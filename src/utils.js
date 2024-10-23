const { MINUTE } = require('./constants');

exports.getDateStart = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

exports.getMonthStart = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

exports.getMonthEnd = function (date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
};

exports.getPrevMonthEnd = function (date) {
  return new Date(exports.getMonthStart(date).getTime() - 1);
};

exports.getNextMonthStart = function (date) {
  return new Date(exports.getMonthEnd(date).getTime() + 1);
};

exports.shiftDate = function (date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE);
};

exports.truncateHour = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
};

exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
