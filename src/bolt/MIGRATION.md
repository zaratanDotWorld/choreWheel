# Bolt App Migration Strategy

This document outlines the strategy for refactoring large Slack Bolt apps into a modular structure.

## Problem

Single-file apps become difficult to maintain as they grow:
- `chores.app.js` was 830 lines with 8+ workflows
- `chores.views.js` was 988 lines with 20+ view functions
- Hard to navigate and understand specific features

## Solution

Split apps into modular directories with separated handlers and view functions for clean dependency management.

## Target Structure

```
src/bolt/{app}/
├── app.js                 # App initialization, registration, & cron schedules
├── handlers/
│   ├── common.js          # Module state, business logic helpers, & cron functions
│   ├── events.js          # All event handlers
│   ├── commands.js        # All command handlers
│   └── actions.js         # All action handlers
└── views/
    ├── common.js          # Formatting & mapping functions
    ├── events.js          # All event view functions
    ├── commands.js        # All command view functions
    └── actions.js         # All action view functions
```

## Migration Steps

### 1. Create Directory Structure

```bash
mkdir -p src/bolt/{app}
mkdir -p src/bolt/{app}/handlers
mkdir -p src/bolt/{app}/views
```

### 2. Create Handler Helpers

Create `handlers/common.js` with business logic helpers and cron functions:

```javascript
const { Admin } = require('../../../core/index');
const common = require('../../common');

// Business logic helpers
exports.postMessage = async function (app, config, text, blocks) {
  return common.postMessage(app, config.oauth, config.channel, text, blocks);
};

exports.postEphemeral = async function (app, config, residentId, text) {
  return common.postEphemeral(app, config.oauth, config.channel, residentId, text);
};

// Cron functions
exports.scheduledTask = async function (app) {
  const now = new Date();
  // Scheduled task logic
};
```

### 2a. Create View Helpers

Create `views/common.js` with formatting and mapping functions:

```javascript
// Formatting functions
exports.formatData = function (data) {
  // Format data for display
  return `*${data.name}* - ${data.value}`;
};

exports.getEmoji = function (value) {
  if (value >= 100) {
    return ':sparkles:';
  } else if (value >= 50) {
    return ':fire:';
  } else {
    return '';
  }
};

// Mapping functions
exports.mapItems = function (items) {
  return items.map(item => ({
    value: JSON.stringify({ id: item.id }),
    text: common.blockPlaintext(item.name),
  }));
};
```

### 3. Create App File

Create `app.js` to initialize and register everything:

```javascript
// src/bolt/{app}/app.js

require('dotenv').config();

const cron = require('node-cron');

const { App, LogLevel } = require('@slack/bolt');

const { APP_CONF } = require('../../constants');

const common = require('../common');
const { scheduledTask } = require('./handlers/common');

const APP_NAME = 'AppName';

const app = new App({
  // .. other setup
  logLevel: LogLevel.WARN,
  customRoutes: [ common.homeEndpoint(APP_NAME) ],
  installationStore: common.createInstallationStore(APP_CONF, APP_NAME),
  scopes: [
    'channels:read',
    'chat:write',
    'commands',
    // ... other scopes
  ],
});

// Register event listeners
require('./handlers/events')(app);

// Register slash commands
require('./handlers/commands')(app);

// Register actions
require('./handlers/actions')(app);

// Schedule cron jobs
cron.schedule('0 12 * * *', async () => {
  console.log('Running scheduled task...');
  await scheduledTask(app);
});

// Launch the app
(async () => {
  const port = process.env.APP_PORT || 3000;
  await app.start(port);
  console.log(`⚡️ ${APP_NAME} app is running on port ${port}`);
})();
```

### 4a. Create Consolidated Event Handlers

Create `handlers/events.js` containing all event listeners:

