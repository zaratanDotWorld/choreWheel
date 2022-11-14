require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Hearts = require('../modules/hearts');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { YAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

let res;
let heartsOauth;

// Create the app

const home = {
  path: '/',
  method: [ 'GET' ],
  handler: async (_, res) => {
    res.writeHead(200);
    res.end('Welcome to Mirror - Hearts!');
  }
};

const app = new App({
  logLevel: LogLevel.DEBUG,
  clientId: process.env.HEARTS_CLIENT_ID,
  clientSecret: process.env.HEARTS_CLIENT_SECRET,
  signingSecret: process.env.HEARTS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ home ],
  scopes: [
    'channels:history', 'channels:read',
    'chat:write',
    'commands',
    'users:read',
    'reactions:write'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      return Admin.updateHouse({ slackId: installation.team.id, heartsOauth: installation });
    },
    fetchInstallation: async (installQuery) => {
      ({ heartsOauth } = await Admin.getHouse(installQuery.teamId));
      return heartsOauth;
    },
    deleteInstallation: async (installQuery) => {
      return Admin.updateHouse({ slackId: installQuery.teamId, heartsOauth: null });
    }
  },
  installerOptions: { directInstall: true }
});

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    const houseId = body.team_id;
    const residentId = event.user;

    const now = new Date();

    await Admin.addResident(houseId, residentId, now);
    await Hearts.initialiseResident(houseId, residentId, now);
    await sleep(5);

    const hearts = await Hearts.getHearts(houseId, residentId, now);

    const data = {
      token: heartsOauth.bot.token,
      user_id: residentId,
      view: blocks.heartsHomeView(hearts.sum || 0)
    };
    res = await app.client.views.publish(data);

    // This bookkeeping is done asynchronously after returning the view
    await Hearts.regenerateHearts(houseId, residentId, now);
    await Hearts.resolveChallenges(houseId, now);

    const [ karmaHeart ] = await Hearts.generateKarmaHeart(houseId, now);
    if (karmaHeart !== undefined) {
      const { heartsChannel } = await Admin.getHouse(houseId);
      const message = {
        token: heartsOauth.bot.token,
        channel: heartsChannel,
        text: `<@${karmaHeart.residentId}> is last month's karma winner :heart_on_fire:`
      };
      res = await app.client.chat.postMessage(message);
    }
  }
});

// Slash commands

async function getUser (userId) {
  return app.client.users.info({
    token: heartsOauth.bot.token,
    user: userId
  });
}

function prepareEphemeral (command, text) {
  return {
    token: heartsOauth.bot.token,
    channel: command.channel_id,
    user: command.user_id,
    text: text
  };
}

app.command('/hearts-channel', async ({ ack, command }) => {
  await ack();

  const channelName = command.text;
  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    // TODO: return a friendly error if the channel doesn't exist
    res = await app.client.conversations.list({ token: heartsOauth.bot.token });
    const channelId = res.channels.filter(channel => channel.name === channelName)[0].id;

    await Admin.updateHouse({ slackId: houseId, heartsChannel: channelId });

    text = `Heart challenges channel set to ${channelName} :fire:\nPlease add the Hearts bot to the channel`;
    console.log(`Set heart challenges channel to ${channelName}`);
  } else {
    text = 'Only admins can set the channels...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

// Challenge flow

app.action('hearts-challenge', async ({ ack, body }) => {
  await ack();

  const view = {
    token: heartsOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.heartsChallengeView()
  };

  res = await app.client.views.open(view);
  console.log(`Hearts-challenge opened with id ${res.view.id}`);
});

app.view('hearts-challenge-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const challengeeBlockId = body.view.blocks[2].block_id;
  const numHeartsBlockId = body.view.blocks[3].block_id;
  const circumstanceBlockId = body.view.blocks[4].block_id;

  const challengeeId = body.view.state.values[challengeeBlockId].challengee.selected_user;
  const numHearts = body.view.state.values[numHeartsBlockId].hearts.selected_option.value;
  const circumstance = body.view.state.values[circumstanceBlockId].circumstance.value;

  const { heartsChannel } = await Admin.getHouse(houseId);

  // TODO: Return error to user (not console) if channel is not set
  if (heartsChannel === null) { throw new Error('Hearts channel not set!'); }

  // Initiate the challenge
  const now = new Date();
  const quorum = await Hearts.getChallengeQuorum(houseId, challengeeId, numHearts, now);
  const [ challenge ] = await Hearts.issueChallenge(houseId, residentId, challengeeId, numHearts, now);
  await Polls.submitVote(challenge.pollId, residentId, now, YAY);

  const message = {
    token: heartsOauth.bot.token,
    channel: heartsChannel,
    text: 'Someone just issued a hearts challenge',
    blocks: blocks.heartsChallengeCallbackView(challenge, quorum, circumstance)
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Challenge ${challenge.id} created with poll ${challenge.pollId}`);
});

// Board flow

app.action('hearts-board', async ({ ack, body }) => {
  await ack();

  const houseId = body.team.id;

  const hearts = await Hearts.getHouseHearts(houseId, new Date());

  const view = {
    token: heartsOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.heartsBoardView(hearts)
  };

  res = await app.client.views.open(view);
  console.log(`Hearts-board opened with id ${res.view.id}`);
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  const residentId = body.user.id;
  const channelId = body.channel.id;

  // // Submit the vote
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, residentId, new Date(), value);

  await sleep(5);

  const { yays, nays } = await Polls.getPollResultCounts(pollId);

  // Update the vote counts
  const buttonsIndex = body.message.blocks.length - 1;
  body.message.token = heartsOauth.bot.token;
  body.message.channel = channelId;
  body.message.blocks[buttonsIndex].elements = blocks.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);

  console.log(`Poll ${pollId} updated`);
});

// Karma flow

app.event('message', async ({ payload }) => {
  const regex = /<@(\w+)>\s*\+\+/;
  const matches = regex.exec(payload.text);

  if (matches !== null) {
    const houseId = payload.team;
    const giverId = payload.user;
    const receiverId = matches[1];

    await Hearts.giveKarma(houseId, giverId, receiverId, new Date());

    await app.client.reactions.add({
      token: heartsOauth.bot.token,
      channel: payload.channel,
      timestamp: payload.event_ts,
      name: 'sparkles'
    });
  }
});

// Launch the app

(async () => {
  const port = process.env.HEARTS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Hearts app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
