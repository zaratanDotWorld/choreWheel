const { HOUR, DAY } = require('./constants');

// Chores
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.pointsPerResident = 100;
exports.bootstrapDuration = 72 * HOUR;
exports.inflationFactor = 1.10;
exports.penaltyDelay = 3 * DAY;
exports.penaltyIncrement = 5;
exports.penaltySize = 20; // Points per heart

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsBaseline = 5;
exports.heartsMinVotesInitial = 4; // For removing initial hearts
exports.heartsMinVotesFinal = 7; // For removing the final two hearts

// Things
exports.thingsPollLength = DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
