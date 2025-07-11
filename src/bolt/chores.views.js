const {
  pointsPerResident,
  achievementBase,
  choresPollLength,
  choresProposalPollLength,
  specialChoreProposalPollLength,
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
    emoji = ':broken_heart:';
  }

  return `<@${residentId}> - ${pointsEarned.toFixed(0)} / ${pointsOwed.toFixed(0)} (${(completionPct * 100).toFixed(0)}%) ${emoji}`;
};

exports.formatTotalStats = function (stats) {
  const pointsEarned = stats.reduce((sum, stat) => sum + stat.pointsEarned, 0);
  const pointsOwed = stats.reduce((sum, stat) => sum + stat.pointsOwed, 0);
  const completionPct = pointsEarned / pointsOwed;

  return `*Total - ${pointsEarned.toFixed(0)} / ${pointsOwed.toFixed(0)} (${(completionPct * 100).toFixed(0)}%)*`;
};

exports.formatPointsPerDay = function (ranking, numResidents) {
  const pointsPerDay = ranking * (pointsPerResident / 30) * numResidents;
  return (pointsPerDay > 5) ? pointsPerDay.toFixed(0) : pointsPerDay.toFixed(1);
};

// Home views

exports.choresIntroView = function () {
  const header = ':wave::skin-tone-4: Thanks for installing Chores!';

  const instructions = `
*Follow these steps* to get set up (must be a workspace admin).

*1.* *Invite* all participants to the Slack.

*2.* Make a list of *3-5 starter chores*. Good chores:
  • Take between *5-30 minutes* to do.
  • Are things that folks *usually won't do* on their own.
  • Can be done *anytime* (i.e. not on fixed schedule).
  • Don't overlap with other chores.

*3.* Set an events channel by calling \`/chores-channel\`, which *unlocks the app*.
  • If using a *public* channel, you can just call the command in the channel.
  • If using a *private* channel, manually invite the app to the channel first.

*4.* Use *\`Edit chores list\`* to add the chores you came up with.
  • Adding a few bullet points as a description will help folks stay consistent.
  • As an admin, you can "force" the proposal and create the chores immediately.

*5.* *Activate* all the participants by calling \`/chores-activate\`.

Then just sit back and watch the magic happen...

_For more tips and tricks for using *Chores*, read the <${DOCS_URL}|manual>._
`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(instructions));

  return {
    type: 'home',
    blocks,
  };
};

exports.choresHomeView = function (choreChannel, choreStats, numActive) {
  const pointsEarned = choreStats.pointsEarned.toFixed(0);
  const pointsOwed = choreStats.pointsOwed.toFixed(0);
  const progressEmoji = (pointsOwed - pointsEarned < penaltyIncrement)
    ? ':white_check_mark:'
    : ':muscle::skin-tone-4:';

  const header = 'Welcome to Chores';
  const mainText = `We use *<${DOCS_URL}|Chores>* to keep the house a nice place to live.\n\n` +
    'Instead of a simple chore wheel or schedule, everyone owes *100 points* per month (UTC). ' +
    'You earn points by doing chores you want, on your terms — ' +
    'the point value for a chore _keeps going up_ until someone claims it.\n\n' +
    'If you feel a chore should be worth more (or less) over time, you can change it\'s *priority*. ' +
    'If you think a chore should be *added*, *changed*, or *removed*, you can propose that too.';

  const pointsText = (pointsOwed > 0)
    ? `You've earned *${pointsEarned} / ${pointsOwed} points* this month ${progressEmoji}`
    : '*You are exempt from chores!* :tada:';
  const activeText = `There are *${numActive} people* around today :sunny:`;
  const channelText = `Events will be posted in <#${choreChannel}> :mailbox_with_mail:`;

  const actions = [];

  if (pointsOwed > 0) {
    if (Number(pointsEarned) < Number(pointsOwed) + pointsBuffer) {
      actions.push(common.blockButton('chores-claim', ':hand::skin-tone-4: Claim a chore'));
    }
    actions.push(common.blockButton('chores-break', ':camping: Take a break'));
    actions.push(common.blockButton('chores-gift', ':gift: Gift your points'));
    actions.push(common.blockButton('chores-special', ':bulb: Add special chore'));
    actions.push(common.blockButton('chores-rank', ':scales: Set priorities'));
    actions.push(common.blockButton('chores-propose', ':notebook: Edit chores list'));
  } else {
    actions.push(common.blockButton('chores-activate-solo', ':fire: Activate yourself'));
  }

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.feedbackLink));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(pointsText));
  blocks.push(common.blockSection(activeText));
  blocks.push(common.blockSection(channelText));
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

