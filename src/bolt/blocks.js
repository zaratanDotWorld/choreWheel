
// Chores Views

exports.choresListView = function (choreValues) {
  const mappedChoreValues = choreValues.map((choreClaim) => {
    return {
      value: `${choreClaim.name}.${choreClaim.value}`,
      text: { type: 'plain_text', text: choreClaim.name, emoji: true },
      description: { type: 'plain_text', text: `${choreClaim.value} points` }
    };
  });

  return {
    type: 'modal',
    callback_id: 'chores-list-callback',
    title: { type: 'plain_text', text: 'Chores', emoji: true },
    submit: { type: 'plain_text', text: 'Submit', emoji: true },
    close: { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      {
        type: 'input',
        label: { type: 'plain_text', text: 'Claim a chore', emoji: true },
        element: { type: 'radio_buttons', action_id: 'options', options: mappedChoreValues }
      }
    ]
  };
}

exports.getChoreClaim = function (view) {
  // https://api.slack.com/reference/interaction-payloads/views#view_submission_fields
  const choreClaimIndex = view.state.values.input.options.selected_option.value;
  const choreClaim = view.blocks[0].element.options[parseInt(choreClaimIndex)];

  return {
    name: choreClaim.text.text,
    value: parseInt(choreClaim.description.text)
  };
}

exports.choreListCallbackView = function (residentId, choreName, choreValue, pollDuration) {
  const textA = `*<@${residentId}>* did *${choreName}* for *${choreValue} tokens* :sparkles::sparkles:`;
  const textB = `React :+1: to endorse or :-1: to challenge, voting closes in ${pollDuration / 1000 / 60 / 60} hours`;

  return [
      { type: 'section', text: { type: 'mrkdwn', text: textA } },
      { type: 'section', text: { type: 'mrkdwn', text: textB } },
      { type: 'actions', elements: exports.makeVoteButtons(1, 0) }
    ]
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
  ]
}
