const { db } = require('../db');

exports.addHouse = async function (name, houseId) {
  return db('house')
    .insert({ name: name, slack_id: houseId })
    .onConflict('slack_id').merge('name')
    .returning('id');
};

exports.addResident = async function (name, houseId, slackId) {
  return db('resident')
    .insert({ name: name, house_id: houseId, slack_id: slackId })
    .onConflict('slack_id').merge('name')
    .returning('id');
};

exports.getResidents = async function (houseId) {
  return db('resident')
    .select('*')
    .where('house_id', houseId);
};
