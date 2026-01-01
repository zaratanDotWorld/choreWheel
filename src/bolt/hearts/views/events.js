const common = require('../../common');
const { heartEmoji } = require('./utils');

const DOCS_URL = 'https://docs.chorewheel.zaratan.world/en/latest/tools/hearts.html';

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

exports.heartsHomeView = function (heartsChannel, isActive, numHearts) {
  const header = 'Welcome to Hearts';
  const mainText = `We use *<${DOCS_URL}|Hearts>* to keep each other accountable.\n\n` +
    'Everyone starts with *5 hearts*. ' +
    'We lose hearts when we fail to uphold our commitments, ' +
    'and we regain hearts *over time* or by earning *karma*.';
  const activeText = (isActive)
    ? `You have *${numHearts}* hearts ${heartEmoji(numHearts)}`
    : '*You are exempt from hearts!* :balloon:';
  const channelText = `Events will be posted in <#${heartsChannel}> :mailbox_with_mail:`;

  const actions = [];
  actions.push(common.blockButton('hearts-board', ':two_hearts: See hearts'));
  if (isActive) {
    actions.push(common.blockButton('hearts-karma', ':sparkles: Give karma'));
    actions.push(common.blockButton('hearts-challenge', ':fencer: Settle a dispute'));
  }

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(activeText));
  blocks.push(common.blockSection(channelText));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};
