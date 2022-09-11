const sha256 = require('js-sha256');

const { db } = require('./../../db');

exports.createPoll = async function (duration) {
  return db('poll')
    .insert({ duration })
    .returning('id');
};

exports.getPoll = async function (pollId) {
  return db('poll')
    .select('*')
    .where('id', pollId)
    .first();
};

exports.submitVote = async function (pollId, residentId, vote) {
  const encryptedResidentId = sha256(process.env.SALT + residentId);
  const poll = await exports.getPoll(pollId);

  if (exports.endsAt(poll) < Date.now()) { throw new Error('Poll has closed!'); }

  return db('poll_vote')
    .insert({
      poll_id: pollId,
      encrypted_resident_id: encryptedResidentId,
      vote: vote
    })
    .onConflict([ 'poll_id', 'encrypted_resident_id' ]).merge();
};

exports.getPollVotes = async function (pollId) {
  return db('poll_vote')
    .where('poll_id', pollId);
};

exports.getPollResults = async function (pollId) {
  const poll = await exports.getPoll(pollId);

  return db('poll_vote')
    .where('poll_id', pollId)
    .whereBetween('updated_at', [ poll.created_at, exports.endsAt(poll) ]);
};

exports.getPollResultCounts = async function (pollId) {
  const votes = await exports.getPollResults(pollId);
  const yays = votes.filter(v => v.vote === true).length;
  const nays = votes.filter(v => v.vote === false).length;
  return { yays, nays };
};

exports.endsAt = function (poll) {
  return new Date(poll.created_at.getTime() + poll.duration);
};
