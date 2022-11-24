const { db } = require('../db');
const { HOUR, DAY } = require('../constants');
const { getMonthStart, getMonthEnd, getPrevMonthEnd, getNextMonthStart, getDateStart } = require('../utils');

const {
  pointsPerResident,
  inflationFactor,
  bootstrapDuration,
  choresMinVotes,
  penaltyIncrement,
  penaltyDelay,
  choresPollLength,
  implicitPref
} = require('../config');

const Admin = require('./admin');
const Hearts = require('./hearts');
const Polls = require('./polls');
const { PowerRanker } = require('./power');

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

// Chore Values

exports.getChoreValue = async function (choreId, startTime, endTime) {
  return db('ChoreValue')
    .where({ choreId })
    .where('valuedAt', '>', startTime)
    .where('valuedAt', '<=', endTime)
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
  const residents = await Admin.getResidents(houseId);
  const preferences = await exports.getActiveChorePreferences(houseId);

  const choresSet = new Set(chores.map(c => c.id));
  const formattedPreferences = preferences.map(p => {
    return { alpha: p.alphaChoreId, beta: p.betaChoreId, preference: p.preference };
  });

  const powerRanker = new PowerRanker(choresSet, formattedPreferences, residents.length, implicitPref);
  const rankings = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

  return chores.map(chore => {
    return { id: chore.id, name: chore.name, ranking: rankings.get(chore.id) };
  });
};

