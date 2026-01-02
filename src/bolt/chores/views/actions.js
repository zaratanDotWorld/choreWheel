const {
  choresPollLength,
  choresProposalPollLength,
  specialChoreProposalPollLength,
} = require('../../../params');

const common = require('../../common');

const {
  TITLE,
  DOCS_URL,
  getAchievement,
  getSparkles,
  mapChores,
  mapChoresValues,
  mapChoreRankings,
  formatPointsPerDay,
} = require('./utils');

// Onboarding flow

exports.choresOnboardView2 = function () {
  const header = 'Set app channel';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockInput(
    'Choose a channel for app updates',
    {
      action_id: 'channel',
      type: 'channels_select',
      placeholder: common.blockPlaintext('Choose a channel'),
    },
  ));

  return {
    type: 'modal',
    callback_id: 'chores-onboard-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};

exports.choresOnboardMessage = function (oauth) {
  const imageUrl = 'https://raw.githubusercontent.com/zaratanDotWorld/choreWheel/' +
    'ecd9996619567febdf62edcc20f9617e4414f866/assets/chores-home.png';

  const blocks = [];

  blocks.push(common.blockHeader('Welcome to Chores!'));

  blocks.push(common.blockSection(
    'Chores is a powerful tool for helping groups share recurring tasks.',
  ));

  blocks.push(common.blockDivider());

  blocks.push(common.blockSection(
    'Everyone can access Chores functionality through the app home screen:',
  ));

  blocks.push(common.blockImage(imageUrl, 'Chore Wheel App Home'));

  blocks.push(common.blockSection(
    `If you don't see the app home, you can reach it by clicking on <@${oauth.bot.userId}>.`,
  ));

  blocks.push(common.blockDivider());

  blocks.push(common.blockSection(
    'Your group has been set up with two starter chores: _Dishes_ and _Trash Takeout_. ' +
    'Next steps are to *activate the rest of your group* and *add a few more chores* to the list. ' +
    'Then sit back and let the magic happen. :sparkles:',
  ));

  blocks.push(common.blockSection(
    'Folks can activate themselves through the app home, ' +
    'and admins activate others with the `/chores-activate` command. ' +
    'Adding and claiming chores can be done by anybody through the app home.',
  ));

  blocks.push(common.blockSection(
    `_Tip: pin this message to the channel. To learn more about Chores, read the <${DOCS_URL}|docs>._`,
  ));

  return blocks;
};

// Solo activate flow

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

// Claim flow

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
  const pointsOwed = choreStats.pointsOwed;
  const sparkles = getSparkles(pointsEarned);

  const header = 'Claim a chore';
  const statsText = `After claiming this chore, you'll have *${pointsEarned}* of *${pointsOwed}* points ${sparkles} `;

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(`*${chore.name || chore.metadata.name}*`));

  if (chore.metadata.description) {
    blocks.push(common.blockSection(chore.metadata.description));
  }

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

exports.choresClaimCallbackView = function (claim, name, minVotes, achivementPoints, monthlyPoints) {
  const achievement = getAchievement(achivementPoints);
  const sparkles = getSparkles(monthlyPoints);

  const mainText = `*<@${claim.claimedBy}>* did *${name}* for ` +
    `*${claim.value} points* ${achievement}${sparkles}`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(common.makeVoteText(minVotes, choresPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(claim.pollId, 1, 0)));
  return blocks;
};

// Ranking flow

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
  const pointsPerDay = formatPointsPerDay(targetChoreRanking.ranking, numResidents);

  const effect = change >= 0 ? 'an *increase*' : 'a *decrease*';
  const emoji = change >= 0 ? ':rocket:' : ':snail:';
  const saturation = change >= 0 ? prefSaturation : 1 - prefSaturation;

  const header = 'Set chore priorities';
  const priorityText = 'After your update, ' +
      `*${targetChore.name}* will have a priority of *${newPriority} ppt*, ${effect} of *${Math.abs(change)} ppt*. ` +
      `That's about *${pointsPerDay} points per day* ${emoji}`;
  const submitText = `Your preferences for *${targetChore.name}* are at *${(saturation * 100).toFixed(0)}%* of possible strength. ` +
    '*Submit* to confirm, or go *back* to change your update.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(priorityText));
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

// Break flow

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

// Gift flow

exports.choresGiftView = function (currentBalance) {
  const header = 'Gift chore points';
  const mainText = 'Gift someone points from your balance. ' +
    `You have *${currentBalance} points* to gift.`;

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
  blocks.push(common.blockInputOptional(
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

exports.choresSpecialView = function (minVotes, remainder) {
  const header = 'Add special chore';
  const mainText = 'Sometimes there are big one-off tasks that need to be done. ' +
    'These can be seen as *special chores*.\n\n' +
    `Creating special chores requires *one upvote per 10 points*, and a *minimum of ${minVotes} upvotes*.`;
  const remainderText = `There are *${remainder.toFixed(0)} free points* left for special chores this month. ` +
    'Past this limit, everyone will owe extra points.';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(remainderText));
  blocks.push(common.blockDivider());
  blocks.push(common.blockInput(
    'Name',
    {
      action_id: 'name',
      type: 'plain_text_input',
      placeholder: common.blockPlaintext('Name of the chore'),
    },
  ));
  blocks.push(common.blockInputOptional(
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

exports.choresSpecialCallbackView = function (proposal, minVotes, obligation) {
  const mainText = `*<@${proposal.proposedBy}>* wants to create a *special chore* ` +
    `worth *${proposal.metadata.value} points*:`;
  const obligationText = 'Creating this special chore will add ' +
    `*~${obligation.toFixed(0)} points* to everyone's requirement :bangbang:`;

  const blocks = [];
  blocks.push(common.blockSection(mainText));
  blocks.push(common.blockSection(`*${proposal.name}*`));

  if (proposal.metadata.description) {
    blocks.push(common.blockSection(proposal.metadata.description));
  }

  if (obligation > 0) {
    blocks.push(common.blockSection(obligationText));
  }

  blocks.push(common.blockSection(common.makeVoteText(minVotes, specialChoreProposalPollLength)));
  blocks.push(common.blockActions(common.makeVoteButtons(proposal.pollId, 1, 0)));
  return blocks;
};
