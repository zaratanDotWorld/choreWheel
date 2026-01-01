const common = require('../../common');
const { formatBuy } = require('./utils');

const TITLE = common.blockPlaintext('Things');

// Slash command views

exports.thingsLoadView = function () {
  const header = 'Load an account';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockInput(
    'Account to load',
    {
      action_id: 'account',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Account to load (i.e. General, Major Purchases, etc)'),
    },
  ));
  blocks.push(common.blockInput(
    'Amount to load',
    {
      action_id: 'amount',
      type: 'number_input',
      is_decimal_allowed: false,
      placeholder: common.blockPlaintext('Enter amount to load'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-load-2',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.thingsLoadView2 = function (account, currentAmount, amount) {
  const header = 'Load an account';
  const text = `You are loading *$${amount}* into the *${account}* account.\n\n` +
    `The new balance will be *$${currentAmount + amount}*.`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(text));

  return {
    type: 'modal',
    callback_id: 'things-load-callback',
    private_metadata: JSON.stringify({ account, amount }),
    title: TITLE,
    close: common.BACK,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.thingsFulfillView = function (unfulfilledBuys) {
  const header = 'Fulfill some buys';
  const text = 'Once you\'ve fulfilled some buys, you can check them off here.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(text));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Buys to fulfill',
    {
      action_id: 'buys',
      type: 'multi_static_select',
      placeholder: common.blockPlaintext('Choose some buys'),
      options: unfulfilledBuys
        .filter(buy => buy.resolvedAt)
        .map((buy) => {
          return {
            value: JSON.stringify({ id: buy.id }),
            text: common.blockPlaintext(formatBuy(buy, false).slice(0, 75)),
          };
        }),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-fulfill-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};
