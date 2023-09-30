const { db } = require('./db');

const { HOUR, DAY, HEART_TYPE_CHORE } = require('../constants');
const { getMonthStart, getMonthEnd, getPrevMonthEnd, getNextMonthStart, getDateStart } = require('../utils');

const {
  pointsPerResident,
  inflationFactor,
  bootstrapDuration,
  choresMinVotes,
  penaltyIncrement,
  penaltyDelay,
  choresPollLength,
  implicitPref,
  dampingFactor,
  choresProposalPollLength,
  choreProposalPct
} = require('../config');

const Admin = require('./admin');
const Hearts = require('./hearts');
const Polls = require('./polls');
const { PowerRanker } = require('./power');

// Chores

exports.addChore = async function (houseId, name, metadata) {
  return db('Chore')
    .insert({ houseId, name, metadata, active: true })
    .onConflict([ 'houseId', 'name' ]).merge()
    .returning('*');
};

// NOTE: also used for deletion
// NOTE: add and edit are distinct actions, since editing supports name changes
exports.editChore = async function (choreId, name, metadata, active) {
  return db('Chore')
    .where({ id: choreId })
    .update({ name, metadata, active })
    .returning('*');
};

exports.getChores = async function (houseId) {
  return db('Chore')
    .select('*')
    .where({ houseId })
    .where('active', true);
};

