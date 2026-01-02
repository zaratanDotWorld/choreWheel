const common = require('../../common');
const { DOCS_URL } = require('./utils');

// Home views

exports.thingsIntroView = function () {
  const header = ':wave::skin-tone-4: Thanks for installing Things!';

  const instructions = `
*Follow these steps* to get set up (must be a workspace admin).
_Setup is easiest if everyone is in the same place, but it's not strictly necessary._

*1.* *Invite* all housemates to the Slack, and wait for them to join.

*2.* Make a list of *5-10 starter things*. Good things:
  • Are used by (almost) everybody.
  • Are non-perishable and can be bought in bulk.
  • Are easy to order (free shipping, etc).

*3.* Set an events channel by calling \`/things-channel\`, which *unlocks the app*.

*4.* Use *\`Edit things list\`* to enter the things you came up with.
  • Make sure to include taxes, etc when inputting the total cost.

*5.* Have the housemates go to the events channel and *upvote the edits*.

Once the things have been fully upvoted, *you're ready to go!* :rocket:
Encourage folks to make buys as they go, and use \`/things-load\` and \`/things-fulfill\` to manage accounts.

_For more details on *Things* functionality, read the <${DOCS_URL}|manual>._
`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(instructions));

  return {
    type: 'home',
    blocks,
  };
};

exports.thingsHomeView = function (thingsChannel, isActive, accounts) {
  const getMoneybags = sum => ':moneybag:'.repeat(Math.round(Math.sqrt(sum) / 10));

  const header = 'Welcome to Things';
  const mainText = `We use *<${DOCS_URL}|Things>* to spend money together.\n\n` +
    'Anyone can propose a buy, which requires *1 upvote per $50*. ' +
    'Special buys require at least *30%* whole-house approval.';
  const balancesText = 'The house has the *following balances*:\n' +
    accounts.map(account => `\n*${account.account}* account: *$${account.sum}* ${getMoneybags(account.sum)}`);
  const channelText = `Events will be posted in <#${thingsChannel}> :mailbox_with_mail:`;

  const actions = [];
  if (isActive) {
    actions.push(common.blockButton('things-buy', ':package: Buy a thing'));
    actions.push(common.blockButton('things-special', ':mirror_ball: Buy special thing'));
    actions.push(common.blockButton('things-propose', ':ledger: Edit things list'));
  }
  actions.push(common.blockButton('things-bought', ':bar_chart: See bought things'));

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(balancesText));
  blocks.push(common.blockSection(channelText));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};
