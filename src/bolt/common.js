const Admin = require('../modules/admin');
const Hearts = require('../modules/hearts');
const Polls = require('../modules/polls');

const { SLACKBOT } = require('../constants');
const views = require('./views');

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

exports.postEphemeral = async function (app, oauth, command, text) {
  return app.client.chat.postEphemeral({
    token: oauth.bot.token,
    channel: command.channel_id,
    user: command.user_id,
    text
  });
};

exports.postEphemeralDirect = async function (app, oauth, residentId, text) {
  return app.client.chat.postEphemeral({
    token: oauth.bot.token,
    channel: residentId,
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

exports.addReaction = async function (app, oauth, payload, emoji) {
  return app.client.reactions.add({
    token: oauth.bot.token,
    channel: payload.channel,
    timestamp: payload.event_ts,
    name: emoji
  });
};

exports.setChannel = async function (app, oauth, channelType, command) {
  const channelName = command.text;
  const houseId = command.team_id;

  const userInfo = await exports.getUser(app, oauth, command.user_id);
  if (userInfo.user.is_admin) {
    // TODO: return a friendly error if the channel doesn't exist
    const res = await app.client.conversations.list({ token: oauth.bot.token });
    const channelId = res.channels.filter(channel => channel.name === channelName)[0].id;
    await Admin.updateHouse({ slackId: houseId, [channelType]: channelId });

    const text = `${channelType} set to ${channelName} :fire:\n` +
      'Please add the bot to the channel';
    await exports.postEphemeral(app, oauth, command, text);
    console.log(`Set ${channelType} to ${channelName}`);
  } else {
    const text = 'Only admins can set the channels...';
    await exports.postEphemeral(app, oauth, command, text);
  }
};

exports.syncWorkspace = async function (app, oauth, command) {
  const houseId = command.team_id;
  const residentId = command.user_id;
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
  await exports.postEphemeralDirect(app, oauth, residentId, text);
};

exports.updateVoteCounts = async function (app, oauth, body, action) {
  const [ pollId, value ] = action.value.split('|');
  await Polls.submitVote(pollId, body.user.id, new Date(), value);

  // Update the vote counts
  const { yays, nays } = await Polls.getPollResultCounts(pollId);
  const blockIndex = body.message.blocks.length - 1; // Voting block is last
  body.message.token = oauth.bot.token;
  body.message.channel = body.channel.id;
  body.message.blocks[blockIndex].elements = views.makeVoteButtons(pollId, yays, nays);

  await app.client.chat.update(body.message);
  console.log(`Poll ${pollId} updated`);
};
