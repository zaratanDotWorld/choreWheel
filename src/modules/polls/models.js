const sha256 = require('js-sha256');

const { db, errorLogger } = require('./../../db');
const { defaultPollLength } = require('./../../config');

exports.createPoll = async function (duration = defaultPollLength) {
  return db('poll')
    .insert({ duration })
    .returning('id')
    .catch(errorLogger);
};

exports.getPoll = async function (pollId) {
  return db('poll')
    .select('*')
    .where('id', pollId)
    .first()
    .catch(errorLogger);
};

exports.submitVote = async function (pollId, userId, vote) {
  const encryptedUserId = sha256(process.env.SALT + userId);
  const poll = await exports.getPoll(pollId);

  if (exports.endsAt(poll) < Date.now()) { throw new Error('Poll has closed!'); }

  return db('poll_vote')
    .insert({
      poll_id: pollId,
      encrypted_user_id: encryptedUserId,
      vote: vote
    })
    .onConflict([ 'poll_id', 'encrypted_user_id' ]).merge()
    .catch(errorLogger);
};

exports.getVotes = async function (pollId) {
  return db('poll_vote')
    .where('poll_id', pollId)
    .catch(errorLogger);
};

exports.getResults = async function (pollId) {
  const poll = await exports.getPoll(pollId);

  return db('poll_vote')
    .where('poll_id', pollId)
    .whereBetween('updated_at', [ poll.created_at, exports.endsAt(poll) ])
    .catch(errorLogger);
};

exports.getResultCounts = async function (pollId) {
  const votes = await exports.getResults(pollId);
  const yays = votes.filter(v => v.vote === true).length;
  const nays = votes.filter(v => v.vote === false).length;
  return { yays, nays };
};

exports.endsAt = function (poll) {
  return new Date(poll.created_at.getTime() + poll.duration);
};
