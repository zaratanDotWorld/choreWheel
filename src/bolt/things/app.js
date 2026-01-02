require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');

const { Admin } = require('../../../core/index');
const common = require('../common');

const APP_NAME = 'Things';

const scopes = [
  'channels:history',
  'channels:join',
  'channels:read',
  'chat:write',
  'commands',
  'groups:history',
  'groups:read',
  'users:read',
];

// Create the app

const app = new App({
  logLevel: LogLevel.WARN,
  clientId: process.env.THINGS_CLIENT_ID,
  clientSecret: process.env.THINGS_CLIENT_SECRET,
  signingSecret: process.env.THINGS_SIGNING_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint(APP_NAME) ],
  installationStore: common.createInstallationStore(Admin.THINGS_CONF, APP_NAME),
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
  const port = process.env.THINGS_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Things app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
