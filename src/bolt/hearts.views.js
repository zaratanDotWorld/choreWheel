const { heartsPollLength, heartsCriticalNum, heartsMinPctInitial, heartsMinPctCritical } = require('../config');

const common = require('./common');

const TITLE = common.blockPlaintext('Hearts');
const DOCS_URL = 'https://github.com/zaratanDotWorld/mirror/wiki/Hearts';

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

// Home views

exports.heartsIntroView = function () {
  const header = ':wave::skin-tone-4: Thanks for installing Hearts!';

  const instructions = `
*Follow these steps* to get set up (must be a workspace admin).
_Setup is easiest if everyone is in the same place, but it's not strictly necessary._

*1.* *Invite* all housemates to the Slack, and wait for them to join.

*2.* Set an events channel by calling \`/hearts-channel\`, which *unlocks the app*.

That's it! Just sit back and watch the magic happen :sparkles:

_For more details on *Hearts* functionality, read the <${DOCS_URL}|manual>._
`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(instructions));

  return {
    type: 'home',
    blocks,
  };
};

exports.heartsHomeView = function (numHearts, exempt) {
  const header = 'Welcome to Hearts';
  const textA = `We use *<${DOCS_URL}|Hearts>* to keep each other accountable.\n\n` +
    'Everyone starts with *5 hearts*.\n\n' +
    'We lose hearts when we fail to uphold our commitments. ' +
    'We regain hearts over time *(½ per month)*, or by earning karma :sparkles:';
  const textB = (exempt)
    ? '*You are exempt from hearts!* :balloon:'
    : `You have *${numHearts}* hearts: ${exports.heartEmoji(numHearts)}`;

  const actions = [];
  if (!exempt) {
    actions.push(common.blockButton('hearts-challenge', 'Resolve a dispute'));
  }
  actions.push(common.blockButton('hearts-board', 'See current hearts'));

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(textA));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(textB));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};

exports.heartsChallengeView = function (numVotingResidents) {
  const initialQuorum = Math.ceil(numVotingResidents * heartsMinPctInitial);
  const criticalQuorum = Math.ceil(numVotingResidents * heartsMinPctCritical);
  const resolutionUrl = 'https://github.com/zaratanDotWorld/mirror/wiki/Conflict-Resolution';

  const header = 'Resolve a dispute';
  const mainText = 'If prior attempts at mediating a conflict have failed, it may be time to raise a public dispute.\n\n' +
    'Choose someone to challenge, a number of hearts to take away, and explain the circumstance. ' +
    'The dispute will go to a house vote, and the loser (potentially you) will lose hearts.\n\n' +
    `To succeed, you will need a minimum of *${initialQuorum} upvotes*. ` +
    `If the challengee will end up with less than *${heartsCriticalNum} hearts*, ` +
    `you will need a minimum of *${criticalQuorum} upvotes*. ` +
    'So please make sure you\'ve spoken to others about the issue before raising a dispute.\n\n' +
    `*<${resolutionUrl}|See here>* for more information about conflict resolution.`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Challengee',
    {
      action_id: 'challengee',
      type: 'users_select',
      placeholder: common.blockPlaintext('Choose a resident'),
    },
  ));
  blocks.push(common.blockInput(
    'Number of hearts',
    {
      action_id: 'hearts',
      type: 'static_select',
      placeholder: common.blockPlaintext('Select a number'),
      options: [
        { value: '1', text: common.blockPlaintext('1') },
        { value: '2', text: common.blockPlaintext('2') },
        { value: '3', text: common.blockPlaintext('3') },
      ],
      initial_option: { value: '1', text: common.blockPlaintext('1') },
    },
  ));
  blocks.push(common.blockInput(
    'Circumstance',
    {
      action_id: 'circumstance',
      type: 'plain_text_input',
      multiline: true,
      placeholder: common.blockPlaintext('Explain the circumstance as best you can'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'hearts-challenge-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.heartsChallengeCallbackView = function (challenge, minVotes, circumstance) {
  const mainText = `*<@${challenge.challengerId}>* challenged *<@${challenge.challengeeId}>* ` +
    `for *${challenge.value} heart(s)*, due to the following circumstance:`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(circumstance));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, heartsPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(challenge.pollId, 1, 0)));
  return blocks;
};

exports.heartsBoardView = function (hearts) {
  const header = 'Current hearts';
  const mainText = 'Current hearts for the house.\n\n' +
    '*One or two* hearts is :broken_heart:,\n' +
    '*three to five* is :heart:,\n' +
    'and *six or more* is :heart_on_fire:';
  const heartsText = hearts.map((heart) => {
    return `\n\n${exports.heartEmoji(heart.sum)} <@${heart.residentId}>`;
  }).join('');

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(heartsText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};
