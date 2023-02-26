const voca = require('voca');

const { HOUR } = require('../constants');
const { pointsPerResident, pointPrecision, achievementBase, choresPollLength, penaltyIncrement } = require('../config');

const common = require('./common');

exports.formatChoreName = function (text) {
  return voca(text).latinise().titleCase().value();
};

exports.choresHomeView = function (balance, owed) {
  const progressEmoji = (owed - balance < penaltyIncrement) ? ':white_check_mark:' : ':muscle::skin-tone-4:';
  const docsURI = 'https://github.com/kronosapiens/mirror/wiki/Chores';
  const textA = `We use *<${docsURI}|Chores>* to keep the house a nice place to live.\n\n` +
    'Instead of a chore wheel or schedule, everyone owes *100 points* per month (UTC time). ' +
    'You earn points by doing chores you want, on your terms.\n\n' +
    'The points for a chore go up every hour until someone claims them. ' +
    'Chores gain points at different speeds, which you can change.';

  const textB = `*You've earned ${balance.toFixed(pointPrecision)} points this month, ` +
    `out of ${owed.toFixed(0)} owed* ${progressEmoji}`;

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
    { type: 'actions', elements: common.makeVoteButtons(claim.pollId, 1, 0) }
  ];
};

exports.choresRankView = function () {
  const mainText = 'Every hour, chores gain points. ' +
    'The total points across all chores is fixed, but some chores gain points faster than others. ' +
    'Every chore has a speed (measured in *ppt*, or points-per-thousand), and speeds always add up to *1000*.\n\n' +
    'You can set chore speeds here. First, decide whether you want to speed up or slow down a chore. ' +
    'Speeding up a chore will make other chores slower, and slowing down a chore will make other chores faster.';

  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Set chore speeds', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: mainText } },
      {
        type: 'actions',
        elements: [
          {
            type: 'radio_buttons',
            action_id: 'chores-rank-2',
            options: [
              { text: { type: 'mrkdwn', text: 'Speed up a chore' }, value: 'faster' },
              { text: { type: 'mrkdwn', text: 'Slow down a chore' }, value: 'slower' }
            ]
          }
        ]
      }
    ]
  };
};

exports.choresRankView2 = function (direction, choreRankings) {
  const mappedChoreRankings = choreRankings.map((chore) => {
    const choreSpeed = (chore.ranking * 1000).toFixed(0);
    return {
      value: `${chore.id}|${chore.name}|${choreSpeed}`,
      text: { type: 'plain_text', text: `${chore.name} - ${choreSpeed} ppt`, emoji: true }
    };
  });

  const textA = direction === 'faster' ? 'Chore to speed up' : 'Chore to slow down';
  const textB = direction === 'faster' ? 'Chores to slow down' : 'Chores to speed up';

  return {
    type: 'modal',
    callback_id: 'chores-rank-callback',
    private_metadata: direction,
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Back', emoji: true },
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Set chore speeds', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: 'Choose chores to update' } },
      {
        type: 'input',
        label: { type: 'plain_text', text: textA, emoji: true },
        element: {
          type: 'static_select',
          action_id: 'chores',
          placeholder: { type: 'plain_text', text: 'Choose a chore', emoji: true },
          options: mappedChoreRankings
        }
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: textB, emoji: true },
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

exports.choresGiftView = function (pointsBalance) {
  const mainText = 'Gift someone points from your balance. ' +
    `You have *${pointsBalance.toFixed(pointPrecision)} points* to gift.`;

  return {
    type: 'modal',
    callback_id: 'chores-gift-callback',
    private_metadata: pointsBalance.toString(),
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
      },
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Circumstance', emoji: true },
        element: {
          type: 'plain_text_input',
          placeholder: { type: 'plain_text', text: 'Tell us where you\'re going', emoji: true },
          action_id: 'circumstance'
        }
      }
    ]
  };
};
