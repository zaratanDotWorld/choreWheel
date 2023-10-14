const { thingsMinPctSpecial, thingsMaxPct, thingsPollLength, thingsSpecialPollLength, thingsProposalPollLength } = require('../config');

const common = require('./common');

// Things Views

const TITLE = common.blockPlaintext('Things');

exports.parseResolvedThingBuys = function (unfulfilledBuys) {
  return unfulfilledBuys
    .filter((buy) => buy.resolvedAt)
    .map((buy) => {
      const resolvedAt = buy.resolvedAt.toLocaleDateString();
      return `\n#${buy.id} [${resolvedAt}] ${exports.formatBuy(buy)}`;
    });
};

exports.formatThing = function (thing) {
  if (thing.metadata) {
    return `${thing.name} (${thing.metadata.unit}) - $${thing.value}`;
  } else {
    return `${thing.name} (?) - $${thing.value}`;
  }
};

exports.formatTypedThing = function (thing) {
  return `${thing.type}: ${exports.formatThing(thing)}`;
};

exports.formatBuy = function (buy) {
  let text;

  if (buy.metadata && buy.metadata.special) {
    text = `Special: ${buy.metadata.title}`;
  } else if (buy.metadata && buy.thingMetadata) {
    text = `${buy.type}: ${buy.name} (${buy.metadata.quantity} x ${buy.thingMetadata.unit})`;
  } else {
    text = `${buy.type}: ${buy.name} (?)`;
  }

  if (buy.thingMetadata && buy.thingMetadata.url) {
    text = `<${buy.thingMetadata.url}|${text}>`;
  }

  text = `${text} - $${-buy.value}`;
  return text;
};

exports.thingsHomeView = function (balance, exempt) {
  const docsUrl = 'https://github.com/zaratanDotWorld/mirror/wiki/Things';

  const header = 'Welcome to Things';
  const textA = `We use *<${docsUrl}|Things>* to spend money together.\n\n` +
    'Anyone can propose a buy, which requires *1 upvote per $50*. ' +
    'Successful buys are fulfilled within *3-5 days*.';
  const textB = `The house has *$${balance}* left in the account :moneybag:`;

  const actions = [];
  if (!exempt) {
    actions.push(common.blockButton('things-buy', 'Buy a thing'));
    actions.push(common.blockButton('things-special', 'Buy special thing'));
    actions.push(common.blockButton('things-propose', 'Edit things list'));
  }
  actions.push(common.blockButton('things-bought', 'See bought things'));

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(textA));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(textB));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};

