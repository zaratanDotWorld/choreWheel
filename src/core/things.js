const { db } = require('./db');

const {
  thingsPollLength,
  thingsSpecialPollLength,
  thingsMinVotesScalar,
  thingsMinPctSpecial,
  thingsMaxPct,
  thingsProposalPct,
  thingsProposalPollLength,
} = require('../config');

const Admin = require('./admin');
const Polls = require('./polls');

// Things

exports.addThing = async function (houseId, type, name, value, metadata) {
  return db('Thing')
    .insert({ houseId, type, name, value, metadata, active: true })
    .onConflict([ 'houseId', 'type', 'name' ]).merge()
    .returning('*');
};

// NOTE: also used for deletion
// NOTE: add and edit are distinct actions, since editing supports name changes
exports.editThing = async function (thingId, type, name, value, metadata, active) {
  return db('Thing')
    .where({ id: thingId })
    .update({ type, name, value, metadata, active })
    .returning('*');
};

exports.getThings = async function (houseId) {
  return db('Thing')
    .where({ houseId, active: true })
    .orderBy([ 'type', 'name' ])
    .returning('*');
};

exports.getThing = async function (thingId) {
  return db('Thing')
    .where({ id: thingId })
    .returning('*')
    .first();
};

// Buys

exports.getHouseBalance = async function (houseId, currentTime) {
  return db('ThingBuy')
    .where({ houseId, valid: true })
    .where('boughtAt', '<=', currentTime)
    .sum('value')
    .first();
};

exports.loadHouseAccount = async function (houseId, boughtBy, loadedAt, value) {
  return db('ThingBuy')
    .insert({ houseId, value, boughtBy, boughtAt: loadedAt, resolvedAt: loadedAt })
    .returning('*');
};

exports.buyThing = async function (houseId, thingId, boughtBy, boughtAt, price, quantity) {
  const houseBalance = await exports.getHouseBalance(houseId, boughtAt);
  const totalCost = price * quantity;

  if (houseBalance.sum < totalCost) { throw new Error('Insufficient funds!'); }

  const minVotes = await exports.getThingBuyMinVotes(houseId, thingId, totalCost);
  const [ poll ] = await Polls.createPoll(houseId, boughtAt, thingsPollLength, minVotes);

  return db('ThingBuy')
    .insert({
      houseId,
      thingId,
      boughtBy,
      boughtAt,
      value: -totalCost,
      pollId: poll.id,
      metadata: { quantity },
    })
    .returning('*');
};

exports.buySpecialThing = async function (houseId, boughtBy, boughtAt, price, title, details) {
  const houseBalance = await exports.getHouseBalance(houseId, boughtAt);

  if (houseBalance.sum < price) { throw new Error('Insufficient funds!'); }

  const minVotes = await exports.getThingBuyMinVotes(houseId, null, price);
  const [ poll ] = await Polls.createPoll(houseId, boughtAt, thingsSpecialPollLength, minVotes);

  return db('ThingBuy')
    .insert({
      houseId,
      boughtBy,
      boughtAt,
      value: -price,
      pollId: poll.id,
      metadata: { title, details, special: true },
    })
    .returning('*');
};

exports.getThingBuy = async function (buyId) {
  return db('ThingBuy')
    .select('*')
    .where({ id: buyId })
    .first();
};

exports.resolveThingBuy = async function (buyId, resolvedAt) {
  const thingBuy = await exports.getThingBuy(buyId);
  const valid = await Polls.isPollValid(thingBuy.pollId, resolvedAt);

  return db('ThingBuy')
    .where({ id: buyId, resolvedAt: null }) // Cannot resolve twice
    .update({ resolvedAt, valid })
    .returning('*');
};

exports.resolveThingBuys = async function (houseId, currentTime) {
  const resolveableThingBuys = await db('ThingBuy')
    .join('Poll', 'ThingBuy.pollId', 'Poll.id')
    .where('ThingBuy.houseId', houseId)
    .where('Poll.endTime', '<=', currentTime)
    .where('ThingBuy.resolvedAt', null)
    .select('ThingBuy.id');

  for (const thingBuy of resolveableThingBuys) {
    await exports.resolveThingBuy(thingBuy.id, currentTime);
  }
};

