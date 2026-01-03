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
