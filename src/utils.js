exports.sleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

exports.getMonthStart = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

exports.getMonthEnd = function (date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};
