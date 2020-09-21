require('dotenv').config();

const knex = require('knex');

const config = require('./../knexfile');
const db = knex(config[process.env.NODE_ENV]);

function errorLogger(error) {
  console.error(error);
  throw error;
}

async function getActs() {
  return db('act')
    .select('*')
    .where({ done_at: null, claimed_at: null })
    .catch(errorLogger);
}

async function getChores() {
  return db('chore')
    .select('*')
    .catch(errorLogger);
}

async function doAct(actId, memberSlackId, messageId, choreName) {
  try {
    const now = Date.now();
    await db.transaction(async trx => {
      await trx('act')
        .where({ id: actId })
        .update({ done_by: memberSlackId, done_at: now, message_id: messageId });
      await trx('act')
        .insert({ chore_name: choreName, valued_at: now });
    })
  } catch (err) {
    throw err;
  }
}

exports.db = db;
exports.getActs = getActs;
exports.getChores = getChores;
exports.doAct = doAct;
