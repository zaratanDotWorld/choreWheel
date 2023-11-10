require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');

const { Admin, Polls, Chores } = require('../core/index');
const { pointsPerResident, displayThreshold, breakMinDays } = require('../config');
const { YAY, DAY } = require('../constants');
const { getMonthStart, shiftDate, getPrevMonthEnd } = require('../utils');

const common = require('./common');
const views = require('./chores.views');

let choresOauth;

// Create the app

const app = new App({
  logLevel: LogLevel.WARN,
  signingSecret: process.env.CHORES_SIGNING_SECRET,
  clientId: process.env.CHORES_CLIENT_ID,
  clientSecret: process.env.CHORES_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Chores') ],
  scopes: [
    'channels:history',
    'channels:join',
    'chat:write',
    'commands',
    'users:read',
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      await Admin.addHouse(installation.team.id);
      await Admin.updateHouse(installation.team.id, { choresOauth: installation });
      console.log(`chores installed @ ${installation.team.id}`);
    },
    fetchInstallation: async (installQuery) => {
      ({ choresOauth } = (await Admin.getHouse(installQuery.teamId)).metadata);
      return choresOauth;
    },
    deleteInstallation: async (installQuery) => {
      await Admin.updateHouse(installQuery.teamId, { choresOauth: null });
      console.log(`chores uninstalled @ ${installQuery.teamId}`);
    },
  },
  installerOptions: { directInstall: true },
});

// Define publishing functions

async function postMessage (houseId, text, blocks) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postMessage(app, choresOauth, metadata.choresChannel, text, blocks);
}

async function postEphemeral (houseId, residentId, text) {
  const { metadata } = await Admin.getHouse(houseId);
  return common.postEphemeral(app, choresOauth, metadata.choresChannel, residentId, text);
}

// Publish the app home

