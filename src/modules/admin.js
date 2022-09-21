const { db } = require('../db');

// Houses

exports.updateHouse = async function (houseData) {
  return db('House')
    .insert(houseData)
    .onConflict('slackId').merge()
    .returning('*');
};

exports.getHouse = async function (houseId) {
  return db('House')
    .where({ slackId: houseId })
    .select('*')
    .first();
};

exports.setChoreClaimsChannel = async function (houseId, channelId) {
  return db('House')
    .where({ slackId: houseId })
    .update({ choresChannel: channelId });
};

// Residents

exports.addResident = async function (houseId, slackId, name) {
  return db('Resident')
    .insert({ name: name, houseId: houseId, slackId: slackId, active: true })
    .onConflict('slackId').merge()
    .returning('*');
};

exports.deleteResident = async function (slackId) {
  return db('Resident')
    .where({ slackId })
    .update({ active: false });
};

exports.getResidents = async function (houseId) {
  return db('Resident')
    .select('*')
    .where({ houseId })
    .where('active', true);
};
