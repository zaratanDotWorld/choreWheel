const { DAY } = require('../../../constants');
const { Admin } = require('../../../core/index');

// Business logic helpers

exports.houseActive = async function (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'Heart', 'generatedAt', windowStart, now);
};
