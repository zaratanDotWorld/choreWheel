require('dotenv').config();

const knex = require('knex');

const config = require('./../knexfile');
const db = knex(config[process.env.NODE_ENV]);

function errorLogger(error) {
  console.error(error);
  throw error;
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

async function doChoreAct(choreActId, choreName, residentSlackId, messageId) {
  try {
    const now = Date.now();
    await db.transaction(async trx => {
      await trx('chore_act')
        .where({ id: choreActId })
        .update({ done_by: residentSlackId, done_at: now, message_id: messageId });
      await trx('chore_act')
        .insert({ chore_name: choreName, valued_at: now });
    })
  } catch (err) {
    throw err;
  }
}

exports.getChores = getChores;
exports.getChoreActs = getChoreActs;
exports.doChoreAct = doChoreAct;
