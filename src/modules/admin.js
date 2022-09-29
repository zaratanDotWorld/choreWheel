const { db } = require('../db');

// Houses

exports.updateHouse = async function (houseData) {
  return db('House')
    .insert(houseData)
    .onConflict('slackId').merge();
};

exports.getHouse = async function (houseId) {
  return db('House')
    .where({ slackId: houseId })
    .select('*')
    .first();
};

exports.getNumHouses = async function () {
  return db('House')
    .count('id')
    .first();
};

exports.setChoreClaimsChannel = async function (houseId, channelId) {
  return db('House')
    .where({ slackId: houseId })
    .update({ choresChannel: channelId });
};

// Residents

exports.addResident = async function (houseId, slackId) {
  return exports.updateResident(houseId, slackId, true, '');
};

exports.updateResident = async function (houseId, slackId, active, name) {
  return db('Resident')
    .insert({ houseId, slackId, active, name })
    .onConflict('slackId').merge();
};

exports.getResidents = async function (houseId) {
  return db('Resident')
    .select('*')
    .where({ houseId })
    .where('active', true);
};
