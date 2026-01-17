const assert = require('assert');

const { Admin, Polls, Chores } = require('../../../core/index');
const { DAY, getMonthStart, shiftDate } = require('../../../time');

const common = require('../../common');
const views = require('../views/actions');

const { formatPointsPerDay } = require('../views/utils');

module.exports = (app) => {
  // Onboarding flow

  app.action('chores-onboard', async ({ ack, body }) => {
    await ack();

    const { houseId } = common.beginAction('chores-onboard', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = views.choresOnboardView2();
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-onboard-callback', async ({ ack, body }) => {
    await ack();

    const { now, houseId, residentId } = common.beginAction('chores-onboard-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const channel = common.getInputBlock(body, -1).channel.selected_channel;

    // Set app channel
    await app.client.conversations.join({ token: choresConf.oauth.bot.token, channel });
    await Admin.updateHouseConf(houseId, Admin.CHORES_CONF, { channel });
    choresConf.channel = channel;

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

    await common.postMessage(app, choresConf, 'Welcome to Chores!', views.choresOnboardMessage(choresConf.oauth));
  });

  // Solo activate flow

  app.action('chores-activate-solo', async ({ ack, body }) => {
    await ack();

    const { houseId } = common.beginAction('chores-activate-solo', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = views.choresActivateSoloView();
    await common.openView(app, choresConf.oauth, body.trigger_id, view);
  });

  app.view('chores-activate-solo-callback', async ({ ack, body }) => {
    await ack();

    const { now, houseId, residentId } = common.beginAction('chores-activate-solo-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.activateResident(houseId, residentId, now);
    await common.postMessage(app, choresConf, `<@${residentId}> is now active :fire:`);
  });

  // Claim flow

  app.action('chores-claim', async ({ ack, body }) => {
    const { now, houseId } = common.beginAction('chores-claim', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const choreValues = await Chores.getUpdatedChoreValues(houseId, now);
    const filteredChoreValues = choreValues.filter(choreValue => choreValue.value >= Chores.params.displayThreshold);

    if (!filteredChoreValues.length) {
      const view = views.choresClaimViewZero();
      await common.openView(app, choresConf.oauth, body.trigger_id, view);
    } else {
      const view = views.choresClaimView(filteredChoreValues);
      await common.openView(app, choresConf.oauth, body.trigger_id, view);
    }

    await ack();
  });

  app.view('chores-claim-2', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-claim-2', body);

    const { choreId, choreValueId } = JSON.parse(common.getInputBlock(body, -1).chore.selected_option.value);

    assert(choreId || choreValueId, 'Missing choreId or choreValueId');

    const chore = (choreId)
      ? await Chores.getChore(choreId)
      : await Chores.getSpecialChoreValue(choreValueId);

    const choreValue = (choreId)
      ? await Chores.getCurrentChoreValue(choreId, now)
      : chore.value;

    const monthStart = getMonthStart(now);
    const choreStats = await Chores.getChoreStats(houseId, residentId, monthStart, now);

    const view = views.choresClaimView2(chore, choreValue, choreStats);
    await ack({ response_action: 'push', view });
  });

  app.view('chores-claim-callback', async ({ ack, body }) => {
    await ack({ response_action: 'clear' });

    const { now, houseId, residentId } = common.beginAction('chores-claim-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    // Note that this could be either a regular or special chore
    const { chore } = JSON.parse(body.view.private_metadata);

    const monthStart = getMonthStart(now);
    let monthlyPoints = await Chores.getAllChorePoints(residentId, monthStart, now);
    let achivementPoints = 0;

    let name;
    let claim;

    // HACK: Can we do better than conditioning on `name`?
    if (chore.name) {
      // Regular chore
      name = chore.name;

      const achievementStart = new Date(now.getTime() - Chores.params.achievementWindow);
      achivementPoints = await Chores.getChorePoints(residentId, chore.id, achievementStart, now);

      // Perform the regular claim, skipping timeSpent for now
      [ claim ] = await Chores.claimChore(houseId, chore.id, residentId, now, 0);

      achivementPoints = achivementPoints + claim.value;
    } else {
      // Special chore
      name = chore.metadata.name;

      // Perform the special claim, skipping timeSpent for now
      [ claim ] = await Chores.claimSpecialChore(houseId, chore.id, residentId, now, 0);
    }

    monthlyPoints = monthlyPoints + claim.value;

    await Polls.submitVote(claim.pollId, residentId, now, Polls.YAY);
    const { minVotes } = await Polls.getPoll(claim.pollId);

    const text = 'Someone just completed a chore';
    const blocks = views.choresClaimCallbackView(claim, name, minVotes, achivementPoints, monthlyPoints);
    const { channel, ts } = await common.postMessage(app, choresConf, text, blocks);
    await Polls.updateMetadata(claim.pollId, { channel, ts });

    // Append the description
    if (chore.metadata && chore.metadata.description) {
      const text = `*Description:*\n${chore.metadata.description}`;
      await common.postReply(app, choresConf, ts, text);
    }
  });

  // Ranking flow

  app.action('chores-rank', async ({ ack, body }) => {
    const { now, houseId } = common.beginAction('chores-rank', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const choreRankings = await Chores.getCurrentChoreRankings(houseId, now);

    const view = views.choresRankView(choreRankings);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);

    await ack();
  });

  app.view('chores-rank-2', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-rank-2', body);

    const action = JSON.parse(common.getInputBlock(body, -3).action.selected_option.value);
    const targetChore = JSON.parse(common.getInputBlock(body, -2).chore.selected_option.value);
    const preference = JSON.parse(common.getInputBlock(body, -1).preference.selected_option.value);

    const actionPreference = (action) ? preference : 1 - preference;

    const orientedCurrentPreferences = (await Chores.getResidentChorePreferences(houseId, residentId))
      .map(pref => Chores.orientChorePreference(targetChore.id, pref))
      .filter(pref => pref);

    const sourceExclusionSet = Chores.createSourceExclusionSet(orientedCurrentPreferences, actionPreference);
    const choreRankings = (await Chores.getCurrentChoreRankings(houseId, now))
      .filter(ranking => ranking.id !== targetChore.id && !sourceExclusionSet.has(ranking.id));

    const view = (choreRankings.length)
      ? views.choresRankView2(actionPreference, targetChore, choreRankings)
      : views.choresRankViewZero(actionPreference);

    await ack({ response_action: 'push', view });
  });

  app.view('chores-rank-3', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-rank-3', body);

    const { preference, targetChore } = JSON.parse(body.view.private_metadata);
    const sourceChoreIds = common.getInputBlock(body, -1).chores.selected_options
      .map(option => JSON.parse(option.value).id);

    const newPrefs = sourceChoreIds.map((scId) => {
      const pref = { targetChoreId: targetChore.id, sourceChoreId: scId, preference };
      return { residentId, ...Chores.normalizeChorePreference(pref) };
    });

    // Get the proposed ranking and preference saturation
    const proposedRankings = await Chores.getProposedChoreRankings(houseId, newPrefs, now);
    const targetChoreRanking = proposedRankings.find(ranking => ranking.id === targetChore.id);
    const prefSaturation = await Chores.getProposedPreferenceSaturation(houseId, residentId, targetChore.id, newPrefs, now);

    // Forward the preferences through metadata
    const prefsMetadata = JSON.stringify({ targetChore, sourceChoreIds, preference });

    const totalObligation = await Chores.getTotalObligation(houseId, now);

    const view = views.choresRankView3(targetChore, targetChoreRanking, prefsMetadata, prefSaturation, totalObligation);
    await ack({ response_action: 'push', view });
  });

  app.view('chores-rank-callback', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-rank-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const { targetChore, sourceChoreIds, preference } = JSON.parse(body.view.private_metadata);

    const newPrefs = sourceChoreIds.map((scId) => {
      const pref = { targetChoreId: targetChore.id, sourceChoreId: scId, preference };
      return { residentId, ...Chores.normalizeChorePreference(pref) };
    });

    // Get the real new ranking
    await Chores.setChorePreferences(houseId, newPrefs);
    const choreRankings = await Chores.getCurrentChoreRankings(houseId, now);
    const targetChoreRanking = choreRankings.find(chore => chore.id === targetChore.id);

    const newPriority = targetChoreRanking.ranking * 100;
    const change = newPriority - targetChore.priority;

    const totalObligation = await Chores.getTotalObligation(houseId, now);
    const pointsPerDay = formatPointsPerDay(targetChoreRanking.ranking, totalObligation);

    if (change > 0) {
      const text = `Someone *prioritized ${targetChore.name}* to *${newPriority.toFixed(1)}%* ` +
        `(+${change.toFixed(1)}%), or about *${pointsPerDay} points per day* :rocket:`;
      await common.postMessage(app, choresConf, text);
    } else if (change < 0) {
      const text = `Someone *deprioritized ${targetChore.name}* to *${newPriority.toFixed(1)}%* ` +
        `(${change.toFixed(1)}%), or about *${pointsPerDay} points per day* :snail:`;
      await common.postMessage(app, choresConf, text);
    }

    await ack({ response_action: 'clear' });
  });

  // Break flow

  app.action('chores-break', async ({ ack, body }) => {
    const { now, houseId } = common.beginAction('chores-break', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const view = views.choresBreakView(now);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);

    await ack();
  });

  app.view('chores-break-callback', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-break-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

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

    if (breakStart < todayStart || breakDays < Chores.params.breakMinDays) {
      const text = 'Not a valid chore break :slightly_frowning_face:';
      await common.postEphemeral(app, choresConf, residentId, text);
    } else {
      // Record the break
      await Chores.addChoreBreak(houseId, residentId, breakStart, breakEnd, circumstance);
      const text = `<@${residentId}> is taking a *${breakDays}-day* break ` +
          `starting ${breakStart.toDateString()} :beach_with_umbrella:\n` +
          `_${circumstance}_`;
      await common.postMessage(app, choresConf, text);
    }

    await ack();
  });

  // Gift flow

  app.action('chores-gift', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-gift', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const chorePoints = await Chores.getAllChorePoints(residentId, monthStart, now);

    const view = views.choresGiftView(chorePoints);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);

    await ack();
  });

  app.view('chores-gift-callback', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-gift-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const currentBalance = Number(body.view.private_metadata);
    const recipientId = common.getInputBlock(body, 2).recipient.selected_conversation;
    const points = common.getInputBlock(body, 3).points.value;
    const circumstance = common.getInputBlock(body, 4).circumstance.value;

    if (!(await Admin.isActive(recipientId, now))) {
      const text = `<@${recipientId}> is not active and cannot earn points :confused:`;
      await common.postEphemeral(app, choresConf, residentId, text);
    } else if (points > currentBalance) {
      const text = 'You can\'t gift more points than you have! :face_with_monocle:';
      await common.postEphemeral(app, choresConf, residentId, text);
    } else {
      // Make the gift
      await Chores.giftChorePoints(houseId, residentId, recipientId, now, points);

      const text = `<@${residentId}> just gifted <@${recipientId}> *${points} points* :gift:\n` +
        `_${circumstance}_`;
      await common.postMessage(app, choresConf, text);
    }

    await ack();
  });

  // Edit flow

  app.action('chores-propose', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-propose', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const isAdmin = await common.isAdmin(app, choresConf.oauth, residentId);
    const minVotes = await Chores.getChoreProposalMinVotes(houseId, now);

    const view = views.choresProposeView(minVotes, isAdmin);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);

    await ack();
  });

  app.view('chores-propose-2', async ({ ack, body }) => {
    const { houseId } = common.beginAction('chores-propose-2', body);

    const force = common.getForceInput(common.getInputBlock(body, -2));
    const change = common.getInputBlock(body, -1).change.selected_option.value;

    let chores, view;
    switch (change) {
      case 'add':
        view = views.choresProposeAddView(force);
        break;
      case 'edit':
        chores = await Chores.getChores(houseId);
        view = views.choresProposeEditView(force, chores);
        break;
      case 'delete':
        chores = await Chores.getChores(houseId);
        view = views.choresProposeDeleteView(force, chores);
        break;
      default:
        console.log('No match found!');
        return;
    }

    await ack({ response_action: 'push', view });
  });

  app.view('chores-propose-edit', async ({ ack, body }) => {
    common.beginAction('chores-propose-edit', body);

    const { force } = JSON.parse(body.view.private_metadata);
    const { id: choreId } = JSON.parse(common.getInputBlock(body, -1).chore.selected_option.value);
    const chore = await Chores.getChore(choreId);

    const view = views.choresProposeAddView(force, chore);
    await ack({ response_action: 'push', view });
  });

  app.view('chores-propose-callback', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-propose-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

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

    const metadata = { description };

    if (privateMetadata.force) {
      await Chores.executeChoreProposal(houseId, choreId, name, metadata, active, now);

      const text = 'An admin just edited a chore';
      const blocks = views.choresProposeCallbackViewForce(privateMetadata, residentId, name, description);
      await common.postMessage(app, choresConf, text, blocks);
    } else {
      // Create the chore proposal
      const [ proposal ] = await Chores.createChoreProposal(houseId, residentId, choreId, name, metadata, active, now);
      await Polls.submitVote(proposal.pollId, residentId, now, Polls.YAY);

      const { minVotes } = await Polls.getPoll(proposal.pollId);

      const text = 'Someone just proposed a chore edit';
      const blocks = views.choresProposeCallbackView(privateMetadata, proposal, minVotes);
      const { channel, ts } = await common.postMessage(app, choresConf, text, blocks);
      await Polls.updateMetadata(proposal.pollId, { channel, ts });
    }

    await ack({ response_action: 'clear' });
  });

  // Special chore flow

  app.action('chores-special', async ({ ack, body }) => {
    const { now, houseId } = common.beginAction('chores-special', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const minVotes = await Chores.getSpecialChoreProposalMinVotes(houseId, 0, now);
    const remainder = Math.max(0, await Chores.getSpecialChoreBalance(houseId, now));

    const view = views.choresSpecialView(minVotes, remainder);
    await common.openView(app, choresConf.oauth, body.trigger_id, view);

    await ack();
  });

  app.view('chores-special-callback', async ({ ack, body }) => {
    const { now, houseId, residentId } = common.beginAction('chores-special-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const name = common.parseTitlecase(common.getInputBlock(body, -4).name.value);
    const points = common.getInputBlock(body, -3).points.value;
    const description = common.getInputBlock(body, -2).description.value;
    const claimableUtc = new Date(common.getInputBlock(body, -1).claimable.selected_date);

    const claimable = shiftDate(claimableUtc, now.getTimezoneOffset());
    const valuedAt = (claimable >= now) ? claimable : now;

    // Create the special chore proposal
    const [ proposal ] = await Chores.createSpecialChoreProposal(houseId, residentId, name, description, points, valuedAt, now);
    await Polls.submitVote(proposal.pollId, residentId, now, Polls.YAY);

    const { minVotes } = await Polls.getPoll(proposal.pollId);

    const numResidents = await Admin.getNumResidents(houseId, valuedAt);
    const balance = await Chores.getSpecialChoreBalance(houseId, valuedAt);
    const newObligation = Math.min(points, points - balance) / numResidents;

    const text = 'Someone just proposed a special chore';
    const blocks = views.choresSpecialCallbackView(proposal, minVotes, newObligation, valuedAt);
    const { channel, ts } = await common.postMessage(app, choresConf, text, blocks);
    await Polls.updateMetadata(proposal.pollId, { channel, ts });

    await ack({ response_action: 'clear' });
  });

  // Voting flow

  app.action(/poll-vote/, async ({ ack, body, action }) => {
    const { houseId } = common.beginAction('chores poll-vote', body);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.updateVoteCounts(app, choresConf.oauth, body, action);

    await ack();
  });
};
