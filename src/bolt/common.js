
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
  const userInfo = await exports.getUser(app, oauth, command.user_id);
  if (userInfo.user.is_admin) {
    const houseId = command.team_id;
    const channelId = command.channel_id;

    await Admin.updateHouse({ slackId: houseId, [channelType]: channelId });
    await app.client.conversations.join({ token: oauth.bot.token, channel: channelId });

    const text = `App events channel set to *<#${channelId}>* :fire:`;
    await exports.replyEphemeral(app, oauth, command, text);
  } else {
    const text = 'Only admins can set the channels...';
    await exports.replyEphemeral(app, oauth, command, text);
  }
};

exports.syncWorkspace = async function (app, oauth, command) {
  const houseId = command.team_id;
  const now = new Date();

  const workspaceMembers = await app.client.users.list({ token: oauth.bot.token });
  for (const member of workspaceMembers.members) {
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
  const text = `Synced workspace with ${residents.length} active residents`;
  await exports.replyEphemeral(app, oauth, command, text);
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
