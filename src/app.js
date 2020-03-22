require('dotenv').config()

const { App } = require('@slack/bolt');

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

  app.client.views.open({
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: command.trigger_id,
    view: {
      type: "modal",
      callback_id: "modal-identifier",
      title: {
        type: "plain_text",
        text: "Just a modal"
      },
      blocks: [
        {
          type: "section",
          block_id: "section-identifier",
          text: {
            type: "mrkdwn",
            text: "*Welcome* to ~my~ Block Kit _modal_!"
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Just a button"
            },
            action_id: "button_click"
          }
        }
      ]
    }
  });

});


app.action('button_click', ({ ack }) => {
  // 'context', 'logger', 'client', 'next'
  // 'body', 'payload', 'action', 'ack'

  ack();
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Fin