exports.getChoreValueIntervalScalar = async function (houseId, currentTime) {
  const lastChoreValue = await exports.getLastChoreValueUpdate(houseId);
  const lastUpdate = (lastChoreValue !== undefined)
    ? lastChoreValue.valuedAt
    : new Date(currentTime.getTime() - bootstrapDuration); // First update assigns a fixed amount of value

  const hoursSinceUpdate = Math.floor((currentTime - lastUpdate) / HOUR);
  const daysInMonth = getMonthEnd(currentTime).getDate();
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

exports.updateChoreValues = async function (houseId, updateTime) {
  // TODO: lock tables during this function call
  const intervalScalar = await exports.getChoreValueIntervalScalar(houseId, updateTime);

  // If we've updated in the last interval, short-circuit execution
  if (intervalScalar === 0) { return Promise.resolve([]); }

  const [ residentCount ] = await exports.getActiveResidentCount(houseId, updateTime);
  const updateScalar = (residentCount.count * pointsPerResident) * intervalScalar * inflationFactor;
  const choreRankings = await exports.getCurrentChoreRankings(houseId);

  const choreValues = choreRankings.map(chore => {
    return {
      choreId: chore.id,
      valuedAt: updateTime,
      value: chore.ranking * updateScalar,
      ranking: chore.ranking,
      residents: residentCount.count
    };
  });

  return db('ChoreValue')
    .insert(choreValues)
    .returning('*');
};

exports.getUpdatedChoreValues = async function (houseId, updateTime) {
  // By doing it this way, we avoid race conditions
  const choreValues = await exports.getCurrentChoreValues(houseId, updateTime);
  const choreValueUpdates = await exports.updateChoreValues(houseId, updateTime);

  // O(n**2), too bad
  choreValues.forEach((choreValue) => {
    const choreValueUpdate = choreValueUpdates.find((update) => update.choreId === choreValue.id);
    choreValue.value += (choreValueUpdate) ? choreValueUpdate.value : 0;
  });

  return choreValues;
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

exports.claimChore = async function (houseId, choreId, slackId, claimedAt) {
  const choreValue = await exports.getCurrentChoreValue(choreId, claimedAt);

  if (choreValue.sum === null) { throw new Error('Cannot claim a zero-value chore!'); }

  const [ poll ] = await Polls.createPoll(claimedAt, choresPollLength);

  return db('ChoreClaim')
    .insert({
      houseId: houseId,
      choreId: choreId,
      claimedBy: slackId,
      claimedAt: claimedAt,
      value: choreValue.sum,
      pollId: poll.id
    })
    .returning('*');
};

exports.resolveChoreClaim = async function (claimId, resolvedAt) {
  const choreClaim = await exports.getChoreClaim(claimId);
  const poll = await Polls.getPoll(choreClaim.pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  let adjustedCurrentValue;
  if (choreClaim.choreId) {
    const choreGifts = await exports.getChorePointGifts(choreClaim.pollId);
    const currentValue = await exports.getCurrentChoreValue(choreClaim.choreId, choreClaim.claimedAt);
    const sumGifts = choreGifts.reduce((sum, gift) => sum + gift.value, 0);
    adjustedCurrentValue = currentValue.sum - sumGifts;
  } else {
    adjustedCurrentValue = choreClaim.value;
  }

  const { yays, nays } = await Polls.getPollResultCounts(choreClaim.pollId);
  const valid = (yays >= choresMinVotes && yays > nays);
  const choreValue = valid ? adjustedCurrentValue : 0;

  return db('ChoreClaim')
    .where({ id: claimId, resolvedAt: null }) // Cannot resolve twice
    .update({ value: choreValue, resolvedAt: resolvedAt, valid: valid })
    .returning('*');
};

exports.resolveChoreClaims = async function (houseId, currentTime) {
  const resolvableChoreClaims = await db('ChoreClaim')
    .join('Poll', 'ChoreClaim.pollId', 'Poll.id')
    .where('ChoreClaim.houseId', houseId)
    .where('ChoreClaim.resolvedAt', null)
    .where('Poll.endTime', '<=', currentTime)
    .select('ChoreClaim.id');

  for (const choreClaim of resolvableChoreClaims) {
    await exports.resolveChoreClaim(choreClaim.id, currentTime);
  }
};

exports.getChorePoints = async function (residentId, choreId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy: residentId, choreId: choreId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .sum('value')
    .first();
};

exports.getAllChorePoints = async function (residentId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy: residentId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .sum('value')
    .first();
};

// Chore Breaks

exports.addChoreBreak = async function (residentId, startDate, endDate) {
  return db('ChoreBreak')
    .insert({ residentId, startDate, endDate })
    .returning('*');
};

exports.deleteChoreBreak = async function (choreBreakId) {
  return db('ChoreBreak')
    .where({ id: choreBreakId })
    .del();
};

exports.getActiveResidentCount = async function (houseId, now) {
  return db('Resident')
    .fullOuterJoin('ChoreBreak', 'Resident.slackId', 'ChoreBreak.residentId')
    .where('Resident.houseId', houseId)
    .where('Resident.active', true)
    .where(function () { // Want residents NOT currently on a break
      this.where('ChoreBreak.startDate', '>', now).orWhereNull('ChoreBreak.startDate')
        .orWhere('ChoreBreak.endDate', '<=', now).orWhereNull('ChoreBreak.endDate');
    })
    .countDistinct('Resident.slackId');
};

exports.getActiveResidentPercentage = async function (residentId, now) {
  const monthStart = getMonthStart(now);
  const monthEnd = getMonthEnd(now);

  const choreBreaks = await db('ChoreBreak')
    .where({ residentId })
    .where(function () { // Either startDate or endDate is betwen monthStart and monthEnd
      this.whereBetween('startDate', [ monthStart, monthEnd ])
        .orWhereBetween('endDate', [ monthStart, monthEnd ]);
    })
    .select('*');

  // Add an implicit break the month the resident is added
  const resident = await Admin.getResident(residentId);
  if (monthStart < resident.activeAt) {
    const activeAt = getDateStart(resident.activeAt);
    choreBreaks.push({ startDate: monthStart, endDate: activeAt });
  }

  // TODO: implement this more efficiently... currently O(n) but could probably be O(1)
  const daysInMonth = monthEnd.getDate();
  const activeDays = new Map([ ...Array(daysInMonth).keys() ].map(day => [ day, true ]));

  for (const choreBreak of choreBreaks) {
    let startDate = new Date(Math.max(choreBreak.startDate, monthStart));
    const endDate = new Date(Math.min(choreBreak.endDate, getNextMonthStart(monthEnd)));
    while (startDate < endDate) {
      activeDays.set(startDate.getDate() - 1, false);
      startDate = new Date(startDate.getTime() + DAY);
    }
  }
  const numActiveDays = Array.from(activeDays.values()).filter(active => active).length;
  return numActiveDays / daysInMonth;
};

exports.addChorePenalty = async function (houseId, residentId, currentTime) {
  const monthStart = getMonthStart(currentTime);
  const penaltyTime = new Date(monthStart.getTime() + penaltyDelay);
  if (currentTime < penaltyTime) { return []; }

  const penalty = await Hearts.getHeart(residentId, penaltyTime);
  if (penalty === undefined) {
    const hearts = await Hearts.getHearts(residentId, penaltyTime);
    if (hearts.sum === null) { return []; } // Don't penalize if not initialized

    const penaltyAmount = await exports.calculatePenalty(residentId, penaltyTime);
    return Hearts.generateHearts(houseId, residentId, -penaltyAmount, penaltyTime);
  } else {
    return [];
  }
};

exports.calculatePenalty = async function (residentId, penaltyTime) {
  const prevMonthEnd = getPrevMonthEnd(penaltyTime);
  const prevMonthStart = getMonthStart(prevMonthEnd);
  const chorePoints = await exports.getAllChorePoints(residentId, prevMonthStart, prevMonthEnd);
  const activePercentage = await exports.getActiveResidentPercentage(residentId, prevMonthEnd);

  const pointsOwed = pointsPerResident * activePercentage;
  const deficiency = Math.max(pointsOwed - chorePoints.sum, 0);
  const truncatedDeficiency = Math.floor(deficiency / penaltyIncrement) * penaltyIncrement;
  return truncatedDeficiency / (4 * penaltyIncrement);
};

// Chore Point Gifting

exports.getLargestChoreClaim = async function (residentId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy: residentId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .orderBy('value', 'desc')
    .first();
};

exports.giftChorePoints = async function (sourceClaimId, recipientId, giftedAt, value) {
  const choreClaim = await exports.getChoreClaim(sourceClaimId);

  return db.transaction(async trx => {
    await trx('ChoreClaim')
      .where({ id: choreClaim.id })
      .update({ value: choreClaim.value - value });

    await trx('ChoreClaim')
      .insert({
        houseId: choreClaim.houseId,
        claimedBy: recipientId,
        claimedAt: giftedAt,
        value: value,
        pollId: choreClaim.pollId
      })
      .returning('*');
  });
};

exports.getChorePointGifts = async function (pollId) {
  return db('ChoreClaim')
    .where({ choreId: null, pollId: pollId })
    .select('*');
};
