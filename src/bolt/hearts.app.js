require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Hearts = require('../modules/hearts');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { YAY } = require('../constants');

const common = require('./common');
const views = require('./views');

let heartsOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.INFO,
  clientId: process.env.HEARTS_CLIENT_ID,
  clientSecret: process.env.HEARTS_CLIENT_SECRET,
  signingSecret: process.env.HEARTS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Hearts') ],
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
    console.log('hearts home');
    const houseId = body.team_id;
    const residentId = event.user;

    const now = new Date();

    await Admin.addResident(houseId, residentId, now);
    await Hearts.initialiseResident(houseId, residentId, now);

    const hearts = await Hearts.getHearts(residentId, now);
    const view = views.heartsHomeView(hearts.sum || 0);
    await common.publishHome(app, heartsOauth, residentId, view);

    // This bookkeeping is done after returning the view
    await Hearts.regenerateHearts(houseId, residentId, now);
    await Hearts.resolveChallenges(houseId, now);

    // Issue karma hearts
    const numWinners = await Hearts.getNumKarmaWinners(houseId);
    const karmaHearts = await Hearts.generateKarmaHearts(houseId, now, numWinners);
    if (karmaHearts.length > 0) {
      const { heartsChannel } = await Admin.getHouse(houseId);
      const karmaWinners = karmaHearts.map((heart) => `<@${heart.residentId}`).join(' and ');
      const text = `${karmaWinners} are last month's karma winners :heart_on_fire:`;
      await common.postMessage(app, heartsOauth, heartsChannel, text);
    }
  }
});

// Slash commands

app.command('/hearts-sync', async ({ ack, command }) => {
  console.log('/hearts-sync');
  await ack();

  await common.syncWorkspace(app, heartsOauth, command);
});

app.command('/hearts-channel', async ({ ack, command }) => {
  console.log('/hearts-channel');
  await ack();

  await common.setChannel(app, heartsOauth, 'heartsChannel', command);
});

// Challenge flow

app.action('hearts-challenge', async ({ ack, body }) => {
  console.log('hearts-challenge');
  await ack();

  const view = views.heartsChallengeView();
  await common.openView(app, heartsOauth, body.trigger_id, view);
});

app.view('hearts-challenge-callback', async ({ ack, body }) => {
  console.log('hearts-challenge-callback');
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

  // TODO: Return error to user (not console) if channel is not set
  const { heartsChannel } = await Admin.getHouse(houseId);
  if (heartsChannel === null) { throw new Error('Hearts channel not set!'); }

  // Initiate the challenge
  const now = new Date();
  const quorum = await Hearts.getChallengeQuorum(houseId, challengeeId, numHearts, now);
  const [ challenge ] = await Hearts.issueChallenge(houseId, residentId, challengeeId, numHearts, now);
  await Polls.submitVote(challenge.pollId, residentId, now, YAY);

  const text = 'Someone just issued a hearts challenge';
  const blocks = views.heartsChallengeCallbackView(challenge, quorum, circumstance);
  await common.postMessage(app, heartsOauth, heartsChannel, text, blocks);
});

// Board flow

app.action('hearts-board', async ({ ack, body }) => {
  console.log('hearts-board');
  await ack();

  const houseId = body.team.id;
  const hearts = await Hearts.getHouseHearts(houseId, new Date());

  const view = views.heartsBoardView(hearts);
  await common.openView(app, heartsOauth, body.trigger_id, view);
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  console.log('hearts poll-vote');
  await ack();

  await common.updateVoteCounts(app, heartsOauth, body, action);
});

// Karma flow

app.event('message', async ({ payload }) => {
  const karmaRecipients = Hearts.getKarmaRecipients(payload.text);

  if (karmaRecipients.length > 0) {
    console.log('karma message');
    const houseId = payload.team;
    const giverId = payload.user;

    const now = new Date();
    for (const receiverId of karmaRecipients) {
      await Hearts.giveKarma(houseId, giverId, receiverId, now);
    }

    await common.addReaction(app, heartsOauth, payload, 'sparkles');
  }
});

// Launch the app

(async () => {
  const port = process.env.HEARTS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Hearts app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
