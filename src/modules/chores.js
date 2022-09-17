const { db } = require('../db');

const Polls = require('./polls');

// Chores

exports.addChore = async function (houseId, choreName) {
  return db('chore')
    .insert({ house_id: houseId, name: choreName, active: true })
    .onConflict([ 'house_id', 'name' ]).merge()
    .returning('id');
};

exports.deleteChore = async function (houseId, choreName) {
  return db('chore')
    .where({ house_id: houseId, name: choreName })
    .update({ active: false });
};

exports.getChores = async function (houseId) {
  return db('chore')
    .select('*')
    .where('house_id', houseId)
    .where('active', true);
};

// Chore Preferences

exports.getChorePreferences = async function (houseId) {
  return db('chore_pref')
    .where('house_id', houseId)
    .select('alpha_chore_id', 'beta_chore_id', 'preference');
};

exports.setChorePreference = async function (houseId, slackId, alphaChoreId, betaChoreId, preference) {
  return db('chore_pref')
    .insert({
      house_id: houseId,
      preferred_by: slackId,
      alpha_chore_id: alphaChoreId,
      beta_chore_id: betaChoreId,
      preference: preference
    })
    .onConflict([ 'house_id', 'preferred_by', 'alpha_chore_id', 'beta_chore_id' ]).merge();
};

exports.formatPreferencesForRanking = function (preferences) {
  return preferences.map(p => {
    return { alpha: p.alpha_chore_id, beta: p.beta_chore_id, preference: p.preference };
  });
};

// Chore Values

exports.getChoreValue = async function (choreId, startTime, endTime) {
  return db('chore_value')
    .where('chore_id', choreId)
    .where('created_at', '>', startTime)
    .where('created_at', '<=', endTime)
    .sum('value')
    .first();
};

exports.getCurrentChoreValue = async function (choreId, claimedAt) {
  const previousClaims = await exports.getValidChoreClaims(choreId);
  const filteredClaims = previousClaims.filter((claim) => claim.claimed_at < claimedAt);
  const previousClaimedAt = (filteredClaims.length === 0) ? new Date(0) : filteredClaims.slice(-1)[0].claimed_at;
  return exports.getChoreValue(choreId, previousClaimedAt, claimedAt);
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

exports.getValidChoreClaims = async function (choreId) {
  return db('chore_claim')
    .select('*')
    .whereNot({ result: 'fail' })
    .andWhere({ chore_id: choreId });
};

exports.claimChore = async function (choreId, slackId, messageId, duration) {
  const [ poll ] = await Polls.createPoll(duration);

  const claimedAt = new Date();
  const choreValue = await exports.getCurrentChoreValue(choreId, claimedAt);

  return db('chore_claim')
    .insert({
      chore_id: choreId,
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
    ? await exports.getCurrentChoreValue(choreClaim.chore_id, choreClaim.claimed_at)
    : { sum: 0 };

  return db('chore_claim')
    .where({ id: claimId })
    .update({ value: choreValue.sum, result: result })
    .returning([ 'value', 'result' ]);
};
