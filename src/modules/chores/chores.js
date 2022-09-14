const { db } = require('../../db');

const Polls = require('../polls/polls');

// Chores

exports.addChore = async function (choreName) {
  return db('chore')
    .insert({ name: choreName })
    .returning('id');
};

exports.getChores = async function () {
  return db('chore')
    .select('*');
};

// Chore Preferences

exports.getChorePreferences = async function () {
  return db('chore_pref')
    .select('alpha_chore', 'beta_chore', 'preference');
};

exports.setChorePreference = async function (slackId, alphaChore, betaChore, preference) {
  return db('chore_pref')
    .insert({
      preferred_by: slackId,
      alpha_chore: alphaChore,
      beta_chore: betaChore,
      preference: preference
    })
    .onConflict([ 'preferred_by', 'alpha_chore', 'beta_chore' ])
    .merge();
};

exports.formatPreferencesForRanking = function (preferences) {
  return preferences.map(p => {
    return { alpha: p.alpha_chore, beta: p.beta_chore, preference: p.preference };
  });
};

// Chore Values

exports.getChoreValue = async function (choreName, startTime, endTime) {
  return db('chore_value')
    .where('chore_name', choreName)
    .where('created_at', '>', startTime)
    .where('created_at', '<=', endTime)
    .sum('value')
    .first();
};

exports.getCurrentChoreValue = async function (choreName, claimedAt) {
  const previousClaims = await exports.getValidChoreClaims(choreName);
  const filteredClaims = previousClaims.filter((claim) => claim.claimed_at < claimedAt);
  const previousClaimedAt = (filteredClaims.length === 0) ? new Date(0) : filteredClaims.slice(-1)[0].claimed_at;
  return exports.getChoreValue(choreName, previousClaimedAt, claimedAt);
};

exports.setChoreValues = async function (choreData) {
  return db('chore_value')
    .insert(choreData);
};

// Chore Claims

exports.getChoreClaim = async function (claimId) {
  return db('chore_claim')
    .select('*')
    .where({ id: claimId })
    .first();
};

exports.getChoreClaimByMessageId = async function (messageId) {
  return db('chore_claim')
    .select('*')
    .where({ message_id: messageId })
    .first();
};

exports.getValidChoreClaims = async function (choreName) {
  return db('chore_claim')
    .select('*')
    .whereNot({ result: 'fail' })
    .andWhere({ chore_name: choreName });
};

exports.claimChore = async function (choreName, slackId, messageId, duration) {
  const [ poll ] = await Polls.createPoll(duration);

  const claimedAt = new Date();
  const choreValue = await exports.getCurrentChoreValue(choreName, claimedAt);

  return db('chore_claim')
    .insert({
      chore_name: choreName,
      claimed_by: slackId,
      claimed_at: claimedAt,
      message_id: messageId,
      value: choreValue.sum,
      poll_id: poll.id
    })
    .returning([ 'id', 'poll_id' ]);
};

exports.resolveChoreClaim = async function (claimId) {
  const choreClaim = await exports.getChoreClaim(claimId);

  if (choreClaim.result !== 'unknown') { throw new Error('Claim already resolved!'); }

  const pollId = choreClaim.poll_id;
  const poll = await Polls.getPoll(pollId);

  if (Date.now() < Polls.endsAt(poll)) { throw new Error('Poll not closed!'); }

  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const result = (yays >= 2 && yays > nays) ? 'pass' : 'fail';

  const choreValue = (result === 'pass')
    ? await exports.getCurrentChoreValue(choreClaim.chore_name, choreClaim.claimed_at)
    : { sum: 0 };

  return db('chore_claim')
    .where({ id: claimId })
    .update({ value: choreValue.sum, result: result })
    .returning([ 'value', 'result' ]);
};
