const sha256 = require('js-sha256');

const { db } = require('./db');

const Admin = require('./admin');

exports.createPoll = async function (houseId, startTime, duration, minVotes) {
  const endTime = new Date(startTime.getTime() + duration);
  return db('Poll')
    .insert({ houseId, startTime, endTime, minVotes })
    .returning('*');
};

exports.getPoll = async function (pollId) {
  return db('Poll')
    .select('*')
    .where('id', pollId)
    .first();
};

exports.submitVote = async function (pollId, residentId, submittedAt, vote) {
  const poll = await exports.getPoll(pollId);
  const resident = await Admin.getResident(residentId);
  const encryptedResidentId = sha256(process.env.SALT + residentId);

  // TODO: remove first clause post-migration
  if (poll.houseId && poll.houseId !== resident.houseId) { throw new Error('Invalid user for poll!'); }
  if (poll.endTime <= submittedAt) { throw new Error('Poll has closed!'); }

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

exports.isPollValid = async function (pollId, now) {
  const poll = await exports.getPoll(pollId);

  if (now < poll.endTime) { throw new Error('Poll not closed!'); }

  const { yays, nays } = await exports.getPollResultCounts(pollId);
  return (yays >= poll.minVotes && yays > nays);
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
