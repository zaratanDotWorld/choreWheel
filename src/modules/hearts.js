const { db } = require('../db');
const { heartsMinVotesInitial, heartsBaseline, heartsPollLength } = require('../config');

const Polls = require('./polls');
const { getMonthStart } = require('../utils');

// Hearts

exports.getResidentHearts = async function (residentId, currentTime) {
  return db('Heart')
    .where({ residentId })
    .where('generatedAt', '<=', currentTime)
    .sum('value')
    .first();
};

exports.generateHearts = async function (houseId, residentId, value, generatedAt) {
  return db('Heart')
    .insert({ houseId, residentId, generatedAt, value })
    .returning('*');
};

exports.initialiseResident = async function (houseId, residentId, currentTime) {
  const hearts = await exports.getResidentHearts(residentId, currentTime);
  if (hearts.sum === null) {
    return exports.generateHearts(houseId, residentId, heartsBaseline, currentTime);
  } else {
    return [];
  }
};

exports.regenerateHearts = async function (houseId, residentId, currentTime) {
  const monthStart = getMonthStart(currentTime);
  const [ regenEvents ] = await db('Heart')
    .where({ residentId: residentId, generatedAt: monthStart })
    .count();
  if (regenEvents.count === '0') {
    const hearts = await exports.getResidentHearts(residentId, currentTime);
    const regenAmount = Math.min(1, Math.max(0, heartsBaseline - hearts.sum)); // Bring to baseline
    return exports.generateHearts(houseId, residentId, regenAmount, monthStart);
  } else {
    return [];
  }
};

// Challenges

exports.issueChallenge = async function (houseId, challenger, challengee, numHearts, challengeTime) {
  const [ poll ] = await Polls.createPoll(challengeTime, heartsPollLength);

  return db('HeartChallenge')
    .insert({
      houseId: houseId,
      challenger: challenger,
      challengee: challengee,
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

exports.resolveChallenge = async function (challengeId, resolvedAt) {
  const challenge = await exports.getChallenge(challengeId);

  if (challenge.heartId !== null) { throw new Error('Challenge already resolved!'); }

  const pollId = challenge.pollId;
  const poll = await Polls.getPoll(pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  // Challangers wins with a majority and a minimum of four votes
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const loser = (yays >= heartsMinVotesInitial && yays > nays)
    ? challenge.challengee
    : challenge.challenger;

  const [ heart ] = await exports.generateHearts(challenge.houseId, loser, -challenge.value, resolvedAt);

  return db('HeartChallenge')
    .where({ id: challengeId })
    .update({ resolvedAt: resolvedAt, heartId: heart.id })
    .returning('*');
};
