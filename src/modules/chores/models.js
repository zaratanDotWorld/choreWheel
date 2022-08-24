const { db, errorLogger } = require('./../../db');
const { defaultPollLength } = require('./../../config');

const Polls = require('./../polls/models');

exports.getChores = async function getChores() {
  return db('chore')
    .select('*')
    .catch(errorLogger);
}

exports.getChoreValue = async function getChoreValue(choreName, startTime, endTime) {
  return db('chore_value')
    .where('chore_name', choreName )
    .where('created_at', '>', startTime)
    .where('created_at', '<=', endTime)
    .sum('value')
    .first()
    .catch(errorLogger)
}

exports.getCurrentChoreValue = async function getCurrentChoreValue(choreName, claimedAt) {
  const previousClaims = await exports.getChoreClaims(choreName)
  const filteredClaims = previousClaims.filter((claim) => claim.claimed_at < claimedAt);
  const previousClaimedAt = (filteredClaims.length === 0) ? new Date(0) : filteredClaims.slice(-1)[0].claimed_at;
  return exports.getChoreValue(choreName, previousClaimedAt, claimedAt);
}

exports.setChoreValues = async function setChoreValues(choreData) {
  return db('chore_value')
    .insert(choreData)
    .catch(errorLogger)
}

exports.claimChore = async function claimChore(choreName, slackId, claimedAt, messageId, duration = defaultPollLength) {
  const [ pollId ] = await Polls.createPoll(duration);

  const choreValue = await exports.getCurrentChoreValue(choreName, claimedAt);

  return db('chore_claim')
    .insert({
      chore_name: choreName,
      claimed_by: slackId,
      claimed_at: claimedAt,
      message_id: messageId,
      value: choreValue.sum,
      poll_id: pollId,
    })
    .returning(['id', 'poll_id'])
    .catch(errorLogger);
}

exports.resolveChoreClaim = async function resolveChoreClaim(claimId) {
  const [ choreClaim ] = await exports.getChoreClaim(claimId);

  if (choreClaim.result !== 'unknown') { throw new Error('Claim already resolved!'); }

  const pollId = choreClaim.poll_id;
  const poll = await Polls.getPoll(pollId);

  if (Date.now() < Polls.endsAt(poll)) { throw new Error('Poll not closed!'); }

  const { yays, nays } = await Polls.getResultCounts(pollId);
  const result = (yays >= 2 && yays > nays) ? 'pass' : 'fail';

  const choreValue = (result === 'pass') ?
    await exports.getCurrentChoreValue(choreClaim.chore_name, choreClaim.claimed_at) :
    { sum: 0 };

  return db('chore_claim')
    .where({ id: claimId })
    .update({ value: choreValue.sum, result: result })
    .returning(['value', 'result'])
    .catch(errorLogger);
}

exports.getChoreClaim = async function getChoreClaim(claimId) {
  return db('chore_claim')
    .select('*')
    .where({ id: claimId })
    .catch(errorLogger);
}

exports.getChoreClaims = async function getChoreClaims(choreName) {
  return db('chore_claim')
    .select('*')
    .whereNot({ result: 'fail' })
    .andWhere({ chore_name: choreName })
    .catch(errorLogger);
}

exports.setChorePreference = async function setChorePreference(slackId, alphaChore, betaChore, preference) {
  if (alphaChore >= betaChore) throw new Error('Chores out of order');
  return db('chore_pref')
    .insert({
      preferred_by: slackId,
      alpha_chore: alphaChore,
      beta_chore: betaChore,
      preference: preference,
    })
    .onConflict(['preferred_by', 'alpha_chore', 'beta_chore'])
    .merge()
    .catch(errorLogger);
}

exports.getChorePreferences = async function getChorePreferences() {
  return db('chore_pref')
    .select('alpha_chore', 'beta_chore', 'preference')
    .catch(errorLogger);
}
