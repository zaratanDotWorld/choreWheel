const { THINGS_CONF } = require('../../../constants');

const { Admin, Things } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/commands');
const actionsViews = require('../views/actions');
const { postMessage, postEphemeral, parseThingsEditSubmission } = require('./common');

module.exports = (app) => {
  // Channel command
  app.command('/things-channel', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/things-channel';
    const { houseId } = common.beginCommand(commandName, command);
    const { thingsConf } = await Admin.getHouse(houseId);

    await common.setChannel(app, thingsConf.oauth, THINGS_CONF, command, respond);
  });

  // Load command
  app.command('/things-load', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/things-load';
    const { houseId } = common.beginCommand(commandName, command);
    const { thingsConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, thingsConf.oauth, command.user_id))) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const view = views.thingsLoadView();
      await common.openView(app, thingsConf.oauth, command.trigger_id, view);
    }
  });

  app.view('things-load-2', async ({ ack, body }) => {
    const actionName = 'things-load-2';
    const { now, houseId } = common.beginAction(actionName, body);

    const account = common.parseTitlecase(common.getInputBlock(body, -2).account.value);
    const amount = Number(common.getInputBlock(body, -1).amount.value);

    const balance = await Things.getAccountBalance(houseId, account, now);

    const view = views.thingsLoadView2(account, balance, amount);
    await ack({ response_action: 'push', view });
  });

  app.view('things-load-callback', async ({ ack, body }) => {
    await ack({ response_action: 'clear' });

    const actionName = 'things-load-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const { account, amount } = JSON.parse(body.view.private_metadata);

    const [ thing ] = await Things.loadAccount(houseId, account, residentId, now, amount);

    const text = `<@${thing.boughtBy}> just loaded *$${thing.value}* into the *${thing.account}* account :chart_with_upwards_trend:`;
    await postMessage(app, thingsConf, text);
  });

  // Fulfill command
  app.command('/things-fulfill', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/things-fulfill';
    const { now, houseId } = common.beginCommand(commandName, command);
    const { thingsConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, thingsConf.oauth, command.user_id))) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
      return;
    }

    const confirmedBuys = (await Things.getUnfulfilledThingBuys(houseId, now))
      .filter(buy => buy.resolvedAt);

    if (confirmedBuys.length) {
      const view = views.thingsFulfillView(confirmedBuys);
      await common.openView(app, thingsConf.oauth, command.trigger_id, view);
    } else {
      await respond({ response_type: 'ephemeral', text: 'There are no buys to fulfill :relieved:' });
    }
  });

  app.view('things-fulfill-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-fulfill-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const buys = common.getInputBlock(body, -1).buys.selected_options
      .map(buy => JSON.parse(buy.value));

    for (const buy of buys) {
      await Things.fulfillThingBuy(buy.id, residentId, now);
    }

    const text = 'Fulfillment succeeded :shopping_bags:';
    await postEphemeral(app, thingsConf, residentId, text);
  });

  // Update command
  app.command('/things-update', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/things-update';
    const { houseId } = common.beginCommand(commandName, command);
    const { thingsConf } = await Admin.getHouse(houseId);

    if (!(await common.isAdmin(app, thingsConf.oauth, command.user_id))) {
      await respond({ response_type: 'ephemeral', text: common.ADMIN_ONLY });
    } else {
      const things = await Things.getThings(houseId);

      // TODO: improve this (hacky) implementation
      const view = actionsViews.thingsProposeEditView(things, '-admin');
      await common.openView(app, thingsConf.oauth, command.trigger_id, view);
    }
  });

  app.view('things-propose-edit-admin', async ({ ack, body }) => {
    const actionName = 'things-update-2';
    common.beginAction(actionName, body);

    const { id: thingId } = JSON.parse(common.getInputBlock(body, -1).thing.selected_option.value);
    const thing = await Things.getThing(thingId);

    const view = actionsViews.thingsProposeAddView(thing, '-admin');
    await ack({ response_action: 'push', view });
  });

  app.view('things-propose-callback-admin', async ({ ack, body }) => {
    const actionName = 'things-update-callback';
    const { houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const { thing } = JSON.parse(body.view.private_metadata);
    const { type, name, unit, value, url } = parseThingsEditSubmission(body);

    // Update the thing
    const metadata = { unit, url };
    await Things.editThing(thing.id, type, name, value, metadata, true);

    const text = 'Update succeeded :floppy_disk:';
    await postEphemeral(app, thingsConf, residentId, text);

    await ack({ response_action: 'clear' });
  });
};
