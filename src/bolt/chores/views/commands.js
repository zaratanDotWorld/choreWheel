const common = require('../../common');
const { TITLE, formatStats, formatTotalStats } = require('./utils');

// Command views

exports.choresStatsView = function (choreClaims, choreBreaks, choreStats, choreValues) {
  const header = 'See chore stats';

  const availablePoints = choreValues.reduce((sum, cv) => sum + cv.value, 0);
  const availableText = `*Points available to claim:* ${availablePoints.toFixed(0)}`;

  const totalSpecialObligation = choreStats.length
    ? choreStats[0].specialObligation * choreStats.length
    : 0;
  const specialNote = totalSpecialObligation > 0
    ? `\n_Includes ${totalSpecialObligation.toFixed(0)} points of special chores_`
    : '';

  const statsText = '*Current points:*\n' +
    (choreStats.length > 0
      ? choreStats
        .map(cs => `\n${formatStats(cs)}`)
        .join('') + `\n\n${formatTotalStats(choreStats)}${specialNote}`
      : '\n_No active residents_'
    );

  const claimText = '*Your claims:*\n' +
    (choreClaims.length > 0
      ? choreClaims
        .map(cc => `\n${cc.claimedAt.toDateString()} - ${cc.name} - ${cc.value} points`)
        .join('')
      : '\n_No claims yet_'
    );

  const breakText = '*Current breaks:*\n' +
    (choreBreaks.length > 0
      ? choreBreaks
        .map(cb => `\n${cb.startDate.toDateString()} - ${cb.endDate.toDateString()} - <@${cb.residentId}>`)
        .join('')
      : '\n_No one is on break_'
    );

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(availableText));
  blocks.push(common.blockSection(statsText));
  blocks.push(common.blockSection(claimText));
  blocks.push(common.blockSection(breakText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.choresSpecialListView = function (currentChores, futureChores) {
  const header = 'Special Chores';

  const currentText = '*Current*\n' +
    (currentChores.length > 0
      ? currentChores
        .map(cv => `\n${cv.metadata.name} - ${cv.value} points`)
        .join('')
      : '\n_No special chores available_'
    );

  const futureText = '*Future*\n' +
    (futureChores.length > 0
      ? futureChores
        .map(cv => `\n${cv.metadata.name} - ${cv.value} points - ${common.formatDate(cv.valuedAt)}`)
        .join('')
      : '\n_No upcoming special chores_'
    );

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(currentText));
  blocks.push(common.blockSection(futureText));

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
    'You can update *all* residents in the workspace, or only *a few*. ' +
    'You can also customize their monthly *chores* obligation.';
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
  blocks.push(common.blockInputOptional(
    'Customize monthly chores obligation',
    {
      type: 'number_input',
      action_id: 'obligation',
      is_decimal_allowed: false,
      min_value: '1',
      max_value: '200',
      placeholder: common.blockPlaintext('Default is 100 points'),
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
