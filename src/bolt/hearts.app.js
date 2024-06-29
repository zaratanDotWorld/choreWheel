require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Hearts } = require('../core/index');
const { YAY, HEARTS_CONF } = require('../constants');
const { sleep } = require('../utils');

const common = require('./common');
const views = require('./hearts.views');

let heartsConf;

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
    'groups:history',
    'users:read',
    'reactions:write',
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      await Admin.addHouse(installation.team.id, installation.team.name);
      await Admin.updateHouseConf(installation.team.id, HEARTS_CONF, { oauth: installation });
      console.log(`hearts installed @ ${installation.team.id}`);
    },
    fetchInstallation: async (installQuery) => {
      ({ heartsConf } = (await Admin.getHouse(installQuery.teamId)));
      return heartsConf.oauth;
    },
    deleteInstallation: async (installQuery) => {
      await Admin.updateHouseConf(installQuery.teamId, HEARTS_CONF, { oauth: null });
      console.log(`hearts uninstalled @ ${installQuery.teamId}`);
    },
  },
  installerOptions: { directInstall: true },
});

// Define publishing functions

async function postMessage (text, blocks) {
  return common.postMessage(app, heartsConf.oauth, heartsConf.channel, text, blocks);
}

async function postEphemeral (residentId, text) {
  return common.postEphemeral(app, heartsConf.oauth, heartsConf.channel, residentId, text);
}

// Event listeners

app.event('user_change', async ({ payload }) => {
  const { user } = payload;
  console.log(`hearts user_change - ${user.team_id} x ${user.id}`);

  await sleep(1 * 1000);
  await common.syncWorkspaceMember(user.team_id, user, new Date());
});

app.event('channel_created', async ({ payload }) => {
  const { channel } = payload;
  console.log(`hearts channel_created - ${channel.context_team_id} x ${channel.creator}`);

  await common.joinChannel(app, heartsConf.oauth, channel.id);
});

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log(`hearts home - ${body.team_id} x ${event.user}`);

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);
    await Hearts.initialiseResident(houseId, residentId, now);

    let view;
    if (heartsConf.channel) {
      const hearts = await Hearts.getHearts(residentId, now);
      const maxHearts = await Hearts.getResidentMaxHearts(residentId, now);
      const exempt = await Admin.isExempt(residentId, now);

      view = views.heartsHomeView(hearts.sum || 0, maxHearts, exempt);
    } else {
      view = views.heartsIntroView();
    }

    await common.publishHome(app, heartsConf.oauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any challanges
    for (const resolvedChallenge of (await Hearts.resolveChallenges(houseId, now))) {
      console.log(`resolved heartChallenge ${resolvedChallenge.id}`);
      await common.updateVoteResults(app, heartsConf.oauth, resolvedChallenge.pollId, now);
    }

    for (const challengeHeart of (await Hearts.getAgnosticHearts(houseId, now))) {
      const text = `<@${challengeHeart.residentId}> lost a challenge, ` +
        `and *${(-challengeHeart.value).toFixed(0)}* heart(s)...`;
      await postMessage(text);
    }

    // Regenerate lost hearts // fade karma hearts
    for (const regenHeart of (await Hearts.regenerateHouseHearts(houseId, now))) {
      if (regenHeart.value !== 0) {
        const text = (regenHeart.value > 0)
          ? `You regenerated *${regenHeart.value.toFixed(1)}* heart(s)!`
          : `Your karma faded by *${(-regenHeart.value).toFixed(1)}* heart(s)!`;
        await postEphemeral(regenHeart.residentId, text);
      }
    }

    // Issue karma hearts
    const karmaHearts = await Hearts.generateKarmaHearts(houseId, now);
    if (karmaHearts.length) {
      const karmaWinners = karmaHearts.map(heart => `<@${heart.residentId}>`).join(' and ');
      const text = (karmaHearts.length > 1)
        ? `${karmaWinners} get last month's karma hearts :heart_on_fire:`
        : `${karmaWinners} gets last month's karma heart :heart_on_fire:`;

      await postMessage(text);
    }
  }
});

