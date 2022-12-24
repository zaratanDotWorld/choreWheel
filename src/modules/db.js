require('dotenv').config();

const findup = require('findup-sync');
const knex = require('knex');

const knexfilePath = findup('knexfile.js');
const knexfile = require(knexfilePath);

/* istanbul ignore next */
exports.db = knex(knexfile[process.env.NODE_ENV || 'development']);