exports.choresActivateView = function (residents) {
  const header = 'Update activation status';
  const mainText = 'Activated residents *owe chores*, and can *create or vote on polls*.\n\n' +
    'Choose some residents to update. ' +
    'You can update *all* residents in the workspace, or only *a few*.';
  const residentsText = `*Currently active residents* (${residents.length}): ` +
    residents.slice(0, 100).map(r => `<@${r.slackId}>`).join(', ');

  const options = [
    { value: 'true', text: common.blockMarkdown('*Activate* some residents') },
    { value: 'false', text: common.blockMarkdown('*Deactivate* some residents') },
  ];

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(residentsText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Update action',
    {
      type: 'radio_buttons',
      action_id: 'action',
      initial_option: options[0],
      options,
    },
  ));
  blocks.push(common.blockInputOptional(
    'Update ~all~ residents',
    {
      type: 'checkboxes',
      action_id: 'select_all',
      options: [ { value: 'true', text: common.blockPlaintext('Yes') } ],
    },
  ));
  blocks.push(common.blockInputOptional(
    'or, Update ~selected~ residents',
    {
      action_id: 'residents',
      type: 'multi_conversations_select',
      filter: common.userFilter,
      placeholder: common.blockPlaintext('Choose some residents'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-activate-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresActivateSoloView = function () {
  const header = 'Activate yourself';
  const mainText = 'By activating yourself, you agree to participate in the chores system.\n\n' +
    'You will be responsible for earning *~100 points per month* by doing chores. ' +
    'You can claim chores, vote on claims, take breaks, gift points to others, set chore priorities, and propose new chores.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    callback_id: 'chores-activate-solo-callback',
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

exports.choresClaimViewZero = function () {
  const header = 'No chores available';
  const mainText = 'If no chores exist, create some using `Edit chores list`. ' +
    'Otherwise, come back a little bit later.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.choresClaimView = function (chores) {
  const header = 'Claim a chore';
  const mainText = 'Claims are verified by the group. ' +
    'Large claims (*10+ points*) require at least *2 upvotes*, including yours.';

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

exports.choresClaimView2 = function (chore, choreValue, choreStats) {
  const pointsEarned = (choreValue + choreStats.pointsEarned).toFixed(0);
  const pointsOwed = choreStats.pointsOwed.toFixed(0);
  const sparkles = exports.getSparkles(pointsEarned);

  const header = 'Claim a chore';
  const statsText = `After claiming this chore, you'll have *${pointsEarned}* of *${pointsOwed}* points ${sparkles} `;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(`*${chore.name || chore.metadata.name}*`));
  blocks.push(common.blockSection(chore.metadata.description || ''));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(statsText));

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

exports.choresClaimCallbackView = function (claim, name, minVotes, achivementPoints, monthlyPoints) {
  const achievement = exports.getAchievement(achivementPoints);
  const sparkles = exports.getSparkles(monthlyPoints);

  const mainText = `*<@${claim.claimedBy}>* did *${name}* for ` +
    `*${claim.value.toFixed(0)} points* ${achievement}${sparkles}`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, choresPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(claim.pollId, 1, 0)));
  return blocks;
};

exports.choresRankView = function (choreRankings) {
  const header = 'Set chore priorities';
  const mainText = 'The higher a chore\'s priority, the more points it will be worth over time.\n\n' +
    'Chore priorities are measured in *points-per-thousand* (ppt), which always add up to *1000*. ' +
    'A ppt of *0* means a chore gets no points, while a ppt of *1000* means a chore gets _all_ the points.';

  const actions = [
    { value: String(1), text: common.blockPlaintext('prioritize (more points over time)') },
    { value: String(0), text: common.blockPlaintext('deprioritize (less points over time)') },
  ];

  const preferenceOptions = [
    { value: String(1.0), text: common.blockPlaintext('a lot') },
    { value: String(0.7), text: common.blockPlaintext('a little') },
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
  blocks.push(common.blockInput(
    'by',
    {
      action_id: 'preference',
      type: 'radio_buttons',
      initial_option: preferenceOptions[0],
      options: preferenceOptions,
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

exports.choresRankView2 = function (preference, targetChore, choreRankings) {
  const header = 'Set chore priorities';
  const mainText = 'Priority-setting is a *collaborative and ongoing* process, ' +
    'where people "take" priority from some chores and give it to others.\n\n' +
    '*Example:* "I want to _prioritize_ dishes and _deprioritize_ yardwork."\n\n' +
    'To have a *bigger effect,* you can: ' +
    '*1)* take from *more* chores, ' +
    '*2)* take from *higher-priority* chores, ' +
    '*3)* set a *stronger* preference, ' +
    'or *4)* get *other people* to back you up.';
  const actionText = `You want to *${(preference >= 0.5) ? 'prioritize' : 'deprioritize'}* ` +
    `*${targetChore.name}* by *${Math.abs(preference - 0.5) > 0.2 ? 'a lot' : 'a little'}*,`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockSection(actionText));
  blocks.push(common.blockInput(
    `by ${(preference >= 0.5) ? 'deprioritizing' : 'prioritizing'}`,
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
    private_metadata: JSON.stringify({ preference, targetChore }),
    title: TITLE,
    close: common.BACK,
    submit: common.NEXT,
    blocks,
  };
};

exports.choresRankView3 = function (targetChore, targetChoreRanking, prefsMetadata, prefSaturation, numResidents) {
  const newPriority = Math.round(targetChoreRanking.ranking * 1000);
  const change = newPriority - targetChore.priority;
  const pointsPerDay = exports.formatPointsPerDay(targetChoreRanking.ranking, numResidents);

  const effect = change >= 0 ? 'an *increase*' : 'a *decrease*';
  const emoji = change >= 0 ? ':rocket:' : ':snail:';
  const saturation = change >= 0 ? prefSaturation : 1 - prefSaturation;

  const header = 'Set chore priorities';
  const priorityText = 'After your update, ' +
      `*${targetChore.name}* will have a priority of *${newPriority} ppt*, ` +
      `${effect} of *${Math.abs(change)} ppt* ${emoji}\n\n` +
      `That's about *${pointsPerDay} points per day*.`;
  const saturationText = `Your preferences for *${targetChore.name}* are at *${(saturation * 100).toFixed(0)}%* of possible strength. ` +
    'If you want a *bigger effect*, ' +
    (saturation > 0.8 ? 'ask others to support your priorities.' : 'you can strengthen your preferences.');
  const submitText = '*Submit* to confirm, or go *back* to change your update.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(priorityText));
  blocks.push(common.blockSection(saturationText));
  blocks.push(common.blockSection(submitText));

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

exports.choresRankViewZero = function (preference) {
  const header = 'Set chore priorities';
  const mainText = `No chores available to *${(preference >= 0.5) ? 'deprioritize' : 'prioritize'}*, ` +
    'most likely because you\'ve put in these preferences already.\n\n' +
    'Try asking someone else to submit the same preferences as you.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    title: TITLE,
    close: common.BACK,
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
      type: 'conversations_select',
      filter: common.userFilter,
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
  const docsUrl = 'https://docs.chorewheel.zaratan.world/en/latest/tools/chores.html#core-concepts';

  const header = 'Edit chores list';
  const mainText = 'Chores are not set in stone. ' +
    'If you believe things could be flowing better, consider *adding, removing, or changing* some chores. ' +
    `As a major house decision, a minimum of *${minVotes} upvote(s)* are required.\n\n` +
    'When defining chores, a key challenge is finding the right "size". ' +
    'Bigger chores are harder to do, but easier to prioritize and verify. ' +
    'Smaller chores are the opposite.\n\n' +
    'Ultimately, finding the right balance is an ongoing discovery process. ' +
    `If you want some examples of good chores, *check out the ${common.makeLink(docsUrl, 'docs')}*.`;

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

// Special chore flow

exports.choresSpecialView = function (minVotes) {
  const header = 'Add special chore';
  const mainText = 'Sometimes there are big one-off tasks that need to be done. ' +
    'These can be seen as *special chores*.\n\n' +
    `Creating special chores requires *one upvote per 10 points*, and a *minimum of ${minVotes} upvotes*.`;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Name',
    {
      action_id: 'name',
      type: 'plain_text_input',
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
      placeholder: common.blockPlaintext('Describe the chore (bullet points work well)'),
    },
  ));
  blocks.push(common.blockInput(
    'Points',
    {
      action_id: 'points',
      type: 'number_input',
      min_value: '1',
      is_decimal_allowed: false,
      placeholder: common.blockPlaintext('Number of points the chore is worth'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-special-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresSpecialCallbackView = function (proposal, minVotes, numResidents) {
  const mainText = `*<@${proposal.proposedBy}>* wants to create a *special chore* ` +
    `worth *${proposal.metadata.value} points*:`;
  const pointsText = 'Creating this special chore will add ' +
    `*~${(proposal.metadata.value / numResidents).toFixed(0)} points* to everyone's requirement.`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(`*${proposal.name}*`));

  if (proposal.metadata.description) {
    blocks.push(common.blockSection(proposal.metadata.description));
  }

  blocks.push(common.blockSection(pointsText));

  blocks.push(common.blockSection(common.makeVoteText(minVotes, specialChoreProposalPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(proposal.pollId, 1, 0)));
  return blocks;
};

// Internal

function mapChores (chores) {
  return chores.map((chore) => {
    return {
      value: JSON.stringify({ id: chore.id }),
      text: common.blockPlaintext(chore.name.slice(0, 60)),
    };
  });
}

function mapChoresValues (chores) {
  return chores.map((chore) => {
    const name = chore.name || chore.metadata.name;
    return {
      value: JSON.stringify({ choreId: chore.choreId, choreValueId: chore.choreValueId }),
      text: common.blockPlaintext(`${name.slice(0, 60)} - ${chore.value.toFixed(0)} points`),
    };
  });
}

function mapChoreRankings (choreRankings) {
  return choreRankings.map((chore) => {
    const priority = Math.round(chore.ranking * 1000);
    return {
      value: JSON.stringify({ id: chore.id, name: chore.name, priority }),
      text: common.blockPlaintext(`${chore.name.slice(0, 60)} - ${priority} ppt`),
    };
  });
}
