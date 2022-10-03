const { db } = require('../db');
const { heartsMinVotesInitial } = require('../config');

const Polls = require('./polls');

// Hearts

exports.getResidentHearts = async function (houseId, residentId) {
  return db('Heart')
    .where({ houseId, residentId })
    .sum('value')
    .first();
};

exports.generateHearts = async function (houseId, residentId, numHearts) {
  return db('Heart')
    .insert({ houseId: houseId, residentId: residentId, value: numHearts })
    .returning('id');
};

// Challenges

exports.initiateChallenge = async function (houseId, challenger, challengee, numHearts, challengeTime, duration) {
  const [ poll ] = await Polls.createPoll(challengeTime, duration);

  return db('HeartChallenge')
    .insert({
      houseId: houseId,
      challenger: challenger,
      challengee: challengee,
      value: numHearts,
      pollId: poll.id
    })
    .returning([ 'id', 'pollId' ]);
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

  const [ heart ] = await exports.generateHearts(challenge.houseId, loser, -challenge.value);

  return db('HeartChallenge')
    .where({ id: challengeId })
    .update({ heartId: heart.id })
    .returning([ 'heartId' ]);
};
