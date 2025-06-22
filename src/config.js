const { HOUR, DAY } = require('./constants');

// Chores
exports.choresHourPrecision = 3;
exports.choresPollLength = DAY;
exports.choresMinVotes = 2;
exports.choreMinVotesThreshold = 10;
exports.pointsPerResident = 100;
exports.pointsBuffer = 200;
exports.bootstrapValue = 10;
exports.inflationFactor = 1.00;
exports.displayThreshold = 0;
exports.penaltyDelay = exports.choresPollLength + 6 * HOUR; // TODO: make robust
exports.penaltyIncrement = 5;
exports.penaltyUnit = 0.25;
exports.achievementBase = 20;
exports.achievementWindow = 18 * 30 * DAY;
exports.dampingFactor = 0.99;
exports.choresProposalPollLength = 2 * DAY;
exports.specialChoreProposalPollLength = DAY;
exports.choreProposalPct = 0.4;
exports.breakMinDays = 3;
exports.pingInterval = 50;
exports.specialChoreVoteIncrement = 10;
exports.choreSpecialPctMin = 0.3; // Minimum threshold for special chores
exports.choreSpecialPctMax = 0.6; // Maximum threshold for special chores

// Hearts
exports.heartsPollLength = 3 * DAY;
exports.heartsBaselineAmount = 5;
exports.heartsReviveAmount = 3;
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
exports.heartsVoteScalar = 0.2;

// Things
exports.thingsPollLength = 6 * HOUR;
exports.thingsSpecialPollLength = 1 * DAY;
exports.thingsMinVotesScalar = 50; // One vote per $50
exports.thingsMinPctSpecial = 0.3; // Minimum threshold for special buys
exports.thingsMaxPct = 0.6; // Maximum approval threshold
exports.thingsProposalPollLength = 2 * DAY;
exports.thingsProposalPct = 0.4;
