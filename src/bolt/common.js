
const { Admin, Hearts, Polls } = require('../core/index');
const { SLACKBOT } = require('../constants');

exports.homeEndpoint = function (appName) {
  return {
    path: '/',
    method: [ 'GET' ],
    handler: async (_, res) => {
      res.writeHead(200);
      res.end(`Welcome to Mirror - ${appName}!`);
    }
  };
};

exports.getUser = async function (app, oauth, userId) {
  return app.client.users.info({
    token: oauth.bot.token,
    user: userId
  });
};

exports.isAdmin = async function (app, oauth, command) {
  const { user } = await exports.getUser(app, oauth, command.user_id);
  return user.is_admin;
};

exports.replyEphemeral = async function (app, oauth, command, text) {
  return app.client.chat.postEphemeral({
    token: oauth.bot.token,
    channel: command.channel_id,
    user: command.user_id,
    text
  });
};

exports.postEphemeral = async function (app, oauth, channelId, residentId, text) {
  return app.client.chat.postEphemeral({
    token: oauth.bot.token,
    channel: channelId,
    user: residentId,
    text
  });
};

exports.postMessage = async function (app, oauth, channelId, text, blocks) {
  return app.client.chat.postMessage({
    token: oauth.bot.token,
    channel: channelId,
    text,
    blocks
  });
};

exports.publishHome = async function (app, oauth, residentId, view) {
  await app.client.views.publish({
    token: oauth.bot.token,
    user_id: residentId,
    view
  });
};

exports.openView = async function (app, oauth, triggerId, view) {
  return app.client.views.open({
    token: oauth.bot.token,
    trigger_id: triggerId,
    view
  });
};

exports.pushView = async function (app, oauth, triggerId, view) {
  return app.client.views.push({
    token: oauth.bot.token,
    trigger_id: triggerId,
    view
  });
};

exports.addReaction = async function (app, oauth, payload, emoji) {
  return app.client.reactions.add({
    token: oauth.bot.token,
    channel: payload.channel,
    timestamp: payload.event_ts,
    name: emoji
  });
};

exports.setChannel = async function (app, oauth, channelType, command) {
  let text;

  if (command.text === 'help') {
    text = 'Set the current channel as the log channel for the app. ' +
    'The app will use this channel to post polls or share public activity.';
  } else if (await exports.isAdmin(app, oauth, command)) {
    const [ houseId, channelId ] = [ command.team_id, command.channel_id ];
    await Admin.updateHouse({ slackId: houseId, [channelType]: channelId });
    await app.client.conversations.join({ token: oauth.bot.token, channel: channelId });
    text = `App events channel set to *<#${channelId}>* :fire:`;
  } else {
    text = ':warning: Only admins can set the channels...';
  }

  await exports.replyEphemeral(app, oauth, command, text);
};

exports.syncWorkspace = async function (app, oauth, command, syncMembers, syncChannels) {
  let text;

  if (command.text === 'help') {
    text = 'Sync the workspace to the current number of active members. ' +
    'This is important for ensuring the correct behavior of the app.';
  } else {
    text = 'Synced workspace with ';

    if (syncMembers) {
      const numResidents = await exports.syncWorkspaceMembers(app, oauth, command.team_id);
      text += `${numResidents} active residents`;
    }

    if (syncMembers & syncChannels) {
      text += ' and ';
    }

    if (syncChannels) {
      const numChannels = await exports.syncWorkspaceChannels(app, oauth);
      text += `${numChannels} public channels`;
    }
  }

  await exports.replyEphemeral(app, oauth, command, text);
};

exports.syncWorkspaceMembers = async function (app, oauth, houseId) {
  const now = new Date();

  const { members } = await app.client.users.list({ token: oauth.bot.token });
  for (const member of members) {
    if (!member.is_bot & member.id !== SLACKBOT) {
      if (member.deleted) {
        await Admin.deleteResident(houseId, member.id);
      } else {
        await Admin.addResident(houseId, member.id, now);
        await Hearts.initialiseResident(houseId, member.id, now);
      }
    }
  }

  const residents = await Admin.getResidents(houseId);
  return residents.length;
};

exports.syncWorkspaceChannels = async function (app, oauth) {
  const { channels: workspaceChannels } = await app.client.conversations.list({ token: oauth.bot.token, exclude_archived: true });
  const workspaceChannelIds = workspaceChannels.map(channel => channel.id);

  const { channels: botChannels } = await app.client.users.conversations({ token: oauth.bot.token });
  const botChannelIds = botChannels.map(channel => channel.id);

  for (const channelId of workspaceChannelIds) {
    if (!botChannelIds.includes(channelId)) {
      await app.client.conversations.join({ token: oauth.bot.token, channel: channelId });
    }
  }

  return workspaceChannels.length;
};

exports.updateVoteCounts = async function (app, oauth, body, action) {
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, body.user.id, new Date(), value);

  // Update the vote counts
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const blockIndex = body.message.blocks.length - 1; // Voting block is last
  body.message.token = oauth.bot.token;
  body.message.channel = body.channel.id;
  body.message.blocks[blockIndex].elements = exports.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);
  console.log(`Poll ${pollId} updated`);
};

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