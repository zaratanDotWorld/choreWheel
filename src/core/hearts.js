const { db } = require('./db');

const { getMonthStart, getPrevMonthEnd } = require('../utils');
const { HEART_TYPE_REGEN, HEART_TYPE_CHALLENGE, HEART_TYPE_KARMA } = require('../constants');

const {
  heartsMinPctInitial,
  heartsMinPctCritical,
  heartsBaseline,
  heartsPollLength,
  karmaDelay,
  karmaProportion,
  karmaMaxHearts,
  heartsRegen,
  heartsCriticalNum
} = require('../config');

const Admin = require('./admin');
const Polls = require('./polls');
const { PowerRanker } = require('./power');

// Hearts

exports.getHeart = async function (residentId, generatedAt) {
  return db('Heart')
    .where({ residentId, generatedAt })
    .first();
};

exports.getAgnosticHearts = async function (houseId, generatedAt) {
  return db('Heart')
    .where({ houseId, generatedAt });
};

exports.getHearts = async function (residentId, currentTime) {
  return db('Heart')
    .where({ residentId })
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

exports.generateHearts = async function (houseId, residentId, type, generatedAt, value) {
  return db('Heart')
    .insert({ houseId, residentId, type, generatedAt, value })
    .returning('*');
};

exports.initialiseResident = async function (houseId, residentId, currentTime) {
  const hearts = await exports.getHearts(residentId, currentTime);
  if (hearts.sum === null) {
    return exports.generateHearts(houseId, residentId, HEART_TYPE_REGEN, currentTime, heartsBaseline);
  } else { return []; }
};

exports.regenerateHearts = async function (houseId, residentId, currentTime) {
  const regenTime = getMonthStart(currentTime);
  if (currentTime < regenTime) { return []; }

  const regeneration = await exports.getHeart(residentId, regenTime);
  if (regeneration === undefined) {
    const hearts = await exports.getHearts(residentId, regenTime);
    if (hearts.sum === null) { return []; } // Don't regenerate if not initialized

    const regenAmount = Math.min(heartsRegen, Math.max(0, heartsBaseline - hearts.sum)); // Bring to baseline
    return exports.generateHearts(houseId, residentId, HEART_TYPE_REGEN, regenTime, regenAmount);
  } else { return []; }
};

// Challenges

exports.issueChallenge = async function (houseId, challengerId, challengeeId, value, challengedAt, circumstance) {
  const [ poll ] = await Polls.createPoll(challengedAt, heartsPollLength);

  return db('HeartChallenge')
    .insert({ houseId, challengerId, challengeeId, challengedAt, value, pollId: poll.id, metadata: { circumstance } })
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
  const challengeeHearts = await exports.getHearts(challengeeId, challengedAt);
  return (challengeeHearts.sum - value <= heartsCriticalNum)
    ? Math.ceil(residents.length * heartsMinPctCritical)
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

  const [ heart ] = await exports.generateHearts(challenge.houseId, loser, HEART_TYPE_CHALLENGE, resolvedAt, -challenge.value);

  return db('HeartChallenge')
    .where({ id: challengeId })
    .update({ resolvedAt, heartId: heart.id })
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

exports.getKarmaRecipients = function (message) {
  const regex = /<@(\w+)>\s*\+\+/g; // Matches`<@username>++`
  const matches = [];

  let match;
  while ((match = regex.exec(message))) {
    matches.push(match[1]);
  }

  return matches;
};

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

  // TODO: Update PowerRanker to handle 0 implicit pref
  const powerRanker = new PowerRanker(residentSet, formattedKarma, residents.length, 0.01);
  const rankings = powerRanker.run();

  return residents.map(resident => {
    return { id: resident.id, slackId: resident.slackId, ranking: rankings.get(resident.slackId) };
  }).sort((a, b) => b.ranking - a.ranking);
};

exports.getNumKarmaWinners = async function (houseId) {
  const residents = await Admin.getResidents(houseId);
  return Math.floor(residents.length / karmaProportion);
};

exports.generateKarmaHearts = async function (houseId, currentTime, numWinners) {
  const monthStart = getMonthStart(currentTime);
  const generatedAt = new Date(monthStart.getTime() + karmaDelay);
  if (currentTime < generatedAt) { return []; }

  const karmaHearts = await exports.getAgnosticHearts(houseId, generatedAt);
  if (karmaHearts.length === 0) {
    const prevMonthEnd = getPrevMonthEnd(currentTime);
    const prevMonthStart = getMonthStart(prevMonthEnd);
    const karmaRankings = await exports.getKarmaRankings(houseId, prevMonthStart, prevMonthEnd);
    if (karmaRankings.length === 0) { return []; }

    for (const winner of karmaRankings.slice(0, numWinners)) {
      const residentId = winner.slackId;
      const type = HEART_TYPE_KARMA;
      const residentHearts = await exports.getHearts(residentId, generatedAt);
      const value = Math.min(1, Math.max(0, karmaMaxHearts - residentHearts.sum)); // Bring to maximum
      const metadata = { ranking: winner.ranking };
      karmaHearts.push({ houseId, residentId, type, generatedAt, value, metadata });
    }

    return db('Heart').insert(karmaHearts).returning('*');
  } else { return []; }
};
