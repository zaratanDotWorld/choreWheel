const { HEARTS_CONF } = require('../../../constants');

const { Admin, Hearts } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/commands');
const { postMessage } = require('./common');

module.exports = (app) => {
  // Sync command
  app.command('/hearts-sync', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/hearts-sync';
    const { houseId } = common.beginCommand(commandName, command);
    const { heartsConf } = await Admin.getHouse(houseId);

    const text = await common.syncWorkspaceChannels(app, heartsConf.oauth);
    await respond({ response_type: 'ephemeral', text });
  });

  // Prune command
  app.command('/hearts-prune', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/hearts-prune';
    const { now, houseId } = common.beginCommand(commandName, command);
    const { heartsConf } = await Admin.getHouse(houseId);

    const text = await common.pruneWorkspaceMembers(app, heartsConf.oauth, houseId, now);
    await respond({ response_type: 'ephemeral', text });
  });

  // Channel command
  app.command('/hearts-channel', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/hearts-channel';
    const { houseId } = common.beginCommand(commandName, command);
    const { heartsConf } = await Admin.getHouse(houseId);

    await common.setChannel(app, heartsConf.oauth, HEARTS_CONF, command, respond);
  });

  // Reset command
  app.command('/hearts-reset', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/hearts-reset';
    const { houseId } = common.beginCommand(commandName, command);
    const { heartsConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, heartsConf.oauth, command.user_id))) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const view = views.heartsResetView();
      await common.openView(app, heartsConf.oauth, command.trigger_id, view);
    }
  });

  // Reset callback
  app.view('hearts-reset-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'hearts-reset-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { heartsConf } = await Admin.getHouse(houseId);

    await Hearts.resetResidents(houseId, now);

    await postMessage(app, heartsConf, `<@${residentId}> just reset all hearts :heartpulse:`);
  });
};
