const { DAY, sleep } = require('../../../time');
const { Admin, Things } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/events');

function houseActive (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'ThingBuy', 'boughtAt', windowStart, now);
}

module.exports = (app) => {
  // App uninstalled
  app.event('app_uninstalled', async ({ context }) => {
    await common.uninstallApp(app, 'things', context);
  });

  // User change
  app.event('user_change', async ({ payload }) => {
    const [ now, user ] = [ new Date(), payload.user ];

    if (!(await houseActive(user.team_id, now))) { return; }

    console.log(`things user_change - ${user.team_id} x ${user.id}`);

    await sleep(common.THINGS_IDX * 1000);
    await common.pruneWorkspaceMember(user.team_id, user);
  });

  // App home opened
  app.event('app_home_opened', async ({ body, event }) => {
    if (event.tab !== 'home') { return; }

    const { now, houseId, residentId } = common.beginHome('things', body, event);
    const { thingsConf } = await Admin.getHouse(houseId);

    let view;
    if (thingsConf.channel) {
      const isActive = await Admin.isActive(residentId, now);
      const activeAccounts = await Things.getActiveAccounts(houseId, now);

      view = views.thingsHomeView(thingsConf.channel, isActive, activeAccounts);
    } else {
      view = views.thingsIntroView();
    }

    await common.publishHome(app, thingsConf.oauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any buys
    for (const resolvedBuy of (await Things.resolveThingBuys(houseId, now))) {
      console.log(`resolved thingBuy ${resolvedBuy.id}`);
      await common.updateVoteResults(app, thingsConf.oauth, resolvedBuy.pollId, now);
    }

    // Resolve any proposals
    for (const resolvedProposal of (await Things.resolveThingProposals(houseId, now))) {
      console.log(`resolved thingProposal ${resolvedProposal.id}`);
      await common.updateVoteResults(app, thingsConf.oauth, resolvedProposal.pollId, now);
    }
  });
};
