const { db } = require('../db');

// Houses

exports.addHouse = async function (houseId, name) {
  return db('house')
    .insert({ name: name, slack_id: houseId })
    .onConflict('slack_id').merge()
    .returning('*');
};

exports.getHouse = async function (houseId) {
  return db('house')
    .where({ slack_id: houseId })
    .select('*')
    .first();
};

exports.setChoreClaimsChannel = async function (houseId, channelId) {
  return db('house')
    .where({ slack_id: houseId })
    .update({ chores_channel: channelId });
};

// Residents

exports.addResident = async function (houseId, slackId, name) {
  return db('resident')
    .insert({ name: name, house_id: houseId, slack_id: slackId, active: true })
    .onConflict('slack_id').merge()
    .returning('*');
};

exports.deleteResident = async function (slackId) {
  return db('resident')
    .where({ slack_id: slackId })
    .update({ active: false });
};

exports.getResidents = async function (houseId) {
  return db('resident')
    .select('*')
    .where('house_id', houseId)
    .where('active', true);
};
