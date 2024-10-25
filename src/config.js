const { HOUR, DAY } = require('./constants');

// Chores
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.choreMinVotesThreshold = 10;
exports.pointsPerResident = 100;
exports.bootstrapDuration = 72 * HOUR;
exports.inflationFactor = 1.00;
exports.displayThreshold = 1;
exports.penaltyDelay = exports.choresPollLength + 6 * HOUR; // TODO: make robust
exports.penaltyIncrement = 10; // Per half heart
exports.achievementBase = 20;
exports.achievementWindow = 18 * 30 * DAY;
exports.dampingFactor = 0.99;
exports.choresProposalPollLength = 2 * DAY;
exports.choreProposalPct = 0.4;
exports.breakMinDays = 3;
exports.pointsBuffer = 20;
exports.pingInterval = 25;
exports.specialChoreMaxValueProportion = 0.2;
exports.specialChoreVoteIncrement = 25;
exports.choreSpecialPctMin = 0.3; // Minimum threshold for special chores
exports.choreSpecialPctMax = 0.6; // Maximum threshold for special chores

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsBaselineAmount = 5;
exports.heartsRegenAmount = 0.25;
exports.heartsFadeAmount = 0.25;
exports.heartsMinPctInitial = 0.4; // For removing initial hearts
exports.heartsMinPctCritical = 0.7; // For removing the final two hearts
exports.heartsCriticalNum = 2;
exports.karmaDelay = 3 * HOUR;
exports.karmaProportion = 3;
exports.heartsMaxBase = 7;
exports.heartsMaxLimit = 10;
exports.heartsKarmaGrowthRate = 4;

// Things
exports.thingsPollLength = 6 * HOUR;
exports.thingsSpecialPollLength = 2 * DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
exports.thingsMinPctSpecial = 0.3; // Minimum threshold for special buys
exports.thingsMaxPct = 0.6; // Maximum approval threshold
exports.thingsProposalPollLength = 2 * DAY;
exports.thingsProposalPct = 0.4;
