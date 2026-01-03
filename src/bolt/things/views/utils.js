const common = require('../../common');

// Constants

exports.TITLE = common.blockPlaintext('Things');
exports.DOCS_URL = 'https://docs.chorewheel.zaratan.world/en/latest/tools/things.html';

// Formatting functions

exports.formatThing = function (thing) {
  if (thing.metadata) {
    return `${thing.name} (${thing.metadata.unit}) - $${thing.value}`;
  } else {
    return `${thing.name} (?) - $${thing.value}`;
  }
};

exports.formatTypedThing = function (thing) {
  return `${thing.type}: ${exports.formatThing(thing)}`;
};

exports.formatBuy = function (buy, url = true) {
  let text;

  if (buy.metadata && buy.metadata.special) {
    text = `Special: ${buy.metadata.title}`;
  } else if (buy.metadata && buy.thingMetadata) {
    text = `${buy.name} (${buy.metadata.quantity} x ${buy.thingMetadata.unit})`;
  } else {
    text = `${buy.name} (?)`;
  }

  if (url && buy.thingMetadata && buy.thingMetadata.url) {
    text = `<${buy.thingMetadata.url}|${text}>`;
  }

  text = `${text} - $${-buy.value}`;
  return text;
};

function getUrlHost (buy) {
  try {
    return (new URL(buy.thingMetadata.url)).host;
  } catch {
    return '';
  }
}

exports.urlCompare = function (a, b) {
  const hostA = getUrlHost(a);
  const hostB = getUrlHost(b);
  return hostA.localeCompare(hostB);
};

exports.mapThings = function (things) {
  return things.map((thing) => {
    return {
      value: JSON.stringify({ id: thing.id, type: thing.type, name: thing.name }),
      text: common.blockPlaintext(exports.formatTypedThing(thing)),
    };
  });
};
