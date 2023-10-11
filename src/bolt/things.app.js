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
    'users:read',
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
    },
  },
  installerOptions: { directInstall: true },
});

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log('things home');

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);
    const balance = await Things.getHouseBalance(houseId, now);

    const view = views.thingsHomeView(balance.sum || 0);
    await common.publishHome(app, thingsOauth, residentId, view);

    // This bookkeeping is done after returning the view
    await Things.resolveThingBuys(houseId, now);
    await Things.resolveThingProposals(houseId, now);
  }
});

// Slash commands

app.command('/things-channel', async ({ ack, command }) => {
  console.log('/things-channel');
  await ack();

  await common.setChannel(app, thingsOauth, 'thingsChannel', command);
});

app.command('/things-load', async ({ ack, command }) => {
  console.log('/things-load');
  await ack();

  if (command.text === 'help' || command.text.length === 0) {
    const text = 'Enter an amount of money to add to the account for future buys.';
    await common.replyEphemeral(app, thingsOauth, command, text);
  } else if (await common.isAdmin(app, thingsOauth, command)) {
    const now = new Date();
    const houseId = command.team_id;
    const residentId = command.user_id;

    const [ thing ] = await Things.loadHouseAccount(houseId, residentId, now, command.text);
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
    const now = new Date();
    const houseId = command.team_id;

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
    const now = new Date();
    const residentId = command.user_id;
    const buyIds = command.text.split(' ');

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

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const { id: thingId } = JSON.parse(common.getInputBlock(body, -2).things.selected_option.value);
  const quantity = common.getInputBlock(body, -1).quantity.value;

  // Perform the buy
  const thing = await Things.getThing(thingId);
  const [ buy ] = await Things.buyThing(houseId, thing.id, residentId, now, thing.value, quantity);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(buy.pollId);
  const balance = await Things.getHouseBalance(houseId, now);

  // TODO: Return error to user (not console) if channel is not set
  const { thingsChannel } = await Admin.getHouse(houseId);
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  const text = 'Someone just bought a thing';
  const blocks = views.thingsBuyCallbackView(buy, thing, balance.sum, minVotes);
  const { channel, ts } = await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
  await Polls.updateMetadata(buy.pollId, { channel, ts });
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

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const title = common.getInputBlock(body, -3).title.value.trim();
  const details = common.getInputBlock(body, -2).details.value.trim();
  const cost = common.getInputBlock(body, -1).cost.value;

  // Perform the buy
  const [ buy ] = await Things.buySpecialThing(houseId, residentId, now, cost, title, details);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(buy.pollId);

  const balance = await Things.getHouseBalance(houseId, now);

  // TODO: Return error to user (not console) if channel is not set
  const { thingsChannel } = await Admin.getHouse(houseId);
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  const text = 'Someone just bought a thing';
  const blocks = views.thingsSpecialBuyCallbackView(buy, balance.sum, minVotes);
  const { channel, ts } = await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
  await Polls.updateMetadata(buy.pollId, { channel, ts });
});

app.action('things-bought', async ({ ack, body }) => {
  console.log('things-bought');
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const oneWeekAgo = new Date(now.getTime() - 7 * DAY);
  const threeMonthsAgo = new Date(now.getTime() - 90 * DAY);

  const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);
  const fulfilledBuys7 = await Things.getFulfilledThingBuys(houseId, oneWeekAgo, now);
  const fulfilledBuys90 = await Things.getFulfilledThingBuys(houseId, threeMonthsAgo, now);
  const view = views.thingsBoughtView(unfulfilledBuys, fulfilledBuys7, fulfilledBuys90);
  await common.openView(app, thingsOauth, body.trigger_id, view);
});

// Proposal flow

app.action('things-propose', async ({ ack, body }) => {
  console.log('things-propose');
  await ack();

  const houseId = body.team.id;

  const minVotes = await Things.getThingProposalMinVotes(houseId);

  const view = views.thingsProposeView(minVotes);
  await common.openView(app, thingsOauth, body.trigger_id, view);
});

app.action('things-propose-2', async ({ ack, body }) => {
  console.log('things-propose-2');
  await ack();

  const houseId = body.team.id;
  const change = body.actions[0].selected_option.value;

  let things, view;
  switch (change) {
    case 'add':
      view = views.thingsProposeAddView();
      break;
    case 'edit':
      things = await Things.getThings(houseId);
      view = views.thingsProposeEditView(things);
      break;
    case 'delete':
      things = await Things.getThings(houseId);
      view = views.thingsProposeDeleteView(things);
      break;
    default:
      console.log('No match found!');
      return;
  }

  await common.pushView(app, thingsOauth, body.trigger_id, view);
});

app.action('things-propose-edit', async ({ ack, body }) => {
  console.log('things-propose-edit');
  await ack();

  const { id: thingId } = JSON.parse(body.actions[0].selected_option.value);
  const thing = await Things.getThing(thingId);

  const blocks = views.thingsProposeAddView(thing);
  await common.pushView(app, thingsOauth, body.trigger_id, blocks);
});

app.view('things-propose-callback', async ({ ack, body }) => {
  console.log('things-propose-callback');
  await ack({ response_action: 'clear' });

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  let thingId, type, name, value, unit, url, active;
  const metadata = JSON.parse(body.view.private_metadata);

  switch (metadata.change) {
    case 'add':
      // TODO: if thing exists, return ephemeral and exit
      type = common.parseTitlecase(common.getInputBlock(body, -5).type.value);
      name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
      unit = common.parseLowercase(common.getInputBlock(body, -3).unit.value);
      value = common.getInputBlock(body, -2).cost.value;
      url = common.getInputBlock(body, -1).url.value;
      [ thingId, active ] = [ null, true ];
      break;
    case 'edit':
      type = common.parseTitlecase(common.getInputBlock(body, -5).type.value);
      name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
      unit = common.parseLowercase(common.getInputBlock(body, -3).unit.value);
      value = common.getInputBlock(body, -2).cost.value;
      url = common.getInputBlock(body, -1).url.value;
      [ thingId, active ] = [ metadata.thing.id, true ];
      break;
    case 'delete':
      ({ id: thingId, type, name } = JSON.parse(common.getInputBlock(body, -1).thing.selected_option.value));
      [ value, unit, url, active ] = [ 0, undefined, undefined, false ];
      break;
    default:
      console.log('No match found!');
      return;
  }

  // Validate URL
  try {
    url = new URL(url);
  } catch {
    url = undefined;
  }

  // Create the thing proposal
  const [ proposal ] = await Things.createThingProposal(houseId, residentId, thingId, type, name, value, { unit, url }, active, now);
  await Polls.submitVote(proposal.pollId, residentId, now, YAY);

  const { thingsChannel } = await Admin.getHouse(houseId);
  const { minVotes } = await Polls.getPoll(proposal.pollId);

  const text = 'Someone just proposed a thing edit';
  const blocks = views.thingsProposeCallbackView(metadata, proposal, minVotes);
  const { channel, ts } = await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
  await Polls.updateMetadata(proposal.pollId, { channel, ts });
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