exports.thingsBuyView = function (things) {
  const header = 'Buy a thing';
  const mainText = 'Choose something to buy. Make sure you have support for large buys!';

  const types = new Set(things.map(thing => thing.type));

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Thing to buy',
    {
      action_id: 'things',
      type: 'static_select',
      placeholder: common.blockPlaintext('Choose a thing'),
      option_groups: [ ...types ].map(type =>
        common.blockOptionGroup(
          type,
          things
            .filter(thing => thing.type === type)
            .map(thing => {
              return {
                value: JSON.stringify({ id: thing.id }),
                text: common.blockPlaintext(exports.formatThing(thing)),
              };
            }),
        ),
      ),
    },
  ));

  blocks.push(common.blockInput(
    'Amount to buy',
    {
      action_id: 'quantity',
      type: 'number_input',
      initial_value: '1',
      min_value: '0',
      is_decimal_allowed: false,
      placeholder: common.blockPlaintext('Choose number of units'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-buy-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.thingsBuyCallbackView = function (buy, thing, balance, minVotes) {
  // TODO: clean this up somehow
  buy.type = thing.type;
  buy.name = thing.name;
  buy.thingMetadata = thing.metadata;
  const formattedBuy = exports.formatBuy(buy);

  const mainText = `*<@${buy.boughtBy}>* bought *${formattedBuy}*. ` +
    `There's *$${balance}* left in the account :money_with_wings:`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, thingsPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(buy.pollId, 1, 0)));
  return blocks;
};

exports.thingsSpecialBuyView = function (numResidents) {
  const minVotes = Math.ceil(thingsMinPctSpecial * numResidents);
  const maxVotes = Math.ceil(thingsMaxPct * numResidents);

  const header = 'Buy special thing';
  const mainText = 'Propose a special buy. ' +
    `Special buys are more flexible, but need a minimum of *${minVotes}* (max *${maxVotes}*) *upvote(s).*\n\n` +
    'Add relevant information about the buy, including any delivery information. ' +
    'Special buys are fulfilled by the person who proposes them, and then reimbursed. ' +
    'Reimbursements are capped at the amount requested.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Thing to buy',
    {
      action_id: 'title',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Short description of the thing'),
    },
  ));
  blocks.push(common.blockInput(
    'Additional details',
    {
      action_id: 'details',
      type: 'plain_text_input',
      multiline: true,
      placeholder: common.blockPlaintext('Add any additional details'),
    },
  ));
  blocks.push(common.blockInput(
    'Total cost',
    {
      action_id: 'cost',
      type: 'number_input',
      initial_value: '1',
      min_value: '0',
      is_decimal_allowed: false,
      placeholder: common.blockPlaintext('Provide the total cost (including tax and shipping)'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-special-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.thingsSpecialBuyCallbackView = function (buy, balance, minVotes) {
  const textA = `*<@${buy.boughtBy}>* bought the following for *$${-buy.value}*:`;
  const textB = `There's *$${balance}* left in the account :money_with_wings:`;

  const blocks = [];
  blocks.push(common.blockSection(textA));
  blocks.push(common.blockSection(`*${buy.metadata.title}*`));
  blocks.push(common.blockSection(buy.metadata.details));
  blocks.push(common.blockSection(textB));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, thingsSpecialPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(buy.pollId, 1, 0)));
  return blocks;
};

exports.thingsBoughtView = function (unfulfilledBuys, fulfilledBuys7, fulfilledBuys90) {
  const header = 'Bought things';
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

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(`*Pending:*\n${pendingBuysText}`));
  blocks.push(common.blockSection(`*Unfulfilled:*\n${confirmedBuysText}`));
  blocks.push(common.blockSection(`*Fulfilled in the last 7 days:*\n${fulfilledBuys7Text}`));
  blocks.push(common.blockSection(`*Fulfilled in the last 90 days:*\n${fulfilledBuys90Text}`));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

// Thing proposals

exports.thingsProposeView = function (minVotes) {
  const header = 'Edit things list';
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
        { value: 'delete', text: common.blockMarkdown('*Remove* an existing thing') },
      ],
    },
  ]));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.thingsProposeEditView = function (things) {
  const header = 'Edit things list';
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
          text: common.blockPlaintext(exports.formatTypedThing(thing)),
        };
      }),
    },
  ]));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

// NOTE: used for both add and edit flows
exports.thingsProposeAddView = function (thing) {
  const header = 'Edit things list';
  let metadata, mainText;

  if (thing) {
    metadata = JSON.stringify({ change: 'edit', thing: { id: thing.id, type: thing.type, name: thing.name } });
    mainText = 'Change an existing thing.';
  } else {
    metadata = JSON.stringify({ change: 'add' });
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
      placeholder: common.blockPlaintext('Category of the thing, e.g. Pantry, Beverage'),
    },
  ));
  blocks.push(common.blockInput(
    'Name',
    {
      action_id: 'name',
      type: 'plain_text_input',
      initial_value: (thing) ? thing.name : undefined,
      placeholder: common.blockPlaintext('Name of the thing, e.g. Oat Milk, Salt'),
    },
  ));
  blocks.push(common.blockInput(
    'Unit',
    {
      action_id: 'unit',
      type: 'plain_text_input',
      initial_value: (thing) ? thing.metadata.unit : undefined,
      placeholder: common.blockPlaintext('Unit sold, e.g. 2 x 24 oz, 2 dozen'),
    },
  ));
  blocks.push(common.blockInput(
    'Cost',
    {
      action_id: 'cost',
      type: 'number_input',
      min_value: '1',
      is_decimal_allowed: false,
      initial_value: (thing) ? thing.value.toString() : undefined,
      placeholder: common.blockPlaintext('Cost of the thing (including tax & shipping)'),
    },
  ));
  blocks.push(common.blockInput(
    'Link',
    {
      action_id: 'url',
      type: 'url_text_input',
      initial_value: (thing) ? thing.metadata.url : undefined,
      placeholder: common.blockPlaintext('Link to the thing'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-propose-callback',
    private_metadata: metadata,
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.thingsProposeDeleteView = function (things) {
  const metadata = JSON.stringify({ change: 'delete' });
  const header = 'Edit things list';
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
          text: common.blockPlaintext(exports.formatTypedThing(thing)),
        };
      }),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'things-propose-callback',
    private_metadata: metadata,
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
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
