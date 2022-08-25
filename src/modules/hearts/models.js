const { db, errorLogger } = require('./../../db');
const { defaultPollLength } = require('./../../config');

const Polls = require('./../polls/models');

exports.getUserHearts = async function getUserHearts(slackId) {
  return db('heart')
    .where('user', slackId)
    .sum('value')
    .first()
    .catch(errorLogger);
}

exports.generateHearts = async function generateHearts(slackIds, numHearts) {
  const hearts = slackIds.map((slackId) => { return { user: slackId, value: numHearts} });

  return db('heart')
    .insert(hearts)
    .catch(errorLogger);
}