app.event('app_home_opened', async ({ body, event }) => {
  if (event.tab === 'home') {
    console.log('chores home');

    const now = new Date();
    const houseId = body.team_id;
    const residentId = event.user;

    await Admin.activateResident(houseId, residentId, now);

    let view;
    if ((await Admin.getHouse(houseId)).metadata.choresChannel) {
      const monthStart = getMonthStart(now);
      const choreStats = await Chores.getChoreStats(residentId, monthStart, now);
      const workingResidentCount = await Chores.getWorkingResidentCount(houseId, now);
      const exempt = await Admin.isExempt(residentId, now);

      view = views.choresHomeView(choreStats, workingResidentCount, exempt);
    } else {
      view = common.introHomeView('Chores');
    }

    await common.publishHome(app, choresOauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any claims
    for (const resolvedClaim of (await Chores.resolveChoreClaims(houseId, now))) {
      console.log(`resolved choreClaim ${resolvedClaim.id}`);
      await common.updateVoteResults(app, choresOauth, resolvedClaim.pollId);
    }

    // Resolve any proposals
    for (const resolvedProposal of (await Chores.resolveChoreProposals(houseId, now))) {
      console.log(`resolved choreProposal ${resolvedProposal.id}`);
      await common.updateVoteResults(app, choresOauth, resolvedProposal.pollId);
    }

    // Give monthly penalties, if any
    for (const penaltyHeart of (await Chores.addChorePenalties(houseId, now))) {
      if (penaltyHeart.value < 0) {
        const text = 'You missed too many chores last month, ' +
          `and lost *${penaltyHeart.value.toFixed(1)}* hearts...`;
        await postEphemeral(houseId, penaltyHeart.residentId, text);
      }
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

  await common.setChannel(app, choresOauth, command, 'choresChannel');

  if (command.text !== 'help') {
    await common.syncWorkspace(app, choresOauth, command, true, false);
  }
});

app.command('/chores-stats', async ({ ack, command }) => {
  console.log('/chores-stats');
  await ack();

  const now = new Date();
  const houseId = command.team_id;
  const residentId = command.user_id;

  const monthStart = getMonthStart(now);
  const prevMonthEnd = getPrevMonthEnd(now);
  const prevMonthStart = getMonthStart(prevMonthEnd);

  // TODO: Calculate remaining points in the month

  const choreClaims = await Chores.getChoreClaims(residentId, monthStart, now);
  const choreBreaks = await Chores.getChoreBreaks(houseId, now);

  const chorePoints = [];
  for (const resident of (await Admin.getVotingResidents(houseId, now))) {
    const choreStats = await Chores.getChoreStats(resident.slackId, prevMonthStart, prevMonthEnd);
    chorePoints.push({ residentId: resident.slackId, ...choreStats });
  }

  const view = views.choresStatsView(choreClaims, choreBreaks, chorePoints);
  await common.openView(app, choresOauth, command.trigger_id, view);
});

app.command('/chores-exempt', async ({ ack, command }) => {
  console.log('/chores-exempt');
  await ack();

  if (!(await common.isAdmin(app, choresOauth, command))) {
    await common.replyAdminOnly(app, choresOauth, command);
    return;
  }

  const now = new Date();
  const houseId = command.team_id;

  const exemptResidents = (await Admin.getResidents(houseId, now))
    .filter(r => r.exemptAt && r.exemptAt <= now);

  const view = views.choresExemptView(exemptResidents);
  await common.openView(app, choresOauth, command.trigger_id, view);
});

app.view('chores-exempt-callback', async ({ ack, body }) => {
  console.log('chores-exempt-callback');
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const action = common.getInputBlock(body, -2).action.selected_option.value;
  const residentIds = common.getInputBlock(body, -1).residents.selected_users;

  let text;

  switch (action) {
    case 'exempt':
      for (const residentId of residentIds) {
        await Admin.exemptResident(houseId, residentId, now);
      }
      text = 'Exemption succeeded :fire:';
      break;
    case 'unexempt':
      for (const residentId of residentIds) {
        await Admin.unexemptResident(houseId, residentId, now);
      }
      text = 'Unexemption succeeded :fire:';
      break;
    default:
      console.log('No match found!');
      return;
  }

  await postEphemeral(houseId, residentId, text);
});

// Claim flow

app.action('chores-claim', async ({ ack, body }) => {
  console.log('chores-claim');
  await ack();

  const now = new Date();
  const choreValues = await Chores.getUpdatedChoreValues(body.team.id, now, pointsPerResident);
  const filteredChoreValues = choreValues.filter(choreValue => choreValue.value >= displayThreshold);

  const view = views.choresClaimView(filteredChoreValues);
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.action('chores-claim-2', async ({ ack, body }) => {
  console.log('chores-claim-2');
  await ack();

  const { id: choreId } = JSON.parse(body.actions[0].selected_option.value);
  const chore = await Chores.getChore(choreId);

  const view = views.choresClaimView2(chore);
  await common.pushView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-claim-callback', async ({ ack, body }) => {
  console.log('chores-claim-callback');
  await ack({ response_action: 'clear' });

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const chore = JSON.parse(body.view.private_metadata);

  // Get chore points over last six months
  const monthStart = getMonthStart(now);
  const sixMonths = new Date(now.getTime() - 180 * DAY);
  let monthlyPoints = await Chores.getAllChorePoints(residentId, monthStart, now);
  let recentPoints = await Chores.getChorePoints(residentId, chore.id, sixMonths, now);

  // Perform the claim
  const [ claim ] = await Chores.claimChore(houseId, chore.id, residentId, now);
  await Polls.submitVote(claim.pollId, residentId, now, YAY);

  // Update point values
  recentPoints = (recentPoints.sum || 0) + claim.value;
  monthlyPoints = (monthlyPoints.sum || 0) + claim.value;

  const text = 'Someone just completed a chore';
  const blocks = views.choresClaimCallbackView(claim, chore.name, recentPoints, monthlyPoints);
  const { channel, ts } = await postMessage(houseId, text, blocks);
  await Polls.updateMetadata(claim.pollId, { channel, ts });
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

  const now = new Date();
  const houseId = body.team.id;

  const direction = body.actions[0].selected_option.value;
  const choreRankings = await Chores.getCurrentChoreRankings(houseId, now);

  const view = views.choresRankView2(direction, choreRankings);
  await common.pushView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-rank-callback', async ({ ack, body }) => {
  console.log('chores-rank-callback');
  await ack({ response_action: 'clear' });

  const now = new Date();
  const residentId = body.user.id;
  const houseId = body.team.id;

  const direction = body.view.private_metadata;
  const targetChore = JSON.parse(common.getInputBlock(body, -2).chores.selected_option.value);
  const sourceChores = common.getInputBlock(body, -1).chores.selected_options
    .map(option => JSON.parse(option.value));

  const strength = 100 / 200 + 0.5; // Scale (0, 100) -> (0.5, 1.0)
  const preference = (direction === 'faster') ? strength : 1 - strength;

  // Perform the update
  for (const sourceChore of sourceChores) {
    await Chores.setChorePreference(houseId, residentId, targetChore.id, sourceChore.id, preference);
    console.log(`Chore preference set: ${targetChore.name} <- ${sourceChore.name} @ ${preference}`);
  }

  const choreRankings = await Chores.getCurrentChoreRankings(houseId, now);
  const targetChoreRanking = choreRankings.find(chore => chore.id === targetChore.id);
  const priority = Math.round(targetChoreRanking.ranking * 1000);

  const bigChange = (1000 / choreRankings.length) / 5; // 20% of the average priority
  const change = priority - targetChore.priority;
  const changeText = (Math.abs(change) > bigChange) ? 'a lot' : 'a little';

  if (change > 0) {
    const text = `Someone prioritized *${targetChore.name}* by *${changeText}*, to *${priority} ppt* :rocket:`;
    await postMessage(houseId, text);
  } else if (change < 0) {
    const text = `Someone deprioritized *${targetChore.name}* by *${changeText}*, to *${priority} ppt* :snail:`;
    await postMessage(houseId, text);
  } else {
    const text = 'You\'ve already input those preferences.\n\n' +
      'To have an additional effect, *choose more or different chores*. ' +
      'Alternatively, *convince others* to support your priorities.';
    await postEphemeral(houseId, residentId, text);
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

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  // Dates come in yyyy-mm-dd format
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const breakStartUtc = new Date(common.getInputBlock(body, 2).date.selected_date);
  const breakEndUtc = new Date(common.getInputBlock(body, 3).date.selected_date);
  const circumstance = common.getInputBlock(body, 4).circumstance.value;

  // Shift the date to align with the system clock
  // TODO: This might be brittle / hacky
  const breakStart = shiftDate(breakStartUtc, now.getTimezoneOffset());
  const breakEnd = shiftDate(breakEndUtc, now.getTimezoneOffset());
  const breakDays = parseInt((breakEnd - breakStart) / DAY);

  if (breakStart < todayStart || breakDays < breakMinDays) {
    const text = 'Not a valid chore break :slightly_frowning_face:';
    await postEphemeral(houseId, residentId, text);
  } else {
    // Record the break
    await Chores.addChoreBreak(houseId, residentId, breakStart, breakEnd, circumstance);
    const text = `<@${residentId}> is taking a *${breakDays}-day* break ` +
        `starting ${breakStart.toDateString()} :beach_with_umbrella:\n` +
        `_${circumstance}_`;
    await postMessage(houseId, text);
  }
});

// Gift flow

app.action('chores-gift', async ({ ack, body }) => {
  console.log('chores-gift');
  await ack();

  const now = new Date();
  const residentId = body.user.id;

  const monthStart = getMonthStart(now);
  const chorePoints = await Chores.getAllChorePoints(residentId, monthStart, now);

  const view = views.choresGiftView(chorePoints.sum || 0);
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.view('chores-gift-callback', async ({ ack, body }) => {
  console.log('chores-gift-callback');
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  const currentBalance = Number(body.view.private_metadata);
  const recipientId = common.getInputBlock(body, 2).recipient.selected_user;
  const points = common.getInputBlock(body, 3).points.value;
  const circumstance = common.getInputBlock(body, 4).circumstance.value;

  if (await Admin.isExempt(recipientId, now)) {
    const text = `<@${recipientId}> is exempt and cannot earn points :confused:`;
    await postEphemeral(houseId, residentId, text);
  } else if (points > currentBalance) {
    const text = 'You can\'t gift more points than you have! :face_with_monocle:';
    await postEphemeral(houseId, residentId, text);
  } else {
    // Make the gift
    await Chores.giftChorePoints(houseId, residentId, recipientId, now, points);

    const text = `<@${residentId}> just gifted <@${recipientId}> *${points} points* :gift:\n` +
      `_${circumstance}_`;
    await postMessage(houseId, text);
  }
});

// Edit flow

app.action('chores-propose', async ({ ack, body }) => {
  console.log('chores-propose');
  await ack();

  const now = new Date();
  const houseId = body.team.id;
  const minVotes = await Chores.getChoreProposalMinVotes(houseId, now);

  const view = views.choresProposeView(minVotes);
  await common.openView(app, choresOauth, body.trigger_id, view);
});

app.action('chores-propose-2', async ({ ack, body }) => {
  console.log('chores-propose-2');
  await ack();

  const houseId = body.team.id;
  const change = body.actions[0].selected_option.value;

  let chores, view;
  switch (change) {
    case 'add':
      view = views.choresProposeAddView();
      break;
    case 'edit':
      chores = await Chores.getChores(houseId);
      view = views.choresProposeEditView(chores);
      break;
    case 'delete':
      chores = await Chores.getChores(houseId);
      view = views.choresProposeDeleteView(chores);
      break;
    default:
      console.log('No match found!');
      return;
  }

  await common.pushView(app, choresOauth, body.trigger_id, view);
});

app.action('chores-propose-edit', async ({ ack, body }) => {
  console.log('chores-propose-edit');
  await ack();

  const { id: choreId } = JSON.parse(body.actions[0].selected_option.value);
  const chore = await Chores.getChore(choreId);

  const blocks = views.choresProposeAddView(chore);
  await common.pushView(app, choresOauth, body.trigger_id, blocks);
});

app.view('chores-propose-callback', async ({ ack, body }) => {
  console.log('chores-propose-callback');
  await ack({ response_action: 'clear' });

  const now = new Date();
  const houseId = body.team.id;
  const residentId = body.user.id;

  function parseSubmission (body) {
    name = common.parseTitlecase(common.getInputBlock(body, -2).name.value);
    description = common.getInputBlock(body, -1).description.value;
    return { name, description };
  }

  let choreId, name, description, active;
  const privateMetadata = JSON.parse(body.view.private_metadata);

  switch (privateMetadata.change) {
    case 'add':
      // TODO: if chore exists, return ephemeral and exit
      ({ name, description } = parseSubmission(body));
      [ choreId, active ] = [ null, true ];
      break;
    case 'edit':
      ({ name, description } = parseSubmission(body));
      [ choreId, active ] = [ privateMetadata.chore.id, true ];
      break;
    case 'delete':
      ({ id: choreId, name } = JSON.parse(common.getInputBlock(body, -1).chore.selected_option.value));
      [ description, active ] = [ undefined, false ];
      break;
    default:
      console.log('No match found!');
      return;
  }

  // Create the chore proposal
  const metadata = { description };
  const [ proposal ] = await Chores.createChoreProposal(houseId, residentId, choreId, name, metadata, active, now);
  await Polls.submitVote(proposal.pollId, residentId, now, YAY);

  const { minVotes } = await Polls.getPoll(proposal.pollId);

  const text = 'Someone just proposed a chore edit';
  const blocks = views.choresProposeCallbackView(privateMetadata, proposal, minVotes);
  const { channel, ts } = await postMessage(houseId, text, blocks);
  await Polls.updateMetadata(proposal.pollId, { channel, ts });
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
