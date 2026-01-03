const common = require('../../common');

// Constants

exports.TITLE = common.blockPlaintext('Hearts');
exports.DOCS_URL = 'https://docs.chorewheel.zaratan.world/en/latest/tools/hearts.html';

// Formatting functions

exports.heartEmoji = function (numHearts) {
  let emoji;
  if (numHearts <= 0) {
    emoji = ':skull_and_crossbones:';
  } else if (numHearts <= 2) {
    emoji = ':broken_heart:';
  } else if (numHearts <= 5) {
    emoji = ':heart:';
  } else {
    emoji = ':heart_on_fire:';
  }

  let text = emoji.repeat(Math.max(1, Math.floor(numHearts)));
  text += (numHearts % 1 > 0) ? ':heavy_plus_sign:' : '';
  return text;
};
