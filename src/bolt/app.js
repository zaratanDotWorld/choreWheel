require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Chores = require('../modules/chores');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { choresPollLength, pointsPerResident } = require('../config');
const { YAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

let res;
let choresOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.DEBUG,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  scopes: [
    'channels:history', 'channels:read',
    'chat:write',
    'commands',
    'users:read'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      return Admin.updateHouse({ slackId: installation.team.id, choresOauth: installation });
    },
    fetchInstallation: async (installQuery) => {
      ({ choresOauth } = await Admin.getHouse(installQuery.teamId));
      return choresOauth;
    },
    deleteInstallation: async (installQuery) => {
      return Admin.updateHouse({ slackId: installQuery.teamId, choresOauth: null });
    }
  },
  installerOptions: { directInstall: true }
});

// Publish the app home

app.event('app_home_opened', async ({ payload }) => {
  if (payload.tab === 'home') {
    await Admin.addResident(payload.view.team_id, payload.user, '');
    console.log(`Added house ${payload.view.team_id}`);
    console.log(`Added resident ${payload.user}`);

    const chorePoints = 10; // TODO: Implement this function

    const data = {
      token: choresOauth.bot.token,
      user_id: payload.user,
      view: blocks.choresHomeView(chorePoints)
    };
    await app.client.views.publish(data);
  }
});

// Slash commands

async function getUser (userId) {
  return app.client.users.info({
    token: choresOauth.bot.token,
    user: userId
  });
}

function prepareEphemeral (command, text) {
  return {
    token: choresOauth.bot.token,
    channel: command.channel_id,
    user: command.user_id,
    text: text
  };
}

app.command('/chores-channel', async ({ ack, command, say }) => {
  await ack();

  const channelName = command.text;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    // TODO: return a friendly error if the channel doesn't exist
    res = await app.client.conversations.list({ token: choresOauth.bot.token });
    const channelId = res.channels.filter(channel => channel.name === channelName)[0].id;

    await Admin.setChoreClaimsChannel(command.team_id, channelId);

    text = `Chore claims channel set to ${channelName} :fire:`;
    console.log(`Set chore claims channel to ${channelName}`);
  } else {
    text = 'Only admins can set the channels...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/chores-add', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.addChore(command.team_id, choreName);

    text = `${choreName} added to the chores list :star-struck:`;
    console.log(`Added chore ${choreName}`);
  } else {
    text = 'Only admins can update the chore list...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/chores-del', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.addChore(command.team_id, choreName);

    text = `${choreName} added to the chores list :star-struck:`;
    console.log(`Added chore ${choreName}`);
  } else {
    text = 'Only admins can update the chore list...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/chores-list', async ({ ack, command, say }) => {
  await ack();

  const chores = await Chores.getChores(command.team_id);
  const choreNames = chores.map((chore) => `\n${chore.name}`);

  const text = `The current chores:${choreNames}`;
  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

// Claim flow

app.action('chores-claim', async ({ ack, body, action }) => {
  await ack();

  // Update the chore values
  await Chores.updateChoreValues(body.team.id, new Date(), pointsPerResident);

  const choreValues = await Chores.getCurrentChoreValues(body.team.id, new Date());

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresClaimView(choreValues)
  };

  res = await app.client.views.open(view);
  console.log(`Chores-claim opened with id ${res.view.id}`);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  await ack();

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const blockId = body.view.blocks[0].block_id;
  const [ choreId, choreName, choreValue ] = body.view.state.values[blockId].options.selected_option.value.split('|');

  // TODO: Return error to user if channel is not set
  const residentId = body.user.id;
  const { choresChannel } = await Admin.getHouse(body.team.id);

  // Perform the claim
  const [ claim ] = await Chores.claimChore(choreId, residentId, new Date(), choresPollLength);
  await Polls.submitVote(claim.pollId, residentId, new Date(), YAY);

  const message = {
    token: choresOauth.bot.token,
    channel: choresChannel,
    text: 'Someone just completed a chore',
    blocks: blocks.choresClaimCallbackView(residentId, choreName, Number(choreValue), claim.pollId, choresPollLength)
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Claim ${claim.id} created with poll ${claim.pollId}`);
});

// Ranking flow

app.action('chores-rank', async ({ ack, body, action }) => {
  await ack();

  const chores = await Chores.getChores(body.team.id);

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresRankView(chores)
  };

  res = await app.client.views.open(view);
  console.log(`Chores-rank opened with id ${res.view.id}`);
});

app.view('chores-rank-callback', async ({ ack, body }) => {
  await ack();

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const targetBlockId = body.view.blocks[2].block_id;
  const sourceBlockId = body.view.blocks[3].block_id;
  const valueBlockId = body.view.blocks[4].block_id;

  const [ targetChoreId, targetChoreName ] = body.view.state.values[targetBlockId].chores.selected_option.value.split('|');
  const [ sourceChoreId, sourceChoreName ] = body.view.state.values[sourceBlockId].chores.selected_option.value.split('|');
  const strength = body.view.state.values[valueBlockId].strength.selected_option.value;

  let alphaChoreId;
  let betaChoreId;
  let preference;

  // TODO: Return a friendly error if you try to prefer a chore to itself

  // Value flows from source to target, and from beta to alpha
  if (parseInt(targetChoreId) < parseInt(sourceChoreId)) {
    alphaChoreId = parseInt(targetChoreId);
    betaChoreId = parseInt(sourceChoreId);
    preference = Number(strength);
  } else {
    alphaChoreId = parseInt(sourceChoreId);
    betaChoreId = parseInt(targetChoreId);
    preference = 1.0 - Number(strength);
  }

  const { choresChannel } = await Admin.getHouse(body.team.id);

  // Perform the update
  await Chores.setChorePreference(body.team.id, body.user.id, alphaChoreId, betaChoreId, preference);

  const message = {
    token: choresOauth.bot.token,
    channel: choresChannel,
    text: `Someone just prioritized ${targetChoreName} over ${sourceChoreName} :rocket:`
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Chore preference updated, ${alphaChoreId} vs ${betaChoreId} at ${preference}`);
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  // // Submit the vote
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, body.user.id, new Date(), value);

  await sleep(1);

  const { yays, nays } = await Polls.getPollResultCounts(pollId);

  // Update the vote counts
  body.message.token = choresOauth;
  body.message.channel = body.channel.id;
  body.message.blocks[2].elements = blocks.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);

  console.log(`Poll ${pollId} updated`);
});

// Launch the app

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
