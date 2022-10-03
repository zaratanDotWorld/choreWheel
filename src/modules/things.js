const { db } = require('../db');
const { thingsPollLength, thingsMinVotesScalar } = require('../config');

const Polls = require('./polls');

// Things

exports.updateThing = async function (thingData) {
  return db('Thing')
    .insert(thingData)
    .onConflict([ 'houseId', 'type', 'name' ]).merge()
    .returning('*');
};

exports.getThings = async function (houseId) {
  return db('Thing')
    .where({ houseId: houseId, active: true })
    .returning('*');
};

// Buys

exports.getHouseBalance = async function (houseId, currentTime) {
  return db('ThingBuy')
    .where({ houseId: houseId, valid: true })
    .where('boughtAt', '<=', currentTime)
    .sum('value')
    .first();
};

exports.loadHouseAccount = async function (houseId, loadedAt, amount) {
  return db('ThingBuy')
    .insert({
      houseId: houseId,
      boughtAt: loadedAt,
      value: amount
    })
    .returning('*');
};

exports.buyThing = async function (houseId, thingId, boughtBy, boughtAt, price) {
  const houseBalance = await exports.getHouseBalance(houseId, boughtAt);

  if (houseBalance.sum < price) { throw new Error('Insufficient funds!'); }

  const [ poll ] = await Polls.createPoll(boughtAt, thingsPollLength);

  return db('ThingBuy')
    .insert({
      houseId: houseId,
      thingId: thingId,
      boughtBy: boughtBy,
      boughtAt: boughtAt,
      value: -price,
      pollId: poll.id
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

  const pollId = thingBuy.pollId;
  const poll = await Polls.getPoll(pollId);

  if (resolvedAt < poll.endTime) { throw new Error('Poll not closed!'); }

  const minVotes = Math.ceil(Math.abs(thingBuy.value) / thingsMinVotesScalar);
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const valid = (yays >= minVotes && yays > nays);

  return db('ThingBuy')
    .where({ id: buyId, resolvedAt: null }) // Cannot resolve twice
    .update({ resolvedAt, valid })
    .returning('*');
};
