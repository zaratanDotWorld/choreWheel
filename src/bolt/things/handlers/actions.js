const { YAY, DAY } = require('../../../constants');

const { Admin, Polls, Things } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/actions');
const { postMessage, parseThingsEditSubmission } = require('./common');

module.exports = (app) => {
  // Buy flow
  app.action('things-buy', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-buy';
    const { now, houseId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const things = await Things.getThings(houseId);
    const accounts = await Things.getActiveAccounts(houseId, now);

    const view = views.thingsBuyView(things, accounts);
    await common.openView(app, thingsConf.oauth, body.trigger_id, view);
  });

  app.view('things-buy-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-buy-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const { id: thingId } = JSON.parse(common.getInputBlock(body, -3).things.selected_option.value);
    const quantity = common.getInputBlock(body, -2).quantity.value;
    const { account } = JSON.parse(common.getInputBlock(body, -1).account.selected_option.value);

    // Perform the buy
    const thing = await Things.getThing(thingId);
    const [ buy ] = await Things.buyThing(houseId, thing.id, residentId, now, account, thing.value, quantity);
    await Polls.submitVote(buy.pollId, residentId, now, YAY);

    const { minVotes } = await Polls.getPoll(buy.pollId);
    const balance = await Things.getAccountBalance(houseId, account, now);

    const text = 'Someone just bought a thing';
    const blocks = views.thingsBuyCallbackView(buy, thing, balance, minVotes);
    const { channel, ts } = await postMessage(app, thingsConf, text, blocks);
    await Polls.updateMetadata(buy.pollId, { channel, ts });
  });

  // Special buy flow
  app.action('things-special', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-special';
    const { now, houseId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const residents = await Admin.getResidents(houseId, now);
    const accounts = await Things.getActiveAccounts(houseId, now);

    const view = views.thingsSpecialBuyView(residents.length, accounts);
    await common.openView(app, thingsConf.oauth, body.trigger_id, view);
  });

  app.view('things-special-callback', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-special-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const title = common.getInputBlock(body, -4).title.value;
    const details = common.getInputBlock(body, -3).details.value;
    const cost = common.getInputBlock(body, -2).cost.value;
    const { account } = JSON.parse(common.getInputBlock(body, -1).account.selected_option.value);

    // Perform the buy
    const [ buy ] = await Things.buySpecialThing(houseId, residentId, now, account, cost, title, details);
    await Polls.submitVote(buy.pollId, residentId, now, YAY);

    const { minVotes } = await Polls.getPoll(buy.pollId);
    const balance = await Things.getAccountBalance(houseId, account, now);

    const text = 'Someone just bought a thing';
    const blocks = views.thingsSpecialBuyCallbackView(buy, balance, minVotes);
    const { channel, ts } = await postMessage(app, thingsConf, text, blocks);
    await Polls.updateMetadata(buy.pollId, { channel, ts });
  });

  // Bought things flow
  app.action('things-bought', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-bought';
    const { now, houseId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const oneWeekAgo = new Date(now.getTime() - 7 * DAY);
    const threeMonthsAgo = new Date(now.getTime() - 90 * DAY);

    const unfulfilledBuys = await Things.getUnfulfilledThingBuys(houseId, now);
    const fulfilledBuys7 = await Things.getFulfilledThingBuys(houseId, oneWeekAgo, now);
    const fulfilledBuys90 = await Things.getFulfilledThingBuys(houseId, threeMonthsAgo, now);
    const view = views.thingsBoughtView(unfulfilledBuys, fulfilledBuys7, fulfilledBuys90);
    await common.openView(app, thingsConf.oauth, body.trigger_id, view);
  });

  // Proposal flow
  app.action('things-propose', async ({ ack, body }) => {
    await ack();

    const actionName = 'things-propose';
    const { now, houseId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    const minVotes = await Things.getThingProposalMinVotes(houseId, now);

    const view = views.thingsProposeView(minVotes);
    await common.openView(app, thingsConf.oauth, body.trigger_id, view);
  });

  app.view('things-propose-2', async ({ ack, body }) => {
    const actionName = 'things-propose-2';
    const { houseId } = common.beginAction(actionName, body);

    const change = common.getInputBlock(body, -1).change.selected_option.value;

    let things, view;
    switch (change) {
      case 'add':
        view = views.thingsProposeAddView();
        break;
      case 'edit':
        things = await Things.getThings(houseId);
        view = views.thingsProposeEditView(things);
        break;
      case 'delete':
        things = await Things.getThings(houseId);
        view = views.thingsProposeDeleteView(things);
        break;
      default:
        console.log('No match found!');
        return;
    }

    await ack({ response_action: 'push', view });
  });

  app.view('things-propose-edit', async ({ ack, body }) => {
    const actionName = 'things-propose-edit';
    common.beginAction(actionName, body);

    const { id: thingId } = JSON.parse(common.getInputBlock(body, -1).thing.selected_option.value);
    const thing = await Things.getThing(thingId);

    const view = views.thingsProposeAddView(thing);
    await ack({ response_action: 'push', view });
  });

  app.view('things-propose-callback', async ({ ack, body }) => {
    const actionName = 'things-propose-callback';
    const { now, houseId, residentId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    let thingId, type, name, value, unit, url, active;
    const privateMetadata = JSON.parse(body.view.private_metadata);

    switch (privateMetadata.change) {
      case 'add':
        // TODO: if thing exists, return ephemeral and exit
        ({ type, name, unit, value, url } = parseThingsEditSubmission(body));
        [ thingId, active ] = [ null, true ];
        break;
      case 'edit':
        ({ type, name, unit, value, url } = parseThingsEditSubmission(body));
        [ thingId, active ] = [ privateMetadata.thing.id, true ];
        break;
      case 'delete':
        ({ id: thingId, type, name } = JSON.parse(common.getInputBlock(body, -1).thing.selected_option.value));
        [ value, unit, url, active ] = [ 0, undefined, undefined, false ];
        break;
      default:
        console.log('No match found!');
        return;
    }

    // Create the thing proposal
    const metadata = { unit, url };
    const [ proposal ] = await Things.createThingProposal(houseId, residentId, thingId, type, name, value, metadata, active, now);
    await Polls.submitVote(proposal.pollId, residentId, now, YAY);

    const { minVotes } = await Polls.getPoll(proposal.pollId);

    const text = 'Someone just proposed a thing edit';
    const blocks = views.thingsProposeCallbackView(privateMetadata, proposal, minVotes);
    const { channel, ts } = await postMessage(app, thingsConf, text, blocks);
    await Polls.updateMetadata(proposal.pollId, { channel, ts });

    await ack({ response_action: 'clear' });
  });

  // Voting flow
  app.action(/poll-vote/, async ({ ack, body, action }) => {
    await ack();

    const actionName = 'things poll-vote';
    const { houseId } = common.beginAction(actionName, body);
    const { thingsConf } = await Admin.getHouse(houseId);

    await common.updateVoteCounts(app, thingsConf.oauth, body, action);
  });
};
