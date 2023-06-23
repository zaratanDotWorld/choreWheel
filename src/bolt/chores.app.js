require('dotenv').config();

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Chores } = require('../core/index');
const { pointsPerResident, displayThreshold } = require('../config');
const { YAY, DAY } = require('../constants');
const { getMonthStart, shiftDate } = require('../utils');

const common = require('./common');
const views = require('./chores.views');

let choresOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.INFO,
  signingSecret: process.env.CHORES_SIGNING_SECRET,
  clientId: process.env.CHORES_CLIENT_ID,
  clientSecret: process.env.CHORES_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Chores') ],
  scopes: [
    'channels:join',
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
    console.log('chores home');
    const houseId = body.team_id;
    const residentId = event.user;

    const now = new Date();
    const monthStart = getMonthStart(now);

    await Admin.addResident(houseId, residentId, now);

    const chorePoints = await Chores.getAllChorePoints(residentId, monthStart, now);
    const activePercentage = await Chores.getActiveResidentPercentage(residentId, now);

    const view = views.choresHomeView(chorePoints.sum || 0, activePercentage * pointsPerResident);
    await common.publishHome(app, choresOauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any claims
    await Chores.resolveChoreClaims(houseId, now);

    // Give monthly penalty if needed
    const [ penaltyHeart ] = await Chores.addChorePenalty(houseId, residentId, now);
    if (penaltyHeart !== undefined && penaltyHeart.value > 0) {
      const { choresChannel } = await Admin.getHouse(houseId);
      const text = `You missed too many chores last month, and lost *${penaltyHeart.value.toFixed(1)}* hearts...`;
      await common.postEphemeral(app, choresOauth, choresChannel, residentId, text); // TODO: make public?
    }
  }
});

// Slash commands

app.command('/chores-sync', async ({ ack, command }) => {
  console.log('/chores-sync');
  await ack();

  await common.syncWorkspace(app, choresOauth, command, true, false);
});

app.command('/chores-channel', async ({ ack, command }) => {
  console.log('/chores-channel');
  await ack();

  await common.setChannel(app, choresOauth, 'choresChannel', command);
});

app.command('/chores-add', async ({ ack, command }) => {
  console.log('/chores-add');
  await ack();

  let text;

  if (command.text === 'help' || command.text.length === 0) {
    text = 'Enter the name of a new chore to add it to the list. ' +
    'If the chore already exists, the command does nothing.';
  } else if (await common.isAdmin(app, choresOauth, command)) {
    const choreName = views.formatChoreName(command.text);
    await Chores.addChore(command.team_id, choreName);
    text = `${choreName} added to the chores list :star-struck:`;
  } else {
    text = ':warning: Only admins can update the chore list...';
  }

  await common.replyEphemeral(app, choresOauth, command, text);
});

app.command('/chores-del', async ({ ack, command }) => {
  console.log('/chores-del');
  await ack();

  let text;

  if (command.text === 'help' || command.text.length === 0) {
    text = 'Enter the name of an existing chore to delete it from the list. ' +
    'If no matching chore is found, the command does nothing.';
  } else if (await common.isAdmin(app, choresOauth, command)) {
    const choreName = views.formatChoreName(command.text);
    await Chores.deleteChore(command.team_id, choreName);
    text = `${choreName} removed from the chores list :sob:`;
  } else {
    text = ':warning: Only admins can update the chore list...';
  }

  await common.replyEphemeral(app, choresOauth, command, text);
});

// Claim flow

app.action('chores-claim', async ({ ack, body }) => {
  console.log('chores-claim');
  await ack();

  const choreValues = await Chores.getUpdatedChoreValues(body.team.id, new Date(), pointsPerResident);
  const filteredChoreValues = choreValues.filter(choreValue => choreValue.value >= displayThreshold);

  const view = views.choresClaimView(filteredChoreValues);
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  console.log('chores-claim-callback');
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const blockIndex = body.view.blocks.length - 1;
  const blockId = body.view.blocks[blockIndex].block_id;
  const [ choreId, choreName ] = body.view.state.values[blockId].options.selected_option.value.split('|');

  // TODO: Return error to user (not console) if channel is not set
  const { choresChannel } = await Admin.getHouse(houseId);
  if (choresChannel === null) { throw new Error('Chores channel not set!'); }

  // Get chore points over last six months
  const now = new Date();
  const monthStart = getMonthStart(now);
  const sixMonths = new Date(now.getTime() - 180 * DAY);
  let monthlyPoints = await Chores.getAllChorePoints(residentId, monthStart, now);
  let recentPoints = await Chores.getChorePoints(residentId, choreId, sixMonths, now);

  // Perform the claim
  const [ claim ] = await Chores.claimChore(houseId, choreId, residentId, now);
  await Polls.submitVote(claim.pollId, residentId, now, YAY);

  // Update point values
  recentPoints = (recentPoints.sum || 0) + claim.value;
  monthlyPoints = (monthlyPoints.sum || 0) + claim.value;

  const text = 'Someone just completed a chore';
  const blocks = views.choresClaimCallbackView(claim, choreName, recentPoints, monthlyPoints);
  await common.postMessage(app, choresOauth, choresChannel, text, blocks);
});

// Ranking flow

