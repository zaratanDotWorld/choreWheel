const common = require('../../common');

const TITLE = common.blockPlaintext('Hearts');

// Slash commands

exports.heartsResetView = function () {
  const header = 'Reset hearts';
  const mainText = 'Reset hearts for the workspace. ' +
  'All hearts will be reset to 5.\n\n' +
  ':warning: *This action cannot be undone!* :warning:';

  const blocks = [];
  blocks.push(common.blockHeader(header));
  blocks.push(common.blockSection(mainText));

  return {
    type: 'modal',
    callback_id: 'hearts-reset-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};
