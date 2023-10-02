const voca = require('voca');

const { HOUR } = require('../constants');
const { thingsMinPctSpecial, thingsMaxPct, thingsPollLength, thingsSpecialPollLength, thingsProposalPollLength } = require('../config');

const common = require('./common');

// Things Views

const TITLE = common.blockPlaintext('Things');
const CLOSE = common.blockPlaintext('Cancel');
const SUBMIT = common.blockPlaintext('Submit');

exports.parseTitlecase = function (text) {
  return voca(text).trim().lowerCase().titleCase().value();
};

exports.parseLowercase = function (text) {
  return voca(text).trim().lowerCase().value();
};

exports.parseResolvedThingBuys = function (unfulfilledBuys) {
  return unfulfilledBuys
    .filter((buy) => buy.resolvedAt !== null)
    .map((buy) => {
      const resolvedAt = buy.resolvedAt.toLocaleDateString();
      return `\n#${buy.id} [${resolvedAt}] ${exports.formatBuy(buy)}`;
    });
};

exports.formatThing = function (thing) {
  if (thing.metadata !== null) {
    return `${thing.type}: ${thing.name} (${thing.metadata.unit}) - $${thing.value}`;
  } else {
    return `${thing.type}: ${thing.name} (?) - $${thing.value}`;
  }
};

exports.formatBuy = function (buy) {
  let text;

  if (buy.metadata !== null && buy.metadata.special) {
    text = `Special: ${buy.metadata.title}`;
  } else if (buy.metadata !== null & buy.thingMetadata !== null) {
    text = `${buy.type}: ${buy.name} (${buy.metadata.quantity} x ${buy.thingMetadata.unit})`;
  } else {
    text = `${buy.type}: ${buy.name} (?)`;
  }

  if (buy.thingMetadata !== null && buy.thingMetadata.url) {
    text = `<${buy.thingMetadata.url}|${text}>`;
  }

  text = `${text} - $${-buy.value}`;

  return text;
};

exports.thingsHomeView = function (balance) {
  const docsUrl = 'https://github.com/zaratanDotWorld/mirror/wiki/Things';
  const textA = `We use *<${docsUrl}|Things>* to spend money together.\n\n` +
    'Anyone can propose a buy, which requires *1 upvote per $50*. ' +
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
          { type: 'button', action_id: 'things-bought', text: { type: 'plain_text', text: 'See bought things', emoji: true } },
          { type: 'button', action_id: 'things-propose', text: { type: 'plain_text', text: 'Edit things list', emoji: true } }
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
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Amount to buy', emoji: true },
        element: {
          type: 'number_input',
          action_id: 'quantity',
          placeholder: { type: 'plain_text', text: 'Choose number of units', emoji: true },
          initial_value: '1',
          min_value: '0',
          is_decimal_allowed: false
        }
      }
    ]
  };
};

exports.thingsBuyCallbackView = function (buy, thing, balance, minVotes) {
  // TODO: clean this up somehow
  buy.type = thing.type;
  buy.name = thing.name;
  buy.thingMetadata = thing.metadata;
  const formattedBuy = exports.formatBuy(buy);

  const textA = `*<@${buy.boughtBy}>* bought *${formattedBuy}*. ` +
    `There's *$${balance}* left in the account :money_with_wings:`;
  const textB = `*${minVotes} upvote(s)* are required to pass, ` +
    `voting closes in *${thingsPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: common.makeVoteButtons(buy.pollId, 1, 0) }
  ];
};

exports.thingsSpecialBuyView = function (numResidents) {
  const minVotes = Math.ceil(thingsMinPctSpecial * numResidents);
  const maxVotes = Math.ceil(thingsMaxPct * numResidents);

  const mainText = 'Propose a special buy. ' +
    `Special buys are more flexible, but need a minimum of *${minVotes}* (max *${maxVotes}*) *upvote(s).*\n\n` +
    'Add relevant information about the buy, including any delivery information. ' +
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
          multiline: false,
          placeholder: { type: 'plain_text', text: 'Short description of the thing', emoji: true },
          action_id: 'title'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Additional details', emoji: true },
        element: {
          type: 'plain_text_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Add any additional details', emoji: true },
          action_id: 'details'
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

exports.thingsSpecialBuyCallbackView = function (buy, balance, minVotes) {
  const textA = `*<@${buy.boughtBy}>* bought the following for *$${-buy.value}*:`;
  const textB = `There's *$${balance}* left in the account :money_with_wings:\n` +
    `*${minVotes} upvote(s)* are required to pass, ` +
    `voting closes in *${thingsSpecialPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${buy.metadata.title}*` } },
    { type: 'section', text: { type: 'mrkdwn', text: buy.metadata.details } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: common.makeVoteButtons(buy.pollId, 1, 0) }
  ];
};

