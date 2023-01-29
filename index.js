// Bring the database up to date
const { db } = require('src/db');
await db.migrate.latest();

// Expose the modules
exports.Admin = require('src/modules/admin');
exports.Chores = require('src/modules/chores');
exports.Hearts = require('src/modules/hearts');
exports.Polls = require('src/modules/polls');
exports.Things = require('src/modules/things');

// Expose the config and utilities
// TODO: make config more... configurable
exports.utils = require('src/utils');
exports.config = require('src/config');
