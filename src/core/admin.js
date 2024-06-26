const { db } = require('./db');

// Houses

exports.addHouse = async function (slackId, name) {
  return db('House')
    .insert({ slackId, name })
    .onConflict('slackId').ignore();
};

exports.getHouse = async function (slackId) {
  return db('House')
    .where({ slackId })
    .select('*')
    .first();
};

exports.updateHouseConf = async function (slackId, confName, conf) {
  // NOTE: May be possible as a single operation using a jsonb datatype
  const house = await exports.getHouse(slackId);
  conf = { ...house[confName], ...conf };

  return db('House')
    .where({ slackId })
    .update(confName, conf)
    .returning('*');
};

// Residents

exports.activateResident = async function (houseId, slackId, activeAt) {
  // No-op if already active or exempt
  const resident = await exports.getResident(slackId);
  if (resident && (resident.activeAt || resident.exemptAt)) { return; }

  return db('Resident')
    .insert({ houseId, slackId, activeAt, exemptAt: null })
    .onConflict('slackId').merge();
};

exports.deactivateResident = async function (houseId, slackId) {
  return db('Resident')
    .insert({ houseId, slackId, activeAt: null })
    .onConflict('slackId').merge();
};

exports.exemptResident = async function (houseId, slackId, exemptAt) {
  // No-op if already exempt
  const resident = await exports.getResident(slackId);
  if (resident && resident.exemptAt && resident.exemptAt <= exemptAt) { return; }

  return db('Resident')
    .insert({ houseId, slackId, exemptAt })
    .onConflict('slackId').merge();
};

exports.unexemptResident = async function (houseId, slackId, activeAt) {
  return db('Resident')
    .insert({ houseId, slackId, activeAt, exemptAt: null })
    .onConflict('slackId').merge();
};

exports.getResidents = async function (houseId, now) {
  return db('Resident')
    .where({ houseId })
    .where('activeAt', '<=', now)
    .select('*');
};

// Voting residents are active && !exempt
exports.getVotingResidents = async function (houseId, now) {
  return db('Resident')
    .where({ houseId })
    .where('activeAt', '<=', now)
    .where(function () { exports.residentNotExempt(this, now); })
    .select('*');
};

exports.getResident = async function (residentId) {
  return db('Resident')
    .where({ slackId: residentId })
    .select('*')
    .first();
};

exports.isExempt = async function (residentId, now) {
  const resident = await exports.getResident(residentId);
  return Boolean(resident.exemptAt && resident.exemptAt <= now);
};

// Subqueries

exports.residentNotExempt = function (db, now) {
  return db.whereNull('Resident.exemptAt')
    .orWhere('Resident.exemptAt', '>', now);
};
