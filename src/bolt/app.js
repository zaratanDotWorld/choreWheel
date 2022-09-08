require('dotenv').config();

const { App } = require('@slack/bolt');

const Chores = require('../modules/chores/chores');

const blocks = require('./blocks');

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Define the interface

app.event('reaction_added', async ({ payload }) => {
  console.log(`User ${payload.user} just added ${payload.reaction} to message ${payload.item.channel}.${payload.item.ts}`);

  const reactionQuery = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: payload.item.channel,
    timestamp: payload.item.ts
  };

  const res = await app.client.reactions.get(reactionQuery);
  console.log(res.message.reactions);
});

app.event('reaction_removed', async ({ payload }) => {
  console.log(`User ${payload.user} just removed ${payload.reaction} from message ${payload.item.channel}.${payload.item.ts}`);
});

// Chores flow

app.shortcut('chores-list', async ({ ack, shortcut }) => {
  await ack();

  const choreValues = [];
  const chores = await Chores.getChores();

  for (const chore of chores) {
    const choreValue = await Chores.getCurrentChoreValue(chore.name);
    choreValues.push({ name: chore.name, value: parseInt(choreValue.sum || 0) });
  };

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

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const choreClaimIndex = body.view.state.values.input.options.selected_option.value;
  const choreClaim = body.view.blocks[0].element.options[parseInt(choreClaimIndex)];

  const userName = body.user.name;
  const choreName = choreClaim.text.text;
  const choreValue = parseInt(choreClaim.description.text);

  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'mr-chores',
    blocks: blocks.choreListCallbackView(userName, choreName, choreValue)
  };

  const res = await app.client.chat.postMessage(message);
  const messageId = `${res.channel}.${res.ts}`;

  await Chores.claimChore(choreName, userName, res.ts, messageId, defaultPollLength);

  console.log(`Message posted as ${messageId}`);
});

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();
  console.log(body);
  console.log(action);
});

// Launch the app

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
