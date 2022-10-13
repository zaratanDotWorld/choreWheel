const voca = require('voca');

const { HOUR } = require('../constants');

// Chores Views

exports.formatChoreName = function (text) {
  return voca(text).latinise().titleCase().value();
};

exports.choresHomeView = function (balance, owed) {
  const textA = 'We use Chores to keep the house a nice place to live.\n\n' +
    'Instead of a chore wheel or schedule, everyone owes *100 points* per month. ' +
    'You earn points by doing the chores you want, on your terms.\n\n' +
    'The points for a chore go up every hour until someone claims them, then resets. ' +
    'Chores gain points at different speeds, depending on your priorities, which you can change.';

  const textB = `*You've earned ${balance.toFixed(1)} points this month, out of ${parseInt(owed)} owed :muscle:*`;

  return {
    type: 'home',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Welcome to Chores', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      {
        type: 'actions',
        elements: [
          { type: 'button', action_id: 'chores-claim', text: { type: 'plain_text', text: 'Claim a chore', emoji: true } },
          { type: 'button', action_id: 'chores-rank', text: { type: 'plain_text', text: 'Set chore priorities', emoji: true } },
          { type: 'button', action_id: 'chores-gift', text: { type: 'plain_text', text: 'Gift chore points', emoji: true } }
        ]
      }
    ]
  };
};

exports.choresClaimView = function (chores) {
  const mappedChores = chores.map((chore) => {
    return {
      value: `${chore.id}|${chore.name}|${chore.value}`,
      text: { type: 'plain_text', text: `${chore.name} - ${chore.value.toFixed(1)} points`, emoji: true }
    };
  });

  const mainText = 'Claims are verified by the house via emoji vote, and require at least *two* thumbs-up votes. ' +
    'Posting a picture of the work you did in the channel or thread will help others verify your claim.';

  return {
    type: 'modal',
    callback_id: 'chores-claim-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Claim', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Claim a chore', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Chore to claim', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'options',
          placeholder: { type: 'plain_text', text: 'Choose a chore', emoji: true },
          options: mappedChores
        }
      }
    ]
  };
};

exports.choresClaimCallbackView = function (residentId, choreName, choreValue, totalValue, pollId, pollDuration) {
  const textA = `*<@${residentId}>* did *${choreName}* for *${choreValue.toFixed(1)} points*. ` +
    `That's *${totalValue.toFixed(1)}* points this month :sparkles::sparkles:`;
  const textB = `React :+1: to endorse or :-1: to challenge, voting closes in ${pollDuration / HOUR} hours`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(pollId, 1, 0) }
  ];
};

exports.choresRankView = function (chores) {
  const mappedChores = chores.map((chore) => {
    return {
      value: `${chore.id}|${chore.name}`,
      text: { type: 'plain_text', text: `${chore.name}`, emoji: true }
    };
  });

  const mainText = 'Increasing the priority of one chore over another will give it more points over time. ' +
    'You can express the preference as strong, mild, or neutral (equal value).';

  return {
    type: 'modal',
    callback_id: 'chores-rank-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Set chore priorities', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Chore to prioritize', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'chores',
          placeholder: { type: 'plain_text', text: 'Choose a chore', emoji: true },
          options: mappedChores
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Chore to deprioritize', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'chores',
          placeholder: { type: 'plain_text', text: 'Choose a chore', emoji: true },
          options: mappedChores
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Preference strength', emoji: true },
        element: {
          type: 'radio_buttons',
          action_id: 'strength',
          options: [
            { text: { type: 'plain_text', text: 'Strong', emoji: true }, value: '1.0' },
            { text: { type: 'plain_text', text: 'Mild', emoji: true }, value: '0.7' },
            { text: { type: 'plain_text', text: 'Neutral', emoji: true }, value: '0.5' }
          ],
          initial_option: { text: { type: 'plain_text', text: 'Mild', emoji: true }, value: '0.7' }
        }
      }
    ]
  };
};

exports.choresGiftView = function (maxValue) {
  const mainText = `Choose a recipient. You can gift up to a maximum of *${maxValue.toFixed(1)} points* (the remaining value of your last claim).`;

  return {
    type: 'modal',
    callback_id: 'chores-gift-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Gift chore points', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Gift recipient', emoji: true },
        element: {
          type: 'multi_users_select',
          placeholder: { type: 'plain_text', text: 'Choose a resident', emoji: true },
          action_id: 'recipient'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Number of points', emoji: true },
        element: {
          type: 'plain_text_input',
          placeholder: { type: 'plain_text', text: 'Enter a number', emoji: true },
          action_id: 'value'
        }
      }
    ]
  };
};

// Things Views

exports.parseThingAdd = function (text) {
  // [type] [name] [price]
  const words = voca(text).trim().titleCase().split(' ');
  const type = words[0];
  const name = words.slice(1, words.length - 1).join(' ');
  const value = words[words.length - 1];
  return { type, name, value };
};

exports.parseThingDel = function (text) {
  // [type] [name]
  const words = voca(text).trim().titleCase().split(' ');
  const type = words[0];
  const name = words.slice(1, words.length).join(' ');
  return { type, name };
};

exports.formatThing = function (thing) {
  return `${thing.type} - ${thing.name} ($${thing.value})`;
};

exports.thingsHomeView = function (balance) {
  const textA = 'We use Things to spend money together.\n\n' +
    'Anyone can propose a buy, which requires *one* thumbs-up vote per $50. ' +
    'Successful buys are fulfilled within 3-7 days.';

  const textB = `The house has *$${balance}* left in the account :money_with_wings:`;

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
          { type: 'button', action_id: 'things-buy', text: { type: 'plain_text', text: 'Buy a thing', emoji: true } }
        ]
      }
    ]
  };
};

exports.thingsBuyView = function (things) {
  const mappedThings = things.map((thing) => {
    return {
      value: `${thing.id}|${thing.name}|${thing.value}`,
      text: { type: 'plain_text', text: exports.formatThing(thing), emoji: true }
    };
  });

  const mainText = 'Choose the thing to buy. Make sure you have support for large buys, ' +
    'as you need one thumbs-up vote per $50.';

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

exports.thingsBuyCallbackView = function (residentId, thingName, thingValue, houseBalance, pollId, pollDuration) {
  const textA = `*<@${residentId}>* bought *${thingName}* for *$${thingValue}*. ` +
    `There's *$${houseBalance}* left in the house account :fire:`;
  const textB = `React :+1: to endorse or :-1: to challenge, voting closes in ${pollDuration / HOUR} hours`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(pollId, 1, 0) }
  ];
};

// Polls Views (utils)

exports.makeVoteButtons = function (pollId, upvoteCount, downvoteCount) {
  return [
    {
      type: 'button',
      text: { type: 'plain_text', text: `:+1: (${upvoteCount})`, emoji: true },
      value: `${pollId}|1`,
      action_id: 'poll-vote-up'
    },
    {
      type: 'button',
      text: { type: 'plain_text', text: `:-1: (${downvoteCount})`, emoji: true },
      value: `${pollId}|0`,
      action_id: 'poll-vote-down'
    }
  ];
};
