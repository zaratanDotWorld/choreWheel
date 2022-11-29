const voca = require('voca');

const { HOUR } = require('../constants');

const {
  pointsPerResident,
  pointPrecision,
  achievementBase,
  thingsMinVotesScalar,
  choresPollLength,
  thingsPollLength,
  heartsPollLength
} = require('../config');

// Chores Views

exports.formatChoreName = function (text) {
  return voca(text).latinise().titleCase().value();
};

exports.choresHomeView = function (balance, owed) {
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Chores';
  const textA = `We use *<${docsURI}|Chores>* to keep the house a nice place to live.\n\n` +
    'Instead of a chore wheel or schedule, everyone owes *100 points* per month. ' +
    'You earn points by doing the chores you want, on your terms.\n\n' +
    'The points for a chore go up every hour until someone claims them. ' +
    'Chores gain points at different speeds, which you can change.';

  const textB = `*You've earned ${balance.toFixed(pointPrecision)} points this month, ` +
    `out of ${parseInt(owed)} owed :muscle::skin-tone-4:*`;

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
          { type: 'button', action_id: 'chores-rank', text: { type: 'plain_text', text: 'Set chore speeds', emoji: true } },
          { type: 'button', action_id: 'chores-gift', text: { type: 'plain_text', text: 'Gift your points', emoji: true } },
          { type: 'button', action_id: 'chores-break', text: { type: 'plain_text', text: 'Take a break', emoji: true } }
        ]
      }
    ]
  };
};