```javascript
// src/bolt/{app}/handlers/events.js

const { Admin } = require('../../../core/index');

const common = require('../../common');

const { postMessage } = require('./common');
const { homeView } = require('../views/events');

module.exports = (app) => {
  // App uninstalled
  app.event('app_uninstalled', async ({ context }) => {
    await common.uninstallApp(app, '{app}', context);
  });

  // User change
  app.event('user_change', async ({ payload }) => {
    const now = new Date();
    const { user } = payload;
    // Event logic
  });

  // App home opened
  app.event('app_home_opened', async ({ body, event }) => {
    if (event.tab !== 'home') { return; }

    const { now, houseId, residentId } = common.beginHome('{app}', body, event);
    const { appConf } = await Admin.getHouse(houseId);

    const view = homeView();
    await common.publishHome(app, appConf.oauth, residentId, view);

    // Additional bookkeeping after view is published
  });
};
```

### 4b. Create Consolidated Command Handlers

Create `handlers/commands.js` containing all slash commands and their callbacks:

```javascript
// src/bolt/{app}/handlers/commands.js

const { Admin } = require('../../../core/index');

const common = require('../../common');

const { postMessage } = require('./common');
const { simpleView, complexView } = require('../views/commands');

module.exports = (app) => {
  // Simple command (no UI)
  app.command('/app-simple', async ({ ack, command, respond }) => {
    await ack();

    const commandName = '/app-simple';
    common.beginCommand(commandName, command);

    // Command logic
    await respond({ response_type: 'ephemeral', text: 'Done!' });
  });

  // Complex command (with modal)
  app.command('/app-complex', async ({ ack, command }) => {
    await ack();

    const commandName = '/app-complex';
    const { houseId } = common.beginCommand(commandName, command);
    const { appConf } = await Admin.getHouse(houseId);

    const view = complexView();
    await common.openView(app, appConf.oauth, command.trigger_id, view);
  });

  // Complex command callback
  app.view('complex-callback', async ({ ack, body }) => {
    await ack();
    // Handle the callback
  });
};
```

### 4c. Create Consolidated Action Handlers

Create `handlers/actions.js` containing all workflows (onboard, claim, vote, etc.):

```javascript
// src/bolt/{app}/handlers/actions.js

const { Admin } = require('../../../core/index');

const common = require('../../common');

const { postMessage } = require('./common');
const { onboardView, claimView, voteView } = require('../views/actions');

module.exports = (app) => {
  // Onboard flow
  app.action('onboard-action', async ({ ack, body }) => {
    await ack();
    // ...
  });

  app.view('onboard-callback', async ({ ack, body }) => {
    await ack();
    // ...
  });

  // Claim flow
  app.action('claim-action', async ({ ack, body }) => {
    await ack();
    // ...
  });

  app.view('claim-callback', async ({ ack, body }) => {
    await ack();
    // ...
  });

  // Vote flow
  app.action('vote-action', async ({ ack, body }) => {
    await ack();
    // ...
  });

  app.view('vote-callback', async ({ ack, body }) => {
    await ack();
    // ...
  });
};
```

### 5. Create Consolidated View Files

Create three view files that consolidate all view functions by type:

**Event views:**
```javascript
// src/bolt/{app}/views/events.js

const common = require('../../common');

exports.homeView = function () {
  const blocks = [];
  // ...
  return {
    type: 'home',
    blocks,
  };
};
```

**Command views:**
```javascript
// src/bolt/{app}/views/commands.js

const common = require('../../common');
const { formatData } = require('./common');

const TITLE = common.blockPlaintext('App Name');

exports.statsView = function (data) {
  const blocks = [];
  blocks.push(common.blockSection(formatData(data)));
  // ...
  return {
    type: 'modal',
    title: TITLE,
    close: common.CLOSE,
    blocks,
  };
};

exports.activateView = function (data) {
  const blocks = [];
  // ...
  return {
    type: 'modal',
    callback_id: 'activate-callback',
    title: TITLE,
    close: common.CLOSE,
    submit: common.SUBMIT,
    blocks,
  };
};
```

