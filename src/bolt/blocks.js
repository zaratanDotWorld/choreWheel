const voca = require('voca');

const { HOUR } = require('../constants');

// Chores Views

exports.formatChoreName = function (text) {
  return voca(text).latinise().titleCase().value();
};

exports.choresHomeView = function (balance, owed) {
  const mainText = 'We use Chores to keep the house a nice place to live.\n\n' +
    'Instead of a chore wheel or schedule, everyone owes *100 points* per month. ' +
    'You earn points by doing the chores you want, on your terms.\n\n' +
    'The points for a chore go up every hour until someone claims them, then resets to 0. ' +
    'Chores gain points at different speeds, depending on your priorities, which you can change.';

  return {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Welcome to Chores :gloves:', emoji: true }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: mainText }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*You've earned ${balance.toFixed(1)} points this month, out of ${parseInt(owed)} owed :muscle:*` }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'chores-claim',
            text: { type: 'plain_text', text: 'Claim a chore', emoji: true }
          },
          {
            type: 'button',
            action_id: 'chores-rank',
            text: { type: 'plain_text', text: 'Set chore priorities', emoji: true }
          }
        ]
      }
    ]
  };
};

exports.choresClaimView = function (chores) {
  const mappedChores = chores.map((chore) => {
    return {
      value: `${chore.id}|${chore.name}|${chore.value}`,
      text: { type: 'plain_text', text: chore.name, emoji: true },
      description: { type: 'plain_text', text: `${chore.value.toFixed(1)} points` }
    };
  });

  return {
    type: 'modal',
    callback_id: 'chores-claim-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Claim', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Claim a chore', emoji: true },
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
    title: { type: 'plain_text', text: 'Chores :gloves:', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Update your chore preferences ', emoji: true }
      },
      {
        type: 'section',
        text: { type: 'plain_text', text: mainText, emoji: true }
      },
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
            {
              text: { type: 'plain_text', text: 'Strong', emoji: true },
              value: '1.0'
            },
            {
              text: { type: 'plain_text', text: 'Mild', emoji: true },
              value: '0.7'
            },
            {
              text: { type: 'plain_text', text: 'Neutral', emoji: true },
              value: '0.5'
            }
          ],
          initial_option: {
            text: { type: 'plain_text', text: 'Mild', emoji: true },
            value: '0.7'
          }
        }
      }
    ]
  };
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
