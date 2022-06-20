const { db, errorLogger } = require('./../db');

async function setChoreValues(values) {

}

async function getChoreActs() {
  return db('chore_act')
    .select('*')
    .where({ done_at: null, claimed_at: null })
    .catch(errorLogger);
}

async function getChores() {
  return db('chore')
    .select('*')
    .catch(errorLogger);
}

async function getChoreValue(choreName, startTime, endTime) {
  return db('chore_value')
    .sum('value')
    .whereBetween('created_at', [startTime, endTime])
    .catch(errorLogger)
}

async function doChoreAct(choreName, doneAt, residentSlackId, messageId) {
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

exports.getChores = getChores;
exports.getChoreActs = getChoreActs;
exports.doChoreAct = doChoreAct;