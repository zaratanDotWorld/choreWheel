require('dotenv').config();

const { App } = require('@slack/bolt');

const chores = require('./modules/chores/models');

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

// Chores app

const CHORES_CHANNEL = 'test';
const CHORES_LIST = 'chores-list';
const CHORES_LIST_CALLBACK = 'chores-list-callback';

const POLL_VOTE = /poll-vote/;
const POLL_VOTE_UP = 'poll-vote-up';
const POLL_VOTE_DOWN = 'poll-vote-down';
const POLL_VOTE_CANCEL = 'poll-vote-cancel';

app.shortcut(CHORES_LIST, async ({ ack, shortcut }) => {
  await ack();

  const choreActsList = await db.getChoreActs();
  const view = chores.list(choreActsList);
  view.callback_id = CHORES_LIST_CALLBACK;

  const viewPayload = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: shortcut.trigger_id,
    view: view
  };

  const res = await app.client.views.open(viewPayload);
  console.log(`Chores listed with id ${res.view.id}`);
});

app.view(CHORES_LIST_CALLBACK, async ({ ack, body }) => {
  await ack();

  const { user, view } = body;
  const choreAct = getChoreAct(view);

  const textA = `*${user.name}* did *${choreAct.name}* for *${choreAct.description} tokens*. Thanks ${user.name}! :sparkles::sparkles:`;
  const textB = 'React :+1: to endorse or :-1: to challenge (& probably leave a comment about it).';

  const upVote = makeVoteButton(POLL_VOTE_UP, 3);
  const downVote = makeVoteButton(POLL_VOTE_DOWN, 1);
  const cancelVote = makeVoteButton(POLL_VOTE_CANCEL);

  const messagePayload = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: CHORES_CHANNEL,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      { type: 'actions', elements: [ upVote, downVote, cancelVote ] }
    ]
  };

  const res = await app.client.chat.postMessage(messagePayload);
  const messageId = `${res.channel}.${res.ts}`;

  await db.doChoreAct(choreAct.id, choreAct.name, user.id, messageId);

  console.log(`Message posted as ${messageId}`);
});

app.action(POLL_VOTE, async ({ ack, body, action }) => {
  await ack();
  console.log(body);
  console.log(action);
});

// Launch the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();

// Utils

function makeVoteButton (actionId, count = 0) {
  let text = '';

  if (actionId === POLL_VOTE_UP) {
    text = `:+1: (${count})`;
  } else if (actionId === POLL_VOTE_DOWN) {
    text = `:-1: (${count})`;
  } else if (actionId === POLL_VOTE_CANCEL) {
    text = ':x:';
  } else {
    throw new RangeError('Invalid actionId');
  }

  return {
    type: 'button',
    text: { type: 'plain_text', text: text, emoji: true },
    value: actionId,
    action_id: actionId
  };
}

function getChoreAct (view) {
  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const choreActIndex = parseInt(view.state.values.input.options.selected_option.value);
  const choreAct = view.blocks[0].element.options[choreActIndex];

  return {
    id: parseInt(choreAct.description.text.split('.')[1]),
    name: choreAct.text.text,
    description: choreAct.description.text
  };
}

// Fin
