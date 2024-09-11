const {
  pointsPerResident,
  achievementBase,
  choresPollLength,
  choresProposalPollLength,
  penaltyIncrement,
  pointsBuffer,
} = require('../config');

const common = require('./common');

// Chores views

const TITLE = common.blockPlaintext('Chores');
const DOCS_URL = 'https://docs.chorewheel.zaratan.world/en/latest/tools/chores.html';

exports.formatStats = function (stats) {
  const { residentId, pointsEarned, pointsOwed, completionPct } = stats;

  let emoji = '';
  if (pointsEarned >= pointsOwed) {
    emoji = ':star:';
  } else if (pointsOwed - pointsEarned >= penaltyIncrement) {
    emoji = ':crying_cat_face:';
  }

  return `<@${residentId}> - ${pointsEarned.toFixed(0)} / ${pointsOwed.toFixed(0)} (${(completionPct * 100).toFixed(0)}%) ${emoji}`;
};

// Home views

exports.choresIntroView = function () {
  const header = ':wave::skin-tone-4: Thanks for installing Chores!';

  const instructions = `
*Follow these steps* to get set up (must be a workspace admin).
_Setup is easiest if everyone is in the same place, but it's not strictly necessary._

*1.* *Invite* all housemates to the Slack, and wait for them to join.

*2.* Make a list of *3-5 starter chores*. Good chores:
  • Take between *5-30 minutes* to do.
  • Are things that folks *usually won't do* on their own.
  • Can be done *anytime* (i.e. not on fixed schedule).

*3.* Set an events channel by calling \`/chores-channel\`, which *unlocks the app*.

*4.* Use *\`Edit chores list\`* to enter the chores you came up with.
  • Adding a few bullet points as a description will help folks stay consistent.

*5.* Have the housemates go to the events channel and *upvote the edits*.

Once the chores have been fully upvoted, *you're ready to go!* :rocket:
Just sit back and watch the magic happen...

_For more details on *Chores* functionality, read the <${DOCS_URL}|manual>._
`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(instructions));

  return {
    type: 'home',
    blocks,
  };
};

exports.choresHomeView = function (choreStats, numActive, exempt) {
  const pointsEarned = choreStats.pointsEarned.toFixed(0);
  const pointsOwed = choreStats.pointsOwed.toFixed(0);
  const progressEmoji = (pointsOwed - pointsEarned < penaltyIncrement)
    ? ':white_check_mark:'
    : ':muscle::skin-tone-4:';

  const header = 'Welcome to Chores';
  const textA = `We use *<${DOCS_URL}|Chores>* to keep the house a nice place to live.\n\n` +
    'Instead of a simple chore wheel or schedule, everyone owes *100 points* per month (UTC time). ' +
    'You earn points by doing chores you want, on your terms.\n\n' +
    'The points for a chore go up *every hour* until someone claims them. ' +
    'If you feel a chore should be worth more (or less), you can change it\'s *priority*.\n\n' +
    'If you think a chore should be *added, changed, or removed*, you can propose that as well.';
  const textB = (exempt)
    ? '*You are exempt from chores!* :tada:'
    : `You've earned *${pointsEarned} / ${pointsOwed} points* this month ${progressEmoji}`;
  const textC = `There are *${numActive} people* around today :sunny:`;

  const actions = [];
  if (!exempt) {
    if (Number(pointsEarned) < Number(pointsOwed) + pointsBuffer) {
      actions.push(common.blockButton('chores-claim', 'Claim a chore'));
    }
    actions.push(common.blockButton('chores-break', 'Take a break'));
    actions.push(common.blockButton('chores-gift', 'Gift your points'));
    actions.push(common.blockButton('chores-propose', 'Edit chores list'));
  }
  actions.push(common.blockButton('chores-rank', 'Set priorities'));

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(textA));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(textB));
  blocks.push(common.blockSection(textC));
  blocks.push(common.blockActions(actions));

  return {
    type: 'home',
    blocks,
  };
};

