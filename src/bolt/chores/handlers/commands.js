const { Admin, Chores } = require('../../../core/index');
const { CHORES_CONF } = require('../../../constants');
const { getMonthStart, getPrevMonthEnd } = require('../../../utils');

const common = require('../../common');
const { postMessage } = require('./common');
const views = require('../views/commands');

module.exports = (app) => {
  // Slash command: /chores-prune
  app.command('/chores-prune', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/chores-prune';
    const { now, houseId } = common.beginCommand(commandName, command);
    const { choresConf } = await Admin.getHouse(houseId);

    const text = await common.pruneWorkspaceMembers(app, choresConf.oauth, houseId, now);
    await respond({ response_type: 'ephemeral', text });
  });

  // Slash command: /chores-channel
  app.command('/chores-channel', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/chores-channel';
    const { houseId } = common.beginCommand(commandName, command);
    const { choresConf } = await Admin.getHouse(houseId);

    await common.setChannel(app, choresConf.oauth, CHORES_CONF, command, respond);
  });

  // Slash command: /chores-stats
  app.command('/chores-stats', async ({ ack, command }) => {
    await ack();

    const commandName = '/chores-stats';
    const { now, houseId, residentId } = common.beginCommand(commandName, command);
    const { choresConf } = await Admin.getHouse(houseId);

    const monthStart = getMonthStart(now);
    const prevMonthEnd = getPrevMonthEnd(now);
    const prevMonthStart = getMonthStart(prevMonthEnd);

    // TODO: Calculate remaining points in the month

    const choreClaims = await Chores.getChoreClaims(residentId, monthStart, now);
    const choreBreaks = await Chores.getChoreBreaks(houseId, now);
    const choreStats = await Chores.getHouseChoreStats(houseId, prevMonthStart, prevMonthEnd);

    const view = views.choresStatsView(choreClaims, choreBreaks, choreStats);
    await common.openView(app, choresConf.oauth, command.trigger_id, view);
  });

  // Slash command: /chores-activate
  app.command('/chores-activate', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/chores-activate';
    const { now, houseId } = common.beginCommand(commandName, command);
    const { choresConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, choresConf.oauth, command.user_id))) {
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

    const actionName = 'chores-activate-callback';
    const { now, houseId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    const activate = common.getInputBlock(body, -3).action.selected_option.value === 'true';
    const selectAll = common.getInputBlock(body, -2).select_all.selected_options.length > 0;

    let residentIds;
    let residentsText;

    if (selectAll) {
      // Exclude bots and deleted users
      residentIds = (await common.getWorkspaceMembers(app, choresConf.oauth))
        .filter(member => !member.deleted)
        .map(member => member.id);

      residentsText = `all ${residentIds.length} residents`;
    } else {
      residentIds = common.getInputBlock(body, -1).residents.selected_conversations;

      residentsText = residentIds.map(residentId => `<@${residentId}>`).join(' and ');
    }

    let text;

    if (activate) {
      for (const residentId of residentIds) {
        await common.activateResident(houseId, residentId, now);
      }
      text = `Activated ${residentsText || 'nobody'} :fire:`;
    } else {
      for (const residentId of residentIds) {
        await common.deactivateResident(houseId, residentId);
      }
      text = `Deactivated ${residentsText || 'nobody'} :ice_cube:`;
    }

    await postMessage(app, choresConf, text);
  });

  // Slash command: /chores-reset
  app.command('/chores-reset', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/chores-reset';
    const { houseId } = common.beginCommand(commandName, command);
    const { choresConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, choresConf.oauth, command.user_id))) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const view = views.choresResetView();
      await common.openView(app, choresConf.oauth, command.trigger_id, view);
    }
  });

  // Callback: chores-reset-callback
  app.view('chores-reset-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'chores-reset-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { choresConf } = await Admin.getHouse(houseId);

    await Chores.resetChorePoints(houseId, now);

    await postMessage(app, choresConf, `<@${residentId}> just reset all chore points :volcano:`);
  });
};
