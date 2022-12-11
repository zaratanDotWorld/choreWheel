const { db } = require('./db');

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

// Residents

exports.addResident = async function (houseId, slackId, activeAt) {
  // TODO: incorporate logic into `onConflict`? Want to update activeAt only if !active
  const resident = await exports.getResident(slackId);
  if (resident && resident.active) { return; }

  return db('Resident')
    .insert({ houseId, slackId, activeAt, active: true })
    .onConflict('slackId').merge();
};

exports.deleteResident = async function (houseId, slackId) {
  return db('Resident')
    .insert({ houseId, slackId, active: false })
    .onConflict('slackId').merge([ 'active' ]);
};

exports.getResidents = async function (houseId) {
  return db('Resident')
    .select('*')
    .where({ houseId })
    .where('active', true);
};

exports.getResident = async function (slackId) {
  return db('Resident')
    .select('*')
    .where({ slackId })
    .first();
};
