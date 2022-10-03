const { HOUR, DAY } = require('./constants');

exports.choresPollLength = DAY;
exports.heartsPollLength = 3 * DAY;

exports.choresMinVotes = 2;
exports.heartsInitialMinVotes = 4; // For removing initial hearts
exports.heartsFinalMinVotes = 7; // For removing the final two hearts

exports.pointsPerResident = 100;
exports.initialValueDuration = 72 * HOUR;
