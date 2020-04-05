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
    .catch(errorLogger);
}

async function doAct(actId, memberSlackId, messageId) {
  return db('act')
    .where({ id: actId })
    .update({ done_by: memberSlackId, done_at: Date.now(), message_id: messageId })
    .catch(errorLogger)
}

exports.db = db;
exports.getActs = getActs;
exports.doAct = doAct;
