require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Chores = require('../modules/chores');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { pointsPerResident, displayThreshold } = require('../config');
const { YAY, MINUTE, DAY } = require('../constants');
const { sleep, getMonthStart } = require('../utils');

const blocks = require('./blocks');

let res;
let choresOauth;

// Create the app

const home = {
  path: '/',
  method: [ 'GET' ],
  handler: async (_, res) => {
    res.writeHead(200);
    res.end('Welcome to Mirror - Chores!');
  }
};

const app = new App({
  logLevel: LogLevel.INFO,
  signingSecret: process.env.CHORES_SIGNING_SECRET,
  clientId: process.env.CHORES_CLIENT_ID,
  clientSecret: process.env.CHORES_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ home ],
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

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    const houseId = body.team_id;
    const residentId = event.user;

    const now = new Date();

    await Admin.addResident(houseId, residentId, now);
    console.log(`Added resident ${residentId}`);

    const monthStart = getMonthStart(now);
    const chorePoints = await Chores.getAllChorePoints(residentId, monthStart, now);
    const activePercentage = await Chores.getActiveResidentPercentage(residentId, now);

    const data = {
      token: choresOauth.bot.token,
      user_id: residentId,
      view: blocks.choresHomeView(chorePoints.sum || 0, activePercentage * pointsPerResident)
    };
    await app.client.views.publish(data);

    // This bookkeeping is done asynchronously after returning the view
    await Chores.resolveChoreClaims(houseId, now);
    // await Chores.addChorePenalty(houseId, residentId, now);
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

app.command('/chores-channel', async ({ ack, command }) => {
  await ack();

  const channelName = command.text;
  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    // TODO: return a friendly error if the channel doesn't exist
    res = await app.client.conversations.list({ token: choresOauth.bot.token });
    const channelId = res.channels.filter(channel => channel.name === channelName)[0].id;

    await Admin.updateHouse({ slackId: houseId, choresChannel: channelId });

    text = `Chore claims channel set to ${channelName} :fire:\nPlease add the Chores bot to the channel`;
    console.log(`Set chore claims channel to ${channelName}`);
  } else {
    text = 'Only admins can set the channels...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/chores-add', async ({ ack, command }) => {
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

app.command('/chores-del', async ({ ack, command }) => {
  await ack();

  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const choreName = blocks.formatChoreName(command.text);
    await Chores.deleteChore(command.team_id, choreName);

    text = `${choreName} removed from the chores list :sob:`;
    console.log(`Deleted chore ${choreName}`);
  } else {
    text = 'Only admins can update the chore list...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/chores-sync', async ({ ack, command }) => {
  await ack();

  const SLACKBOT = 'USLACKBOT';

  const now = new Date();
  const workspaceMembers = await app.client.users.list({ token: choresOauth.bot.token });

  for (const member of workspaceMembers.members) {
    if (!member.is_bot & member.id !== SLACKBOT) {
      member.deleted
        ? await Admin.deleteResident(member.team_id, member.id)
        : await Admin.addResident(member.team_id, member.id, now);
    }
  }

  await sleep(5);
  const residents = await Admin.getResidents(workspaceMembers.members[0].team_id);

  const text = `Synced workspace, ${residents.length} active residents found`;
  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

// Claim flow

app.action('chores-claim', async ({ ack, body }) => {
  await ack();

  const choreValues = await Chores.getUpdatedChoreValues(body.team.id, new Date(), pointsPerResident);
  const filteredChoreValues = choreValues.filter(choreValue => choreValue.value >= displayThreshold);

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresClaimView(filteredChoreValues)
  };

  res = await app.client.views.open(view);
  console.log(`Chores-claim opened with id ${res.view.id}`);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const blockIndex = body.view.blocks.length - 1;
  const blockId = body.view.blocks[blockIndex].block_id;
  const [ choreId, choreName ] = body.view.state.values[blockId].options.selected_option.value.split('|');

  const { choresChannel } = await Admin.getHouse(houseId);

  // TODO: Return error to user (not console) if channel is not set
  if (choresChannel === null) { throw new Error('Chores channel not set!'); }

  // Get chore points over last six months
  const now = new Date();
  const monthStart = getMonthStart(now);
  const sixMonths = new Date(now.getTime() - 180 * DAY);
  const monthlyPoints = await Chores.getAllChorePoints(residentId, monthStart, now);
  const recentPoints = await Chores.getChorePoints(residentId, choreId, sixMonths, now);

  // Perform the claim
  const [ claim ] = await Chores.claimChore(houseId, choreId, residentId, now);
  await Polls.submitVote(claim.pollId, residentId, now, YAY);

  const message = {
    token: choresOauth.bot.token,
    channel: choresChannel,
    text: 'Someone just completed a chore',
    blocks: blocks.choresClaimCallbackView(
      claim,
      choreName,
      (recentPoints.sum || 0) + claim.value,
      (monthlyPoints.sum || 0) + claim.value
    )
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Claim ${claim.id} created with poll ${claim.pollId}`);
});

// Ranking flow

app.action('chores-rank', async ({ ack, body }) => {
  await ack();

  const choreRankings = await Chores.getCurrentChoreRankings(body.team.id);

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresRankView(choreRankings)
  };

  res = await app.client.views.open(view);
  console.log(`Chores-rank opened with id ${res.view.id}`);
});

app.view('chores-rank-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const targetBlockId = body.view.blocks[2].block_id;
  const sourceBlockId = body.view.blocks[3].block_id;

  const [ targetChoreId, targetChoreName ] = body.view.state.values[targetBlockId].chores.selected_option.value.split('|');
  const sources = body.view.state.values[sourceBlockId].chores.selected_options;

  let alphaChoreId;
  let betaChoreId;
  let preference;

  for (const source of sources) {
    const sourceChoreId = source.value.split('|')[0];
    if (sourceChoreId === targetChoreId) { continue; }

    // Value flows from source to target, and from beta to alpha
    if (parseInt(targetChoreId) < parseInt(sourceChoreId)) {
      alphaChoreId = parseInt(targetChoreId);
      betaChoreId = parseInt(sourceChoreId);
      preference = 1;
    } else {
      alphaChoreId = parseInt(sourceChoreId);
      betaChoreId = parseInt(targetChoreId);
      preference = 0;
    }

    // Perform the update
    await Chores.setChorePreference(houseId, residentId, alphaChoreId, betaChoreId, preference);
    console.log(`Chore preference updated, ${alphaChoreId} vs ${betaChoreId} at ${preference}`);
  }

  const { choresChannel } = await Admin.getHouse(houseId);

  const message = {
    token: choresOauth.bot.token,
    channel: choresChannel,
    text: `Someone just sped up ${targetChoreName} :rocket:`
  };

  res = await app.client.chat.postMessage(message);
});

// Break flow

app.action('chores-break', async ({ ack, body }) => {
  await ack();

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresBreakView(new Date())
  };

  res = await app.client.views.open(view);
  console.log(`Chores-break opened with id ${res.view.id}`);
});

app.view('chores-break-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const breakStartId = body.view.blocks[2].block_id;
  const breakEndId = body.view.blocks[3].block_id;

  const now = new Date();
  const breakStartUtc = new Date(body.view.state.values[breakStartId].date.selected_date);
  const breakEndUtc = new Date(body.view.state.values[breakEndId].date.selected_date);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const breakStart = new Date(breakStartUtc.getTime() + now.getTimezoneOffset() * MINUTE);
  const breakEnd = new Date(breakEndUtc.getTime() + now.getTimezoneOffset() * MINUTE);
  const breakDays = parseInt((breakEnd - breakStart) / DAY);

  let message;
  if (breakStart < todayStart || breakDays < 3) {
    message = {
      token: choresOauth.bot.token,
      channel: residentId,
      text: 'Not a valid chore break :slightly_frowning_face:'
    };
  } else {
    // Record the break
    await Chores.addChoreBreak(residentId, breakStart, breakEnd);
    const { choresChannel } = await Admin.getHouse(houseId);

    message = {
      token: choresOauth.bot.token,
      channel: choresChannel,
      text: `<@${residentId}> is taking a *${breakDays}-day* break ` +
        `starting ${breakStart.toDateString()} :beach_with_umbrella:`
    };
  }

  res = await app.client.chat.postMessage(message);
  console.log('Chore break added');
});

// Gift flow

app.action('chores-gift', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const lastChoreclaim = await Chores.getLatestChoreClaim(residentId);

  const view = {
    token: choresOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.choresGiftView(lastChoreclaim.value)
  };

  res = await app.client.views.open(view);
  console.log(`Chores-gift opened with id ${res.view.id}`);
});

app.view('chores-gift-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const recipientBlockId = body.view.blocks[2].block_id;
  const valueBlockId = body.view.blocks[3].block_id;

  const recipientId = body.view.state.values[recipientBlockId].recipient.selected_users[0];
  const value = body.view.state.values[valueBlockId].value.value;

  const { choresChannel } = await Admin.getHouse(houseId);

  // Perform the update
  await Chores.giftChorePoints(residentId, recipientId, new Date(), Number(value));

  const message = {
    token: choresOauth.bot.token,
    channel: choresChannel,
    text: `<@${residentId}> just gifted <@${recipientId}> *${value} points* :sparkling_heart:`
  };

  res = await app.client.chat.postMessage(message);
  console.log('Chore points gifted');
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  await ack();

  // // Submit the vote
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, body.user.id, new Date(), value);
  await sleep(5);

  const { yays, nays } = await Polls.getPollResultCounts(pollId);

  // Update the vote counts
  const blockIndex = body.message.blocks.length - 1;
  body.message.token = choresOauth.bot.token;
  body.message.channel = body.channel.id;
  body.message.blocks[blockIndex].elements = blocks.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);

  console.log(`Poll ${pollId} updated`);
});

// Launch the app

(async () => {
  const port = process.env.CHORES_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Chores app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
