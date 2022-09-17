const voca = require('voca');

// Chores Views

exports.displayString = function (text) {
  return voca.titleCase(text);
};

exports.storeString = function (text) {
  return voca(text).latinise().lowerCase().value();
};

exports.choresHomeView = function (balance) {
  const mainText = 'We use Chores to keep the house a nice place to live.\n' +
    'Instead of a chore wheel or schedule, everyone owes *100 points* per month.\n' +
    'You earn points by doing the chores you want, on your terms.\n' +
    'The points for a chore go up until someone claims them, then resets to 0.\n' +
    'Different chores earn points at different speeds, depending on your priorities.';

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
        text: { type: 'mrkdwn', text: `*You've earned ${balance} points so far this month :muscle:*` }
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
            action_id: 'chores-pref',
            text: { type: 'plain_text', text: 'Set chore priorities', emoji: true }
          }
        ]
      }
    ]
  };
};

exports.choresListView = function (chores) {
  const mappedChoreValues = chores.map((chore) => {
    const choreName = exports.displayString(chore.name);
    const choreValue = parseInt(chore.sum || 0);
    return {
      value: `${chore.id}.${choreValue}`,
      text: { type: 'plain_text', text: choreName, emoji: true },
      description: { type: 'plain_text', text: `${choreValue} points` }
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
        element: { type: 'radio_buttons', action_id: 'options', options: mappedChoreValues }
      }
    ]
  };
};

exports.getChoreClaim = function (view) {
  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const choreClaimIndex = view.state.values.input.options.selected_option.value;
  const choreClaim = view.blocks[0].element.options[parseInt(choreClaimIndex)];

  return {
    name: choreClaim.text.text,
    value: parseInt(choreClaim.description.text)
  };
};

exports.choreListCallbackView = function (residentId, choreName, choreValue, pollDuration) {
  const textA = `*<@${residentId}>* did *${choreName}* for *${choreValue} tokens* :sparkles::sparkles:`;
  const textB = `React :+1: to endorse or :-1: to challenge, voting closes in ${pollDuration / 1000 / 60 / 60} hours`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(1, 0) }
  ];
};

// Polls Views (utils)

exports.makeVoteButtons = function (upvoteCount, downvoteCount) {
  return [
    {
      type: 'button',
      text: { type: 'plain_text', text: `:+1: (${upvoteCount})`, emoji: true },
      value: '1',
      action_id: 'poll-vote-up'
    },
    {
      type: 'button',
      text: { type: 'plain_text', text: `:-1: (${downvoteCount})`, emoji: true },
      value: '0',
      action_id: 'poll-vote-down'
    }
  ];
};
