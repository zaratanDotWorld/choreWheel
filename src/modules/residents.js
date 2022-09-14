const { db } = require('../db');

exports.addResident = async function (slackId, email = undefined) {
  return db('resident')
    .insert({ slack_id: slackId, email: email })
    .onConflict('slack_id').ignore()
    .returning('id');
};
