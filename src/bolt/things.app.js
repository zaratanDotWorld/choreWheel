require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Things } = require('../core/index');
const { YAY, DAY } = require('../constants');

const common = require('./common');
const views = require('./things.views');

let thingsOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.INFO,
  clientId: process.env.THINGS_CLIENT_ID,
  clientSecret: process.env.THINGS_CLIENT_SECRET,
  signingSecret: process.env.THINGS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Things') ],
  scopes: [
    'channels:join',
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
    console.log('things home');
    const houseId = body.team_id;
    const residentId = event.user;
    const now = new Date();

    await Admin.addResident(houseId, residentId, now);
    const balance = await Things.getHouseBalance(houseId, now);
    const view = views.thingsHomeView(balance.sum || 0);
    await common.publishHome(app, thingsOauth, residentId, view);

    // This bookkeeping is done after returning the view
    await Things.resolveThingBuys(houseId, now);
  }
});

// Slash commands

app.command('/things-channel', async ({ ack, command }) => {
  console.log('/things-channel');
  await ack();

  await common.setChannel(app, thingsOauth, 'thingsChannel', command);
});

app.command('/things-add', async ({ ack, command }) => {
  console.log('/things-add');
  await ack();

  let text;

  if (command.text === 'help' || command.text.length === 0) {
    text = 'Enter the details of a new thing to add it to the list. ' +
    'Entries have four hyphen-separated parts, e.g. Food - Eggs - 2 dozen - 20. ' +
    'If the thing already exists, the command does nothing.';
  } else if (await common.isAdmin(app, thingsOauth, command)) {
    const [ houseId, active ] = [ command.team_id, true ];
    const { type, name, unit, value } = views.parseThingAdd(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, value, active, metadata: { unit } });
    text = `${views.formatThing(thing)} added to the things list :star-struck:`;
  } else {
    text = ':warning: Only admins can update the things list...';
  }

  await common.replyEphemeral(app, thingsOauth, command, text);
});

app.command('/things-del', async ({ ack, command }) => {
  console.log('/things-del');
  await ack();

  let text;

  if (command.text === 'help' || command.text.length === 0) {
    text = 'Enter the name of an existing thing to delete it from the list. ' +
    'Entries have two hyphen-separated parts, e.g. Food - Eggs. ' +
    'If no matching thing is found, the command does nothing.';
  } else if (await common.isAdmin(app, thingsOauth, command)) {
    const [ houseId, value, active ] = [ command.team_id, 0, false ];
    const { type, name } = views.parseThingDel(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, value, active });
    text = `${views.formatThing(thing)} removed from the things list :sob:`;
  } else {
    text = ':warning: Only admins can update the things list...';
  }

  await common.replyEphemeral(app, thingsOauth, command, text);
});

app.command('/things-load', async ({ ack, command }) => {
  console.log('/things-load');
  await ack();

  if (command.text === 'help' || command.text.length === 0) {
    const text = 'Enter an amount of money to add to the account for future buys.';
    await common.replyEphemeral(app, thingsOauth, command, text);
  } else if (await common.isAdmin(app, thingsOauth, command)) {
    const houseId = command.team_id;
    const residentId = command.user_id;
    const [ thing ] = await Things.loadHouseAccount(houseId, residentId, new Date(), command.text);
    const { thingsChannel } = await Admin.getHouse(houseId);

    const text = `*<@${thing.boughtBy}>* just loaded *$${thing.value}* into the house account :chart_with_upwards_trend:`;
    await common.postMessage(app, thingsOauth, thingsChannel, text);
  } else {
    const text = ':warning: Only admins can load the house account...';
    await common.replyEphemeral(app, thingsOauth, command, text);
  }
});

app.command('/things-resolved', async ({ ack, command }) => {
  console.log('/things-resolved');
  await ack();

  let text;

  if (command.text === 'help') {
    text = 'Show a list of resolved buys, including their buy id. ' +
    'Buys are resolved after 12 hours, assuming they have received enough upvotes';
  } else {
    const houseId = command.team_id;
    const now = new Date();

    const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);
    const parsedResolvedBuys = views.parseResolvedThingBuys(unfulfilledBuys);
    text = `Resolved buys not yet fulfilled:${parsedResolvedBuys}`;
  }

  await common.replyEphemeral(app, thingsOauth, command, text);
});

