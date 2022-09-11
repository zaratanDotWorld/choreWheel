require('dotenv').config();

const { App } = require('@slack/bolt');

const Chores = require('../modules/chores/chores');
const Polls = require('../modules/polls/polls');
const Residents = require('../modules/residents/residents');

const { defaultPollLength } = require('../config');
const { YAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Define the interface

app.event('reaction_added', async ({ payload }) => {
  console.log(`Resident ${payload.resident} just added ${payload.reaction} to message ${payload.item.channel}.${payload.item.ts}`);

  const reactionQuery = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: payload.item.channel,
    timestamp: payload.item.ts
  };

  const res = await app.client.reactions.get(reactionQuery);
  console.log(res.message.reactions);
});

app.event('reaction_removed', async ({ payload }) => {
  console.log(`Resident ${payload.resident} just removed ${payload.reaction} from message ${payload.item.channel}.${payload.item.ts}`);
});

// Chores flow

app.shortcut('chores-list', async ({ ack, shortcut }) => {
  await ack();

  const choreValues = [];
  const currentTime = new Date();
  const chores = await Chores.getChores();

  for (const chore of chores) {
    const choreValue = await Chores.getCurrentChoreValue(chore.name, currentTime);
    choreValues.push({ name: chore.name, value: parseInt(choreValue.sum || 0) });
  }

  const view = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: shortcut.trigger_id,
    view: blocks.choresListView(choreValues)
  };

  const res = await app.client.views.open(view);
  console.log(`Chores listed with id ${res.view.id}`);
});

app.view('chores-list-callback', async ({ ack, body }) => {
  await ack();

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const residentId = body.user.id;
  const blockId = body.view.blocks[0].block_id;
  const [ choreName, choreValue ] = body.view.state.values[blockId].options.selected_option.value.split('.');

  await Residents.addResident(residentId);

  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'test',
    text: 'Someone just completed a chore',
    blocks: blocks.choreListCallbackView(residentId, choreName, choreValue, defaultPollLength)
  };

  const res = await app.client.chat.postMessage(message);
  const messageId = `${res.channel}.${res.ts}`;

  console.log(`Message posted as ${messageId}`);

  const [ claim ] = await Chores.claimChore(choreName, residentId, messageId, defaultPollLength);
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
