require('dotenv').config();
require('newrelic');

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Hearts } = require('../core/index');
const { YAY } = require('../constants');

const common = require('./common');
const views = require('./hearts.views');

let heartsOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.WARN,
  clientId: process.env.HEARTS_CLIENT_ID,
  clientSecret: process.env.HEARTS_CLIENT_SECRET,
  signingSecret: process.env.HEARTS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Hearts') ],
  scopes: [
    'channels:history',
    'channels:join',
    'channels:read',
    'chat:write',
    'commands',
    'users:read',
    'reactions:write',
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      await Admin.addHouse(installation.team.id);
      await Admin.updateHouse(installation.team.id, { heartsOauth: installation });
      console.log(`hearts installed @ ${installation.team.id}`);
    },
    fetchInstallation: async (installQuery) => {
      ({ heartsOauth } = (await Admin.getHouse(installQuery.teamId)).metadata);
      return heartsOauth;
    },
    deleteInstallation: async (installQuery) => {
      await Admin.updateHouse(installQuery.teamId, { heartsOauth: null });
      console.log(`hearts uninstalled @ ${installQuery.teamId}`);
    },
  },
  installerOptions: { directInstall: true },
});

// Define publishing functions

async function postMessage (houseId, text, blocks) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postMessage(app, heartsOauth, metadata.heartsChannel, text, blocks);
}

async function postEphemeral (houseId, residentId, text) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postEphemeral(app, heartsOauth, metadata.heartsChannel, residentId, text);
}

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log('hearts home');

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);
    await Hearts.initialiseResident(houseId, residentId, now);

    let view;
    if ((await Admin.getHouse(houseId)).metadata.heartsChannel) {
      const hearts = await Hearts.getHearts(residentId, now);
      const exempt = await Admin.isExempt(residentId, now);

      view = views.heartsHomeView(hearts.sum || 0, exempt);
    } else {
      view = common.introHomeView('Hearts');
    }

    await common.publishHome(app, heartsOauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any challanges
    for (const resolvedChallenge of (await Hearts.resolveChallenges(houseId, now))) {
      console.log(`resolved heartChallenge ${resolvedChallenge.id}`);
      await common.updateVoteResults(app, heartsOauth, resolvedChallenge.pollId);
    }

    for (const challengeHeart of (await Hearts.getAgnosticHearts(houseId, now))) {
      const text = `<@${challengeHeart.residentId}> lost a challenge, ` +
        `and *${(-challengeHeart.value).toFixed(0)}* heart(s)...`;
      await postMessage(houseId, text);
    }

    // Regenerate lost hearts // decay karma hearts
    for (const regenHeart of (await Hearts.regenerateHouseHearts(houseId, now))) {
      // Notify for regeneration only
      if (regenHeart.value > 0) {
        const text = `You regenerated *${regenHeart.value.toFixed(1)}* heart(s)!`;
        await postEphemeral(houseId, regenHeart.residentId, text);
      }
    }

    // Issue karma hearts
    const karmaHearts = await Hearts.generateKarmaHearts(houseId, now);
    if (karmaHearts.length) {
      const karmaWinners = karmaHearts.map(heart => `<@${heart.residentId}>`).join(' and ');
      const text = (karmaHearts.length > 1)
        ? `${karmaWinners} get last month's karma hearts :heart_on_fire:`
        : `${karmaWinners} gets last month's karma heart :heart_on_fire:`;
      await postMessage(houseId, text);
    }
  }
});

// Slash commands

app.command('/hearts-sync', async ({ ack, command }) => {
  console.log('/hearts-sync');
  await ack();

  await common.syncWorkspace(app, heartsOauth, command, true, true);
});

app.command('/hearts-channel', async ({ ack, command }) => {
  console.log('/hearts-channel');
  await ack();

  await common.setChannel(app, heartsOauth, command, 'heartsChannel');

  if (command.text !== 'help') {
    await common.syncWorkspace(app, heartsOauth, command, true, true);
  }
});

// Challenge flow

app.action('hearts-challenge', async ({ ack, body }) => {
  console.log('hearts-challenge');
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const votingResidents = await Admin.getVotingResidents(houseId, now);
  const view = views.heartsChallengeView(votingResidents.length);
  await common.openView(app, heartsOauth, body.trigger_id, view);
});

app.view('hearts-challenge-callback', async ({ ack, body }) => {
  console.log('hearts-challenge-callback');
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const challengeeId = common.getInputBlock(body, 2).challengee.selected_user;
  const numHearts = common.getInputBlock(body, 3).hearts.selected_option.value;
  const circumstance = common.getInputBlock(body, 4).circumstance.value;

  const unresolvedChallenges = await Hearts.getUnresolvedChallenges(houseId, challengeeId);

  if (await Admin.isExempt(challengeeId, now)) {
    const text = `<@${challengeeId}> is exempt and cannot be challenged :weary:`;
    await postEphemeral(houseId, residentId, text);
  } else if (unresolvedChallenges.length) {
    const text = `<@${challengeeId}> is already being challenged!`;
    await postEphemeral(houseId, residentId, text);
  } else {
    // Initiate the challenge
    const [ challenge ] = await Hearts.issueChallenge(houseId, residentId, challengeeId, numHearts, now, circumstance);
    await Polls.submitVote(challenge.pollId, residentId, now, YAY);

    const { minVotes } = await Polls.getPoll(challenge.pollId);

    const text = 'Someone just issued a hearts challenge';
    const blocks = views.heartsChallengeCallbackView(challenge, minVotes, circumstance);
    const { channel, ts } = await postMessage(houseId, text, blocks);
    await Polls.updateMetadata(challenge.pollId, { channel, ts });
  }
});

// Board flow

app.action('hearts-board', async ({ ack, body }) => {
  console.log('hearts-board');
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const hearts = await Hearts.getHouseHearts(houseId, now);

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

    const now = new Date();
    const houseId = payload.team;
    const giverId = payload.user;

    for (const receiverId of karmaRecipients) {
      await Hearts.giveKarma(houseId, giverId, receiverId, now);
    }

    await common.addReaction(app, heartsOauth, payload, 'sparkles');
  }

  if (karmaRecipients.length > 1 && karmaRecipients.length < 10) {
    const numbers = [ 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine' ];

    await common.addReaction(app, heartsOauth, payload, numbers[karmaRecipients.length]);
  }
});

// Launch the app

(async () => {
  const port = process.env.HEARTS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Hearts app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
