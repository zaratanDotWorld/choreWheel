const { db } = require('../db');
const { getMonthStart, getPrevMonthEnd } = require('../utils');

const {
  heartsMinPctInitial,
  heartsMinPctFinal,
  heartsBaseline,
  heartsPollLength,
  karmaDelay,
  karmaMaxHearts,
  heartsRegen,
  heartsCriticalNum
} = require('../config');

const Admin = require('./admin');
const Polls = require('./polls');
const { PowerRanker } = require('./power');

// Hearts

exports.getHeart = async function (houseId, residentId, currentTime) {
  return db('Heart')
    .where({ houseId: houseId, residentId: residentId, generatedAt: currentTime })
    .first();
};

exports.getAgnosticHeart = async function (houseId, currentTime) {
  return db('Heart')
    .where({ houseId: houseId, generatedAt: currentTime })
    .first();
};

exports.getHearts = async function (houseId, residentId, currentTime) {
  return db('Heart')
    .where({ houseId, residentId })
    .where('generatedAt', '<=', currentTime)
    .sum('value')
    .first();
};

exports.getHouseHearts = async function (houseId, currentTime) {
  return db('Heart')
    .join('Resident', 'Heart.residentId', 'Resident.slackId')
    .where('Heart.houseId', houseId)
    .where('Resident.active', true)
    .where('generatedAt', '<=', currentTime)
    .groupBy('residentId')
    .select('residentId')
    .sum('value')
    .orderBy('sum', 'desc');
};

exports.generateHearts = async function (houseId, residentId, value, generatedAt) {
  return db('Heart')
    .insert({ houseId, residentId, generatedAt, value })
    .returning('*');
};

exports.initialiseResident = async function (houseId, residentId, currentTime) {
  const hearts = await exports.getHearts(houseId, residentId, currentTime);
  if (hearts.sum === null) {
    return exports.generateHearts(houseId, residentId, heartsBaseline, currentTime);
  } else { return []; }
};

exports.regenerateHearts = async function (houseId, residentId, currentTime) {
  const regenTime = getMonthStart(currentTime);
  if (currentTime < regenTime) { return []; }

  const regeneration = await exports.getHeart(houseId, residentId, regenTime);
  if (regeneration === undefined) {
    const hearts = await exports.getHearts(houseId, residentId, regenTime);
    if (hearts.sum === null) { return []; } // Don't regenerate if not initialized

    const regenAmount = Math.min(heartsRegen, Math.max(0, heartsBaseline - hearts.sum)); // Bring to baseline
    return exports.generateHearts(houseId, residentId, regenAmount, regenTime);
  } else { return []; }
};

// Challenges

exports.issueChallenge = async function (houseId, challengerId, challengeeId, numHearts, challengedAt) {
  const [ poll ] = await Polls.createPoll(challengedAt, heartsPollLength);

  return db('HeartChallenge')
    .insert({
      houseId: houseId,
      challengerId: challengerId,
      challengeeId: challengeeId,
      challengedAt: challengedAt,
      value: numHearts,
      pollId: poll.id
    })
    .returning('*');
};

exports.getChallenge = async function (challengeId) {
  return db('HeartChallenge')
    .select('*')
    .where('id', challengeId)
    .first();
};

exports.getChallengeQuorum = async function (houseId, challengeeId, value, challengedAt) {
  const residents = await Admin.getResidents(houseId);
  const challengeeHearts = await exports.getHearts(houseId, challengeeId, challengedAt);
  return (challengeeHearts.sum - value <= heartsCriticalNum)
    ? Math.ceil(residents.length * heartsMinPctFinal)
    : Math.ceil(residents.length * heartsMinPctInitial);
};

exports.resolveChallenge = async function (challengeId, resolvedAt) {
  const challenge = await exports.getChallenge(challengeId);

  if (challenge.heartId !== null) { throw new Error('Challenge already resolved!'); }

  const poll = await Polls.getPoll(challenge.pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  // Challenger wins with a majority and minimum quorum
  const quorum = await exports.getChallengeQuorum(challenge.houseId, challenge.challengeeId, challenge.value, challenge.challengedAt);
  const { yays, nays } = await Polls.getPollResultCounts(challenge.pollId);
  const loser = (yays >= quorum && yays > nays)
    ? challenge.challengeeId
    : challenge.challengerId;

  const [ heart ] = await exports.generateHearts(challenge.houseId, loser, -challenge.value, resolvedAt);

  return db('HeartChallenge')
    .where({ id: challengeId })
    .update({ resolvedAt: resolvedAt, heartId: heart.id })
    .returning('*');
};

exports.resolveChallenges = async function (houseId, currentTime) {
  const resolvableChallenges = await db('HeartChallenge')
    .join('Poll', 'HeartChallenge.pollId', 'Poll.id')
    .where('HeartChallenge.houseId', houseId)
    .where('Poll.endTime', '<=', currentTime)
    .where('HeartChallenge.resolvedAt', null)
    .select('HeartChallenge.id');

  for (const challenge of resolvableChallenges) {
    await exports.resolveChallenge(challenge.id, currentTime);
  }
};

// Karma

exports.getKarma = async function (houseId, startTime, endTime) {
  return db('HeartKarma')
    .where({ houseId })
    .whereBetween('givenAt', [ startTime, endTime ])
    .select('*');
};

exports.giveKarma = async function (houseId, giverId, receiverId, givenAt) {
  return db('HeartKarma')
    .insert({ houseId, giverId, receiverId, givenAt })
    .returning('*');
};

exports.getKarmaRankings = async function (houseId, startTime, endTime) {
  const residents = await Admin.getResidents(houseId);
  const karma = await exports.getKarma(houseId, startTime, endTime);
  if (karma.length === 0) { return []; }

  const residentSet = new Set(residents.map(r => r.slackId));
  const formattedKarma = karma.map(k => {
    return { alpha: k.receiverId, beta: k.giverId, preference: 1 };
  });

  const powerRanker = new PowerRanker(residentSet, formattedKarma, residents.length, 0);
  const rankings = powerRanker.run();

  return residents.map(resident => {
    return { id: resident.id, slackId: resident.slackId, ranking: rankings.get(resident.slackId) };
  }).sort((a, b) => b.ranking - a.ranking);
};

exports.generateKarmaHeart = async function (houseId, currentTime) {
  const monthStart = getMonthStart(currentTime);
  const generationTime = new Date(monthStart.getTime() + karmaDelay);
  if (currentTime < generationTime) { return []; }

  const karmaHeart = await exports.getAgnosticHeart(houseId, generationTime);
  if (karmaHeart === undefined) {
    const prevMonthEnd = getPrevMonthEnd(currentTime);
    const prevMonthStart = getMonthStart(prevMonthEnd);
    const karmaRankings = await exports.getKarmaRankings(houseId, prevMonthStart, prevMonthEnd);
    if (karmaRankings.length === 0) { return []; }

    const winnerId = karmaRankings[0].slackId;
    const winnerHearts = await exports.getHearts(houseId, winnerId, generationTime);
    const karmaAmount = Math.min(1, Math.max(0, karmaMaxHearts - winnerHearts.sum)); // Bring to maximum
    return exports.generateHearts(houseId, winnerId, karmaAmount, generationTime);
  } else { return []; }
};
