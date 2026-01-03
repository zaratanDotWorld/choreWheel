const { DAY, sleep } = require('../../../time');
const { Admin, Hearts } = require('../../../core/index');

const common = require('../../common');
const views = require('../views/events');

function houseActive (houseId, now) {
  const windowStart = new Date(now.getTime() - 30 * DAY);
  return Admin.houseActive(houseId, 'Heart', 'generatedAt', windowStart, now);
}

module.exports = (app) => {
  // App uninstalled
  app.event('app_uninstalled', async ({ context }) => {
    const [ now, houseId ] = [ new Date(), context.teamId ];

    await Hearts.resetResidents(houseId, now);
    await common.uninstallApp(app, 'hearts', context);
  });

  // User change
  app.event('user_change', async ({ payload }) => {
    const [ now, user ] = [ new Date(), payload.user ];

    if (!(await houseActive(user.team_id, now))) { return; }

    console.log(`hearts user_change - ${user.team_id} x ${user.id}`);

    await sleep(common.HEARTS_IDX * 1000);
    await common.pruneWorkspaceMember(user.team_id, user);
  });

  // Channel created
  app.event('channel_created', async ({ payload }) => {
    const { channel } = payload;
    const { context_team_id } = channel;
    const { heartsConf } = await Admin.getHouse(context_team_id);
    console.log(`hearts channel_created - ${context_team_id} x ${channel.creator}`);

    await common.joinChannel(app, heartsConf.oauth, channel.id);
  });

  // Message
  app.event('message', async ({ payload }) => {
    const karmaRecipients = Hearts.getKarmaRecipients(payload.text);

    if (karmaRecipients.length > 0) {
      const [ now, giverId ] = [ new Date(), payload.user ];
      const houseId = (payload.subtype === 'thread_broadcast') ? payload.root.team : payload.team;
      const { heartsConf } = await Admin.getHouse(houseId);
      console.log(`hearts karma-message - ${houseId} x ${giverId}`);

      for (const recipientId of karmaRecipients) {
        await Hearts.giveKarma(houseId, giverId, recipientId, now);
      }

      await common.addReaction(app, heartsConf.oauth, payload, 'sparkles');
    }

    if (karmaRecipients.length > 1 && karmaRecipients.length < 10) {
      const numbers = [ 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine' ];
      const houseId = (payload.subtype === 'thread_broadcast') ? payload.root.team : payload.team;
      const { heartsConf } = await Admin.getHouse(houseId);

      await common.addReaction(app, heartsConf.oauth, payload, numbers[karmaRecipients.length]);
    }
  });

  // App home opened
  app.event('app_home_opened', async ({ body, event }) => {
    if (event.tab !== 'home') { return; }

    const { now, houseId, residentId } = common.beginHome('hearts', body, event);
    const { heartsConf } = await Admin.getHouse(houseId);

    let view;
    if (heartsConf.channel) {
      const isActive = await Admin.isActive(residentId, now);
      const hearts = await Hearts.getHearts(residentId, now);

      view = views.heartsHomeView(heartsConf.channel, isActive, (hearts || 0));
    } else {
      view = views.heartsIntroView();
    }

    await common.publishHome(app, heartsConf.oauth, residentId, view);

    // This bookkeeping is done after returning the view

    // Resolve any challanges
    for (const resolvedChallenge of (await Hearts.resolveChallenges(houseId, now))) {
      console.log(`resolved heartChallenge ${resolvedChallenge.id}`);
      await common.updateVoteResults(app, heartsConf.oauth, resolvedChallenge.pollId, now);
    }

    for (const challengeHeart of (await Hearts.getAgnosticHearts(houseId, now))) {
      const text = `<@${challengeHeart.residentId}> lost a challenge, ` +
        `and *${(-challengeHeart.value).toFixed(0)}* heart(s)...`;
      await common.postMessage(app, heartsConf, text);
    }

    // Regenerate lost hearts // fade karma hearts
    for (const regenHeart of (await Hearts.regenerateHouseHearts(houseId, now))) {
      if (regenHeart.value !== 0) {
        const text = (regenHeart.value > 0)
          ? `You regenerated *${regenHeart.value.toFixed(2)}* heart(s)!`
          : `Your karma faded by *${(-regenHeart.value).toFixed(2)}* heart(s)!`;
        await common.postEphemeral(app, heartsConf, regenHeart.residentId, text);
      }
    }

    // Issue karma hearts
    const karmaHearts = await Hearts.generateKarmaHearts(houseId, now);
    if (karmaHearts.length) {
      const karmaWinners = karmaHearts.map(heart => `<@${heart.residentId}>`).join(' and ');
      const text = (karmaHearts.length > 1)
        ? `${karmaWinners} get last month's karma hearts :heart_on_fire:`
        : `${karmaWinners} gets last month's karma heart :heart_on_fire:`;

      await common.postMessage(app, heartsConf, text);
    }

    // Retire any residents
    for (const residentId of (await Hearts.retireResidents(houseId, now))) {
      const text = `*<@${residentId}> lost all their hearts* and is deactivated. :sleeping:`;
      await common.postMessage(app, heartsConf, text);
    }
  });
};
