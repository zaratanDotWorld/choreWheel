const { DAY } = require('../../../constants');

const { Admin } = require('../../../core/index');

const common = require('../../common');

// Business logic helpers

exports.postMessage = async function (app, config, text, blocks) {
  return common.postMessage(app, config.oauth, config.channel, text, blocks);
};

exports.postEphemeral = async function (app, config, residentId, text) {
  return common.postEphemeral(app, config.oauth, config.channel, residentId, text);
};

exports.houseActive = async function (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'Heart', 'generatedAt', windowStart, now);
};
