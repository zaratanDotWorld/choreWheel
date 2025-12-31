const { Admin, Chores } = require('../../../core/index');
const { CHORES_IDX } = require('../../../constants');
const { getMonthStart, getPrevMonthEnd, sleep } = require('../../../utils');

const common = require('../../common');
const { postMessage, postEphemeral, houseActive } = require('./common');
const views = require('../views/events');

module.exports = (app) => {
  // App uninstalled
  app.event('app_uninstalled', async ({ context }) => {
    await common.uninstallApp(app, 'chores', context);
  });

  // User change
  app.event('user_change', async ({ payload }) => {
    const now = new Date();
    const { user } = payload;

    if (!(await houseActive(user.team_id, now))) { return; }

    console.log(`chores user_change - ${user.team_id} x ${user.id}`);

    await sleep(CHORES_IDX * 1000);
    await common.pruneWorkspaceMember(user.team_id, user);
  });

  // App home opened
  app.event('app_home_opened', async ({ body, event }) => {
    if (event.tab !== 'home') { return; }

    const { now, houseId, residentId } = common.beginHome('chores', body, event);
    const { choresConf } = await Admin.getHouse(houseId);

    let view;
    if (choresConf.channel) {
      const monthStart = getMonthStart(now);
      const choreStats = await Chores.getChoreStats(houseId, residentId, monthStart, now);
      const workingResidentCount = await Chores.getWorkingResidentCount(houseId, now);

      view = views.choresHomeView(choresConf.channel, choreStats, workingResidentCount);
    } else {
      view = views.choresOnboardView();
    }

    await common.publishHome(app, choresConf.oauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any claims
    for (const resolvedClaim of (await Chores.resolveChoreClaims(houseId, now))) {
      console.log(`resolved choreClaim ${resolvedClaim.id}`);
      await common.updateVoteResults(app, choresConf.oauth, resolvedClaim.pollId, now);
    }

    // Resolve any proposals
    for (const resolvedProposal of (await Chores.resolveChoreProposals(houseId, now))) {
      console.log(`resolved choreProposal ${resolvedProposal.id}`);
      await common.updateVoteResults(app, choresConf.oauth, resolvedProposal.pollId, now);
    }

    // Handle monthly bookkeeping
    const chorePenalties = await Chores.addChorePenalties(houseId, now);
    if (chorePenalties.length) {
      // Post penalties, if any
      for (const penaltyHeart of chorePenalties) {
        if (penaltyHeart.value < 0) {
          const text = 'You missed too many chores last month, ' +
            `and lost *${penaltyHeart.value.toFixed(1)}* hearts...`;
          await postEphemeral(app, choresConf, penaltyHeart.residentId, text);
        } else if (penaltyHeart.value > 0) {
          const text = 'You did all your chores last month, ' +
            `and earned *${penaltyHeart.value.toFixed(1)}* hearts!`;
          await postEphemeral(app, choresConf, penaltyHeart.residentId, text);
        }
      }

      // Prune workspace
      await common.pruneWorkspaceMembers(app, choresConf.oauth, houseId, now);

      // Post house stats (checking the length to avoid posting when someone gets activated)
      if (chorePenalties.length > 1) {
        const prevMonthEnd = getPrevMonthEnd(now);
        const prevMonthStart = getMonthStart(prevMonthEnd);
        const choreStats = await Chores.getHouseChoreStats(houseId, prevMonthStart, prevMonthEnd);

        if (choreStats.length) {
          const HEARTS_URL = 'https://www.zaratan.world/chorewheel/hearts';
          const { heartsConf } = await Admin.getHouse(houseId);

          const viewsCommon = require('../views/common');
          let text = ':scroll: *Last month\'s chore points* :scroll: \n';
          text += choreStats.map(cs => `\n${viewsCommon.formatStats(cs)}`).join('');
          text += `\n${viewsCommon.formatTotalStats(choreStats)}`;
          text += (!heartsConf) ? `\n\n:heart: Want month-to-month accountability? *Get <${HEARTS_URL}|Hearts>!* :heart:` : '';
          await postMessage(app, choresConf, text);
        }
      }
    }
  });
};
