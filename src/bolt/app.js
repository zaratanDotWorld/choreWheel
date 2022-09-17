require('dotenv').config();

const { App } = require('@slack/bolt');

const Chores = require('../modules/chores');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { choresPollLength } = require('../config');
const { YAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Publish the app home

app.event('app_home_opened', async ({ payload }) => {
  if (payload.tab === 'home') {
    await Admin.addHouse('', payload.view.team_id);
    await Admin.addResident('', payload.view.team_id, payload.user);

    const chorePoints = 10; // TODO: Implement this function

    const data = {
      token: process.env.SLACK_BOT_TOKEN,
      user_id: payload.user,
      view: blocks.choresHomeView(chorePoints)
    };
    await app.client.views.publish(data);
  }
});

// Slash commands

app.command('/chores-add', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await app.client.users.info({
    token: process.env.SLACK_BOT_TOKEN,
    user: command.user_id
  });

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.addChore(command.team_id, choreName);
    await say(`${choreName} added to the chores list :star-struck:`);
  } else {
    await say('Only admins can update the chore list...');
  }
});

app.command('/chores-del', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await app.client.users.info({
    token: process.env.SLACK_BOT_TOKEN,
    user: command.user_id
  });

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.deleteChore(command.team_id, choreName);
    await say(`${choreName} deleted from the chores list :sob:`);
  } else {
    await say('Only admins can update the chore list...');
  }
});

app.command('/chores-list', async ({ ack, command, say }) => {
  await ack();

  const chores = await Chores.getChores(command.team_id);
  const choreNames = chores.map((chore) => `\n${chore.name}`);

  await say(`The current chores:${choreNames}`);
});

// Claim flow

app.action('chores-claim', async ({ ack, body, action }) => {
  await ack();

  const choreValues = await Chores.getCurrentChoreValues(body.team.id, new Date());

  const view = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: body.trigger_id,
    view: blocks.choresListView(choreValues)
  };

  const res = await app.client.views.open(view);
  console.log(`Chores listed with id ${res.view.id}`);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  await ack();

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const residentId = body.user.id;
  const blockId = body.view.blocks[0].block_id;
  const [ choreName, choreValue ] = body.view.state.values[blockId].options.selected_option.value.split('.');

  await Admin.addResident(residentId);

  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'test',
    text: 'Someone just completed a chore',
    blocks: blocks.choreListCallbackView(residentId, choreName, choreValue, choresPollLength)
  };

  const res = await app.client.chat.postMessage(message);
  const messageId = `${res.channel}.${res.ts}`;

  console.log(`Message posted as ${messageId}`);

  const [ claim ] = await Chores.claimChore(choreName, residentId, messageId, choresPollLength);
  await Polls.submitVote(claim.poll_id, residentId, YAY);

  console.log(`Claim ${claim.id} created with poll ${claim.poll_id}`);
});

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  // // Submit the vote
  const messageId = `${body.channel.id}.${body.message.ts}`;
  const choreClaim = await Chores.getChoreClaimByMessageId(messageId);
  await Polls.submitVote(choreClaim.poll_id, body.user.id, parseInt(action.value));

  await sleep(1);

  const { yays, nays } = await Polls.getPollResultCounts(choreClaim.poll_id);

  // Update the vote counts
  body.message.channel = body.channel.id;
  body.message.blocks[2].elements = blocks.makeVoteButtons(yays, nays);
  await app.client.chat.update(body.message);

  console.log(`Poll ${choreClaim.poll_id} updated`);
});

// Launch the app

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
