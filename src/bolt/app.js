require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Chores = require('../modules/chores');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { choresPollLength, pointsPerResident } = require('../config');
const { YAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

// Create the app

let res;

const app = new App({
  logLevel: LogLevel.DEBUG,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  scopes: [
    'channels:history',
    'channels:read',
    'chat:write',
    'users:read',
    'commands'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      return Admin.updateHouse({ slack_id: installation.team.id, chores_oauth: installation.bot.token });
    },
    fetchInstallation: async (installQuery) => {
      const house = await Admin.getHouse(installQuery.teamId);
      return Promise.resolve(house.chores_oauth);
    },
    deleteInstallation: async (installQuery) => {
      return Admin.updateHouse({ slack_id: installQuery.teamId, chores_oauth: null });
    }
  },
  installerOptions: { directInstall: true }
});

// Publish the app home

app.event('app_home_opened', async ({ payload }) => {
  if (payload.tab === 'home') {
    await Admin.addHouse(payload.view.team_id, '');
    await Admin.addResident(payload.view.team_id, payload.user, '');
    console.log(`Added house ${payload.view.team_id}`);
    console.log(`Added resident ${payload.user}`);

    const chorePoints = 10; // TODO: Implement this function

    const data = {
      token: process.env.SLACK_BOT_TOKEN,
      user_id: payload.user,
      view: blocks.choresHomeView(chorePoints)
    };
    await app.client.views.publish(data);
  }
});

// Slash commands

async function getUser (userId) {
  return app.client.users.info({
    token: process.env.SLACK_BOT_TOKEN,
    user: userId
  });
}

app.command('/chores-channel', async ({ ack, command, say }) => {
  await ack();

  const channelName = command.text;
  const userInfo = await getUser(command.user_id);

  if (userInfo.user.is_admin) {
    let channelId;

    try {
      res = await app.client.conversations.list({ token: process.env.SLACK_BOT_TOKEN });
      channelId = res.channels.filter(channel => channel.name === channelName)[0].id;
    } catch (err) {
      await say(`Channel ${channelName} not found...`);
      throw err;
    }

    await Admin.setChoreClaimsChannel(command.team_id, channelId);

    await say(`Chore claims channel set to ${channelName} :fire:`);
    console.log(`Set chore claims channel to ${channelName}`);
  } else {
    await say('Only admins can set the channels...');
  }
});

app.command('/chores-add', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await getUser(command.user_id);

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.addChore(command.team_id, choreName);

    await say(`${choreName} added to the chores list :star-struck:`);
    console.log(`Added chore ${choreName}`);
  } else {
    await say('Only admins can update the chore list...');
  }
});

app.command('/chores-del', async ({ ack, command, say }) => {
  await ack();

  const userInfo = await getUser(command.user_id);

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.deleteChore(command.team_id, choreName);

    await say(`${choreName} deleted from the chores list :sob:`);
    console.log(`Deleted chore ${choreName}`);
  } else {
    await say('Only admins can update the chore list...');
  }
});

app.command('/chores-list', async ({ ack, command, say }) => {
  await ack();

  const chores = await Chores.getChores(command.team_id);
  const choreNames = chores.map((chore) => `\n${chore.name}`);

  await say(`The current chores:${choreNames}`);
});

// Claim flow

app.action('chores-claim', async ({ ack, body, action }) => {
  await ack();

  // Update the chore values
  await Chores.updateChoreValues(body.team.id, new Date(), pointsPerResident);

  const choreValues = await Chores.getCurrentChoreValues(body.team.id, new Date());

  const view = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: body.trigger_id,
    view: blocks.choresListView(choreValues)
  };

  res = await app.client.views.open(view);
  console.log(`Chores listed with id ${res.view.id}`);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  await ack();

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const blockId = body.view.blocks[0].block_id;
  const [ choreId, choreName, choreValue ] = body.view.state.values[blockId].options.selected_option.value.split('|');

  const residentId = body.user.id;
  const { chores_channel: choresChannel } = await Admin.getHouse(body.team.id);

  const [ claim ] = await Chores.claimChore(choreId, residentId, new Date(), choresPollLength);
  await Polls.submitVote(claim.poll_id, residentId, new Date(), YAY);

  const message = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: choresChannel,
    text: 'Someone just completed a chore',
    blocks: blocks.choreListCallbackView(residentId, choreName, Number(choreValue), claim.poll_id, choresPollLength)
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Claim ${claim.id} created with poll ${claim.poll_id}`);
});

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  // // Submit the vote
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, body.user.id, new Date(), value);

  await sleep(1);

  const { yays, nays } = await Polls.getPollResultCounts(pollId);

  // Update the vote counts
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