exports.thingsBoughtView = function (unfulfilledBuys, fulfilledBuys7, fulfilledBuys90) {
  const mainText = 'Things bought by the house.\n\n' +
    '*Pending* buys are proposed but not yet approved. ' +
    '*Unfulfilled* buys are approved but not yet ordered. ' +
    '*Fulfilled* buys have been ordered, and show *total amounts* over a time period ' +
    '(excluding special buys)';

  const pendingBuysText = unfulfilledBuys
    .filter((buy) => buy.resolvedAt === null)
    .map((buy) => exports.formatBuy(buy))
    .join('\n');

  const confirmedBuysText = unfulfilledBuys
    .filter((buy) => buy.resolvedAt !== null)
    .map((buy) => exports.formatBuy(buy))
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

// Thing proposals

exports.thingsProposeView = function (minVotes) {
  const header = 'Edit thing list';
  const mainText = 'Choosing a list of things in advance means fewer approvals are needed for any single buy. ' +
    'It\'s also helpful to keep the list up-to-date as costs and inventories change.\n\n' +
    'Make sure to consider taxes and shipping when entering costs, otherwise you might accidentally overspend.\n\n' +
    `As a major house decision, a minimum of *${minVotes} upvote(s)* are required.`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockActions([
    {
      type: 'radio_buttons',
      action_id: 'things-propose-2',
      options: [
        { value: 'add', text: common.blockMarkdown('*Add* a new thing') },
        { value: 'edit', text: common.blockMarkdown('*Change* an existing thing') },
        { value: 'delete', text: common.blockMarkdown('*Remove* an existing thing') }
      ]
    }
  ]));

  return {
    type: 'modal',
    title: TITLE,
    close: CLOSE,
    blocks
  };
};

exports.thingsProposeEditView = function (things) {
  const header = 'Edit thing list';
  const mainText = 'Change an existing thing.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockActions([
    {
      type: 'static_select',
      action_id: 'things-propose-edit',
      placeholder: common.blockPlaintext('Choose a thing'),
      options: things.map((thing) => {
        return {
          value: JSON.stringify({ id: thing.id }),
          text: common.blockPlaintext(exports.formatThing(thing))
        };
      })
    }
  ]));

  return {
    type: 'modal',
    title: TITLE,
    close: CLOSE,
    blocks
  };
};

// NOTE: used for both add and edit flows
exports.thingsProposeAddView = function (thing) {
  let metadata, header, mainText;

  if (thing) {
    metadata = JSON.stringify({ change: 'edit', thing: { id: thing.id, type: thing.type, name: thing.name } });
    header = 'Edit thing list';
    mainText = 'Change an existing thing.';
  } else {
    metadata = JSON.stringify({ change: 'add' });
    header = 'Edit thing list';
    mainText = 'Add a new thing.';
  }

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Category',
    {
      action_id: 'type',
      type: 'plain_text_input',
      initial_value: (thing) ? thing.type : undefined,
      placeholder: common.blockPlaintext('Category of the thing, e.g. Pantry, Beverage')
    }
  ));
  blocks.push(common.blockInput(
    'Name',
    {
      action_id: 'name',
      type: 'plain_text_input',
      initial_value: (thing) ? thing.name : undefined,
      placeholder: common.blockPlaintext('Name of the thing, e.g. Oat Milk, Salt')
    }
  ));
  blocks.push(common.blockInput(
    'Unit',
    {
      action_id: 'unit',
      type: 'plain_text_input',
      initial_value: (thing) ? thing.metadata.unit : undefined,
      placeholder: common.blockPlaintext('Unit sold, e.g. 2 x 24 oz, 2 dozen')
    }
  ));
  blocks.push(common.blockInput(
    'Cost',
    {
      action_id: 'cost',
      type: 'number_input',
      min_value: '1',
      is_decimal_allowed: false,
      initial_value: (thing) ? thing.value.toString() : undefined,
      placeholder: common.blockPlaintext('Cost of the thing (including tax & shipping)')
    }
  ));
  blocks.push(common.blockInput(
    'Link',
    {
      action_id: 'url',
      type: 'url_text_input',
      initial_value: (thing) ? thing.metadata.url : undefined,
      placeholder: common.blockPlaintext('Link to the thing')
    }
  ));

  return {
    type: 'modal',
    callback_id: 'things-propose-callback',
    private_metadata: metadata,
    title: TITLE,
    close: CLOSE,
    submit: SUBMIT,
    blocks
  };
};

exports.thingsProposeDeleteView = function (things) {
  const metadata = JSON.stringify({ change: 'delete' });

  const header = 'Edit thing list';
  const mainText = 'Remove an existing thing.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Thing to remove',
    {
      action_id: 'thing',
      type: 'static_select',
      placeholder: common.blockPlaintext('Choose a thing'),
      options: things.map((thing) => {
        return {
          value: JSON.stringify({ id: thing.id, type: thing.type, name: thing.name }),
          text: common.blockPlaintext(exports.formatThing(thing))
        };
      })
    }
  ));

  return {
    type: 'modal',
    callback_id: 'things-propose-callback',
    private_metadata: metadata,
    title: TITLE,
    close: CLOSE,
    submit: SUBMIT,
    blocks
  };
};

exports.thingsProposeCallbackView = function (metadata, proposal, minVotes) {
  let mainText;
  switch (metadata.change) {
    case 'add':
      mainText = `*<@${proposal.proposedBy}>* wants to *add* a thing:`;
      break;
    case 'edit':
      mainText = `*<@${proposal.proposedBy}>* wants to *edit* the *${metadata.thing.type}: ${metadata.thing.name}* thing:`;
      break;
    case 'delete':
      mainText = `*<@${proposal.proposedBy}>* wants to *delete* a thing:`;
      break;
  }

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(`*${proposal.type}: ${proposal.name}*`));

  if (proposal.value) {
    blocks.push(common.blockSection(`${proposal.metadata.unit} - $${proposal.value}`));
  }

  if (proposal.metadata.url) {
    blocks.push(common.blockSection(`<${proposal.metadata.url}|Link>`));
  }

  blocks.push(common.blockSection(common.makeVoteText(minVotes, thingsProposalPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(proposal.pollId, 1, 0)));
  return blocks;
};
