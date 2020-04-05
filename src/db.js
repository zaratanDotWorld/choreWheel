require('dotenv').config();

const knex = require('knex');

const config = require('./../knexfile');
const db = knex(config[process.env.NODE_ENV]);

function errorLogger(error) {
  console.error(error)
  throw error
}

async function getActs() {
  return db('act')
    .select('*')
    .catch(errorLogger)
}

exports.getActs = getActs