exports.getChore = async function (choreId) {
  return db('Chore')
    .select('*')
    .where({ id: choreId })
    .first();
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

exports.setChorePreference = async function (houseId, residentId, alphaChoreId, betaChoreId, preference) {
  return db('ChorePref')
    .insert({ houseId, residentId, alphaChoreId, betaChoreId, preference })
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
  const latestClaim = await exports.getLatestChoreClaim(choreId, currentTime);
  const latestClaimedAt = (latestClaim === undefined) ? new Date(0) : latestClaim.claimedAt;
  return exports.getChoreValue(choreId, latestClaimedAt, currentTime);
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
  const rankings = powerRanker.run(d = dampingFactor); // eslint-disable-line no-undef

  return chores.map(chore => {
    return { id: chore.id, name: chore.name, ranking: rankings.get(chore.id) };
  }).sort((a, b) => b.ranking - a.ranking);
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

  const residentCount = await exports.getWorkingResidentCount(houseId, updateTime);
  const updateScalar = (residentCount * pointsPerResident) * intervalScalar * inflationFactor;
  const choreRankings = await exports.getCurrentChoreRankings(houseId);

  const choreValues = choreRankings.map(chore => {
    return {
      houseId,
      choreId: chore.id,
      valuedAt: updateTime,
      value: chore.ranking * updateScalar,
      metadata: { ranking: chore.ranking, residents: residentCount }
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

  return choreValues.sort((a, b) => b.value - a.value);
};

// Chore Claims

exports.getChoreClaim = async function (claimId) {
  return db('ChoreClaim')
    .select('*')
    .where({ id: claimId })
    .first();
};

exports.getLatestChoreClaim = async function (choreId, currentTime) {
  return db('ChoreClaim')
    .select('*')
    .where({ choreId })
    .where('claimedAt', '<', currentTime) // TODO: should this be <= ??
    .whereNot({ valid: false })
    .orderBy('claimedAt', 'desc')
    .first();
};

exports.claimChore = async function (houseId, choreId, claimedBy, claimedAt) {
  const choreValue = await exports.getCurrentChoreValue(choreId, claimedAt);

  if (choreValue.sum === null) { throw new Error('Cannot claim a zero-value chore!'); }

  const [ poll ] = await Polls.createPoll(claimedAt, choresPollLength);

  return db('ChoreClaim')
    .insert({ houseId, choreId, claimedBy, claimedAt, value: choreValue.sum, pollId: poll.id })
    .returning('*');
};

exports.resolveChoreClaim = async function (claimId, resolvedAt) {
  const choreClaim = await exports.getChoreClaim(claimId);
  const poll = await Polls.getPoll(choreClaim.pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  const { yays, nays } = await Polls.getPollResultCounts(choreClaim.pollId);
  const valid = (yays >= choresMinVotes && yays > nays);
  const value = await exports.getCurrentChoreValue(choreClaim.choreId, choreClaim.claimedAt);

  return db('ChoreClaim')
    .where({ id: claimId, resolvedAt: null }) // Cannot resolve twice
    .update({ resolvedAt, valid, value: value.sum })
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

exports.getChorePoints = async function (claimedBy, choreId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy, choreId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .sum('value')
    .first();
};

exports.getAllChorePoints = async function (claimedBy, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .sum('value')
    .first();
};

// Chore Breaks

exports.addChoreBreak = async function (houseId, residentId, startDate, endDate, circumstance) {
  return db('ChoreBreak')
    .insert({ houseId, residentId, startDate, endDate, metadata: { circumstance } })
    .returning('*');
};

exports.deleteChoreBreak = async function (choreBreakId) {
  return db('ChoreBreak')
    .where({ id: choreBreakId })
    .del();
};

exports.getChoreBreaks = async function (houseId, now) {
  return db('ChoreBreak')
    .leftJoin('Resident', 'ChoreBreak.residentId', 'Resident.slackId')
    .where('ChoreBreak.houseId', houseId)
    .where('ChoreBreak.startDate', '<=', now)
    .where('ChoreBreak.endDate', '>', now)
    .where('Resident.active', true)
    .where(function () { Admin.residentNotExempt(this, now); })
    .returning('*');
};

exports.getWorkingResidentCount = async function (houseId, now) {
  const residents = await Admin.getWorkingResidents(houseId, now);
  const choreBreaks = await exports.getChoreBreaks(houseId, now);
  return residents.length - (new Set(choreBreaks.map(cb => cb.residentId))).size;
};

exports.getWorkingResidentPercentage = async function (residentId, now) {
  const monthStart = getMonthStart(now);
  const monthEnd = getMonthEnd(now);

  const choreBreaks = await db('ChoreBreak')
    .where({ residentId })
    .where(function () { // Either startDate or endDate is betwen monthStart and monthEnd
      this.whereBetween('startDate', [ monthStart, monthEnd ])
        .orWhereBetween('endDate', [ monthStart, monthEnd ]);
    })
    // .orWhere(function () { // Now falls between startDate & endDate
    //   this.where('startDate', '<=', now)
    //     .where('endDate', '>', now);
    // })
    .select('*');

  // Add an implicit break the month the resident is added or exempted
  const resident = await Admin.getResident(residentId);
  if (monthStart < resident.activeAt) {
    const activeAt = getDateStart(resident.activeAt);
    choreBreaks.push({ startDate: monthStart, endDate: activeAt });
  }
  if (resident.exemptAt !== null & resident.exemptAt < monthEnd) {
    const exemptAt = getDateStart(resident.exemptAt);
    choreBreaks.push({ startDate: exemptAt, endDate: monthEnd });
  }

  // TODO: implement this more efficiently... currently O(n) but could probably be O(1)
  const daysInMonth = monthEnd.getDate();
  const workingDays = new Map([ ...Array(daysInMonth).keys() ].map(day => [ day, true ]));

  for (const choreBreak of choreBreaks) {
    let startDate = new Date(Math.max(choreBreak.startDate, monthStart));
    const endDate = new Date(Math.min(choreBreak.endDate, getNextMonthStart(monthEnd)));
    while (startDate < endDate) {
      workingDays.set(startDate.getDate() - 1, false);
      startDate = new Date(startDate.getTime() + DAY);
    }
  }
  const numWorkingDays = Array.from(workingDays.values()).filter(x => x).length;
  return numWorkingDays / daysInMonth;
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
    return Hearts.generateHearts(houseId, residentId, HEART_TYPE_CHORE, penaltyTime, -penaltyAmount);
  } else {
    return [];
  }
};

exports.calculatePenalty = async function (residentId, penaltyTime) {
  const prevMonthEnd = getPrevMonthEnd(penaltyTime);
  const prevMonthStart = getMonthStart(prevMonthEnd);
  const chorePoints = await exports.getAllChorePoints(residentId, prevMonthStart, prevMonthEnd);
  const workingPercentage = await exports.getWorkingResidentPercentage(residentId, prevMonthEnd);

  const pointsOwed = pointsPerResident * workingPercentage;
  const deficiency = Math.max(pointsOwed - chorePoints.sum, 0);
  const truncatedDeficiency = Math.floor(deficiency / penaltyIncrement) * penaltyIncrement;
  return truncatedDeficiency / (2 * penaltyIncrement);
};

// Chore Point Gifting

exports.getLargestChoreClaim = async function (residentId, startTime, endTime) {
  return db('ChoreClaim')
    .where({ claimedBy: residentId, valid: true })
    .whereBetween('claimedAt', [ startTime, endTime ])
    .orderBy('value', 'desc')
    .first();
};

exports.giftChorePoints = async function (houseId, gifterId, recipientId, giftedAt, value) {
  const monthStart = getMonthStart(giftedAt);
  const gifterChorePoints = await exports.getAllChorePoints(gifterId, monthStart, giftedAt);

  if (gifterChorePoints.sum < value) { throw new Error('Cannot gift more than the points balance!'); }

  await db('ChoreClaim')
    .insert([
      { houseId, claimedBy: gifterId, claimedAt: giftedAt, value: -value },
      { houseId, claimedBy: recipientId, claimedAt: giftedAt, value }
    ])
    .returning('*');
};

// Chore Proposals

exports.createChoreProposal = async function (houseId, proposedBy, choreId, name, metadata, active, now) {
  // TODO: Can this be done as a table constraint?
  if (!(choreId || name)) { throw new Error('Proposal must include either choreId or name!'); }

  const [ poll ] = await Polls.createPoll(now, choresProposalPollLength);

  return db('ChoreProposal')
    .insert({ houseId, proposedBy, choreId, name, metadata, active, pollId: poll.id })
    .returning('*');
};

exports.getChoreProposal = async function (proposalId) {
  return db('ChoreProposal')
    .select('*')
    .where({ id: proposalId })
    .first();
};

exports.getChoreProposalMinVotes = async function (houseId) {
  const residents = await Admin.getResidents(houseId);
  return Math.ceil(choreProposalPct * residents.length);
};

exports.resolveChoreProposal = async function (proposalId, now) {
  const proposal = await exports.getChoreProposal(proposalId);
  if (proposal.resolvedAt !== null) { throw new Error('Proposal already resolved!'); }

  const poll = await Polls.getPoll(proposal.pollId);
  if (now < poll.endTime) { throw new Error('Poll not closed!'); }

  const minVotes = await exports.getChoreProposalMinVotes(proposal.houseId);
  const valid = await Polls.isPollValid(proposal.pollId, minVotes);

  if (valid) {
    if (!proposal.choreId) {
      await exports.addChore(proposal.houseId, proposal.name, proposal.metadata);
    } else {
      await exports.editChore(proposal.choreId, proposal.name, proposal.metadata, proposal.active);
    }
  }

  return db('ChoreProposal')
    .where({ id: proposalId })
    .update({ resolvedAt: now })
    .returning('*');
};

exports.resolveChoreProposals = async function (houseId, now) {
  const resolveableChoreProposals = await db('ChoreProposal')
    .join('Poll', 'ChoreProposal.pollId', 'Poll.id')
    .where('ChoreProposal.houseId', houseId)
    .where('Poll.endTime', '<=', now)
    .where('ChoreProposal.resolvedAt', null)
    .orderBy('Poll.endTime') // Ensure sequential resolution
    .select('ChoreProposal.id');

  for (const proposal of resolveableChoreProposals) {
    await exports.resolveChoreProposal(proposal.id, now);
  }
};
