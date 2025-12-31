const assert = require('assert');

const { Admin, Chores, Polls } = require('../../../core/index');
const { CHORES_CONF } = require('../../../constants');
const { displayThreshold, achievementWindow, breakMinDays, choresPollLength, specialChoreProposalPollLength } = require('../../../config');
const { getMonthStart, shiftDate, DAY } = require('../../../utils');

const common = require('../../common');
const { postMessage } = require('./common');
const {
  choresOnboardView2,
  choresOnboardMessage,
  choresActivateSoloView,
  choresClaimViewZero,
  choresClaimView,
  choresClaimView2,
  choresClaimCallbackView,
  choresRankView,
  choresRankView2,
  choresRankView3,
  choresRankViewZero,
  choresBreakView,
  choresGiftView,
  choresProposeView,
  choresProposeEditView,
  choresProposeAddView,
  choresProposeDeleteView,
  choresProposeCallbackView,
  choresProposeCallbackViewForce,
  choresSpecialView,
  choresSpecialCallbackView,
} = require('../views/actions');

module.exports = (app) => {
  // Onboard flow

  app.action('chores-onboard', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-onboard';
    const { houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = choresOnboardView2();
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-onboard-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-onboard-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const channel = common.getInputBlock(body, -1).channel.selected_channel;

    // Set app channel
    await app.client.conversations.join({ token: choresConf.oauth.bot.token, channel });
    await Admin.updateHouseConf(houseId, CHORES_CONF, { channel });
    choresConf.channel = channel; // Update local copy for this request

    // Activate calling resident
    await common.activateResident(houseId, residentId, now);

    // Setup initial chores
    const [ chore1 ] = await Chores.addChore(houseId, 'Dishes', {});
    const [ chore2 ] = await Chores.addChore(houseId, 'Trash Takeout', {});
    await Chores.addChoreValues([
      { houseId, choreId: chore1.id, valuedAt: now, value: 1 },
      { houseId, choreId: chore2.id, valuedAt: now, value: 1 },
    ]);

    // Setup initial preference
    const [ alphaChoreId, betaChoreId ] = [ chore1.id, chore2.id ];
    const pref = { residentId, alphaChoreId, betaChoreId, preference: 0.7 };
    await Chores.setChorePreferences(houseId, [ pref ]);

    await postMessage(app, choresConf, 'Welcome to Chores!', choresOnboardMessage(choresConf.oauth));
  });

  // Solo activate flow

  app.action('chores-activate-solo', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-activate-solo';
    const { houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = choresActivateSoloView();
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-activate-solo-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-activate-solo-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.activateResident(houseId, residentId, now);
    await postMessage(app, choresConf, `<@${residentId}> is now active :fire:`);
  });

  // Claim flow

  app.action('chores-claim', async ({ ack, body }) => {
    const actionName = 'chores-claim';
    const { now, houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const choreValues = await Chores.getUpdatedChoreValues(houseId, now);
    const filteredChoreValues = choreValues.filter(choreValue => choreValue.value >= displayThreshold);

    if (filteredChoreValues.length === 0) {
      await ack();
      const view = choresClaimViewZero();
      await common.openView(app, choresConf.oauth, body.trigger_id, view);
      return;
    }

    const claimableChores = filteredChoreValues.map(choreValue => choreValue.chore);

    await ack();
    const view = choresClaimView(claimableChores);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-claim-2', async ({ ack, body }) => {
    const actionName = 'chores-claim-2';
    const { now, houseId, residentId } = common.beginAction(actionName, body);

    const chore = JSON.parse(common.getInputBlock(body, -1).chore.selected_option.value);

    const choreStats = await Chores.getChoreStats(houseId, residentId, now);

    const choreValue = (await Chores.getUpdatedChoreValues(houseId, now))
      .find(choreValue => choreValue.chore.id === chore.id).value;

    const view = choresClaimView2(chore, choreValue, choreStats);

    await ack({ response_action: 'update', view });
  });

  app.view('chores-claim-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-claim-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const chore = JSON.parse(body.view.private_metadata).chore;

    const choreValue = (await Chores.getUpdatedChoreValues(houseId, now))
      .find(choreValue => choreValue.chore.id === chore.id).value;

    const [ claim ] = await Chores.addClaims([
      { houseId, choreId: chore.id, value: choreValue, claimedAt: now, claimedBy: residentId },
    ]);

    // Determine minimum number of upvotes
    const minVotes = choreValue >= 10 ? 2 : 1;

    // Create a poll
    await Polls.addPoll(houseId, claim.pollId, 'chores', choresPollLength * DAY, now, {});

    // Record achievement points for the last three months
    const [ achivementPoints ] = await Chores.getChoreStatsWindow(houseId, residentId, now, achievementWindow);

    // Record claimed points for the current month
    const monthlyPoints = await Chores.getChorePoints(houseId, residentId, getMonthStart(now), now);

    const blocks = choresClaimCallbackView(claim, chore.name || chore.metadata.name, minVotes, achivementPoints, monthlyPoints);
    await postMessage(app, choresConf, '', blocks);
  });

  // Rank flow

  app.action('chores-rank', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-rank';
    const { now, houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const choreRankings = await Chores.getChoreRankings(houseId, now);

    const view = choresRankView(choreRankings);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-rank-2', async ({ ack, body }) => {
    const actionName = 'chores-rank-2';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const action = Number(common.getInputBlock(body, -2).action.selected_option.value);
    const targetChore = JSON.parse(common.getInputBlock(body, -2).chore.selected_option.value);
    const preference = Number(common.getInputBlock(body, -2).preference.selected_option.value);

    // Convert to numerical preference value
    const numericalPreference = 0.5 + (action * preference);
    assert([ 0.3, 0.5, 0.7, 1.0 ].includes(numericalPreference));

    const choreRankings = await Chores.getChoreRankings(houseId, now);

    // Filter out selected target chore and any chores that already have the same preference
    const residentChorePreferences = await Chores.getChorePreferences(houseId, residentId, now);

    const filteredChoreRankings = choreRankings.filter((choreRanking) => {
      // Remove the target chore
      if (choreRanking.chore.id === targetChore.id) { return false; }

      // Remove all chores that already have the same preference as the target chore
      const samePref = residentChorePreferences.filter((pref) => {
        const sameAlpha = (pref.alphaChoreId === choreRanking.chore.id && pref.betaChoreId === targetChore.id);
        const sameBeta = (pref.alphaChoreId === targetChore.id && pref.betaChoreId === choreRanking.chore.id);
        return (sameAlpha || sameBeta) && pref.preference === numericalPreference;
      });
      return samePref.length === 0;
    });

    if (filteredChoreRankings.length === 0) {
      await ack();
      const view = choresRankViewZero(numericalPreference);
      await common.openView(app, choresConf.oauth, body.trigger_id, view);
      return;
    }

    const view = choresRankView2(numericalPreference, targetChore, filteredChoreRankings);
    await ack({ response_action: 'update', view });
  });

  app.view('chores-rank-3', async ({ ack, body }) => {
    const actionName = 'chores-rank-3';
    const { now, houseId, residentId } = common.beginAction(actionName, body);

    const { preference, targetChore } = JSON.parse(body.view.private_metadata);
    const sourceChores = common.getInputBlock(body, -1).chores.selected_options.map(option => JSON.parse(option.value));

    // Construct new set of preferences
    const newPreferences = [];
    sourceChores.forEach((sourceChore) => {
      if (preference >= 0.5) {
        newPreferences.push({ residentId, alphaChoreId: targetChore.id, betaChoreId: sourceChore.id, preference });
      } else {
        newPreferences.push({ residentId, alphaChoreId: sourceChore.id, betaChoreId: targetChore.id, preference: 1 - preference });
      }
    });

    // Determine new state of all chores
    const proposedRankings = await Chores.getProposedChoreRankings(houseId, residentId, now, newPreferences);

    // Determine new ranking of target chore
    const targetChoreRanking = proposedRankings.find(ranking => ranking.chore.id === targetChore.id);

    // Determine saturation of new preferences
    const prefSaturation = newPreferences.length / (proposedRankings.length - 1);

    // Determine number of residents
    const { numResidents } = await Admin.getHouse(houseId);

    const prefsMetadata = JSON.stringify({ newPreferences });
    const view = choresRankView3(targetChore, targetChoreRanking, prefsMetadata, prefSaturation, numResidents);

    await ack({ response_action: 'update', view });
  });

  app.view('chores-rank-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-rank-callback';
    const { houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const { newPreferences } = JSON.parse(body.view.private_metadata);
    await Chores.setChorePreferences(houseId, newPreferences);

    await postMessage(app, choresConf, `<@${residentId}> updated chore priorities :bar_chart:`);
  });

  // Break flow

  app.action('chores-break', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-break';
    const { now, houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = choresBreakView(now);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-break-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-break-callback';
    const { houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const startDate = new Date(common.getInputBlock(body, -3).date.selected_date);
    const endDate = new Date(common.getInputBlock(body, -2).date.selected_date);
    const circumstance = common.getInputBlock(body, -1).circumstance.value;

    // We need to shift the dates to account for UTC
    const timezonedStartDate = shiftDate(startDate);
    const timezonedEndDate = shiftDate(endDate);

    const daysDiff = Math.floor((timezonedEndDate - timezonedStartDate) / DAY);
    assert(daysDiff >= breakMinDays, `Break must be at least ${breakMinDays} days long. Received ${daysDiff} days.`);

    await Chores.addBreak(houseId, residentId, circumstance, timezonedStartDate, timezonedEndDate);

    await postMessage(app, choresConf, `<@${residentId}> is taking a break :palm_tree:`);
  });

  // Gift flow

  app.action('chores-gift', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-gift';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const choreStats = await Chores.getChoreStats(houseId, residentId, monthStart);
    const currentBalance = choreStats.pointsEarned - choreStats.pointsGifted;

    const view = choresGiftView(currentBalance);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-gift-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-gift-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const currentBalance = Number(body.view.private_metadata);

    const recipientId = common.getInputBlock(body, -3).recipient.selected_conversation;
    const points = Number(common.getInputBlock(body, -2).points.value);
    const circumstance = common.getInputBlock(body, -1).circumstance.value;

    const recipientConf = await Admin.getResidentConf(houseId, recipientId);
    assert(recipientConf.active, 'Recipient must be active');
    assert(points <= currentBalance, 'Cannot gift more points than you have');

    await Chores.addGift(houseId, residentId, recipientId, circumstance, points, monthStart);

    await postMessage(app, choresConf, `<@${residentId}> gifted *${points} points* to <@${recipientId}> :gift:`);
  });

  // Propose flow

  app.action('chores-propose', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-propose';
    const { houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const { minVotes } = await Admin.getHouse(houseId);
    const isAdmin = await Admin.isAdmin(houseId, residentId);

    const view = choresProposeView(minVotes, isAdmin);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-propose-2', async ({ ack, body }) => {
    const actionName = 'chores-propose-2';
    const { now, houseId } = common.beginAction(actionName, body);

    const force = common.getInputBlock(body, -2)?.force?.selected_options?.length > 0;
    const change = common.getInputBlock(body, -1).change.selected_option.value;

    const chores = await Chores.getChores(houseId, now);

    let view;
    switch (change) {
      case 'add':
        view = choresProposeAddView(force, null);
        break;
      case 'edit':
        view = choresProposeEditView(force, chores);
        break;
      case 'delete':
        view = choresProposeDeleteView(force, chores);
        break;
    }

    await ack({ response_action: 'update', view });
  });

  app.view('chores-propose-edit', async ({ ack, body }) => {
    const actionName = 'chores-propose-edit';
    const { now, houseId } = common.beginAction(actionName, body);

    const { force } = JSON.parse(body.view.private_metadata);
    const chore = JSON.parse(common.getInputBlock(body, -1).chore.selected_option.value);

    const latestChore = (await Chores.getChores(houseId, now)).find(c => c.id === chore.id);

    const view = choresProposeAddView(force, latestChore);
    await ack({ response_action: 'update', view });
  });

  app.view('chores-propose-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-propose-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const metadata = JSON.parse(body.view.private_metadata);

    const name = common.getInputBlock(body, -2)?.name?.value;
    const description = common.getInputBlock(body, -1)?.description?.value;

    // If force mode, apply immediately
    if (metadata.force) {
      switch (metadata.change) {
        case 'add':
          await Chores.addChore(houseId, name, { description });
          break;
        case 'edit':
          await Chores.updateChore(houseId, metadata.chore.id, name, { description });
          break;
        case 'delete':
          await Chores.deleteChore(houseId, metadata.chore.id);
          break;
      }

      const blocks = choresProposeCallbackViewForce(metadata, residentId, name, description);
      await postMessage(app, choresConf, '', blocks);
      return;
    }

    // Otherwise, create proposal
    let proposal;
    switch (metadata.change) {
      case 'add':
        [ proposal ] = await Chores.addChoreProposals([
          { houseId, name, proposedAt: now, proposedBy: residentId, metadata: { description, change: metadata.change } },
        ]);
        break;
      case 'edit':
        [ proposal ] = await Chores.addChoreProposals([
          {
            houseId,
            choreId: metadata.chore.id,
            name,
            proposedAt: now,
            proposedBy: residentId,
            metadata: { description, change: metadata.change },
          },
        ]);
        break;
      case 'delete':
        [ proposal ] = await Chores.addChoreProposals([
          {
            houseId,
            choreId: metadata.chore.id,
            name: metadata.chore.name,
            proposedAt: now,
            proposedBy: residentId,
            metadata: { change: metadata.change },
          },
        ]);
        break;
    }

    const { minVotes } = await Admin.getHouse(houseId);

    // Create poll
    await Polls.addPoll(houseId, proposal.pollId, 'chores', specialChoreProposalPollLength * DAY, now, {});

    const blocks = choresProposeCallbackView(metadata, proposal, minVotes);
    await postMessage(app, choresConf, '', blocks);
  });

  // Special flow

  app.action('chores-special', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-special';
    const { now, houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const { numResidents, minVotes } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const [ pointsEarned, pointsOwed ] = await Chores.getHouseStatsSum(houseId, monthStart, now);

    const remainder = Math.max(0, numResidents * pointsOwed - pointsEarned);

    const view = choresSpecialView(minVotes, remainder);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-special-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-special-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const name = common.getInputBlock(body, -3).name.value;
    const description = common.getInputBlock(body, -2)?.description?.value;
    const value = Number(common.getInputBlock(body, -1).points.value);

    const { numResidents, minVotes } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const [ pointsEarned, pointsOwed ] = await Chores.getHouseStatsSum(houseId, monthStart, now);
    const remainder = Math.max(0, numResidents * pointsOwed - pointsEarned);
    const obligation = Math.max(0, value - remainder) / numResidents;

    const [ proposal ] = await Chores.addChoreProposals([
      { houseId, name, proposedAt: now, proposedBy: residentId, metadata: { description, value } },
    ]);

    // Create poll
    await Polls.addPoll(houseId, proposal.pollId, 'chores', specialChoreProposalPollLength * DAY, now, {});

    const blocks = choresSpecialCallbackView(proposal, minVotes, obligation);
    await postMessage(app, choresConf, '', blocks);
  });

  // Voting flow

  app.action(/poll-vote/, async ({ ack, body, action }) => {
    const actionName = 'chores poll-vote';
    const { houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.updateVoteCounts(app, choresConf.oauth, body, action);

    await ack();
  });
};
