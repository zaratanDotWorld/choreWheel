const common = require('../../common');

// Helper functions

exports.parseThingsEditSubmission = function (body) {
  const type = common.parseTitlecase(common.getInputBlock(body, -5).type.value);
  const name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
  const unit = common.parseLowercase(common.getInputBlock(body, -3).unit.value);
  const value = common.getInputBlock(body, -2).cost.value;
  const url = common.parseUrl(common.getInputBlock(body, -1).url.value);
  return { type, name, unit, value, url };
};
