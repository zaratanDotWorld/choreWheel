const { db } = require('./db');

const {
  thingsPollLength,
  thingsSpecialPollLength,
  thingsMinVotesScalar,
  thingsMinPctSpecial,
  thingsMaxPct
} = require('../config');

const Admin = require('./admin');
const Polls = require('./polls');

// Things

exports.updateThing = async function (thingData) {
  return db('Thing')
    .insert(thingData)
    .onConflict([ 'houseId', 'type', 'name' ]).merge()
    .returning('*');
};

exports.deleteThing = async function (thingId) {
  return db('Thing')
    .where({ id: thingId })
    .update({ active: false })
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

  const [ poll ] = await Polls.createPoll(boughtAt, thingsPollLength);

  return db('ThingBuy')
    .insert({
      houseId,
      thingId,
      boughtBy,
      boughtAt,
      value: -totalCost,
      pollId: poll.id,
      metadata: { quantity }
    })
    .returning('*');
};

exports.buySpecialThing = async function (houseId, boughtBy, boughtAt, price, title, details) {
  const houseBalance = await exports.getHouseBalance(houseId, boughtAt);

  if (houseBalance.sum < price) { throw new Error('Insufficient funds!'); }

  const [ poll ] = await Polls.createPoll(boughtAt, thingsSpecialPollLength);

  return db('ThingBuy')
    .insert({
      houseId,
      boughtBy,
      boughtAt,
      value: -price,
      pollId: poll.id,
      metadata: { title, details, special: true }
    })
    .returning('*');
};

exports.getThingBuy = async function (buyId) {
  return db('ThingBuy')
    .select('*')
    .where({ id: buyId })
    .first();
};

exports.resolveThingBuy = async function (buyId, resolvedAt, numResidents) {
  const thingBuy = await exports.getThingBuy(buyId);
  const pollId = thingBuy.pollId;
  const poll = await Polls.getPoll(pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  const minVotes = await exports.getThingBuyMinVotes(thingBuy, numResidents);
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const valid = (yays >= minVotes && yays > nays);

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

  const residents = await Admin.getResidents(houseId);
  for (const thingBuy of resolveableThingBuys) {
    await exports.resolveThingBuy(thingBuy.id, currentTime, residents.length);
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
      'Thing.quantity',
      'ThingBuy.value',
      'ThingBuy.resolvedAt',
      'ThingBuy.metadata'
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
      'Thing.name'
    ]);
};

// Utils

exports.getThingBuyMinVotes = async function (thingBuy, numResidents) {
  const maxVotes = Math.ceil(thingsMaxPct * numResidents);
  const minVotesSpecial = Math.ceil(thingsMinPctSpecial * numResidents);
  const minVotesScaled = Math.ceil(Math.abs(thingBuy.value) / thingsMinVotesScalar);

  return (thingBuy.thingId === null)
    ? Math.min(maxVotes, Math.max(minVotesScaled, minVotesSpecial)) // Special buy
    : Math.min(maxVotes, minVotesScaled); // Regular buy
};
