require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const { App, LogLevel } = require('@slack/bolt');
const cron = require('node-cron');

const { CHORES_CONF } = require('../../constants');

const common = require('../common');
const { pingChores } = require('./handlers/common');

// Create the app

const app = new App({
  logLevel: LogLevel.WARN,
  signingSecret: process.env.CHORES_SIGNING_SECRET,
  clientId: process.env.CHORES_CLIENT_ID,
  clientSecret: process.env.CHORES_CLIENT_SECRET,
  stateSecret: process.env.STATE_SECRET,
  customRoutes: [ common.homeEndpoint('Chores') ],
  scopes: [
    'channels:history',
    'channels:join',
    'channels:read',
    'chat:write',
    'commands',
    'groups:history',
    'groups:read',
    'users:read',
  ],
  installationStore: common.createInstallationStore('chores', CHORES_CONF),
  installerOptions: { directInstall: true },
});

// Register event listeners
require('./handlers/events')(app);

// Register slash commands
require('./handlers/commands')(app);

// Register actions
require('./handlers/actions')(app);

// Schedule cron jobs
// Run every day at 12:00 UTC
cron.schedule('0 12 * * *', async () => {
  console.log('Pinging chores...');
  await pingChores(app);
});

// Launch the app

(async () => {
  const port = process.env.CHORES_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Chores app is running on port ${port} in the ${process.env.NODE_ENV} environment`);
})();

// Fin
