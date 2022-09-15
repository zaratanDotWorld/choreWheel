const { db } = require('../db');

exports.addHouse = async function (name, houseId) {
  return db('house')
    .insert({ name: name, slack_id: houseId })
    .returning('id');
};

exports.addResident = async function (houseId, slackId) {
  return db('resident')
    .insert({ house_id: houseId, slack_id: slackId })
    .onConflict('slack_id').ignore()
    .returning('id');
};

exports.getResidents = async function (houseId) {
  return db('resident')
    .select('*')
    .where('house_id', houseId);
};
