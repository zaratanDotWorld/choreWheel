const { db } = require('../db');

const Admin = require('./admin');
const Polls = require('./polls');

const { PowerRanker } = require('./power');

const { HOUR } = require('../constants');

// Chores

exports.addChore = async function (houseId, name) {
  return db('Chore')
    .insert({ houseId: houseId, name: name, active: true })
    .onConflict([ 'houseId', 'name' ]).merge()
    .returning('*');
};

exports.deleteChore = async function (houseId, name) {
  return db('Chore')
    .where({ houseId, name })
    .update({ active: false });
};

exports.getChores = async function (houseId) {
  return db('Chore')
    .select('*')
    .where({ houseId })
    .where('active', true);
};

// Chore Preferences

exports.getChorePreferences = async function (houseId) {
  return db('ChorePref')
    .where({ houseId })
    .select('alphaChoreId', 'betaChoreId', 'preference');
};

exports.getActiveChorePreferences = async function (houseId) {
  return db('ChorePref')
    .join('Chore AS AlphaChore', 'ChorePref.alphaChoreId', 'AlphaChore.id')
    .join('Chore AS BetaChore', 'ChorePref.betaChoreId', 'BetaChore.id')
    .join('Resident', 'ChorePref.residentId', 'Resident.slackId')
    .where('ChorePref.houseId', houseId)
    .where('Resident.active', true)
    .where('AlphaChore.active', true)
    .where('BetaChore.active', true)
    .select('alphaChoreId', 'betaChoreId', 'preference');
};

exports.setChorePreference = async function (houseId, slackId, alphaChoreId, betaChoreId, preference) {
  return db('ChorePref')
    .insert({
      houseId: houseId,
      residentId: slackId,
      alphaChoreId: alphaChoreId,
      betaChoreId: betaChoreId,
      preference: preference
    })
    .onConflict([ 'houseId', 'residentId', 'alphaChoreId', 'betaChoreId' ]).merge();
};

exports.formatPreferencesForRanking = function (preferences) {
  return preferences.map(p => {
    return { alpha: p.alphaChoreId, beta: p.betaChoreId, preference: p.preference };
  });
};

// Chore Values

exports.getChoreValue = async function (choreId, startTime, endTime) {
  return db('ChoreValue')
    .where({ choreId })
    .whereBetween('createdAt', [ startTime, endTime ])
    .sum('value')
    .first();
};

exports.getCurrentChoreValue = async function (choreId, currentTime) {
  const previousClaims = await exports.getValidChoreClaims(choreId);
  const filteredClaims = previousClaims.filter((claim) => claim.claimedAt < currentTime);
  const previousClaimedAt = (filteredClaims.length === 0) ? new Date(0) : filteredClaims.slice(-1)[0].claimedAt;
  return exports.getChoreValue(choreId, previousClaimedAt, currentTime);
};

exports.getCurrentChoreValues = async function (houseId, currentTime) {
  const choreValues = [];
  const chores = await exports.getChores(houseId);

  for (const chore of chores) {
    const choreValue = await exports.getCurrentChoreValue(chore.id, currentTime);
    choreValues.push({ id: chore.id, name: chore.name, value: choreValue.sum || 0 });
  }

  return choreValues;
};

exports.getCurrentChoreRankings = async function (houseId) {
  const chores = await exports.getChores(houseId);
  const preferences = await exports.getActiveChorePreferences(houseId);
  const residents = await Admin.getResidents(houseId);

  const formattedPreferences = exports.formatPreferencesForRanking(preferences);
  const powerRanker = new PowerRanker(chores, formattedPreferences, residents.length);
  return powerRanker.run(d = 0.8); // eslint-disable-line no-undef
};

exports.getChoreValueScalar = async function (houseId, updateInterval, pointsPerResident) {
  const residents = await Admin.getResidents(houseId);
  return (residents.length * pointsPerResident) * updateInterval;
};

exports.getChoreValueIntervalScalar = async function (houseId, currentTime) {
  const lastChoreValue = await exports.getLastChoreValueUpdate(houseId);
  const lastUpdate = (lastChoreValue !== undefined)
    ? lastChoreValue.valuedAt
    : new Date(currentTime.getTime() - (6 * HOUR)); // First update assigns six hours of value

  const hoursSinceUpdate = Math.floor((currentTime - lastUpdate) / HOUR);
  const daysInMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
  const hoursInMonth = 24 * daysInMonth;

  // TODO: handle scenario where interval spans 2 months

  return (hoursSinceUpdate / hoursInMonth);
};

exports.getLastChoreValueUpdate = async function (houseId) {
  return db('ChoreValue')
    .join('Chore', 'ChoreValue.choreId', 'Chore.id')
    .where('Chore.houseId', houseId)
    .orderBy('ChoreValue.valuedAt', 'desc')
    .select('ChoreValue.valuedAt')
    .first();
};

exports.updateChoreValues = async function (houseId, updateTime, pointsPerResident) {
  const intervalScalar = await exports.getChoreValueIntervalScalar(houseId, updateTime);

  // If we've updated in the last interval, short-circuit execution
  if (intervalScalar === 0) { return Promise.resolve(); }

  const residents = await Admin.getResidents(houseId);
  const chores = await exports.getChores(houseId);
  const choreRankings = await exports.getCurrentChoreRankings(houseId);
  const updateScalar = (residents.length * pointsPerResident) * intervalScalar;

  const choreValues = chores.map(chore => {
    const value = choreRankings.get(chore.id) * updateScalar;
    return { choreId: chore.id, valuedAt: updateTime, value: value };
  });

  return db('ChoreValue')
    .insert(choreValues)
    .returning('*');
};

// Chore Claims

exports.getChoreClaim = async function (claimId) {
  return db('ChoreClaim')
    .select('*')
    .where({ id: claimId })
    .first();
};

exports.getValidChoreClaims = async function (choreId) {
  return db('ChoreClaim')
    .select('*')
    .whereNot({ valid: false })
    .andWhere({ choreId });
};

exports.claimChore = async function (choreId, slackId, claimedAt, duration) {
  const choreValue = await exports.getCurrentChoreValue(choreId, claimedAt);

  if (choreValue.sum === null) {
    throw new Error('Cannot claim a zero-value chore!');
  }

  const [ poll ] = await Polls.createPoll(duration);

  return db('ChoreClaim')
    .insert({
      choreId: choreId,
      claimedBy: slackId,
      claimedAt: claimedAt,
      value: choreValue.sum,
      pollId: poll.id
    })
    .returning([ 'id', 'pollId' ]);
};

exports.resolveChoreClaim = async function (claimId, resolvedAt) {
  const choreClaim = await exports.getChoreClaim(claimId);

  const pollId = choreClaim.pollId;
  const poll = await Polls.getPoll(pollId);

  if (resolvedAt.getTime() < Polls.endsAt(poll)) { throw new Error('Poll not closed!'); }

  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const valid = (yays >= 2 && yays > nays);

  const choreValue = valid
    ? await exports.getCurrentChoreValue(choreClaim.choreId, choreClaim.claimedAt)
    : { sum: 0 };

  return db('ChoreClaim')
    .where({ id: claimId, resolvedAt: null }) // Cannot resolve twice
    .update({ value: choreValue.sum, resolvedAt: resolvedAt, valid: valid })
    .returning([ 'value', 'valid' ]);
};

exports.getUserChoreClaims = async function (residentId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy: residentId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .sum('value')
    .first();
};
