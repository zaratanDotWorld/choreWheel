const { DAY } = require('../../../constants');

const { Admin } = require('../../../core/index');

const common = require('../../common');

// Helper functions

exports.postMessage = async function (app, config, text, blocks) {
  return common.postMessage(app, config.oauth, config.channel, text, blocks);
};

exports.postEphemeral = async function (app, config, residentId, text) {
  return common.postEphemeral(app, config.oauth, config.channel, residentId, text);
};

exports.houseActive = async function (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'ThingBuy', 'boughtAt', windowStart, now);
};

exports.parseThingsEditSubmission = function (body) {
  const type = common.parseTitlecase(common.getInputBlock(body, -5).type.value);
  const name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
  const unit = common.parseLowercase(common.getInputBlock(body, -3).unit.value);
  const value = common.getInputBlock(body, -2).cost.value;
  const url = common.parseUrl(common.getInputBlock(body, -1).url.value);
  return { type, name, unit, value, url };
};
