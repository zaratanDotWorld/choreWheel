const { HOUR, DAY } = require('./constants');

// Chores
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.pointsPerResident = 100;
exports.bootstrapDuration = 72 * HOUR;
exports.inflationFactor = 1.00;
exports.displayThreshold = 1;
exports.penaltyDelay = exports.choresPollLength + 6 * HOUR; // TODO: make robust
exports.penaltyIncrement = 10; // Per half heart
exports.achievementBase = 20;
exports.implicitPref = 0.1 / 2; // Halve the value since it's used twice
exports.dampingFactor = 0.99;
exports.choresProposalPollLength = 2 * DAY;
exports.choreProposalPct = 0.4;

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsBaseline = 5;
exports.heartsRegen = 0.5;
exports.heartsMinPctInitial = 0.4; // For removing initial hearts
exports.heartsMinPctCritical = 0.7; // For removing the final two hearts
exports.heartsCriticalNum = 2;
exports.karmaDelay = 3 * HOUR;
exports.karmaProportion = 3;
exports.karmaMaxHearts = 7;

// Things
exports.thingsPollLength = 6 * HOUR;
exports.thingsSpecialPollLength = 2 * DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
exports.thingsMinPctSpecial = 0.3; // Minimum threshold for special buys
exports.thingsMaxPct = 0.6; // Maximum approval threshold
exports.thingsProposalPollLength = 2 * DAY;
exports.thingsProposalPct = 0.4;
