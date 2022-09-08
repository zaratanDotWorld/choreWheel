const { db, errorLogger } = require('../../db');

exports.createUser = async function (email, slackId) {
  return db('user')
    .insert({ email: email, slack_id: slackId })
    .returning('id')
    .catch(errorLogger);
};

exports.getUsers = async function () {
  return db('user')
    .select('*')
    .catch(errorLogger);
};
