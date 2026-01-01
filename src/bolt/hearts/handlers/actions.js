const { YAY } = require('../../../constants');

const { Admin, Polls, Hearts } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/actions');
const { postMessage, postEphemeral } = require('./common');

module.exports = (app) => {
  // Challenge flow
  app.action('hearts-challenge', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-challenge';
    const { now, houseId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    const residents = await Admin.getResidents(houseId, now);

    const view = views.heartsChallengeView(residents.length);
    await common.openView(app, heartsConf.oauth, body.trigger_id, view);
  });

  app.view('hearts-challenge-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-challenge-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    const challengeeId = common.getInputBlock(body, 2).challengee.selected_conversation;
    const numHearts = common.getInputBlock(body, 3).hearts.selected_option.value;
    const circumstance = common.getInputBlock(body, 4).circumstance.value;

    const unresolvedChallenges = await Hearts.getUnresolvedChallenges(houseId, challengeeId);

    if (!(await Admin.isActive(challengeeId, now))) {
      const text = `<@${challengeeId}> is not active and cannot be challenged :weary:`;
      await postEphemeral(app, heartsConf, residentId, text);
    } else if (unresolvedChallenges.length) {
      const text = `<@${challengeeId}> is already being challenged!`;
      await postEphemeral(app, heartsConf, residentId, text);
    } else {
      // Initiate the challenge
      const [ challenge ] = await Hearts.issueChallenge(houseId, residentId, challengeeId, numHearts, now, circumstance);
      await Polls.submitVote(challenge.pollId, residentId, now, YAY);

      const { minVotes } = await Polls.getPoll(challenge.pollId);

      const text = 'Someone just issued a hearts challenge';
      const blocks = views.heartsChallengeCallbackView(challenge, minVotes, circumstance);
      const { channel, ts } = await postMessage(app, heartsConf, text, blocks);
      await Polls.updateMetadata(challenge.pollId, { channel, ts });
    }
  });

  // Karma flow
  app.action('hearts-karma', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-karma';
    const { houseId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    const view = views.heartsKarmaView();
    await common.openView(app, heartsConf.oauth, body.trigger_id, view);
  });

  app.view('hearts-karma-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-karma-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    const recipientId = common.getInputBlock(body, -2).recipient.selected_conversation;
    const circumstance = common.getInputBlock(body, -1).circumstance.value;

    await Hearts.giveKarma(houseId, residentId, recipientId, now);

    const text = `<@${residentId}> just gave <@${recipientId}> ++ good karma :sparkles: \n` +
      `_${circumstance}_`;
    await postMessage(app, heartsConf, text);
  });

  // Board flow
  app.action('hearts-board', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-board';
    const { now, houseId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    const hearts = await Hearts.getHouseHearts(houseId, now);

    const view = views.heartsBoardView(hearts);
    await common.openView(app, heartsConf.oauth, body.trigger_id, view);
  });

  // Voting flow
  app.action(/poll-vote/, async ({ ack, body, action }) => {
    await ack();

    const actionName = 'hearts poll-vote';
    const { houseId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    await common.updateVoteCounts(app, heartsConf.oauth, body, action);
  });
};