exports.getUnfulfilledThingBuys = async function (houseId, currentTime) {
  return db('ThingBuy')
    .leftOuterJoin('Thing', 'ThingBuy.thingId', 'Thing.id')
    .where('ThingBuy.houseId', houseId)
    .where('ThingBuy.boughtAt', '<=', currentTime)
    .where('ThingBuy.valid', true) // Exclude invalid buys
    .where('ThingBuy.fulfilledAt', null) // Exclude fulfilled buys
    .whereNot('ThingBuy.pollId', null) // Exclude "load" buys
    .orderBy('ThingBuy.boughtAt', 'asc')
    .select([
      'ThingBuy.id',
      'Thing.type',
      'Thing.name',
      'Thing.metadata AS thingMetadata',
      'ThingBuy.value',
      'ThingBuy.resolvedAt',
      'ThingBuy.metadata',
    ]);
};

exports.fulfillThingBuy = async function (buyId, fulfilledBy, fulfilledAt) {
  return db('ThingBuy')
    .where({ id: buyId, fulfilledAt: null })
    .update({ fulfilledBy, fulfilledAt })
    .returning('*');
};

exports.getFulfilledThingBuys = async function (houseId, startTime, endTime) {
  return db('ThingBuy')
    .join('Thing', 'ThingBuy.thingId', 'Thing.id')
    .where('ThingBuy.houseId', houseId)
    .where('ThingBuy.valid', true) // Exclude invalid buys
    .whereNot('ThingBuy.pollId', null) // Exclude "load" buys
    .whereBetween('ThingBuy.fulfilledAt', [ startTime, endTime ])
    .groupBy([ 'Thing.type', 'Thing.name' ])
    .sum('ThingBuy.value as value')
    .orderBy('value', 'asc')
    .select([
      'Thing.type',
      'Thing.name',
    ]);
};

// Thing Proposals

exports.createThingProposal = async function (houseId, proposedBy, thingId, type, name, value, metadata, active, now) {
  // TODO: Can this be done as a table constraint?
  if (!(thingId || (type && name))) { throw new Error('Proposal must include either thingId or type and name!'); }

  const minVotes = await exports.getThingProposalMinVotes(houseId);
  const [ poll ] = await Polls.createPoll(houseId, now, thingsProposalPollLength, minVotes);

  return db('ThingProposal')
    .insert({ houseId, proposedBy, thingId, type, name, value, metadata, active, pollId: poll.id })
    .returning('*');
};

exports.getThingProposal = async function (proposalId) {
  return db('ThingProposal')
    .select('*')
    .where({ id: proposalId })
    .first();
};

exports.resolveThingProposal = async function (proposalId, now) {
  const proposal = await exports.getThingProposal(proposalId);

  if (proposal.resolvedAt !== null) { throw new Error('Proposal already resolved!'); }

  const valid = await Polls.isPollValid(proposal.pollId, now);

  if (valid) {
    const { houseId, thingId, type, name, value, metadata, active } = proposal;
    if (!thingId) {
      await exports.addThing(houseId, type, name, value, metadata);
    } else {
      await exports.editThing(thingId, type, name, value, metadata, active);
    }
  }

  return db('ThingProposal')
    .where({ id: proposalId })
    .update({ resolvedAt: now })
    .returning('*');
};

// TODO: generalize this along with resolveChoreProposals
exports.resolveThingProposals = async function (houseId, now) {
  const resolveableThingProposals = await db('ThingProposal')
    .join('Poll', 'ThingProposal.pollId', 'Poll.id')
    .where('ThingProposal.houseId', houseId)
    .where('Poll.endTime', '<=', now)
    .where('ThingProposal.resolvedAt', null)
    .orderBy('Poll.endTime') // Ensure sequential resolution
    .select('ThingProposal.id');

  for (const proposal of resolveableThingProposals) {
    await exports.resolveThingProposal(proposal.id, now);
  }
};

// Utils

exports.getThingBuyMinVotes = async function (houseId, thingId, price) {
  const residents = await Admin.getResidents(houseId);
  const maxVotes = Math.ceil(thingsMaxPct * residents.length);
  const minVotesSpecial = Math.ceil(thingsMinPctSpecial * residents.length);
  const minVotesScaled = Math.ceil(Math.abs(price) / thingsMinVotesScalar);

  return (thingId)
    ? Math.min(maxVotes, minVotesScaled) // Regular buy
    : Math.min(maxVotes, Math.max(minVotesScaled, minVotesSpecial)); // Special buy
};

exports.getThingProposalMinVotes = async function (houseId) {
  const residents = await Admin.getResidents(houseId);
  return Math.ceil(thingsProposalPct * residents.length);
};
