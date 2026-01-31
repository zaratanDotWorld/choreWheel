const { Admin, Chores } = require('../../../core/index');
const { DAY } = require('../../../time');

const common = require('../../common');

exports.houseActive = function (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'ChoreClaim', 'claimedAt', windowStart, now);
};

// Cron functions

exports.pingChores = async function (app) {
  const now = new Date();
  const houses = await Admin.getHouses();

  for (const house of houses) {
    if (await exports.houseActive(house.slackId, now)) {
      const choreValues = await Chores.getUpdatedChoreValues(house.slackId, now);
      const pingableChore = choreValues.find(cv => cv.ping); // Only ping highest-value chore
      if (pingableChore) {
        console.log(`Pinging ${house.slackId}`);
        const { choresConf } = await Admin.getHouse(house.slackId);
        const text = `Heads up, *${pingableChore.name}* is worth *${pingableChore.value.toFixed(0)} points* :bangbang:`;
        await common.postMessage(app, choresConf, text);
      }
    }
  }
};

// Import functions

exports.generatePreferencesFromScores = function (residentId, chores) {
  const preferences = [];

  for (let i = 0; i < chores.length; i++) {
    for (let j = i + 1; j < chores.length; j++) {
      const [ a, b ] = [ chores[i], chores[j] ];
      const [ target, source ] = a.score >= b.score ? [ a, b ] : [ b, a ];

      // Power-scaled ratio: ratio^k / (ratio^k + 1)
      // k > 1 stretches preferences further from 0.5, preserving more of the score ratio
      const ratio = target.score / source.score;
      const preference = (ratio ** 2) / ((ratio ** 2) + 1);

      preferences.push({
        targetChoreId: target.id,
        sourceChoreId: source.id,
        preference,
      });
    }
  }

  return preferences
    .map(p => ({ residentId, ...Chores.normalizeChorePreference(p) }));
};
