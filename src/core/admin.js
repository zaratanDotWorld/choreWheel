const { db } = require('./db');

// Houses

exports.addHouse = async function (slackId) {
  return db('House')
    .insert({ slackId })
    .onConflict('slackId').ignore();
};

exports.getHouse = async function (slackId) {
  return db('House')
    .where({ slackId })
    .select('*')
    .first();
};

exports.updateHouse = async function (slackId, metadata) {
  // NOTE: May be possible as a single operation using a jsonb datatype
  const house = await exports.getHouse(slackId);
  metadata = { ...house.metadata, ...metadata };

  return db('House')
    .where({ slackId })
    .update({ metadata })
    .returning('*');
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

exports.getResident = async function (residentId) {
  return db('Resident')
    .select('*')
    .where({ slackId: residentId })
    .first();
};

exports.isExempt = async function (residentId, now) {
  const resident = await exports.getResident(residentId);
  return resident.exemptAt && resident.exemptAt <= now;
};

// Subqueries

exports.residentNotExempt = function (db, now) {
  return db.whereNull('Resident.exemptAt')
    .orWhere('Resident.exemptAt', '>', now);
};
