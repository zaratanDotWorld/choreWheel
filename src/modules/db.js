require('dotenv').config();

const knex = require('knex');
const config = require('./../../knexfile');

/* istanbul ignore next */
exports.db = knex(config[process.env.NODE_ENV || 'development']);
