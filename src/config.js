const { HOUR, DAY } = require('./constants');

// Chores
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.pointsPerResident = 100;
exports.initialValueDuration = 72 * HOUR;

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsMinVotesInitial = 4; // For removing initial hearts
exports.heartsMinVotesFinal = 7; // For removing the final two hearts

// Things
exports.thingsPollLength = DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
