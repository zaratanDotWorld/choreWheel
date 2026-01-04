const { Chores } = require('../../../core/index');

const common = require('../../common');

const { DOCS_URL } = require('./utils');

// Event views

exports.choresOnboardView = function () {
  const header = ':wave::skin-tone-4: Thanks for installing Chores!';

  const instructions = 'To get started, choose an *events channel*. ' +
  'Chores will use this channel to post updates, hold votes, and communicate with the group.\n\n' +
  'You can change this channel later using the `/chores-channel` slash command.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(instructions));
  blocks.push(common.blockActions([
    common.blockButton('chores-onboard', ':mailbox_with_mail: Choose a channel'),
  ]));

  return {
    type: 'home',
    blocks,
  };
};

exports.choresHomeView = function (choreChannel, choreStats, numActive) {
  const { pointsEarned, pointsOwed } = choreStats;
  const progressEmoji = (pointsOwed - pointsEarned < Chores.params.penaltyIncrement)
    ? ':white_check_mark:'
    : ':muscle::skin-tone-4:';

  const header = 'Welcome to Chores';
  const mainText = `We use *<${DOCS_URL}|Chores>* to keep the house a nice place to live.\n\n` +
    'Instead of a simple chore wheel or schedule, everyone owes *100 points* per month (UTC). ' +
    'You earn points by doing chores you want, on your terms — ' +
    'the point value for a chore _keeps going up_ until someone claims it.\n\n' +
    'If you feel a chore should be worth more (or less) over time, you can change it\'s *priority*. ' +
    'If you think a chore should be *added*, *changed*, or *removed*, you can propose that too.';

  const pointsText = (pointsOwed > 0)
    ? `You've earned *${pointsEarned} / ${pointsOwed} points* this month ${progressEmoji}`
    : '*You are exempt from chores!* :tada:';
  const activeText = `There are *${numActive} people* around today :sunny:`;
  const channelText = `Events will be posted in <#${choreChannel}> :mailbox_with_mail:`;

  const actions = [];

  if (pointsOwed > 0) {
    if (Number(pointsEarned) < Number(pointsOwed) + Chores.params.pointsBuffer) {
      actions.push(common.blockButton('chores-claim', ':hand::skin-tone-4: Claim a chore'));
    }
    actions.push(common.blockButton('chores-rank', ':scales: Set priorities'));
    actions.push(common.blockButton('chores-break', ':camping: Take a break'));
    actions.push(common.blockButton('chores-gift', ':gift: Gift your points'));
    actions.push(common.blockButton('chores-special', ':bulb: Add special chore'));
    actions.push(common.blockButton('chores-propose', ':notebook: Edit chores list'));
  } else {
    actions.push(common.blockButton('chores-activate-solo', ':fire: Activate yourself'));
  }

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(pointsText));
  blocks.push(common.blockSection(activeText));
  blocks.push(common.blockSection(channelText));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};
