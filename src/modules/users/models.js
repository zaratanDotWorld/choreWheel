const { db, errorLogger } = require('./../../db');


exports.createUser = async function createUser(email, slackId) {
  return db('user')
    .insert({ email: email, slack_id: slackId })
    .returning('id')
    .catch(errorLogger);
}

exports.getUsers = async function getUsers() {
  return db('user')
    .select('*')
    .catch(errorLogger);
}
