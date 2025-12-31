const { Admin, Chores } = require('../../../core/index');
const { DAY } = require('../../../constants');

const common = require('../../common');

// Business logic helpers

async function postMessage (app, choresConf, text, blocks) {
  return common.postMessage(app, choresConf.oauth, choresConf.channel, text, blocks);
}

async function postEphemeral (app, choresConf, residentId, text) {
  return common.postEphemeral(app, choresConf.oauth, choresConf.channel, residentId, text);
}

async function houseActive (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'ChoreClaim', 'claimedAt', windowStart, now);
}

async function pingChores (app) {
  const now = new Date();
  const houses = await Admin.getHouses();

  for (const house of houses) {
    if (await houseActive(house.slackId, now)) {
      const choreValues = await Chores.getUpdatedChoreValues(house.slackId, now);
      const pingableChore = choreValues.find(cv => cv.ping); // Only ping highest-value chore
      if (pingableChore) {
        console.log(`Pinging ${house.slackId}`);
        const { choresConf: config } = await Admin.getHouse(house.slackId);
        const text = `Heads up, *${pingableChore.name}* is worth *${pingableChore.value.toFixed(0)} points* :bangbang:`;
        return common.postMessage(app, config.oauth, config.channel, text);
      }
    }
  }
}

module.exports = {
  postMessage,
  postEphemeral,
  houseActive,
  pingChores,
};
