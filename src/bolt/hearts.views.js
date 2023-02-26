const common = require('./common');
const { HOUR } = require('./constants');
const { heartsPollLength, heartsCriticalNum, heartsMinPctInitial, heartsMinPctCritical } = require('./config');

exports.heartEmoji = function (numHearts) {
  let emoji;
  if (numHearts <= 0) {
    emoji = ':skull_and_crossbones:';
  } else if (numHearts <= 2) {
    emoji = ':broken_heart:';
  } else if (numHearts <= 5) {
    emoji = ':heart:';
  } else {
    emoji = ':heart_on_fire:';
  }
  return emoji.repeat(Math.max(1, Math.floor(numHearts)));
};

exports.heartsHomeView = function (numHearts) {
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Hearts';
  const textA = `We use *<${docsURI}|Hearts>* to keep each other accountable.\n\n` +
    'Everyone starts with five hearts. We lose hearts when we fail to uphold our commitments, ' +
    'and we earn them back over time (one-half per month), and by exceeding expectations.';

  const textB = `You have *${numHearts}* hearts: ${exports.heartEmoji(numHearts)}`;

  return {
    type: 'home',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Welcome to Hearts', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      {
        type: 'actions',
        elements: [
          { type: 'button', action_id: 'hearts-board', text: { type: 'plain_text', text: 'See current hearts', emoji: true } },
          { type: 'button', action_id: 'hearts-challenge', text: { type: 'plain_text', text: 'Resolve a dispute', emoji: true } }
        ]
      }
    ]
  };
};

exports.heartsChallengeView = function (numResidents) {
  const initialQuorum = Math.ceil(numResidents * heartsMinPctInitial);
  const criticalQuorum = Math.ceil(numResidents * heartsMinPctCritical);
  const resolutionURI = 'https://github.com/kronosapiens/mirror/wiki/Conflict-Resolution';
  const mainText = 'If prior attempts at mediating a conflict have failed, it may be time to raise a public dispute.\n\n' +
    'Choose someone to challenge, a number of hearts to take away, and explain the circumstance. ' +
    'The dispute will go to a house vote, and the loser (potentially you) will lose hearts.\n\n' +
    `To succeed, you will need a minimum of *${initialQuorum} positive votes*. ` +
    `If the challengee will end up with less than *${heartsCriticalNum} hearts*, ` +
    `you will need a minimum of *${criticalQuorum} positive votes*. ` +
    'So please make sure you\'ve spoken to others about the issue before raising a dispute.\n\n' +
    `*<${resolutionURI}|See here>* for more information about conflict resolution.`;

  return {
    type: 'modal',
    callback_id: 'hearts-challenge-callback',
    title: { type: 'plain_text', text: 'Hearts', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Resolve a dispute', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Challengee', emoji: true },
        element: {
          type: 'users_select',
          placeholder: { type: 'plain_text', text: 'Choose a resident', emoji: true },
          action_id: 'challengee'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Number of hearts', emoji: true },
        element: {
          type: 'static_select',
          placeholder: { type: 'plain_text', text: 'Select a number', emoji: true },
          options: [
            { text: { type: 'plain_text', text: '1', emoji: true }, value: '1' },
            { text: { type: 'plain_text', text: '2', emoji: true }, value: '2' },
            { text: { type: 'plain_text', text: '3', emoji: true }, value: '3' }
          ],
          initial_option: { text: { type: 'plain_text', text: '1', emoji: true }, value: '1' },
          action_id: 'hearts'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Circumstance', emoji: true },
        element: {
          type: 'plain_text_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Explain the circumstance as best you can', emoji: true },
          action_id: 'circumstance'
        }
      }
    ]
  };
};

exports.heartsChallengeCallbackView = function (challenge, quorum, circumstance) {
  const textA = `*<@${challenge.challengerId}>* challenged *<@${challenge.challengeeId}>* ` +
    `for *${challenge.value} heart(s)*, due to the following circumstance:`;
  const textB = `*${quorum} endorsements* are required to pass, ` +
    `voting closes in *${heartsPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: `_${circumstance}_` } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: common.makeVoteButtons(challenge.pollId, 1, 0) }
  ];
};

exports.heartsBoardView = function (hearts) {
  const mainText = 'Current hearts for the house.\n\n' +
    '*One or two* hearts is :broken_heart:,\n*three to five* is :heart:,\nand *six or more* is :heart_on_fire:';
  const heartsText = hearts.map((heart) => {
    return `\n\n${exports.heartEmoji(heart.sum)} <@${heart.residentId}>`;
  }).join('');

  return {
    type: 'modal',
    callback_id: 'hearts-challenge-callback',
    title: { type: 'plain_text', text: 'Hearts', emoji: true },
    close: { type: 'plain_text', text: 'Close', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Current hearts', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: heartsText } }
    ]
  };
};
