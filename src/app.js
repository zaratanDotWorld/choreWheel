require('dotenv').config()

const { App } = require('@slack/bolt');

const db = require('./db')
const chores = require('./channels/chores')

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Define the interface

app.event('reaction_added', async ({ say, payload }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'event', 'say'

  console.log(`User ${payload.user} just added ${payload.reaction} to message ${payload.item.channel}.${payload.item.ts}`);

  const res = await app.client.reactions.get({
      token: process.env.SLACK_BOT_TOKEN,
      channel: payload.item.channel,
      timestamp: payload.item.ts
    });
  console.log(res.message.reactions);
})

app.event('reaction_removed', async ({ say, payload }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'event', 'say'

  console.log(`User ${payload.user} just removed ${payload.reaction} from message ${payload.item.channel}.${payload.item.ts}`);
})

// Chores app

app.shortcut('chores-list', async ({ ack, shortcut, say }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'shortcut', 'say', 'respond', 'ack'

  await ack();

  const actsList = await db.getActs();
  view = chores.claim(actsList);

  const res = await app.client.views.open({
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: shortcut.trigger_id,
    view: view
  });
  console.log(`Chores listed with id ${res.view.id}`);
});

app.view(chores.claimCallbackId, async ({ ack, body }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'view', 'ack'

  await ack();

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const { user, view } = body;
  const actIndex = parseInt(view.state.values.input.options.selected_option.value);
  const act = view.blocks[0].element.options[actIndex];
  const actId = parseInt(act.description.text.split(".")[1]);
  const choreName = act.text.text;

  const textA = `*${user.name}* did *${choreName}* for *${act.description.text} tokens*. Thanks ${user.name}! :sparkles::sparkles:`;
  const textB = "React :+1: to endorse or :-1: to challenge (& probably leave a comment about it).";

  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: process.env.CHORES_CHANNEL,
    blocks: [
      { "type": "section", "text": { "type": "mrkdwn", "text": textA } },
      { "type": "section", "text": { "type": "mrkdwn", "text": textB } }
    ]
  }

  const res = await app.client.chat.postMessage(message);
  const messageId = `${res.channel}.${res.ts}`;

  await db.doAct(actId, user.id, messageId, choreName);

  console.log(`Message posted as ${messageId}`);
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Fin