// Slash commands

exports.choresStatsView = function (choreClaims, choreBreaks, choreStats) {
  const header = 'See chore stats';
  const mainText = 'Extra information about monthly chores.';

  const claimText = '*Your claimed chores:*\n' +
  choreClaims.map(cc => `\n${cc.claimedAt.toDateString()} - ${cc.name} - ${cc.value.toFixed(1)} points`)
    .join('');

  const breakText = '*Current chore breaks:*\n' +
    choreBreaks.map(cb => `\n${cb.startDate.toDateString()} - ${cb.endDate.toDateString()} - <@${cb.residentId}>`)
      .join('');

  const pointsText = '*Last month\'s chore points:*\n' +
    choreStats.map(cs => `\n${exports.formatStats(cs)}`)
      .join('');

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(claimText));
  blocks.push(common.blockSection(breakText));
  blocks.push(common.blockSection(pointsText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.choresExemptView = function (exemptResidents) {
  const header = 'Set chore exemptions';
  const mainText = 'Exempt residents are excused from chores and cannot create or vote on polls.';

  const exemptText = '*Current exemptions:*\n' +
    exemptResidents
      .sort((a, b) => a.exemptAt < b.exemptAt)
      .map(r => `\n${r.exemptAt.toDateString()} - <@${r.slackId}>`)
      .join('');

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(exemptText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Action',
    {
      action_id: 'action',
      type: 'radio_buttons',
      options: [
        { value: 'exempt', text: common.blockMarkdown('*Exempt* some residents') },
        { value: 'unexempt', text: common.blockMarkdown('*Unexempt* some residents') },
      ],
    },
  ));
  blocks.push(common.blockInput(
    'Residents',
    {
      action_id: 'residents',
      type: 'multi_users_select',
      placeholder: common.blockPlaintext('Choose some residents'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-exempt-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresResetView = function () {
  const header = 'Reset chore points';
  const mainText = 'Reset chore points for the workspace. ' +
  'All chores will be worth 0 points and all residents will have 0 points. ' +
  'Residents will only owe points for the rest of the month.\n\n' +
  ':warning: *This action cannot be undone!* :warning:';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    callback_id: 'chores-reset-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

// Main actions

exports.choresClaimView = function (chores) {
  const header = 'Claim a chore';
  const mainText = 'Claims are verified by the house. ' +
    'Large claims (*10+ points*) require at least *2 upvotes*, including yours. ' +
    'Posting pictures will help others check your work.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Chore to claim',
    {
      action_id: 'chore',
      type: 'static_select',
      placeholder: common.blockPlaintext('Choose a chore'),
      options: mapChoresValues(chores),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-claim-2',
    title: TITLE,
    close: common.CLOSE,
    submit: common.NEXT,
    blocks,
  };
};

exports.choresClaimView2 = function (chore) {
  const header = 'Claim a chore';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(`*${chore.name}*`));
  blocks.push(common.blockSection(chore.metadata.description || ''));

  return {
    type: 'modal',
    callback_id: 'chores-claim-callback',
    private_metadata: JSON.stringify({ chore }),
    title: TITLE,
    close: common.BACK,
    submit: common.SUBMIT,
    blocks,
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
  return ':sparkles:'.repeat(Math.max(numSparkles, 0)); // Handle negative points
};

exports.choresClaimCallbackView = function (claim, choreName, minVotes, achivementPoints, monthlyPoints) {
  const achievement = exports.getAchievement(achivementPoints);
  const sparkles = exports.getSparkles(monthlyPoints);

  const mainText = `*<@${claim.claimedBy}>* did *${choreName}* for ` +
    `*${claim.value.toFixed(0)} points* ${achievement}${sparkles}`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, choresPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(claim.pollId, 1, 0)));
  return blocks;
};

exports.choresRankView = function (choreRankings) {
  const header = 'Set chore priorities';
  const mainText = 'If you feel a chore should be worth more (or less), you can change it\'s *priority*. ' +
    'The higher priority a chore is, the more points it will be worth over time.\n\n' +
    'Priority-setting is a *cumulative, collaborative, and ongoing* process, ' +
    'where every input makes a difference, and anyone can make small (or large) changes at any time.';

  const actions = [
    { value: 'prioritize', text: common.blockPlaintext('prioritize (more points over time)') },
    { value: 'deprioritize', text: common.blockPlaintext('deprioritize (less points over time)') },
  ];

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'I want to',
    {
      action_id: 'action',
      type: 'static_select',
      initial_option: actions[0],
      options: actions,
    },
  ));
  blocks.push(common.blockInput(
    'the following chore:',
    {
      action_id: 'chore',
      type: 'static_select',
      placeholder: common.blockPlaintext('Choose a chore'),
      options: mapChoreRankings(choreRankings),
    },
  ));
  return {
    type: 'modal',
    callback_id: 'chores-rank-2',
    title: TITLE,
    close: common.CLOSE,
    submit: common.NEXT,
    blocks,
  };
};

exports.choresRankView2 = function (action, targetChore, choreRankings) {
  const prioritize = action === 'prioritize';
  const preferenceOptions = [
    { value: String((prioritize) ? 0.7 : 1 - 0.7), text: common.blockPlaintext('a little') },
    { value: String((prioritize) ? 1.0 : 1 - 1.0), text: common.blockPlaintext('a lot') },
  ];

  const header = 'Set chore priorities';
  const mainText = 'Choose chores to update. ' +
    'Chore priorities are measured in *points-per-thousand* (ppt), which always add up to *1000*. ' +
    'A ppt of *0* means a chore gets no points, while a ppt of *1000* means a chore gets _all_ the points.\n\n' +
    'You can think of updating as "taking" priority from some chores and giving it to others. ' +
    '*Example:* "I want to _prioritize_ dishes and _deprioritize_ yardwork."\n\n' +
    '*Some things to keep in mind:*\n\n' +
    '*1.* A *strong preference* has a bigger effect.\n' +
    '*2.* Taking from *high-priority chores* has a bigger effect.\n' +
    '*3.* Taking from *more chores* has a bigger effect.\n' +
    '*4.* *More participants* have a bigger effect.\n\n' +
    'It\'s more involved than just "subtracting" ppt, but not by much.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    `I want to ${action} ${targetChore.name}`,
    {
      action_id: 'preference',
      type: 'static_select',
      initial_option: preferenceOptions[0],
      options: preferenceOptions,
    },
  ));
  blocks.push(common.blockInput(
    `by ${(prioritize) ? 'deprioritizing' : 'prioritizing'}`,
    {
      action_id: 'chores',
      type: 'multi_static_select',
      placeholder: common.blockPlaintext('Choose some chores'),
      options: mapChoreRankings(choreRankings),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-rank-3',
    private_metadata: JSON.stringify({ targetChore }),
    title: TITLE,
    close: common.BACK,
    submit: common.NEXT,
    blocks,
  };
};

exports.choresRankView3 = function (targetChore, targetChoreRanking, prefsMetadata) {
  const newPriority = Math.round(targetChoreRanking.ranking * 1000);
  const change = newPriority - targetChore.priority;

  const effect = change >= 0 ? 'an *increase*' : 'a *decrease*';
  const emoji = change >= 0 ? ':rocket:' : ':snail:';

  const header = 'Set chore priorities';
  const mainText = (change !== 0)
    ? 'After your update, ' +
      `*${targetChore.name}* will have a priority of *${newPriority} ppt*, ` +
      `${effect} of *${Math.abs(change)} ppt* ${emoji}\n\n` +
      '*Submit* to confirm, or go *back* to change your update.'
    : 'These are your current preferences, so this update will have *no effect*.\n\n' +
      'For additional effect, *choose more or different chores* or a *stronger preference*. ' +
      'Alternatively, try and *convince others* to support your priorities.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    callback_id: 'chores-rank-callback',
    private_metadata: prefsMetadata,
    title: TITLE,
    close: common.BACK,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresBreakView = function (currentTime) {
  const formattedTime = `${currentTime.getFullYear()}-${currentTime.getMonth() + 1}-${currentTime.getDate()}`;

  const header = 'Take a break';
  const mainText = 'Take a chore break when you go out of town, ' +
    'and you won\'t owe points for the days that you\'re gone.\n\n' +
    'Breaks must be at least *3 days long* and can\'t be added retroactively, so don\'t forget!';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Day you leave',
    {
      action_id: 'date',
      type: 'datepicker',
      initial_date: formattedTime,
      placeholder: common.blockPlaintext('Select a date'),
    },
  ));
  blocks.push(common.blockInput(
    'Day you return',
    {
      action_id: 'date',
      type: 'datepicker',
      initial_date: formattedTime,
      placeholder: common.blockPlaintext('Select a date'),
    },
  ));
  blocks.push(common.blockInput(
    'Circumstance',
    {
      action_id: 'circumstance',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Tell us where you\'re going'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-break-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresGiftView = function (currentBalance) {
  const header = 'Gift chore points';
  const mainText = 'Gift someone points from your balance. ' +
    `You have *${currentBalance.toFixed(0)} points* to gift.`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockInput(
    'Recipient',
    {
      action_id: 'recipient',
      type: 'users_select',
      placeholder: common.blockPlaintext('Choose a resident'),
    },
  ));
  blocks.push(common.blockInput(
    'Points',
    {
      action_id: 'points',
      type: 'number_input',
      min_value: '1',
      is_decimal_allowed: false,
      placeholder: common.blockPlaintext('Enter a number'),
    },
  ));
  blocks.push(common.blockInput(
    'Circumstance',
    {
      action_id: 'circumstance',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Tell us why you\'re giving the gift'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-gift-callback',
    private_metadata: currentBalance.toString(),
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

// Chore proposals

exports.choresProposeView = function (minVotes, isAdmin) {
  const header = 'Edit chores list';
  const mainText = 'Chores are not set in stone. ' +
    'If you believe things could be flowing better, consider *adding, removing, or changing* some chores. ' +
    `As a major house decision, a minimum of *${minVotes} upvote(s)* are required.\n\n` +
    'When defining chores, a key challenge is finding the right "size". ' +
    'Bigger chores are harder to do, but easier to prioritize and evaluate. ' +
    'Smaller chores are the opposite -- easier to do, but harder to prioritize and evaluate.\n\n' +
    'Ultimately, finding the right balance is an ongoing discovery process.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  if (isAdmin) {
    blocks.push(common.makeForceInput());
  }
  blocks.push(common.blockInput(
    'What change would you like to make?',
    {
      type: 'radio_buttons',
      action_id: 'change',
      options: [
        { value: 'add', text: common.blockMarkdown('*Add* a new chore') },
        { value: 'edit', text: common.blockMarkdown('*Change* an existing chore') },
        { value: 'delete', text: common.blockMarkdown('*Remove* an existing chore') },
      ],
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-propose-2',
    title: TITLE,
    close: common.CLOSE,
    submit: common.NEXT,
    blocks,
  };
};

exports.choresProposeEditView = function (force, chores) {
  const header = 'Edit chores list';
  const mainText = 'Change an existing chore.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Choose a chore to edit',
    {
      type: 'static_select',
      action_id: 'chore',
      placeholder: common.blockPlaintext('Choose a chore'),
      options: mapChores(chores),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-propose-edit',
    private_metadata: JSON.stringify({ force }),
    title: TITLE,
    close: common.BACK,
    submit: common.NEXT,
    blocks,
  };
};

// NOTE: used for both add and edit flows
exports.choresProposeAddView = function (force, chore) {
  const header = 'Edit chores list';
  let metadata, mainText;

  if (chore) {
    metadata = JSON.stringify({ force, change: 'edit', chore: { id: chore.id, name: chore.name } });
    mainText = 'Change an existing chore.';
  } else {
    metadata = JSON.stringify({ force, change: 'add' });
    mainText = 'Add a new chore.';
  }

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Name',
    {
      action_id: 'name',
      type: 'plain_text_input',
      initial_value: (chore) ? chore.name : undefined,
      placeholder: common.blockPlaintext('Name of the chore'),
    },
  ));
  blocks.push(common.blockInput(
    'Description',
    {
      action_id: 'description',
      type: 'plain_text_input',
      multiline: true,
      max_length: 1000,
      initial_value: (chore) ? chore.metadata.description : undefined,
      placeholder: common.blockPlaintext('Describe the chore (bullet points work well)'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-propose-callback',
    private_metadata: metadata,
    title: TITLE,
    close: common.BACK,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresProposeDeleteView = function (force, chores) {
  const header = 'Edit chores list';
  const mainText = 'Remove an existing chore.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Chore to remove',
    {
      action_id: 'chore',
      type: 'static_select',
      placeholder: common.blockPlaintext('Choose a chore'),
      options: chores.map((chore) => {
        return {
          value: JSON.stringify({ id: chore.id, name: chore.name }),
          text: common.blockPlaintext(chore.name),
        };
      }),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-propose-callback',
    private_metadata: JSON.stringify({ force, change: 'delete' }),
    title: TITLE,
    close: common.BACK,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresProposeCallbackView = function (metadata, proposal, minVotes) {
  let mainText;
  switch (metadata.change) {
    case 'add':
      mainText = `*<@${proposal.proposedBy}>* wants to *add* a chore:`;
      break;
    case 'edit':
      mainText = `*<@${proposal.proposedBy}>* wants to *edit* the *${metadata.chore.name}* chore:`;
      break;
    case 'delete':
      mainText = `*<@${proposal.proposedBy}>* wants to *delete* a chore:`;
      break;
  }

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(`*${proposal.name}*`));

  if (proposal.metadata.description) {
    blocks.push(common.blockSection(proposal.metadata.description));
  }

  blocks.push(common.blockSection(common.makeVoteText(minVotes, choresProposalPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(proposal.pollId, 1, 0)));
  return blocks;
};

exports.choresProposeCallbackViewForce = function (metadata, residentId, name, description) {
  let mainText;
  switch (metadata.change) {
    case 'add':
      mainText = `*<@${residentId}>* just *added* a chore:`;
      break;
    case 'edit':
      mainText = `*<@${residentId}>* just *edited* the *${metadata.chore.name}* chore:`;
      break;
    case 'delete':
      mainText = `*<@${residentId}>* just *deleted* a chore:`;
      break;
  }

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(`*${name || metadata.chore.name}*`));

  if (description) {
    blocks.push(common.blockSection(description));
  }

  return blocks;
};

// Internal

function mapChores (chores) {
  return chores.map((chore) => {
    return {
      value: JSON.stringify({ id: chore.id }),
      text: common.blockPlaintext(chore.name),
    };
  });
}

function mapChoresValues (chores) {
  return chores.map((chore) => {
    return {
      value: JSON.stringify({ id: chore.id }),
      text: common.blockPlaintext(`${chore.name} - ${chore.value.toFixed(0)} points`),
    };
  });
}

function mapChoreRankings (choreRankings) {
  return choreRankings.map((chore) => {
    const priority = Math.round(chore.ranking * 1000);
    return {
      value: JSON.stringify({ id: chore.id, name: chore.name, priority }),
      text: common.blockPlaintext(`${chore.name} - ${priority} ppt`),
    };
  });
}