app.command('/things-fulfill', async ({ ack, command }) => {
  console.log('/things-fulfill');
  await ack();

  let text;

  if (command.text === 'help' || command.text.length === 0) {
    text = 'Indicate that buys have been externally fulfilled, and remove them from the list. ' +
    'You can fulfill many buys at once by including multiple soace-separated ids, e.g. 23 24 25 28. ' +
    'Fulfilled buys are indicated by their buy id, which you can see by calling /things-resolved.';
  } else if (await common.isAdmin(app, thingsOauth, command)) {
    const residentId = command.user_id;
    const buyIds = command.text.split(' ');
    const now = new Date();

    for (const buyId of buyIds) {
      await Things.fulfillThingBuy(buyId, residentId, now);
    }

    text = `Fulfilled the following buys: ${buyIds.join(' ')}`;
  } else {
    text = ':warning: Only admins can fulfill buys...';
  }

  await common.replyEphemeral(app, thingsOauth, command, text);
});

// Buy flow

app.action('things-buy', async ({ ack, body }) => {
  console.log('things-buy');
  await ack();

  const things = await Things.getThings(body.team.id);
  const view = views.thingsBuyView(things);
  await common.openView(app, thingsOauth, body.trigger_id, view);
});

app.view('things-buy-callback', async ({ ack, body }) => {
  console.log('things-buy-callback');
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const numBlocks = body.view.blocks.length;
  const thingBlockId = body.view.blocks[numBlocks - 2].block_id;
  const quantityBlockId = body.view.blocks[numBlocks - 1].block_id;
  const thingId = parseInt(body.view.state.values[thingBlockId].options.selected_option.value);
  const quantity = parseInt(body.view.state.values[quantityBlockId].quantity.value);

  // Perform the buy
  const now = new Date();
  const thing = await Things.getThing(thingId);
  const [ buy ] = await Things.buyThing(houseId, thing.id, residentId, now, thing.value, quantity);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const residents = await Admin.getResidents(houseId);
  const minVotes = await Things.getThingBuyMinVotes(buy, residents.length);
  const balance = await Things.getHouseBalance(houseId, now);

  // TODO: Return error to user (not console) if channel is not set
  const { thingsChannel } = await Admin.getHouse(houseId);
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  const text = 'Someone just bought a thing';
  const blocks = views.thingsBuyCallbackView(buy, thing, balance.sum, minVotes);
  await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
});

app.action('things-special', async ({ ack, body }) => {
  console.log('things-special');
  await ack();

  const houseId = body.team.id;
  const residents = await Admin.getResidents(houseId);
  const view = views.thingsSpecialBuyView(residents.length);
  await common.openView(app, thingsOauth, body.trigger_id, view);
});

app.view('things-special-callback', async ({ ack, body }) => {
  console.log('things-special-callback');
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const numBlocks = body.view.blocks.length;
  const titleBlockId = body.view.blocks[numBlocks - 3].block_id;
  const detailsBlockId = body.view.blocks[numBlocks - 2].block_id;
  const costBlockId = body.view.blocks[numBlocks - 1].block_id;
  const title = body.view.state.values[titleBlockId].title.value.trim();
  const details = body.view.state.values[detailsBlockId].details.value.trim();
  const cost = parseInt(body.view.state.values[costBlockId].cost.value);

  // Perform the buy
  const now = new Date();
  const [ buy ] = await Things.buySpecialThing(houseId, residentId, now, cost, title, details);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const residents = await Admin.getResidents(houseId);
  const minVotes = await Things.getThingBuyMinVotes(buy, residents.length);
  const balance = await Things.getHouseBalance(houseId, now);

  // TODO: Return error to user (not console) if channel is not set
  const { thingsChannel } = await Admin.getHouse(houseId);
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  const text = 'Someone just bought a thing';
  const blocks = views.thingsSpecialBuyCallbackView(buy, balance.sum, minVotes);
  await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
});

app.action('things-bought', async ({ ack, body }) => {
  console.log('things-bought');
  await ack();

  const houseId = body.team.id;
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * DAY);
  const threeMonthsAgo = new Date(now.getTime() - 90 * DAY);

  const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);
  const fulfilledBuys7 = await Things.getFulfilledThingBuys(houseId, oneWeekAgo, now);
  const fulfilledBuys90 = await Things.getFulfilledThingBuys(houseId, threeMonthsAgo, now);
  const view = views.thingsBoughtView(unfulfilledBuys, fulfilledBuys7, fulfilledBuys90);
  await common.openView(app, thingsOauth, body.trigger_id, view);
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  console.log('things poll-vote');
  await ack();

  await common.updateVoteCounts(app, thingsOauth, body, action);
});

// Launch the app

(async () => {
  const port = process.env.THINGS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Things app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
