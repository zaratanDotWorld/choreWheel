const voca = require('voca');

const { HOUR } = require('../constants');
const { thingsMinPctSpecial, thingsPollLength, thingsSpecialPollLength } = require('../config');

const { makeVoteButtons } = require('./common');

// Things Views

exports.parseThingAdd = function (text) {
  // [type]-[name]-[quantity]-[value]
  let [ type, name, quantity, value ] = text.split('-');
  type = voca(type).trim().titleCase().value();
  name = voca(name).trim().titleCase().value();
  quantity = voca(quantity).trim().lowerCase().value();
  value = voca(value).trim().value();
  return { type, name, quantity, value };
};

exports.parseThingDel = function (text) {
  // [type]-[name]
  let [ type, name ] = text.split('-');
  type = voca(type).trim().titleCase().value();
  name = voca(name).trim().titleCase().value();
  return { type, name };
};

exports.parseResolvedThingBuys = function (buys) {
  return buys
    .filter((buy) => buy.resolvedAt !== null)
    .map((buy) => {
      const resolvedAt = buy.resolvedAt.toLocaleDateString();
      return `\n(${buy.id}) [${resolvedAt}] ${buy.type}: ${buy.name} - ${buy.quantity}`;
    });
};

exports.formatThing = function (thing) {
  return `${thing.type}: ${thing.name} - ${thing.quantity} ($${thing.value})`;
};

exports.thingsHomeView = function (balance) {
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Things';
  const textA = `We use *<${docsURI}|Things>* to spend money together.\n\n` +
    'Anyone can propose a buy, which requires *one endorsement per $50*. ' +
    'Successful buys are fulfilled within *3-5 days*.';

  const textB = `The house has *$${balance}* left in the account :moneybag:`;

  return {
    type: 'home',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Welcome to Things', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      {
        type: 'actions',
        elements: [
          { type: 'button', action_id: 'things-buy', text: { type: 'plain_text', text: 'Buy a thing', emoji: true } },
          { type: 'button', action_id: 'things-special', text: { type: 'plain_text', text: 'Buy special thing', emoji: true } },
          { type: 'button', action_id: 'things-bought', text: { type: 'plain_text', text: 'See bought things', emoji: true } }
        ]
      }
    ]
  };
};

exports.thingsBuyView = function (things) {
  const mappedThings = things.map((thing) => {
    return {
      value: `${thing.id}`,
      text: { type: 'plain_text', text: exports.formatThing(thing), emoji: true }
    };
  });

  const mainText = 'Choose something to buy. Make sure you have support for large buys!';

  return {
    type: 'modal',
    callback_id: 'things-buy-callback',
    title: { type: 'plain_text', text: 'Things', emoji: true },
    submit: { type: 'plain_text', text: 'Buy', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Buy a thing', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Thing to buy', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'options',
          placeholder: { type: 'plain_text', text: 'Choose a thing', emoji: true },
          options: mappedThings
        }
      }
    ]
  };
};

exports.thingsBuyCallbackView = function (buy, thing, priorBalance, minVotes) {
  const formattedBuy = `${thing.name} - ${buy.metadata.quantity} x ${thing.quantity}`;
  const currentBalance = priorBalance + buy.value;

  const textA = `*<@${buy.boughtBy}>* bought *${formattedBuy}* for *$${-buy.value}*. ` +
    `There's *$${currentBalance}* left in the account :money_with_wings:`;
  const textB = `*${minVotes} endorsement(s)* are required to pass, ` +
    `voting closes in *${thingsPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: makeVoteButtons(buy.pollId, 1, 0) }
  ];
};

exports.thingsSpecialBuyView = function (numResidents) {
  const minVotes = Math.ceil(thingsMinPctSpecial * numResidents);
  const mainText = 'Propose a special buy. ' +
    `Special buys are more flexible, but need a minimum of *${minVotes} endorsements.*\n\n` +
    'Describe what you want to buy, including any delivery information. ' +
    'Special buys are fulfilled by the person who proposes them, and then reimbursed. ' +
    'Reimbursements are capped at the amount requested.';

  return {
    type: 'modal',
    callback_id: 'things-special-callback',
    title: { type: 'plain_text', text: 'Things', emoji: true },
    submit: { type: 'plain_text', text: 'Buy', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Buy special thing', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Thing to buy', emoji: true },
        element: {
          type: 'plain_text_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Describe what you would like to buy', emoji: true },
          action_id: 'description'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Total cost', emoji: true },
        element: {
          type: 'number_input',
          is_decimal_allowed: false,
          placeholder: { type: 'plain_text', text: 'Provide the total cost (including tax and shipping)', emoji: true },
          action_id: 'cost'
        }
      }
    ]
  };
};

exports.thingsSpecialBuyCallbackView = function (buy, priorBalance, minVotes) {
  const currentBalance = priorBalance + buy.value;

  const textA = `*<@${buy.boughtBy}>* bought the following:`;
  const textB = `There's *$${currentBalance}* left in the account :money_with_wings:\n` +
    `*${minVotes} endorsement(s)* are required to pass, ` +
    `voting closes in *${thingsSpecialPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: `_${buy.metadata.description}_` } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: makeVoteButtons(buy.pollId, 1, 0) }
  ];
};

exports.thingsBoughtView = function (unfulfilledBuys, fulfilledBuys7, fulfilledBuys90) {
  const mainText = 'Things bought by the house.\n\n' +
    '*Pending* buys are proposed but not yet approved. ' +
    '*Unfulfilled* buys are approved but not yet ordered. ' +
    '*Fulfilled* buys have already been ordered and show the *total amounts* spent over a time period.';

  const pendingBuysText = unfulfilledBuys
    .filter((buy) => buy.resolvedAt === null)
    .map((buy) => exports.formatThing(buy))
    .join('\n');

  const confirmedBuysText = unfulfilledBuys
    .filter((buy) => buy.resolvedAt !== null)
    .map((buy) => exports.formatThing(buy))
    .join('\n');

  const fulfilledBuys7Text = fulfilledBuys7
    .map((buy) => `${buy.type}: ${buy.name} ($${-buy.value})`)
    .join('\n');

  const fulfilledBuys90Text = fulfilledBuys90
    .map((buy) => `${buy.type}: ${buy.name} ($${-buy.value})`)
    .join('\n');

  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Things', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Bought things', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `*Pending:*\n${pendingBuysText}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Unfulfilled:*\n${confirmedBuysText}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Fulfilled in the last 7 days:*\n${fulfilledBuys7Text}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Fulfilled in the last 90 days:*\n${fulfilledBuys90Text}` } }
    ]
  };
};