**Action views:**
```javascript
// src/bolt/{app}/views/actions.js

const common = require('../../common');
const { formatData, getEmoji, mapItems } = require('./common');

const TITLE = common.blockPlaintext('App Name');

exports.onboardView = function () {
  const blocks = [];
  // ...
  return {
    type: 'modal',
    callback_id: 'onboard-callback',
    title: TITLE,
    blocks,
  };
};

exports.claimView = function (items, value) {
  const emoji = getEmoji(value);
  const blocks = [];
  blocks.push(common.blockSection(`Claim complete ${emoji}`));
  blocks.push(common.blockInput(
    'Choose an item',
    {
      action_id: 'item',
      type: 'static_select',
      options: mapItems(items),
    },
  ));
  // ...
  return {
    type: 'modal',
    callback_id: 'claim-callback',
    title: TITLE,
    blocks,
  };
};
```

### 6. Update Entry Point

Simplify the original app file:

```javascript
// src/bolt/{app}.app.js

// Entry point for {app} app - implementation is in ./{app}/
require('./{app}/app');
```

### 7. Verify

```bash
node src/bolt/{app}.app.js
```

## Key Principles

1. **Separation of Concerns**: Keep handlers separate from view functions to avoid mixing business logic dependencies with UI dependencies
2. **Parallel Structure**: Both handlers/ and views/ are organized by type with matching file names (events.js, commands.js, actions.js, common.js)
3. **Domain-Specific Helpers**: Business logic helpers live in `handlers/common.js`, view/formatting helpers live in `views/common.js`
4. **Database-Driven Configuration**: Fetch configuration from the database in each handler using `Admin.getHouse(houseId)` to avoid race conditions with concurrent teams
5. **Configuration Passing**: Pass config objects to helper functions rather than storing them in module state
6. **Commands vs Actions**: Keep slash commands (user-facing, typed) separate from UI actions (button/modal-triggered workflows)
7. **Cron Functions**: Cron job implementations in `handlers/common.js`, schedules in main `app.js`
8. **Consolidated Files**: Eight total files (4 handler files + 4 view files) make navigation easy while maintaining clear separation of concerns
9. **Individual Exports**: Use `exports.functionName` pattern for all functions instead of `module.exports = {}` for consistency with `bolt/common.js`

## File Size Guidelines

After migration:
- handlers/common.js: ~40-50 lines (business logic helpers, cron functions)
- handlers/events.js: ~100-150 lines (all event handlers)
- handlers/commands.js: ~150-200 lines (all command handlers + callbacks)
- handlers/actions.js: ~550-600 lines (all action workflows)
- views/common.js: ~80-100 lines (formatting & mapping functions)
- views/events.js: ~60-80 lines (all event view functions)
- views/commands.js: ~110-120 lines (all command view functions)
- views/actions.js: ~750-800 lines (all action view functions)
- app.js: ~75-85 lines (app setup + registration + cron schedules)

## Advanced: Workflow-Based Actions Organization

For apps with many action workflows (8+), you may optionally split actions into individual workflow files while keeping events and commands consolidated.
This is an advanced optimization that can be applied after the initial migration if `handlers/actions.js` or `views/actions.js` become too large.

### When to Consider

Split actions into workflows when:
- `handlers/actions.js` exceeds 500 lines
- `views/actions.js` exceeds 700 lines
- You have 8+ distinct action workflows
- You find the actions file harder to navigate than events/commands

### Structure

```
src/bolt/{app}/
├── handlers/
│   ├── actions/           # Split into workflows
│       ├── onboard.js
│       ├── claim.js
│       ├── rank.js
│       └── ...
└── views/
    └── actions/           # Split into workflows
        ├── onboard.js
        ├── claim.js
        ├── rank.js
        └── ...
```

### Benefits

- Each workflow file: 50-220 lines (very readable)
- Easy navigation: one workflow = one file pair
- Clear boundaries and self-contained code

See the [Chores app](src/bolt/chores) for a real-world example (594-line handlers/actions.js and 797-line views/actions.js split into 15 workflow files averaging ~93 lines each).

## Benefits

- **Maintainability**: Easy to find and modify specific workflows or views
- **Clean Dependencies**: Business logic imports separated from UI imports through domain-specific common.js files
- **Clarity**: Handlers focus on flow logic, views focus on UI structure
- **Scalability**: Simple to add new workflows without bloating existing files
- **Domain Alignment**: Helpers are organized by their domain (business logic vs. presentation), making it clear where each function belongs
