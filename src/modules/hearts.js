const { db } = require('../db');

const Polls = require('./polls');

exports.getResidentHearts = async function (slackId) {
  return db('heart')
    .where('resident', slackId)
    .sum('value')
    .first();
};

exports.generateHearts = async function (slackId, numHearts) {
  return db('heart')
    .insert({ resident: slackId, value: numHearts })
    .returning('id');
};

exports.initiateChallenge = async function (challenger, challengee, numHearts, duration) {
  const [ poll ] = await Polls.createPoll(duration);

  return db('heart_challenge')
    .insert({
      challenger: challenger,
      challengee: challengee,
      value: numHearts,
      poll_id: poll.id
    })
    .returning([ 'id', 'poll_id' ]);
};

exports.getChallenge = async function (challengeId) {
  return db('heart_challenge')
    .select('*')
    .where('id', challengeId)
    .first();
};

exports.resolveChallenge = async function (challengeId) {
  const challenge = await exports.getChallenge(challengeId);

  if (challenge.heart_id !== null) { throw new Error('Challenge already resolved!'); }

  const pollId = challenge.poll_id;
  const poll = await Polls.getPoll(pollId);

  if (Date.now() < Polls.endsAt(poll)) { throw new Error('Poll not closed!'); }

  // Challangers wins with a majority and a minimum of four votes
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const loser = (yays >= 4 && yays > nays) ? challenge.challengee : challenge.challenger;

  const [ heart ] = await exports.generateHearts(loser, -challenge.value);

  return db('heart_challenge')
    .where({ id: challengeId })
    .update({ heart_id: heart.id })
    .returning([ 'heart_id' ]);
};
