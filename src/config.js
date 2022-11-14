const { HOUR, DAY } = require('./constants');

// Chores
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.pointsPerResident = 100;
exports.bootstrapDuration = 72 * HOUR;
exports.inflationFactor = 1.10;
exports.pointPrecision = 0;
exports.displayThreshold = 1;
exports.penaltyDelay = exports.choresPollLength + 6 * HOUR;
exports.penaltyIncrement = 10; // Per quarter heart
exports.achievementBase = 20;
exports.implicitPref = 0.25;

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsBaseline = 5;
exports.heartsRegen = 0.5;
exports.heartsMinPctInitial = 0.4; // For removing initial hearts
exports.heartsMinPctFinal = 0.7; // For removing the final two hearts
exports.heartsCriticalNum = 2;
exports.karmaDelay = 3 * HOUR;
exports.karmaMaxHearts = 7;

// Things
exports.thingsPollLength = DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
