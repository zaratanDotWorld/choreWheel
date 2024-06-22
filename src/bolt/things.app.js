require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Things } = require('../core/index');
const { YAY, DAY, THINGS_CONF } = require('../constants');
const { sleep } = require('../utils');

const common = require('./common');
const views = require('./things.views');

let thingsConf;

// Create the app

const app = new App({
  logLevel: LogLevel.WARN,
  clientId: process.env.THINGS_CLIENT_ID,
  clientSecret: process.env.THINGS_CLIENT_SECRET,
  signingSecret: process.env.THINGS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Things') ],
  scopes: [
    'channels:history',
    'channels:join',
    'chat:write',
    'commands',
    'groups:history',
    'users:read',
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      await Admin.addHouse(installation.team.id, installation.team.name);
      await Admin.updateHouseConf(installation.team.id, THINGS_CONF, { oauth: installation });
      console.log(`things installed @ ${installation.team.id}`);
    },
    fetchInstallation: async (installQuery) => {
      ({ thingsConf } = (await Admin.getHouse(installQuery.teamId)));
      return thingsConf;
    },
    deleteInstallation: async (installQuery) => {
      await Admin.updateHouseConf(installQuery.teamId, THINGS_CONF, { oauth: null });
      console.log(`things uninstalled @ ${installQuery.teamId}`);
    },
  },
  installerOptions: { directInstall: true },
});

// Define publishing functions

async function postMessage (text, blocks) {
  return common.postMessage(app, thingsConf.oauth, thingsConf.channel, text, blocks);
}

async function postEphemeral (residentId, text) {
  return common.postEphemeral(app, thingsConf.oauth, thingsConf.channel, residentId, text);
}

async function replyEphemeral (command, text) {
  return common.replyEphemeral(app, thingsConf.oauth, command, text);
}

// Event listeners

app.event('user_change', async ({ payload }) => {
  console.log(`things user_change - ${payload.team_id}`);

  await sleep(3 * 1000);

  const { user } = payload;
  await common.syncWorkspaceMember(user.team_id, user, new Date());
});

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log(`things home - ${body.team_id} x ${event.user}`);

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);

    let view;
    if (thingsConf.channel) {
      const activeAccounts = await Things.getActiveAccounts(houseId, now);
      const exempt = await Admin.isExempt(residentId, now);

      view = views.thingsHomeView(activeAccounts, exempt);
    } else {
      view = views.thingsIntroView();
    }

    await common.publishHome(app, thingsConf.oauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any buys
    for (const resolvedBuy of (await Things.resolveThingBuys(houseId, now))) {
      console.log(`resolved thingBuy ${resolvedBuy.id}`);
      await common.updateVoteResults(app, thingsConf.oauth, resolvedBuy.pollId);
    }

    // Resolve any proposals
    for (const resolvedProposal of (await Things.resolveThingProposals(houseId, now))) {
      console.log(`resolved thingProposal ${resolvedProposal.id}`);
      await common.updateVoteResults(app, thingsConf.oauth, resolvedProposal.pollId);
    }
  }
});

// Slash commands

app.command('/things-channel', async ({ ack, command }) => {
  console.log(`/things-channel - ${command.team_id} x ${command.user_id}`);
  await ack();

  await common.setChannel(app, thingsConf.oauth, THINGS_CONF, command);
});

app.command('/things-load', async ({ ack, command }) => {
  console.log(`/things-load - ${command.team_id} x ${command.user_id}`);
  await ack();

  if (!(await common.isAdmin(app, thingsConf.oauth, command))) {
    await common.replyAdminOnly(app, thingsConf.oauth, command);
    return;
  }

  const view = views.thingsLoadView();
  await common.openView(app, thingsConf.oauth, command.trigger_id, view);
});

