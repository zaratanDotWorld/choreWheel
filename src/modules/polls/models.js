const sha256 = require('js-sha256');

const { db, errorLogger } = require('./../../db');
const { defaultPollLength } = require('./../../config');


exports.createPoll = async function createPoll(duration = defaultPollLength) {
  return db('poll')
    .insert({ duration: duration })
    .returning('id')
    .catch(errorLogger);
}

exports.getPoll = async function getPoll(pollId) {
  return db('poll')
    .select('*')
    .where('id', pollId)
    .first()
    .catch(errorLogger);
}

exports.submitVote = async function submitVote(pollId, userId, vote) {
  const encryptedUserId = sha256(process.env.SALT + userId);
  const poll = await exports.getPoll(pollId);
  const endsAt = new Date(poll.created_at.getTime() + poll.duration)

  if (endsAt < Date.now()) { throw new Error('Poll has closed!'); }

  return db('poll_vote')
    .insert({
      poll_id: pollId,
      encrypted_user_id: encryptedUserId,
      vote: vote
    })
    .onConflict(['poll_id', 'encrypted_user_id']).merge()
    .catch(errorLogger);
}

exports.getVotes = async function getVotes(pollId) {
  return db('poll_vote')
    .where('poll_id', pollId)
    .catch(errorLogger)
}

exports.getResults = async function getResults(pollId) {
  const poll = await exports.getPoll(pollId);
  const endsAt =  new Date(poll.created_at.getTime() + poll.duration)

  return db('poll_vote')
    .where('poll_id', pollId)
    .whereBetween('updated_at', [poll.created_at, endsAt])
    .catch(errorLogger)
}

exports.getResult = async function getResult(pollId) {
  const votes = await exports.getResults(pollId);
  const yays = votes.filter(v => v.vote === true).length;
  const nays = votes.filter(v => v.vote === false).length;
  return (yays > nays);
}
