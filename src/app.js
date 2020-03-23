require('dotenv').config()

const { App } = require('@slack/bolt');

const chores = require('./channels/chores')

// Create the app

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Define the interface

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

  const response = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: command.trigger_id,
    view: chores.list()
  }

  app.client.views.open(response);
});

// https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
app.view('modal_list', ({ ack, body }) => {
  // 'context', 'logger', 'client', 'next'
  // 'body', 'payload', 'view', 'ack'

  ack();

  // This is silly
  const chore = body.view.state.values.chore_input.chore_select.selected_option;
  const response = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: 'test',
    text: `Congratulations ${body.user.name} on doing ${chore.value} ✨✨`
  }

  app.client.chat.postMessage(response);
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Fin
