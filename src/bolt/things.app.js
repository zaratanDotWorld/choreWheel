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
      await Admin.addHouse(installation.team.id);
      await Admin.updateHouse(installation.team.id, { thingsOauth: installation });
      console.log(`things installed @ ${installation.team.id}`);
    },
    fetchInstallation: async (installQuery) => {
      ({ thingsOauth } = (await Admin.getHouse(installQuery.teamId)).metadata);
      return thingsOauth;
    },
    deleteInstallation: async (installQuery) => {
      await Admin.updateHouse(installQuery.teamId, { thingsOauth: null });
      console.log(`things uninstalled @ ${installQuery.teamId}`);
    },
  },
  installerOptions: { directInstall: true },
});

// Define publishing functions

async function postMessage (houseId, text, blocks) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postMessage(app, thingsOauth, metadata.thingsChannel, text, blocks);
}

async function postEphemeral (houseId, residentId, text) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postEphemeral(app, thingsOauth, metadata.thingsChannel, residentId, text);
}

async function replyEphemeral (command, text) {
  return common.replyEphemeral(app, thingsOauth, command, text);
}

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log('things home');

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);

    let view;
    if ((await Admin.getHouse(houseId)).metadata.thingsChannel) {
      const balance = await Things.getHouseBalance(houseId, now);
      const exempt = await Admin.isExempt(residentId, now);

      view = views.thingsHomeView(balance.sum || 0, exempt);
    } else {
      view = common.introHomeView('Things');
    }

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

  await common.setChannel(app, thingsOauth, command, 'thingsChannel');
});

app.command('/things-load', async ({ ack, command }) => {
  console.log('/things-load');
  await ack();

  if (!(await common.isAdmin(app, thingsOauth, command))) {
    await common.replyAdminOnly(app, thingsOauth, command);
    return;
  }

  if (command.text === 'help' || command.text.length === 0) {
    await replyEphemeral(command, 'Enter an amount of money to add to the account.');
  } else {
    const now = new Date();
    const houseId = command.team_id;
    const residentId = command.user_id;

    const [ thing ] = await Things.loadHouseAccount(houseId, residentId, now, command.text);

    const text = `*<@${thing.boughtBy}>* just loaded *$${thing.value}* into the house account :chart_with_upwards_trend:`;
    await postMessage(houseId, text);
  }
});

app.command('/things-fulfill', async ({ ack, command }) => {
  console.log('/things-fulfill');
  await ack();

  if (!(await common.isAdmin(app, thingsOauth, command))) {
    await common.replyAdminOnly(app, thingsOauth, command);
    return;
  }

  const now = new Date();
  const houseId = command.team_id;

  const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);

  const view = views.thingsFulfillView(unfulfilledBuys);
  await common.openView(app, thingsOauth, command.trigger_id, view);
});

app.view('things-fulfill-callback', async ({ ack, body }) => {
  console.log('things-fulfill-callback');
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const buys = common.getInputBlock(body, -1).buys.selected_options
    .map((buy) => JSON.parse(buy.value));

  for (const buy of buys) {
    await Things.fulfillThingBuy(buy.id, residentId, now);
  }

  const text = 'Fulfillment succeeded :shopping_bags:';
  await postEphemeral(houseId, residentId, text);
});

app.command('/things-update', async ({ ack, command }) => {
  console.log('/things-update');
  await ack();

  if (!(await common.isAdmin(app, thingsOauth, command))) {
    await common.replyAdminOnly(app, thingsOauth, command);
    return;
  }

  const houseId = command.team_id;
  const things = await Things.getThings(houseId);

  // TODO: improve this (hacky) implementation
  const view = views.thingsProposeEditView(things, '-admin');
  await common.openView(app, thingsOauth, command.trigger_id, view);
});

app.action('things-propose-edit-admin', async ({ ack, body }) => {
  console.log('things-update-2');
  await ack();

  const { id: thingId } = JSON.parse(body.actions[0].selected_option.value);
  const thing = await Things.getThing(thingId);

  const blocks = views.thingsProposeAddView(thing, '-admin');
  await common.pushView(app, thingsOauth, body.trigger_id, blocks);
});

app.view('things-propose-callback-admin', async ({ ack, body }) => {
  console.log('things-update-callback');
  await ack({ response_action: 'clear' });

  const houseId = body.team.id;
  const residentId = body.user.id;

  const { thing } = JSON.parse(body.view.private_metadata);
  const { type, name, unit, value, url } = parseThingsEditSubmission(body);

  // Update the thing
  const metadata = { unit, url };
  await Things.editThing(thing.id, type, name, value, metadata, true);

  const text = 'Update succeeded :floppy_disk:';
  await postEphemeral(houseId, residentId, text);
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

  const text = 'Someone just bought a thing';
  const blocks = views.thingsBuyCallbackView(buy, thing, balance.sum, minVotes);
  const { channel, ts } = await postMessage(houseId, text, blocks);
  await Polls.updateMetadata(buy.pollId, { channel, ts });
});

app.action('things-special', async ({ ack, body }) => {
  console.log('things-special');
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const votingResidents = await Admin.getVotingResidents(houseId, now);

  const view = views.thingsSpecialBuyView(votingResidents.length);
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

  const text = 'Someone just bought a thing';
  const blocks = views.thingsSpecialBuyCallbackView(buy, balance.sum, minVotes);
  const { channel, ts } = await postMessage(houseId, text, blocks);
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

  const now = new Date();
  const houseId = body.team.id;

  const minVotes = await Things.getThingProposalMinVotes(houseId, now);

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
  const privateMetadata = JSON.parse(body.view.private_metadata);

  switch (privateMetadata.change) {
    case 'add':
      // TODO: if thing exists, return ephemeral and exit
      ({ type, name, unit, value, url } = parseThingsEditSubmission(body));
      [ thingId, active ] = [ null, true ];
      break;
    case 'edit':
      ({ type, name, unit, value, url } = parseThingsEditSubmission(body));
      [ thingId, active ] = [ privateMetadata.thing.id, true ];
      break;
    case 'delete':
      ({ id: thingId, type, name } = JSON.parse(common.getInputBlock(body, -1).thing.selected_option.value));
      [ value, unit, url, active ] = [ 0, undefined, undefined, false ];
      break;
    default:
      console.log('No match found!');
      return;
  }

  // Create the thing proposal
  const metadata = { unit, url };
  const [ proposal ] = await Things.createThingProposal(houseId, residentId, thingId, type, name, value, metadata, active, now);
  await Polls.submitVote(proposal.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(proposal.pollId);

  const text = 'Someone just proposed a thing edit';
  const blocks = views.thingsProposeCallbackView(privateMetadata, proposal, minVotes);
  const { channel, ts } = await postMessage(houseId, text, blocks);
  await Polls.updateMetadata(proposal.pollId, { channel, ts });
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  console.log('things poll-vote');
  await ack();

  await common.updateVoteCounts(app, thingsOauth, body, action);
});

// Utils

function parseThingsEditSubmission (body) {
  const type = common.parseTitlecase(common.getInputBlock(body, -5).type.value);
  const name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
  const unit = common.parseLowercase(common.getInputBlock(body, -3).unit.value);
  const value = common.getInputBlock(body, -2).cost.value;
  const url = common.parseUrl(common.getInputBlock(body, -1).url.value);
  return { type, name, unit, value, url };
}

// Launch the app

(async () => {
  const port = process.env.THINGS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Things app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
