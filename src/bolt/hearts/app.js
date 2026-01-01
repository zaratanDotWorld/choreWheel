require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');

const { HEARTS_CONF } = require('../../constants');

const common = require('../common');

// Create the app

const APP_NAME = 'Hearts';

const scopes = [
  'channels:history',
  'channels:join',
  'channels:read',
  'chat:write',
  'commands',
  'groups:history',
  'groups:read',
  'users:read',
  'reactions:write',
];

const app = new App({
  logLevel: LogLevel.WARN,
  clientId: process.env.HEARTS_CLIENT_ID,
  clientSecret: process.env.HEARTS_CLIENT_SECRET,
  signingSecret: process.env.HEARTS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint(APP_NAME) ],
  installationStore: common.createInstallationStore(HEARTS_CONF, APP_NAME),
  installerOptions: { directInstall: true },
  scopes,
});

// Register event listeners
require('./handlers/events')(app);

// Register slash commands
require('./handlers/commands')(app);

// Register actions
require('./handlers/actions')(app);

// Launch the app

(async () => {
  const port = process.env.HEARTS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Hearts app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
