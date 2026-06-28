const { Admin, Chores } = require('../../../core/index');
const { getMonthStart } = require('../../../time');

const common = require('../../common');
const views = require('../views/commands');
const viewsActions = require('../views/actions');

module.exports = (app) => {
  // Slash command: /chores-prune
  app.command('/chores-prune', async ({ ack, command, respond }) => {
    await ack();

    const { now, houseId } = common.beginCommand('/chores-prune', command);
    const { choresConf } = await Admin.getHouse(houseId);

    const text = await common.pruneWorkspaceMembers(app, choresConf.oauth, houseId, now);
    await respond({ response_type: 'ephemeral', text });
  });

  // Slash command: /chores-channel
  app.command('/chores-channel', async ({ ack, command, respond }) => {
    await ack();

    const { houseId } = common.beginCommand('/chores-channel', command);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.setChannel(app, choresConf.oauth, Admin.CHORES_CONF, command, respond);
    await common.postMessage(app, choresConf, 'Welcome to Chores!', viewsActions.choresOnboardMessage(choresConf.oauth));
  });

  // Slash command: /chores-stats
  app.command('/chores-stats', async ({ ack, command }) => {
    await ack();

    const { now, houseId, residentId } = common.beginCommand('/chores-stats', command);
    const { choresConf } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);

    // Optionally accept `@user` to view another resident's claims
    const mentionedId = (command.text || '').match(/<@([A-Z0-9]+)(?:\|[^>]+)?>/)?.[1];
    const claimsResidentId = mentionedId && mentionedId !== residentId ? mentionedId : residentId;

    const choreClaims = await Chores.getChoreClaims(claimsResidentId, monthStart, now);
    const choreBreaks = await Chores.getChoreBreaks(houseId, now);
    const choreStats = await Chores.getHouseChoreStats(houseId, monthStart, now);
    const choreValues = await Chores.getCurrentChoreValues(houseId, now);

    const view = views.choresStatsView(choreClaims, choreBreaks, choreStats, choreValues, claimsResidentId);
    await common.openView(app, choresConf.oauth, command.trigger_id, view);
  });

  // Slash command: /chores-special
  app.command('/chores-special', async ({ ack, command }) => {
    await ack();

    const { now, houseId, residentId } = common.beginCommand('/chores-special', command);
    const { choresConf } = await Admin.getHouse(houseId);

    const currentSpecialChores = await Chores.getUnclaimedSpecialChoreValues(houseId, now);
    const futureSpecialChores = await Chores.getFutureSpecialChoreValues(houseId, now);

    // A special chore can be deleted by its creator, or by an admin
    const isAdmin = await common.isAdmin(app, choresConf.oauth, residentId);
    const deletableChores = [ ...currentSpecialChores, ...futureSpecialChores ]
      .filter(cv => isAdmin || cv.metadata.createdBy === residentId);

    const view = views.choresSpecialListView(currentSpecialChores, futureSpecialChores, deletableChores);
    await common.openView(app, choresConf.oauth, command.trigger_id, view);
  });

  // Callback: chores-special-delete-callback
  app.view('chores-special-delete-callback', async ({ ack, body }) => {
    await ack({ response_action: 'clear' });

    const { now, houseId, residentId } = common.beginAction('chores-special-delete-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    // The menu only lists chores the viewer may delete (filtered in the /chores-special handler),
    // and Slack constrains a multi_static_select submission to the options we provided
    const selectedOptions = common.getInputBlock(body, -1).chores.selected_options;

    const deleted = [];
    for (const option of selectedOptions) {
      const { choreValueId } = JSON.parse(option.value);
      const choreValue = await Chores.getSpecialChoreValue(choreValueId);

      await Chores.deleteSpecialChore(houseId, choreValueId, residentId, now);
      deleted.push(choreValue.metadata.name);
    }

    if (deleted.length > 0) {
      const text = `<@${residentId}> deleted ${deleted.length} special chore${deleted.length === 1 ? '' : 's'}: ` +
        deleted.map(name => `*${name}*`).join(', ');
      await common.postMessage(app, choresConf, text);
    }
  });

  // Slash command: /chores-activate
  app.command('/chores-activate', async ({ ack, command, respond }) => {
    await ack();

    const { now, houseId } = common.beginCommand('/chores-activate', command);
    const { choresConf } = await Admin.getHouse(houseId);

    if (!await common.isAdmin(app, choresConf.oauth, command.user_id)) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const residents = await Admin.getResidents(houseId, now);
      const view = views.choresActivateView(residents);
      await common.openView(app, choresConf.oauth, command.trigger_id, view);
    }
  });

  // Callback: chores-activate-callback
  app.view('chores-activate-callback', async ({ ack, body }) => {
    await ack();

    const { now, houseId } = common.beginAction('chores-activate-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    const activate = common.getInputBlock(body, -4).action.selected_option.value === 'true';
    const selectAll = common.getInputBlock(body, -3).select_all.selected_options.length > 0;
    // ResidentIds (block -2) are selected only if selectAll === false
    let obligation = common.getInputBlock(body, -1).obligation.value;
    obligation = obligation ? Number(obligation) : undefined;

    let residentIds;
    let residentsText;

    if (selectAll) {
      // Exclude bots and deleted users
      residentIds = (await common.getWorkspaceMembers(app, choresConf.oauth))
        .filter(member => !member.deleted)
        .map(member => member.id);
      residentsText = `all ${residentIds.length} residents`;
    } else {
      residentIds = common.getInputBlock(body, -2).residents.selected_conversations;
      residentsText = residentIds.map(residentId => `<@${residentId}>`).join(' and ');
    }

    let text;

    if (activate) {
      for (const residentId of residentIds) {
        await common.activateResident(houseId, residentId, now, obligation);
      }
      text = `Activated ${residentsText || 'nobody'}` +
        `${obligation ? ` with a *${obligation}-point* obligation` : ''} :fire:`;
    } else {
      for (const residentId of residentIds) {
        await common.deactivateResident(houseId, residentId);
      }
      text = `Deactivated ${residentsText || 'nobody'} :ice_cube:`;
    }

    await common.postMessage(app, choresConf, text);
  });

  // Slash command: /chores-reset
  app.command('/chores-reset', async ({ ack, command, respond }) => {
    await ack();

    const { houseId } = common.beginCommand('/chores-reset', command);
    const { choresConf } = await Admin.getHouse(houseId);

    if (!await common.isAdmin(app, choresConf.oauth, command.user_id)) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const view = views.choresResetView();
      await common.openView(app, choresConf.oauth, command.trigger_id, view);
    }
  });

  // Callback: chores-reset-callback
  app.view('chores-reset-callback', async ({ ack, body }) => {
    await ack();

    const { now, houseId, residentId } = common.beginAction('chores-reset-callback', body);
    const { choresConf } = await Admin.getHouse(houseId);

    await Chores.resetChorePoints(houseId, now);

    await common.postMessage(app, choresConf, `<@${residentId}> just reset all chore points :volcano:`);
  });
};
