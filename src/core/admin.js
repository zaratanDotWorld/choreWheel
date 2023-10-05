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

exports.activateResident = async function (houseId, slackId, activeAt) {
  // TODO: incorporate logic into `onConflict`? Want to update activeAt only if !active
  //  See https://knexjs.org/guide/query-builder.html#onconflict

  // If already active or exempt, a no-op
  const resident = await exports.getResident(slackId);
  if (resident && (resident.active || resident.exemptAt)) { return; }

  return db('Resident')
    .insert({ houseId, slackId, activeAt, active: true, exemptAt: null })
    .onConflict('slackId').merge();
};

exports.deactivateResident = async function (houseId, slackId) {
  return db('Resident')
    .insert({ houseId, slackId, active: false })
    .onConflict('slackId').merge();
};

exports.exemptResident = async function (houseId, slackId, exemptAt) {
  const resident = await exports.getResident(slackId);
  if (resident && resident.exemptAt && resident.exemptAt <= exemptAt) { return; }

  return db('Resident')
    .insert({ houseId, slackId, exemptAt })
    .onConflict('slackId').merge();
};

exports.unexemptResident = async function (houseId, slackId) {
  return db('Resident')
    .insert({ houseId, slackId, exemptAt: null })
    .onConflict('slackId').merge();
};

exports.getResidents = async function (houseId) {
  return db('Resident')
    .select('*')
    .where({ houseId, active: true });
};

// Voting residents are active and not exempt
exports.getVotingResidents = async function (houseId, now) {
  return db('Resident')
    .select('*')
    .where({ houseId, active: true })
    .where('activeAt', '<=', now)
    .where(function () { exports.residentNotExempt(this, now); });
};

exports.getResident = async function (slackId) {
  return db('Resident')
    .select('*')
    .where({ slackId })
    .first();
};

// Subqueries

exports.residentNotExempt = function (db, now) {
  return db.whereNull('Resident.exemptAt')
    .orWhere('Resident.exemptAt', '>', now);
};