// Slash commands

app.command('/hearts-sync', async ({ ack, command }) => {
  await ack();

  const commandName = '/hearts-sync';
  common.beginCommand(commandName, command);

  await common.syncWorkspace(app, heartsConf.oauth, command, true, true);
});

app.command('/hearts-channel', async ({ ack, command }) => {
  await ack();

  const commandName = '/hearts-channel';
  common.beginCommand(commandName, command);

  await common.setChannel(app, heartsConf.oauth, HEARTS_CONF, command);
  await common.syncWorkspace(app, heartsConf.oauth, command, true, true);
});

// Challenge flow

app.action('hearts-challenge', async ({ ack, body }) => {
  await ack();

  const actionName = 'hearts-challenge';
  const { now, houseId } = common.beginAction(actionName, body);

  const votingResidents = await Admin.getVotingResidents(houseId, now);

  const view = views.heartsChallengeView(votingResidents.length);
  await common.openView(app, heartsConf.oauth, body.trigger_id, view);
});

app.view('hearts-challenge-callback', async ({ ack, body }) => {
  await ack();

  const actionName = 'hearts-challenge-callback';
  const { now, houseId, residentId } = common.beginAction(actionName, body);

  const challengeeId = common.getInputBlock(body, 2).challengee.selected_user;
  const numHearts = common.getInputBlock(body, 3).hearts.selected_option.value;
  const circumstance = common.getInputBlock(body, 4).circumstance.value;

  const unresolvedChallenges = await Hearts.getUnresolvedChallenges(houseId, challengeeId);

  if (await Admin.isExempt(challengeeId, now)) {
    const text = `<@${challengeeId}> is exempt and cannot be challenged :weary:`;
    await postEphemeral(residentId, text);
  } else if (unresolvedChallenges.length) {
    const text = `<@${challengeeId}> is already being challenged!`;
    await postEphemeral(residentId, text);
  } else {
    // Initiate the challenge
    const [ challenge ] = await Hearts.issueChallenge(houseId, residentId, challengeeId, numHearts, now, circumstance);
    await Polls.submitVote(challenge.pollId, residentId, now, YAY);

    const { minVotes } = await Polls.getPoll(challenge.pollId);

    const text = 'Someone just issued a hearts challenge';
    const blocks = views.heartsChallengeCallbackView(challenge, minVotes, circumstance);
    const { channel, ts } = await postMessage(text, blocks);
    await Polls.updateMetadata(challenge.pollId, { channel, ts });
  }
});

// Board flow

app.action('hearts-board', async ({ ack, body }) => {
  await ack();

  const actionName = 'hearts-board';
  const { now, houseId } = common.beginAction(actionName, body);

  const hearts = await Hearts.getHouseHearts(houseId, now);

  const view = views.heartsBoardView(hearts);
  await common.openView(app, heartsConf.oauth, body.trigger_id, view);
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  const actionName = 'hearts poll-vote';
  common.beginAction(actionName, body);

  await common.updateVoteCounts(app, heartsConf.oauth, body, action);
});

// Karma flow

app.event('message', async ({ payload }) => {
  const karmaRecipients = Hearts.getKarmaRecipients(payload.text);

  if (karmaRecipients.length > 0) {
    console.log(`hearts karma-message - ${payload.team} x ${payload.user}`);

    const now = new Date();
    const houseId = payload.team;
    const giverId = payload.user;

    for (const receiverId of karmaRecipients) {
      await Hearts.giveKarma(houseId, giverId, receiverId, now);
    }

    await common.addReaction(app, heartsConf.oauth, payload, 'sparkles');
  }

  if (karmaRecipients.length > 1 && karmaRecipients.length < 10) {
    const numbers = [ 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine' ];

    await common.addReaction(app, heartsConf.oauth, payload, numbers[karmaRecipients.length]);
  }
});

// Launch the app

(async () => {
  const port = process.env.HEARTS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Hearts app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
