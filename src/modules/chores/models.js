const { db, errorLogger } = require('./../../db');

exports.getChores = async function getChores() {
  return db('chore')
    .select('*')
    .catch(errorLogger);
}

exports.getChoreActs = async function getChoreActs() {
  return db('chore_act')
    .select('*')
    .where({ done_at: null, claimed_at: null })
    .catch(errorLogger);
}

exports.getChoreValue = async function getChoreValue(choreName, startTime, endTime) {
  return db('chore_value')
    .where('chore_name', choreName )
    .where('created_at', '>', startTime)
    .where('created_at', '<=', endTime)
    .sum('value')
    .first()
    .catch(errorLogger)
}

exports.setChoreValues = async function setChoreValues(choreData) {
  return db('chore_value')
    .insert(choreData)
    .catch(errorLogger)
}

exports.claimChore = async function claimChore(choreName, slackId, claimedAt, messageId) {
  const previousClaims = await exports.getChoreClaims(choreName)
  const previousClaimedAt = (previousClaims.length === 0) ? new Date(0) : previousClaims.slice(-1)[0].claimed_at;
  const choreValue = await exports.getChoreValue(choreName, previousClaimedAt, claimedAt);

  return db('chore_claim')
    .insert({
      chore_name: choreName,
      claimed_by: slackId,
      claimed_at: claimedAt,
      message_id: messageId,
      value: choreValue.sum
    })
}

exports.getChoreClaims = async function getChoreClaims(choreName) {
  return db('chore_claim')
    .select('*')
    .where({ chore_name: choreName })
    .catch(errorLogger);
}

exports.getUserChoreClaims = async function getUserChoreClaims(choreName, slackId) {
  return db('chore_claim')
    .select('*')
    .where({ chore_name: choreName, claimed_by: slackId })
    .catch(errorLogger);
}

// exports.doChoreAct = async function doChoreAct(choreName, userSlackId, doneAt, messageId) {
//   try {
//     await db.transaction(async trx => {
//       await trx('chore_act')
//         .where({ id: choreActId })
//         .update({ done_by: userSlackId, done_at: doneAt, message_id: messageId });
//       await trx('chore_act')
//         .insert({ chore_name: choreName, valued_at: doneAt });
//     })
//   } catch (err) {
//     throw err;
//   }
// }