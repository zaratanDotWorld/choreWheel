const common = require('../../common');
const { TITLE, formatStats } = require('./utils');

// Command views

exports.choresStatsView = function (choreClaims, choreBreaks, choreStats) {
  const header = 'See chore stats';
  const mainText = 'Extra information about monthly chores.';

  const claimText = '*Your claimed chores:*\n' +
  choreClaims.map(cc => `\n${cc.claimedAt.toDateString()} - ${cc.name} - ${cc.value} points`)
    .join('');

  const breakText = '*Current chore breaks:*\n' +
    choreBreaks.map(cb => `\n${cb.startDate.toDateString()} - ${cb.endDate.toDateString()} - <@${cb.residentId}>`)
      .join('');

  const pointsText = '*Last month\'s chore points:*\n' +
    choreStats.map(cs => `\n${formatStats(cs)}`)
      .join('');

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(claimText));
  blocks.push(common.blockSection(breakText));
  blocks.push(common.blockSection(pointsText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.choresActivateView = function (residents) {
  const header = 'Update activation status';
  const mainText = 'Activated residents *owe chores*, and can *create or vote on polls*.\n\n' +
    'Choose some residents to update. ' +
    'You can update *all* residents in the workspace, or only *a few*.';
  const residentsText = `*Currently active residents* (${residents.length}): ` +
    residents.slice(0, 100).map(r => `<@${r.slackId}>`).join(', ');

  const options = [
    { value: 'true', text: common.blockMarkdown('*Activate* some residents') },
    { value: 'false', text: common.blockMarkdown('*Deactivate* some residents') },
  ];

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(residentsText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Update action',
    {
      type: 'radio_buttons',
      action_id: 'action',
      initial_option: options[0],
      options,
    },
  ));
  blocks.push(common.blockInputOptional(
    'Update ~all~ residents',
    {
      type: 'checkboxes',
      action_id: 'select_all',
      options: [ { value: 'true', text: common.blockPlaintext('Yes') } ],
    },
  ));
  blocks.push(common.blockInputOptional(
    'or, Update ~selected~ residents',
    {
      action_id: 'residents',
      type: 'multi_conversations_select',
      filter: common.userFilter,
      placeholder: common.blockPlaintext('Choose some residents'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-activate-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresResetView = function () {
  const header = 'Reset chore points';
  const mainText = 'Reset chore points for the workspace. ' +
  'All chores will be worth 0 points and all residents will have 0 points. ' +
  'Residents will only owe points for the rest of the month.\n\n' +
  ':warning: *This action cannot be undone!* :warning:';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    callback_id: 'chores-reset-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};
