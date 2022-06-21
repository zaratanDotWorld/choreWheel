const { db, errorLogger } = require('./../../db');

exports.getChores = async function getChores() {
  return db('chore')
    .select('*')
    .catch(errorLogger);
}

exports.getChoreActs = async function getChoreActs() {
  return db('chore_act')
  .select('*')
  .where({ done_at: null, claimed_at: null })
  .catch(errorLogger);
}

exports.getChoreValue = async function getChoreValue(choreName, startTime, endTime) {
  return db('chore_value')
    .sum('value')
    .where('chore_name', choreName)
    .whereBetween('created_at', [startTime, endTime])
    .first()
    .catch(errorLogger)
}

exports.setChoreValues = async function setChoreValues(choreData) {
  await db('chore_value')
    .insert(choreData)
    .catch(errorLogger)
}

exports.doChoreAct = async function doChoreAct(choreName, doneAt, residentSlackId, messageId) {
  try {
    await db.transaction(async trx => {
      await trx('chore_act')
        .where({ id: choreActId })
        .update({ done_by: residentSlackId, done_at: doneAt, message_id: messageId });
      await trx('chore_act')
        .insert({ chore_name: choreName, valued_at: doneAt });
    })
  } catch (err) {
    throw err;
  }
}