const sha256 = require('js-sha256');

const { db } = require('./db');

exports.createPoll = async function (startTime, duration) {
  const endTime = new Date(startTime.getTime() + duration);
  return db('Poll')
    .insert({ startTime, endTime })
    .returning('*');
};

exports.getPoll = async function (pollId) {
  return db('Poll')
    .select('*')
    .where('id', pollId)
    .first();
};

exports.submitVote = async function (pollId, residentId, submittedAt, vote) {
  const encryptedResidentId = sha256(process.env.SALT + residentId);
  const poll = await exports.getPoll(pollId);

  if (poll.endTime < submittedAt) { throw new Error('Poll has closed!'); }

  return db('PollVote')
    .insert({ pollId, encryptedResidentId, submittedAt, vote })
    .onConflict([ 'pollId', 'encryptedResidentId' ]).merge()
    .returning('*');
};

exports.getPollVotes = async function (pollId) {
  return db('PollVote')
    .where({ pollId });
};

exports.getPollResults = async function (pollId) {
  // TODO: implement using a join on poll (there's some timestamp issue)
  const poll = await exports.getPoll(pollId);
  return db('PollVote')
    .where({ pollId })
    .whereBetween('submittedAt', [ poll.startTime, poll.endTime ]);
};

exports.getPollResultCounts = async function (pollId) {
  const votes = await exports.getPollResults(pollId);
  const yays = votes.filter(v => v.vote === true).length;
  const nays = votes.filter(v => v.vote === false).length;
  return { yays, nays };
};

exports.isPollValid = async function (pollId, minVotes) {
  const { yays, nays } = await exports.getPollResultCounts(pollId);
  return (yays >= minVotes && yays > nays);
};

exports.updateMetadata = async function (pollId, metadata) {
  // NOTE: May be possible as a single operation using a jsonb datatype
  const poll = await exports.getPoll(pollId);
  metadata = { ...poll.metadata, ...metadata };

  return db('Poll')
    .where({ id: pollId })
    .update({ metadata })
    .returning('*');
};