app.action('chores-rank', async ({ ack, body }) => {
  console.log('chores-rank');
  await ack();

  const view = views.choresRankView();
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.action('chores-rank-2', async ({ ack, body }) => {
  console.log('chores-rank-2');
  await ack();

  const direction = body.actions[0].selected_option.value;
  const choreRankings = await Chores.getCurrentChoreRankings(body.team.id);

  const view = views.choresRankView2(direction, choreRankings);
  await common.pushView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-rank-callback', async ({ ack, body }) => {
  console.log('chores-rank-callback');
  await ack({ response_action: 'clear' });

  const residentId = body.user.id;
  const houseId = body.team.id;

  const FASTER = 'faster';
  const SLOWER = 'slower';

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const targetBlockId = body.view.blocks[2].block_id;
  const sourceBlockId = body.view.blocks[3].block_id;

  const direction = body.view.private_metadata;
  const target = body.view.state.values[targetBlockId].chores.selected_option.value;
  const sources = body.view.state.values[sourceBlockId].chores.selected_options;
  const [ targetChoreId, targetChoreName, targetChoreSpeed ] = target.split('|');

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
      preference = Number(direction === FASTER);
    } else {
      alphaChoreId = parseInt(sourceChoreId);
      betaChoreId = parseInt(targetChoreId);
      preference = Number(direction === SLOWER);
    }

    // Perform the update
    await Chores.setChorePreference(houseId, residentId, alphaChoreId, betaChoreId, preference);
    console.log(`Chore preference updated, ${alphaChoreId} vs ${betaChoreId} at ${preference}`);
  }

  const choreRankings = await Chores.getCurrentChoreRankings(houseId);
  const targetChoreRanking = choreRankings.find((chore) => chore.id === parseInt(targetChoreId));

  const bigChange = (1000 / choreRankings.length) / 5; // 20% of the average speed
  const speedDiff = (targetChoreRanking.ranking * 1000).toFixed(0) - parseInt(targetChoreSpeed);
  const speedText = (Math.abs(speedDiff) > bigChange) ? 'a lot' : 'a little';

  const { choresChannel } = await Admin.getHouse(houseId);
  if (speedDiff > 0) {
    const text = `Someone sped up *${targetChoreName}* by *${speedText}* :rocket:`;
    await common.postMessage(app, choresOauth, choresChannel, text);
  } else if (speedDiff < 0) {
    const { choresChannel } = await Admin.getHouse(houseId);
    const text = `Someone slowed down *${targetChoreName}* by *${speedText}* :snail:`;
    await common.postMessage(app, choresOauth, choresChannel, text);
  } else {
    const text = 'No speed change. Try including more chores.';
    await common.postEphemeral(app, choresOauth, choresChannel, residentId, text);
  }
});

// Break flow

app.action('chores-break', async ({ ack, body }) => {
  console.log('chores-break');
  await ack();

  const view = views.choresBreakView(new Date());
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-break-callback', async ({ ack, body }) => {
  console.log('chores-break-callback');
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const breakStartId = body.view.blocks[2].block_id;
  const breakEndId = body.view.blocks[3].block_id;
  const circumstanceId = body.view.blocks[4].block_id;

  // Dates come in yyyy-mm-dd format
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const breakStartUtc = new Date(body.view.state.values[breakStartId].date.selected_date);
  const breakEndUtc = new Date(body.view.state.values[breakEndId].date.selected_date);
  const circumstance = body.view.state.values[circumstanceId].circumstance.value;

  // Shift the date to align with the system clock
  const breakStart = shiftDate(breakStartUtc, now.getTimezoneOffset());
  const breakEnd = shiftDate(breakEndUtc, now.getTimezoneOffset());
  const breakDays = parseInt((breakEnd - breakStart) / DAY);

  const { choresChannel } = await Admin.getHouse(houseId);
  if (breakStart < todayStart || breakDays < 3) {
    const text = 'Not a valid chore break :slightly_frowning_face:';
    await common.postEphemeral(app, choresOauth, choresChannel, residentId, text);
  } else {
    // Record the break
    await Chores.addChoreBreak(residentId, breakStart, breakEnd);
    const text = `<@${residentId}> is taking a *${breakDays}-day* break ` +
        `starting ${breakStart.toDateString()} :beach_with_umbrella:\n` +
        `_${circumstance}_`;
    await common.postMessage(app, choresOauth, choresChannel, text);
  }
});

// Gift flow

app.action('chores-gift', async ({ ack, body }) => {
  console.log('chores-gift');
  await ack();

  const residentId = body.user.id;
  const now = new Date();
  const monthStart = getMonthStart(now);
  const chorePoints = await Chores.getAllChorePoints(residentId, monthStart, now);

  const view = views.choresGiftView(chorePoints.sum || 0);
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-gift-callback', async ({ ack, body }) => {
  console.log('chores-gift-callback');
  await ack();

  const residentId = body.user.id;
  const houseId = body.team.id;

  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields

  const recipientBlockId = body.view.blocks[2].block_id;
  const valueBlockId = body.view.blocks[3].block_id;
  const circumstanceBlockId = body.view.blocks[4].block_id;

  const recipientId = body.view.state.values[recipientBlockId].recipient.selected_user;
  const value = Number(body.view.state.values[valueBlockId].value.value);
  const circumstance = body.view.state.values[circumstanceBlockId].circumstance.value;
  const pointsBalance = Number(body.view.private_metadata);

  const { choresChannel } = await Admin.getHouse(houseId);
  if (value <= pointsBalance) {
    // Make the gift
    await Chores.giftChorePoints(houseId, residentId, recipientId, new Date(), value);

    const text = `<@${residentId}> just gifted <@${recipientId}> *${value} points* :gift:\n` +
      `_${circumstance}_`;
    await common.postMessage(app, choresOauth, choresChannel, text);
  } else {
    const text = 'You can\'t gift more points than you have! :face_with_monocle:';
    await common.postEphemeral(app, choresOauth, choresChannel, residentId, text);
  }
});

// Voting flow

app.action(/poll-vote/, async ({ ack, body, action }) => {
  console.log('chores poll-vote');
  await ack();

  await common.updateVoteCounts(app, choresOauth, body, action);
});

// Launch the app

(async () => {
  const port = process.env.CHORES_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Chores app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