app.view('things-load-callback', async ({ ack, body }) => {
  console.log(`things-load-callback - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const account = common.parseTitlecase(common.getInputBlock(body, -2).account.value);
  const amount = common.getInputBlock(body, -1).amount.value;

  const [ thing ] = await Things.loadAccount(houseId, account, residentId, now, amount);

  const text = `<@${thing.boughtBy}> just loaded *$${thing.value}* into the *${thing.account}* account :chart_with_upwards_trend:`;
  await postMessage(text);
});

app.command('/things-fulfill', async ({ ack, command }) => {
  console.log(`/things-fulfill - ${command.team_id} x ${command.user_id}`);
  await ack();

  if (!(await common.isAdmin(app, thingsConf.oauth, command))) {
    await common.replyAdminOnly(app, thingsConf.oauth, command);
    return;
  }

  const now = new Date();
  const houseId = command.team_id;

  const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);

  if (unfulfilledBuys.length) {
    const view = views.thingsFulfillView(unfulfilledBuys);
    await common.openView(app, thingsConf.oauth, command.trigger_id, view);
  } else {
    await replyEphemeral(command, 'There are no buys to fulfill :relieved:');
  }
});

app.view('things-fulfill-callback', async ({ ack, body }) => {
  console.log(`things-fulfill-callback - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const residentId = body.user.id;

  const buys = common.getInputBlock(body, -1).buys.selected_options
    .map(buy => JSON.parse(buy.value));

  for (const buy of buys) {
    await Things.fulfillThingBuy(buy.id, residentId, now);
  }

  const text = 'Fulfillment succeeded :shopping_bags:';
  await postEphemeral(residentId, text);
});

app.command('/things-update', async ({ ack, command }) => {
  console.log(`/things-update - ${command.team_id} x ${command.user_id}`);
  await ack();

  if (!(await common.isAdmin(app, thingsConf.oauth, command))) {
    await common.replyAdminOnly(app, thingsConf.oauth, command);
    return;
  }

  const houseId = command.team_id;
  const things = await Things.getThings(houseId);

  // TODO: improve this (hacky) implementation
  const view = views.thingsProposeEditView(things, '-admin');
  await common.openView(app, thingsConf.oauth, command.trigger_id, view);
});

app.action('things-propose-edit-admin', async ({ ack, body }) => {
  console.log(`things-update-2 - ${body.team.id} x ${body.user.id}`);
  await ack();

  const { id: thingId } = JSON.parse(body.actions[0].selected_option.value);
  const thing = await Things.getThing(thingId);

  const blocks = views.thingsProposeAddView(thing, '-admin');
  await common.pushView(app, thingsConf.oauth, body.trigger_id, blocks);
});

app.view('things-propose-callback-admin', async ({ ack, body }) => {
  console.log(`things-update-callback - ${body.team.id} x ${body.user.id}`);
  await ack({ response_action: 'clear' });

  const residentId = body.user.id;

  const { thing } = JSON.parse(body.view.private_metadata);
  const { type, name, unit, value, url } = parseThingsEditSubmission(body);

  // Update the thing
  const metadata = { unit, url };
  await Things.editThing(thing.id, type, name, value, metadata, true);

  const text = 'Update succeeded :floppy_disk:';
  await postEphemeral(residentId, text);
});

// Buy flow

app.action('things-buy', async ({ ack, body }) => {
  console.log(`things-buy - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const things = await Things.getThings(houseId);
  const accounts = await Things.getActiveAccounts(houseId, now);

  const view = views.thingsBuyView(things, accounts);
  await common.openView(app, thingsConf.oauth, body.trigger_id, view);
});

app.view('things-buy-callback', async ({ ack, body }) => {
  console.log(`things-buy-callback - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const { id: thingId } = JSON.parse(common.getInputBlock(body, -3).things.selected_option.value);
  const quantity = common.getInputBlock(body, -2).quantity.value;
  const { account } = JSON.parse(common.getInputBlock(body, -1).account.selected_option.value);

  // Perform the buy
  const thing = await Things.getThing(thingId);
  const [ buy ] = await Things.buyThing(houseId, thing.id, residentId, now, account, thing.value, quantity);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(buy.pollId);
  const balance = await Things.getAccountBalance(houseId, account, now);

  const text = 'Someone just bought a thing';
  const blocks = views.thingsBuyCallbackView(buy, thing, balance.sum, minVotes);
  const { channel, ts } = await postMessage(text, blocks);
  await Polls.updateMetadata(buy.pollId, { channel, ts });
});

app.action('things-special', async ({ ack, body }) => {
  console.log(`things-special - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const votingResidents = await Admin.getVotingResidents(houseId, now);
  const accounts = await Things.getActiveAccounts(houseId, now);

  const view = views.thingsSpecialBuyView(votingResidents.length, accounts);
  await common.openView(app, thingsConf.oauth, body.trigger_id, view);
});

app.view('things-special-callback', async ({ ack, body }) => {
  console.log(`things-special-callback - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const title = common.getInputBlock(body, -4).title.value.trim();
  const details = common.getInputBlock(body, -3).details.value.trim();
  const cost = common.getInputBlock(body, -2).cost.value;
  const { account } = JSON.parse(common.getInputBlock(body, -1).account.selected_option.value);

  // Perform the buy
  const [ buy ] = await Things.buySpecialThing(houseId, residentId, now, account, cost, title, details);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(buy.pollId);
  const balance = await Things.getAccountBalance(houseId, account, now);

  const text = 'Someone just bought a thing';
  const blocks = views.thingsSpecialBuyCallbackView(buy, balance.sum, minVotes);
  const { channel, ts } = await postMessage(text, blocks);
  await Polls.updateMetadata(buy.pollId, { channel, ts });
});

app.action('things-bought', async ({ ack, body }) => {
  console.log(`things-bought - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const oneWeekAgo = new Date(now.getTime() - 7 * DAY);
  const threeMonthsAgo = new Date(now.getTime() - 90 * DAY);

  const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);
  const fulfilledBuys7 = await Things.getFulfilledThingBuys(houseId, oneWeekAgo, now);
  const fulfilledBuys90 = await Things.getFulfilledThingBuys(houseId, threeMonthsAgo, now);
  const view = views.thingsBoughtView(unfulfilledBuys, fulfilledBuys7, fulfilledBuys90);
  await common.openView(app, thingsConf.oauth, body.trigger_id, view);
});

// Proposal flow

app.action('things-propose', async ({ ack, body }) => {
  console.log(`things-propose - ${body.team.id} x ${body.user.id}`);
  await ack();

  const now = new Date();
  const houseId = body.team.id;

  const minVotes = await Things.getThingProposalMinVotes(houseId, now);

  const view = views.thingsProposeView(minVotes);
  await common.openView(app, thingsConf.oauth, body.trigger_id, view);
});

app.action('things-propose-2', async ({ ack, body }) => {
  console.log(`things-propose-2 - ${body.team.id} x ${body.user.id}`);
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

  await common.pushView(app, thingsConf.oauth, body.trigger_id, view);
});

app.action('things-propose-edit', async ({ ack, body }) => {
  console.log(`things-propose-edit - ${body.team.id} x ${body.user.id}`);
  await ack();

  const { id: thingId } = JSON.parse(body.actions[0].selected_option.value);
  const thing = await Things.getThing(thingId);

  const blocks = views.thingsProposeAddView(thing);
  await common.pushView(app, thingsConf.oauth, body.trigger_id, blocks);
});

app.view('things-propose-callback', async ({ ack, body }) => {
  console.log(`things-propose-callback - ${body.team.id} x ${body.user.id}`);
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
  const { channel, ts } = await postMessage(text, blocks);
  await Polls.updateMetadata(proposal.pollId, { channel, ts });
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  console.log(`things poll-vote - ${body.team.id} x ${body.user.id}`);
  await ack();

  await common.updateVoteCounts(app, thingsConf.oauth, body, action);
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