exports.choresClaimView = function (chores) {
  const mappedChores = chores.map((chore) => {
    return {
      value: `${chore.id}|${chore.name}`,
      text: { type: 'plain_text', text: `${chore.name} - ${chore.value.toFixed(pointPrecision)} points`, emoji: true }
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

exports.getAchievement = function (totalPoints) {
  if (totalPoints >= achievementBase * 5 * 5) {
    return ':first_place_medal:';
  } else if (totalPoints >= achievementBase * 5) {
    return ':second_place_medal:';
  } else if (totalPoints >= achievementBase) {
    return ':third_place_medal:';
  } else {
    return '';
  }
};

exports.getSparkles = function (monthlyPoints) {
  const numSparkles = Math.floor(monthlyPoints / (pointsPerResident / 4));
  return ':sparkles:'.repeat(numSparkles);
};

exports.choresClaimCallbackView = function (claim, choreName, totalPoints, monthlyPoints) {
  const achievement = exports.getAchievement(totalPoints);
  const sparkles = exports.getSparkles(monthlyPoints);

  const textA = `*<@${claim.claimedBy}>* did *${choreName}* for ` +
    `*${claim.value.toFixed(pointPrecision)} points* ${achievement}${sparkles}`;
  const textB = '*2 endorsements* are required to pass, ' +
    `voting closes in *${choresPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(claim.pollId, 1, 0) }
  ];
};

exports.choresRankView = function (choreRankings) {
  const mappedChoreRankings = choreRankings.map((chore) => {
    return {
      value: `${chore.id}|${chore.name}`,
      text: { type: 'plain_text', text: `${chore.name} - ${(chore.ranking * 1000).toFixed(0)} speed`, emoji: true }
    };
  });

  const mainText = 'Every hour, chores gain points. ' +
    'The sum of points across all chores is fixed, but some chores gain points faster than others. ' +
    'Every chore has a speed, and speeds always add up to *1000*.\n\n' +
    'You can set chore speeds here. Choose one chore to make faster, ' +
    'and one (or more) to make slower. The effect will be larger the more chores you slow down.';

  return {
    type: 'modal',
    callback_id: 'chores-rank-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Set chore speeds', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Chore to speed up', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'chores',
          placeholder: { type: 'plain_text', text: 'Choose a chore', emoji: true },
          options: mappedChoreRankings
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Chores to slow down', emoji: true },
        element: {
          type: 'multi_static_select',
          action_id: 'chores',
          placeholder: { type: 'plain_text', text: 'Choose some chores', emoji: true },
          options: mappedChoreRankings
        }
      }
    ]
  };
};

exports.choresGiftView = function (choreClaim) {
  const giftablePoints = choreClaim.value.toFixed(pointPrecision);
  const mainText = `Gift someone points from your balance. You have *${giftablePoints} points* to gift.`;

  return {
    type: 'modal',
    callback_id: 'chores-gift-callback',
    private_metadata: choreClaim.id.toString(),
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
          type: 'users_select',
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

exports.choresBreakView = function (currentTime) {
  const formattedTime = `${currentTime.getFullYear()}-${currentTime.getMonth() + 1}-${currentTime.getDate()}`;
  const mainText = 'Take a chore break when you go out of town, ' +
    'and you won\'t owe points for the days that you\'re gone.\n\n' +
    'Breaks must be at least *3 days long* and can\'t be added retroactively, so don\'t forget!';

  return {
    type: 'modal',
    callback_id: 'chores-break-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Take a break', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Day you leave', emoji: true },
        element: {
          type: 'datepicker',
          initial_date: formattedTime,
          placeholder: { type: 'plain_text', text: 'Select a date', emoji: true },
          action_id: 'date'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Day you return', emoji: true },
        element: {
          type: 'datepicker',
          initial_date: formattedTime,
          placeholder: { type: 'plain_text', text: 'Select a date', emoji: true },
          action_id: 'date'
        }
      }
    ]
  };
};

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

exports.formatThing = function (thing) {
  return `${thing.type}: ${thing.name} - ${thing.quantity} ($${thing.value})`;
};

exports.thingsHomeView = function (balance) {
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Things';
  const textA = `We use *<${docsURI}|Things>* to spend money together.\n\n` +
    'Anyone can propose a buy, which requires *one* thumbs-up vote per $50. ' +
    'Successful buys are fulfilled within 3-7 days.';

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
          { type: 'button', action_id: 'things-buy', text: { type: 'plain_text', text: 'Buy a thing', emoji: true } }
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

exports.thingsBuyCallbackView = function (buy, thing, priorBalance) {
  const pollQuorum = Math.ceil(thing.value / thingsMinVotesScalar);
  const currentBalance = priorBalance - thing.value;

  const textA = `*<@${buy.boughtBy}>* bought *${thing.name} - ${thing.quantity}* for *$${thing.value}*. ` +
    `There's *$${currentBalance}* left in the house account :fire:`;
  const textB = `*${pollQuorum} endorsement(s)* are required to pass, ` +
    `voting closes in *${thingsPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(buy.pollId, 1, 0) }
  ];
};

// Hearts

exports.heartEmoji = function (numHearts) {
  if (numHearts <= 2) {
    return ':broken_heart:';
  } else if (numHearts <= 5) {
    return ':heart:';
  } else {
    return ':heart_on_fire:';
  }
};

exports.heartsHomeView = function (numHearts) {
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Hearts';
  const textA = `We use *<${docsURI}|Hearts>* to keep each other accountable.\n\n` +
    'Everyone starts with five hearts. We lose hearts when we fail to uphold our commitments, ' +
    'and we earn them back over time (one per month), and by exceeding expectations.';

  const textB = `You have *${numHearts}* hearts: ${exports.heartEmoji(numHearts).repeat(numHearts)}`;

  return {
    type: 'home',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Welcome to Hearts', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      {
        type: 'actions',
        elements: [
          { type: 'button', action_id: 'hearts-board', text: { type: 'plain_text', text: 'See current hearts', emoji: true } },
          { type: 'button', action_id: 'hearts-challenge', text: { type: 'plain_text', text: 'Issue a challenge', emoji: true } }
        ]
      }
    ]
  };
};

exports.heartsChallengeView = function () {
  const mainText = 'Choose someone to challenge, a number of hearts, and explain the circumstance. ' +
    'The issue will go to a house vote, and the loser (potentially you) will lose hearts.\n\n' +
    'If the challengee has three or more hearts, you need a minimum of *four* positive votes. ' +
    'If they have only one or two hearts left, you need a minimum of *seven* positive votes. ' +
    'So please make sure you\'ve spoken to others about the issue before raising a challenge.\n\n' +
    '*<https://github.com/kronosapiens/mirror/wiki/Conflict-Resolution|Click here>* for more information about conflict resolution.';

  return {
    type: 'modal',
    callback_id: 'hearts-challenge-callback',
    title: { type: 'plain_text', text: 'Hearts', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Issue a challenge', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Challengee', emoji: true },
        element: {
          type: 'users_select',
          placeholder: { type: 'plain_text', text: 'Choose a resident', emoji: true },
          action_id: 'challengee'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Number of hearts', emoji: true },
        element: {
          type: 'static_select',
          placeholder: { type: 'plain_text', text: 'Select a number', emoji: true },
          options: [
            { text: { type: 'plain_text', text: '1', emoji: true }, value: '1' },
            { text: { type: 'plain_text', text: '2', emoji: true }, value: '2' },
            { text: { type: 'plain_text', text: '3', emoji: true }, value: '3' }
          ],
          initial_option: { text: { type: 'plain_text', text: '1', emoji: true }, value: '1' },
          action_id: 'hearts'
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Circumstance', emoji: true },
        element: {
          type: 'plain_text_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Explain the circumstance as best you can', emoji: true },
          action_id: 'circumstance'
        }
      }
    ]
  };
};

exports.heartsChallengeCallbackView = function (challenge, quorum, circumstance) {
  const textA = `*<@${challenge.challengerId}>* challenged *<@${challenge.challengeeId}>* ` +
    `for *${challenge.value} heart(s)*, due to the following circumstance:`;
  const textB = `*${quorum} endorsements* are required to pass, ` +
    `voting closes in *${heartsPollLength / HOUR} hours*`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: textA } },
    { type: 'section', text: { type: 'mrkdwn', text: `_${circumstance}_` } },
    { type: 'section', text: { type: 'mrkdwn', text: textB } },
    { type: 'actions', elements: exports.makeVoteButtons(challenge.pollId, 1, 0) }
  ];
};

exports.heartsBoardView = function (hearts) {
  const mainText = 'Current hearts for the house.\n*One or two* hearts is :broken_heart:, ' +
    '*three to five* is :heart:, and *more than five* is :heart_on_fire:';
  const heartsText = hearts.map((heart) => `\n\n${exports.heartEmoji(heart.sum)} <@${heart.residentId}>`).join('');

  return {
    type: 'modal',
    callback_id: 'hearts-challenge-callback',
    title: { type: 'plain_text', text: 'Hearts', emoji: true },
    close: { type: 'plain_text', text: 'Close', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Current hearts', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: heartsText } }
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
