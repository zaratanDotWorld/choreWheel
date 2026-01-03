const { Hearts } = require('../../../core/index');

const common = require('../../common');
const { TITLE, heartEmoji } = require('./utils');

// Challenge flow

exports.heartsChallengeView = function (numResidents) {
  const initialQuorum = Math.ceil(numResidents * Hearts.params.minPctInitial);
  const criticalQuorum = Math.ceil(numResidents * Hearts.params.minPctCritical);
  const resolutionUrl = 'https://docs.chorewheel.zaratan.world/en/latest/practices/conflict-resolution.html';

  const header = 'Resolve a dispute';
  const mainText = 'If prior attempts at mediating a conflict have failed, it may be time to raise a public dispute.\n\n' +
    'Choose someone to challenge, a number of hearts to take away, and explain the circumstance. ' +
    'The dispute will go to a house vote, and the loser (potentially you) will lose hearts.\n\n' +
    `To succeed, you will need a minimum of *${initialQuorum} upvotes*. ` +
    `If the challengee will end up with less than *${Hearts.params.criticalNum} hearts*, ` +
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
      type: 'conversations_select',
      filter: common.userFilter,
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
  blocks.push(common.blockSection(common.makeVoteText(minVotes, Hearts.params.pollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(challenge.pollId, 1, 0)));
  return blocks;
};

exports.heartsBoardView = function (hearts) {
  const header = 'Current hearts';
  const mainText = 'The baseline is *five hearts*. ' +
    'Anyone with *less* will regenerate at a rate of *½ per month*, ' +
    'and anyone with *more* will fade at *½ per month*, ' +
    'until they reach five.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());

  hearts.forEach((heart) => {
    blocks.push(common.blockSection(`${heartEmoji(heart.sum)} <@${heart.residentId}>`));
  });

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

// Karma flow

exports.heartsKarmaView = function () {
  const header = 'Give karma';
  const mainText = 'You can give someone good karma for any reason. ' +
    'Every month, the people with the most karma get bonus hearts. \n\n' +
    '_You can also give karma by "++"\'ing someone in chat: *@Name ++*_\n\n ';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Recipient',
    {
      action_id: 'recipient',
      type: 'conversations_select',
      filter: common.userFilter,
      placeholder: common.blockPlaintext('Choose a resident'),
    },
  ));
  blocks.push(common.blockInput(
    'Circumstance',
    {
      action_id: 'circumstance',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Why are you giving them karma?'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'hearts-karma-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};
