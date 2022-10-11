require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const Things = require('../modules/things');
const Polls = require('../modules/polls');
const Admin = require('../modules/admin');

const { thingsPollLength } = require('../config');
const { YAY, DAY } = require('../constants');
const { sleep } = require('../utils');

const blocks = require('./blocks');

let res;
let thingsOauth;

// Create the app

const home = {
  path: '/',
  method: [ 'GET' ],
  handler: async (_, res) => {
    res.writeHead(200);
    res.end('Welcome to Mirror - Things!');
  }
};

const app = new App({
  logLevel: LogLevel.DEBUG,
  clientId: process.env.THINGS_CLIENT_ID,
  clientSecret: process.env.THINGS_CLIENT_SECRET,
  signingSecret: process.env.THINGS_SIGNING_SECRET,
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
      return Admin.updateHouse({ slackId: installation.team.id, thingsOauth: installation });
    },
    fetchInstallation: async (installQuery) => {
      ({ thingsOauth } = await Admin.getHouse(installQuery.teamId));
      return thingsOauth;
    },
    deleteInstallation: async (installQuery) => {
      return Admin.updateHouse({ slackId: installQuery.teamId, thingsOauth: null });
    }
  },
  installerOptions: { directInstall: true }
});

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.addResident(houseId, residentId);
    console.log(`Added resident ${residentId}`);

    const now = new Date();
    const balance = await Things.getHouseBalance(houseId, now);

    const data = {
      token: thingsOauth.bot.token,
      user_id: residentId,
      view: blocks.thingsHomeView(balance.sum || 0)
    };
    await app.client.views.publish(data);

    // This is where we resolve any buys, transparently to the resident
    const resolvableBuys = await Things.getResolvableThingBuys(houseId, now);
    for (const buy of resolvableBuys) {
      await Things.resolveThingBuy(buy.id, now);
      console.log(`Resolved ThingBuy ${buy.id}`);
    }
  }
});

// Slash commands

async function getUser (userId) {
  return app.client.users.info({
    token: thingsOauth.bot.token,
    user: userId
  });
}

function prepareEphemeral (command, text) {
  return {
    token: thingsOauth.bot.token,
    channel: command.channel_id,
    user: command.user_id,
    text: text
  };
}

app.command('/things-channel', async ({ ack, command, say }) => {
  await ack();

  const channelName = command.text;
  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    // TODO: return a friendly error if the channel doesn't exist
    res = await app.client.conversations.list({ token: thingsOauth.bot.token });
    const channelId = res.channels.filter(channel => channel.name === channelName)[0].id;

    await Admin.updateHouse({ slackId: houseId, thingsChannel: channelId });

    text = `Thing buys channel set to ${channelName} :fire:\nPlease add the Things bot to the channel`;
    console.log(`Set thing buys channel to ${channelName}`);
  } else {
    text = 'Only admins can set the channels...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/things-add', async ({ ack, command, say }) => {
  await ack();

  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const active = true;
    const { type, name, value } = blocks.parseThingAdd(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, value, active });

    text = `${blocks.formatThing(thing)} added to the things list :star-struck:`;
    console.log(`Added thing ${blocks.formatThing(thing)}`);
  } else {
    text = 'Only admins can update the things list...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/things-del', async ({ ack, command, say }) => {
  await ack();

  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const [ value, active ] = [ 0, false ];
    const { type, name } = blocks.parseThingDel(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, value, active });

    text = `${blocks.formatThing(thing)} removed from the things list :sob:`;
    console.log(`Deleted thing ${blocks.formatThing(thing)}`);
  } else {
    text = 'Only admins can update the things list...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/things-list', async ({ ack, command, say }) => {
  await ack();

  const houseId = command.team_id;

  const things = await Things.getThings(houseId);
  const parsedThings = things.map((thing) => `\n${blocks.formatThing(thing)}`);

  const text = `The current things:${parsedThings}`;
  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/things-load', async ({ ack, command, say }) => {
  await ack();

  const houseId = command.team_id;
  const userInfo = await getUser(command.user_id);

  let text;

  if (userInfo.user.is_admin) {
    const [ thing ] = await Things.loadHouseAccount(houseId, new Date(), command.text);

    text = `$${thing.value} added to the house account :heart_eyes:`;
    console.log(`Added $${thing.value} to house account`);
  } else {
    text = 'Only admins can load the house account...';
  }

  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

app.command('/things-resolved', async ({ ack, command, say }) => {
  await ack();

  const houseId = command.team_id;
  const numDays = parseInt(command.text) || 7;
  const now = new Date();
  const start = new Date(now.getTime() - DAY * numDays);

  const buys = await Things.getResolvedThingBuys(houseId, start, now);
  const parsedBuys = buys.map((buy) => `\n${buy.resolvedAt}: ${blocks.formatThing(buy)}`);

  const text = `The resolved buys in the last ${numDays} days:${parsedBuys}`;
  const message = prepareEphemeral(command, text);
  await app.client.chat.postEphemeral(message);
});

// Buy flow

app.action('things-buy', async ({ ack, body, action }) => {
  await ack();

  const things = await Things.getThings(body.team.id);

  const view = {
    token: thingsOauth.bot.token,
    trigger_id: body.trigger_id,
    view: blocks.thingsBuyView(things)
  };

  res = await app.client.views.open(view);
  console.log(`Things-buy opened with id ${res.view.id}`);
});

app.view('things-buy-callback', async ({ ack, body }) => {
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const blockIndex = body.view.blocks.length - 1;
  const blockId = body.view.blocks[blockIndex].block_id;
  const [ thingId, thingName, thingValue ] = body.view.state.values[blockId].options.selected_option.value.split('|');

  const { thingsChannel } = await Admin.getHouse(houseId);

  // TODO: Return error to user (not console) if channel is not set
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  // Perform the buy
  const now = new Date();
  const balance = await Things.getHouseBalance(houseId, now);
  const [ buy ] = await Things.buyThing(houseId, thingId, residentId, now, thingValue);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const message = {
    token: thingsOauth.bot.token,
    channel: thingsChannel,
    text: 'Someone just bought a thing',
    blocks: blocks.thingsBuyCallbackView(
      residentId,
      thingName,
      Number(thingValue),
      balance.sum - Number(thingValue),
      buy.pollId,
      thingsPollLength
    )
  };

  res = await app.client.chat.postMessage(message);
  console.log(`Buy ${buy.id} created with poll ${buy.pollId}`);
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
  body.message.token = thingsOauth.bot.token;
  body.message.channel = channelId;
  body.message.blocks[2].elements = blocks.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);

  console.log(`Poll ${pollId} updated`);
});

// Launch the app

(async () => {
  const port = process.env.THINGS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Things app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
