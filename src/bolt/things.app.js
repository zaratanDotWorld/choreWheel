require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Things } = require('../core/index');
const { YAY } = require('../constants');

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

  const houseId = command.team_id;
  const userInfo = await common.getUser(app, thingsOauth, command.user_id);

  if (userInfo.user.is_admin) {
    const active = true;
    const { type, name, quantity, value } = views.parseThingAdd(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, quantity, value, active });

    const text = `${views.formatThing(thing)} added to the things list :star-struck:`;
    await common.postEphemeral(app, thingsOauth, command, text);
  } else {
    const text = 'Only admins can update the things list...';
    await common.postEphemeral(app, thingsOauth, command, text);
  }
});

app.command('/things-del', async ({ ack, command }) => {
  console.log('/things-del');
  await ack();

  const houseId = command.team_id;
  const userInfo = await common.getUser(app, thingsOauth, command.user_id);

  if (userInfo.user.is_admin) {
    const [ value, active ] = [ 0, false ];
    const { type, name } = views.parseThingDel(command.text);
    const [ thing ] = await Things.updateThing({ houseId, type, name, value, active });

    const text = `${views.formatThing(thing)} removed from the things list :sob:`;
    await common.postEphemeral(app, thingsOauth, command, text);
  } else {
    const text = 'Only admins can update the things list...';
    await common.postEphemeral(app, thingsOauth, command, text);
  }
});

app.command('/things-load', async ({ ack, command }) => {
  console.log('/things-load');
  await ack();

  const houseId = command.team_id;
  const userInfo = await common.getUser(app, thingsOauth, command.user_id);

  if (userInfo.user.is_admin) {
    const [ thing ] = await Things.loadHouseAccount(houseId, new Date(), command.text);
    const { thingsChannel } = await Admin.getHouse(houseId);

    const text = `<!channel> *$${thing.value}* was just loaded into the house account :chart_with_upwards_trend:`;
    await common.postMessage(app, thingsOauth, thingsChannel, text);
  } else {
    const text = 'Only admins can load the house account...';
    await common.postEphemeral(app, thingsOauth, command, text);
  }
});

app.command('/things-resolved', async ({ ack, command }) => {
  console.log('/things-resolved');
  await ack();

  const houseId = command.team_id;
  const now = new Date();
  const buys = await Things.getUnfulfilledThingBuys(houseId, now);
  const parsedResolvedBuys = buys
    .filter((buy) => buy.resolvedAt !== null)
    .map((buy) => {
      const resolvedAt = buy.resolvedAt.toLocaleDateString();
      return `\n(${buy.id}) [${resolvedAt}] ${buy.type}: ${buy.name} - ${buy.quantity}`;
    });

  const text = `Resolved buys not yet fulfilled:${parsedResolvedBuys}`;
  await common.postEphemeral(app, thingsOauth, command, text);
});

app.command('/things-fulfill', async ({ ack, command }) => {
  console.log('/things-fulfill');
  await ack();

  const residentId = command.user_id;
  const buyIds = command.text.split(' ');
  const now = new Date();

  for (const buyId of buyIds) {
    await Things.fulfillThingBuy(buyId, residentId, now);
  }

  const text = `Fulfilled the following buys: ${buyIds.join(' ')}`;
  await common.postEphemeral(app, thingsOauth, command, text);
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
  const blockIndex = body.view.blocks.length - 1;
  const blockId = body.view.blocks[blockIndex].block_id;
  const thingId = parseInt(body.view.state.values[blockId].options.selected_option.value);

  // TODO: Return error to user (not console) if channel is not set
  const { thingsChannel } = await Admin.getHouse(houseId);
  if (thingsChannel === null) { throw new Error('Things channel not set!'); }

  // Perform the buy
  const now = new Date();
  const balance = await Things.getHouseBalance(houseId, now);
  const thing = await Things.getThing(thingId);

  const [ buy ] = await Things.buyThing(houseId, thing.id, residentId, now, thing.value);
  await Polls.submitVote(buy.pollId, residentId, now, YAY);

  const text = 'Someone just bought a thing';
  const blocks = views.thingsBuyCallbackView(buy, thing, balance.sum);
  await common.postMessage(app, thingsOauth, thingsChannel, text, blocks);
});

app.action('things-bought', async ({ ack, body }) => {
  console.log('things-bought');
  await ack();

  const houseId = body.team.id;
  const things = await Things.getUnfulfilledThingBuys(houseId, new Date());

  const view = views.thingsBoughtView(things);
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
