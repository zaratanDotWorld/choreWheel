// Bring the database up to date
const path = require('path');
const { db } = require('./src/db');

db.migrate.latest({ directory: path.join(__dirname, '/migrations') }); // TODO: await this

// Expose the modules
exports.Admin = require('./src/core/admin');
exports.Chores = require('./src/core/chores');
exports.Hearts = require('./src/core/hearts');
exports.Polls = require('./src/core/polls');
exports.Things = require('./src/core/things');

// Expose the config and utilities
// TODO: make config more... configurable
exports.utils = require('./src/utils');
exports.config = require('./src/config');
