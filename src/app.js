require('dotenv').config()

const { App } = require('@slack/bolt');

const chores = require('./channels/chores')

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Define the interface

app.event('reaction_added', async ({ say, payload }) => {
  // 'context', 'logger', 'client', 'next'
  // 'body', 'payload', 'event', 'say'

  console.log(`User ${payload.user} just added ${payload.reaction} to message ${payload.item.channel}.${payload.item.ts}`);

  app.client.reactions
    .get({
      token: process.env.SLACK_BOT_TOKEN,
      channel: payload.item.channel,
      timestamp: payload.item.ts
    })
    .then(res => { console.log(res.message.reactions); });
})

app.event('reaction_removed', async ({ say, payload }) => {
  // 'context', 'logger', 'client', 'next'
  // 'body', 'payload', 'event', 'say'

  console.log(`User ${payload.user} just removed ${payload.reaction} from message ${payload.item.channel}.${payload.item.ts}`);
})

app.command('/echo', async ({ ack, command, say }) => {
  // 'context', 'logger', 'client', 'next', 'body'
  // 'payload', 'command', 'say','respond', 'ack'

  ack();

  say(`${command.text}`);
});

app.command('/list', ({ ack, command, say }) => {
  // 'context', 'logger', 'client', 'next', 'body'
  // 'payload', 'command', 'say', 'respond', 'ack'

  ack();

  const view = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: command.trigger_id,
    view: chores.list()
  }

  app.client.views
    .open(view);
});

// https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
app.view('modal_list', ({ ack, body }) => {
  // 'context', 'logger', 'client', 'next'
  // 'body', 'payload', 'view', 'ack'

  ack();

  // This is silly
  const value = 100;
  const chore = body.view.state.values.chore_input.chore_select.selected_option;
  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'test',
    text: `**${body.user.name}** did **${chore.value.toLowerCase()}** for **${value} tokens**. Thanks ${body.user.name}! ✨✨ React 👍 to endorse or 👎 to challenge.`
  }

  app.client.chat
    .postMessage(message)
    .then(res => { console.log(`Message posted as ${res.channel}.${res.ts}`); });
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Fin
