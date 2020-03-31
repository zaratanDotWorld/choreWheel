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

app.command('/list', async ({ ack, command, say }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'command', 'say', 'respond', 'ack'

  await ack();

  const view = await chores.list(db);
  const response = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: command.trigger_id,
    view: view
  }
  await app.client.views.open(response);
});

app.view(chores.callback_id, async ({ ack, body }) => {
  // 'context', 'logger', 'client', 'next', 'body', 'payload', 'view', 'ack'

  await ack();

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const chore = body.view.state.values.chore_input.chore_select.selected_option;
  const value = 100;
  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'test',
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${body.user.name}* did *${chore.value.toLowerCase()}* for *${value} tokens*. Thanks ${body.user.name}! :sparkles::sparkles:`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "React :+1: to endorse or :-1: to challenge."
        }
      }
    ]
  }
  const res = await app.client.chat.postMessage(message);
  console.log(`Message posted as ${res.channel}.${res.ts}`);
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Fin
