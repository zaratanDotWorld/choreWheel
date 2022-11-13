const { DAY } = require('./constants');

exports.sleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

exports.getDateStart = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

exports.getMonthStart = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

exports.getMonthEnd = function (date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

exports.getPrevMonthEnd = function (date) {
  return new Date(exports.getMonthStart(date).getTime() - DAY);
};
exports.getNextMonthStart = function (date) {
  return new Date(exports.getMonthEnd(date).getTime() + DAY);
};
