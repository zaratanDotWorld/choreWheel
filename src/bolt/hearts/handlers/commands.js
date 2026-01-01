const { HEARTS_CONF } = require('../../../constants');

const { Admin, Hearts } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/commands');

module.exports = (app) => {
  // Sync command
  app.command('/hearts-sync', async ({ ack, command, respond }) => {
    await ack();

    const { houseId } = common.beginCommand('/hearts-sync', command);
    const { heartsConf } = await Admin.getHouse(houseId);

    const text = await common.syncWorkspaceChannels(app, heartsConf.oauth);
    await respond({ response_type: 'ephemeral', text });
  });

  // Prune command
  app.command('/hearts-prune', async ({ ack, command, respond }) => {
    await ack();

    const { now, houseId } = common.beginCommand('/hearts-prune', command);
    const { heartsConf } = await Admin.getHouse(houseId);

    const text = await common.pruneWorkspaceMembers(app, heartsConf.oauth, houseId, now);
    await respond({ response_type: 'ephemeral', text });
  });

  // Channel command
  app.command('/hearts-channel', async ({ ack, command, respond }) => {
    await ack();

    const { houseId } = common.beginCommand('/hearts-channel', command);
    const { heartsConf } = await Admin.getHouse(houseId);

    await common.setChannel(app, heartsConf.oauth, HEARTS_CONF, command, respond);
  });

  // Reset command
  app.command('/hearts-reset', async ({ ack, command, respond }) => {
    await ack();

    const { houseId } = common.beginCommand('/hearts-reset', command);
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

    const { now, houseId, residentId } = common.beginAction('hearts-reset-callback', body);
    const { heartsConf } = await Admin.getHouse(houseId);

    await Hearts.resetResidents(houseId, now);

    await common.postMessage(app, heartsConf, `<@${residentId}> just reset all hearts :heartpulse:`);
  });
};
