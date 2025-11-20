# CLAUDE.md - Nightscout CGM Remote Monitor

This document provides comprehensive guidance for AI assistants (like Claude) working on the Nightscout CGM Remote Monitor codebase. It covers architecture, conventions, workflows, and best practices.

**Last Updated:** 2025-11-18
**Nightscout Version:** 15.0.3
**Target Node Version:** 14.x or 16.x LTS

---

# ⚠️ KRITISCHE WARNUNG FÜR AI-ASSISTENTEN ⚠️

## **NIEMALS Änderungen im `/lib/` Verzeichnis vornehmen!**

### **NUR im `/nightscout-react/` Verzeichnis arbeiten!**

**Wichtige Informationen:**

- **`/lib/` Verzeichnis** = Altes Node.js/jQuery Frontend (Legacy Code) - **NICHT BEARBEITEN!**
- **`/nightscout-react/` Verzeichnis** = Neues React/TypeScript Frontend - **HIER ARBEITEN!**

**Alle Frontend-Änderungen, Chart-Anpassungen, UI-Verbesserungen müssen ausschließlich in `/nightscout-react/` erfolgen!**

**Für detaillierte Anweisungen zum React-Frontend siehe: `/nightscout-react/CLAUDE.md`**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Architecture & Key Concepts](#architecture--key-concepts)
4. [Development Workflows](#development-workflows)
5. [Code Conventions & Style Guide](#code-conventions--style-guide)
6. [Testing Guidelines](#testing-guidelines)
7. [Plugin Development](#plugin-development)
8. [Common Tasks](#common-tasks)
9. [Important Files Reference](#important-files-reference)
10. [Troubleshooting & Gotchas](#troubleshooting--gotchas)

---

## Project Overview

### What is Nightscout?

Nightscout is a web-based Continuous Glucose Monitor (CGM) system that allows multiple caregivers to remotely view a patient's glucose data in real-time. It's an open-source #WeAreNotWaiting project built by the diabetes community.

### Technology Stack

**Backend:**
- Node.js (v14 or v16 LTS)
- Express.js 4.17.1
- MongoDB 3.6+ or 4.x
- Socket.io ~4.5.4
- EJS templating

**Frontend:**
- Webpack 5 + Babel
- jQuery 3.5.1 + jQuery UI
- D3.js v5 + Flot (charts)
- Moment.js (date/time)

**Key Libraries:**
- Lodash (utilities)
- Helmet (security)
- shiro-trie (authorization)
- JWT (authentication)

### License

AGPL-3.0 - This is a strong copyleft license. Any modifications must be open-sourced.

---

## Codebase Structure

### Root Directory Layout

```
/cgm-remote-monitor/
├── lib/                    # Core application code
│   ├── server/            # Server initialization, routing, core services
│   ├── client/            # Client-side application
│   ├── plugins/           # Plugin implementations
│   ├── api/               # API v1 (original REST API)
│   ├── api2/              # API v2 (enhanced)
│   ├── api3/              # API v3 (modern RESTful)
│   ├── data/              # Data loading and processing
│   ├── storage/           # Database abstraction
│   ├── authorization/     # Auth system
│   ├── middleware/        # Express middleware
│   ├── report/            # Reporting functionality
│   ├── report_plugins/    # Report-specific plugins
│   ├── admin_plugins/     # Admin panel plugins
│   ├── profile/           # Treatment profile management
│   └── food/              # Food database
├── static/                # Static assets (CSS, JS, images, audio)
├── views/                 # EJS templates
├── bundle/                # Webpack entry points
├── tests/                 # Test suite
├── webpack/               # Build configuration
├── bin/                   # Utility scripts
├── docs/                  # Documentation
├── translations/          # i18n files
├── package.json           # Dependencies & scripts
├── .eslintrc.js          # ESLint configuration
├── .babelrc              # Babel configuration
├── Makefile              # Build & test tasks
└── README.md             # User documentation
```

### Key Directories Explained

#### `/lib/server/`
- `server.js` - Application entry point
- `app.js` - Express app configuration, routing, middleware
- `bootevent.js` - Boot sequence orchestration
- `websocket.js` - Socket.io real-time communication
- `cache.js` - In-memory data caching

#### `/lib/plugins/`
- `index.js` - Plugin registry and manager
- `pluginbase.js` - Base utilities for client plugins
- Individual plugin files (e.g., `iob.js`, `cob.js`, `careportal.js`)

#### `/lib/data/`
- `dataloader.js` - Orchestrates loading data from database
- `ddata.js` - In-memory data structure and processing

#### `/lib/api/`, `/lib/api2/`, `/lib/api3/`
- Three generations of REST APIs
- v1: Original API for entries, treatments, profiles
- v2: Enhanced with better configuration
- v3: Modern RESTful with Swagger docs

---

## Architecture & Key Concepts

### Boot Sequence (Modular Boot Events)

Nightscout uses a sophisticated boot event chain defined in `/lib/server/bootevent.js`:

1. **startBoot** - Initialize context (`ctx`), settings, event bus
2. **checkNodeVersion** - Verify Node.js compatibility
3. **checkEnv** - Validate environment variables
4. **augmentSettings** - Import external config (if `IMPORT_CONFIG` set)
5. **checkSettings** - Validate mandatory settings (MongoDB URI, API_SECRET)
6. **setupStorage** - Connect to MongoDB
7. **setupAuthorization** - Initialize auth system
8. **setupInternals** - Load plugins, middleware, data handlers
9. **ensureIndexes** - Create database indexes
10. **setupListeners** - Wire up event bus listeners
11. **setupConnect** - Initialize nightscout-connect bridge
12. **setupBridge/setupMMConnect** - Legacy bridges (deprecated)
13. **finishBoot** - Emit completion event

### Context Object (`ctx`)

The **context object** is the heart of Nightscout. It's created during boot and passed throughout the application:

```javascript
ctx = {
  store,              // Database connection
  plugins,            // Plugin registry
  ddata,              // Current data state (in-memory)
  bus,                // Event emitter
  notifications,      // Notification system
  authorization,      // Auth system
  entries,            // SGV entries collection
  treatments,         // Treatments collection
  devicestatus,       // Device status collection
  settings,           // Configuration
  language            // i18n
}
```

### Sandbox System

The **sandbox** (`/lib/sandbox.js`) provides isolated execution for plugins:

- Prevents plugins from interfering with each other
- Offers safe API to access data
- Two modes: `serverInit()` and `clientInit()`
- Wraps data with read-only snapshots

**Example:**
```javascript
// Inside a plugin's setProperties function
plugin.setProperties = function setProperties(sbx) {
  // sbx is the sandbox - provides safe access to data
  var treatments = sbx.data.treatments;
  var profile = sbx.data.profile;

  // Offer calculated property to other plugins
  sbx.offerProperty('iob', function() {
    return calculateIOB(treatments, profile);
  });
};
```

### Event Bus (`ctx.bus`)

Central event system for loose coupling:

**Key Events:**
- `tick` - Periodic heartbeat (default: 60s)
- `data-received` - New data uploaded
- `data-loaded` - Data fetched from database
- `data-processed` - Plugins finished processing
- `notification` - Alert/notification generated
- `teardown` - Shutdown signal

### Data Flow: Upload to Display

```
1. CGM Device/Uploader
   ↓
2. POST /api/v1/entries (or /api/v3/entries)
   ↓
3. Authentication & Authorization check
   ↓
4. MongoDB storage (entries collection)
   ↓
5. ctx.bus.emit('data-received')
   ↓
6. dataloader.update() - Fetch from DB
   ↓
7. Data merged with cache, sorted by time
   ↓
8. ctx.bus.emit('data-loaded')
   ↓
9. Sandbox created with data snapshot
   ↓
10. plugins.setProperties() - Calculate IOB, COB, etc.
    ↓
11. plugins.checkNotifications() - Generate alerts
    ↓
12. ctx.bus.emit('data-processed')
    ↓
13. WebSocket broadcast to clients
    ↓
14. Client receives via socket.io
    ↓
15. Client updates chart and UI
```

### Database Collections

**entries** - CGM readings
```javascript
{
  _id: "string",
  sgv: 120,              // Sensor Glucose Value (mg/dL)
  date: 1234567890000,   // Timestamp
  mills: 1234567890000,  // Normalized timestamp
  direction: "Flat",     // Trend arrow
  device: "dexcom",
  type: "sgv"
}
```

**treatments** - User-entered events
```javascript
{
  _id: "string",
  eventType: "Meal Bolus",
  insulin: 5.5,
  carbs: 45,
  created_at: "2023-01-01T12:00:00Z",
  mills: 1234567890000,
  notes: "Pizza"
}
```

**devicestatus** - Device information
```javascript
{
  _id: "string",
  device: "openaps://device-name",
  created_at: "2023-01-01T12:00:00Z",
  mills: 1234567890000,
  pump: { battery: 80, reservoir: 50 },
  openaps: { iob: 2.5 },
  uploader: { battery: 95 }
}
```

**profile** - Treatment profiles (basal rates, targets, etc.)

**food** - Custom food database

**activity** - Activity data

### Caching Strategy

- Server maintains in-memory cache (`/lib/server/cache.js`)
- Initial load: 2 days of entries, 2.5 days of treatments
- Incremental updates: Last 15 minutes
- Cache invalidation on `data-received` event
- Reduces database load significantly

---

## Development Workflows

### Initial Setup

1. **Clone repository:**
   ```bash
   git clone https://github.com/nightscout/cgm-remote-monitor.git
   cd cgm-remote-monitor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   **IMPORTANT:** Do NOT use root user for npm install!

3. **Setup MongoDB:**
   - Local: Install MongoDB 4.2 or 4.4
   - Cloud: Use MongoDB Atlas free tier

4. **Configure environment:**
   ```bash
   cp docs/example-template.env my.env
   # Edit my.env with your settings
   ```

   Minimal `my.env`:
   ```bash
   CUSTOMCONNSTR_mongo=mongodb://localhost:27017/nightscout
   API_SECRET=your-secret-min-12-chars
   INSECURE_USE_HTTP=true  # For local dev only
   NODE_ENV=development
   PORT=1337
   ```

### Running Development Server

**Standard development mode:**
```bash
npm run dev
```

This:
- Uses `my.env` configuration
- Starts server with nodemon (auto-restart on file changes)
- Enables webpack-dev-middleware (hot reload)
- Serves on `http://localhost:1337`

**Production mode (locally):**
```bash
npm run prod
```

Uses `my.prod.env` with `NODE_ENV=production`.

### Building for Production

**Bundle client assets:**
```bash
npm run bundle
# or
npm run bundle-dev  # Development mode
```

**Analyze bundle size:**
```bash
npm run bundle-analyzer
```

### Git Workflow

**Branching strategy (git-flow):**
- `master` - Production, stable releases only
- `dev` - Development branch (target for PRs)
- `wip/*` - Work-in-progress feature branches

**Creating a feature branch:**
```bash
git checkout dev
git pull origin dev
git checkout -b wip/my-feature-name
```

**Development cycle:**
1. Make changes on your branch
2. Test thoroughly (see Testing section)
3. Commit with descriptive messages
4. Push to your fork
5. Create PR targeting `dev` branch

### Package Scripts

From `package.json`:

```bash
npm start              # Production server
npm run dev            # Development server with nodemon
npm run prod           # Production mode locally
npm test               # Run test suite
npm run test-single    # Run single test (set TEST=filename)
npm run test-ci        # CI tests with coverage
npm run lint           # Run ESLint
npm run bundle         # Build production bundles
npm run bundle-dev     # Build development bundles
```

### Make Targets

From `Makefile`:

```bash
make test              # Run all tests
make test_onebyone     # Run tests individually
make coverage          # Generate coverage report
make ci_tests          # CI test suite
```

---

## Code Conventions & Style Guide

### JavaScript Style

**Indentation:** 2 spaces (NOT tabs)

**Quotes:** Single quotes preferred
```javascript
var message = 'Hello world';
```

**Comma-first style:**
```javascript
var data = {
  value: 'the value'
  , detail: 'the details...'
  , time: Date.now()
};
```

**Function spacing:**
```javascript
// Include space before parameters
function boom (name, callback) { }

// Name callback functions
boom('the name', function afterBoom (result) { });
```

**Variable declarations:**
```javascript
// Don't use const everywhere unnecessarily
// This codebase uses var extensively for historical reasons
var entries = [];
var currentSGV = 120;
```

### ESLint Configuration

Located in `.eslintrc.js`:

- Extends `eslint:recommended`
- Security plugin enabled (`plugin:security/recommended`)
- Parser: `babel-eslint`
- Environments: browser, node, mocha, jquery

**Running linter:**
```bash
npm run lint
# or
./node_modules/.bin/eslint lib
```

### File Organization

**Server-side code:**
- Place in `/lib/server/` or `/lib/plugins/` (for plugins)
- Export a function that takes `ctx` or `env` as parameter

**Client-side code:**
- Place in `/lib/client/` or client portion of plugin
- Use `clientInit()` for initialization

**Shared code:**
- Place in `/lib/` root for utilities
- Keep minimal dependencies

### Comments & Documentation

**Do:**
- Write clear, concise comments explaining WHY, not WHAT
- Document complex algorithms
- Add JSDoc for public APIs

**Don't:**
- Add author names in file headers (use git history)
- Over-comment obvious code
- Leave commented-out code (use git instead)

### Naming Conventions

**Variables:** camelCase
```javascript
var bloodGlucose = 120;
var insulinOnBoard = 2.5;
```

**Functions:** camelCase with descriptive names
```javascript
function calculateInsulinOnBoard (treatments, profile) { }
```

**Classes/Constructors:** PascalCase (rare in this codebase)
```javascript
function DataLoader (ctx) { }
```

**Constants:** UPPER_SNAKE_CASE
```javascript
var DEFAULT_TIMEOUT = 5000;
```

**Files:** lowercase with hyphens
- `my-plugin.js`
- `data-loader.js`

---

## Testing Guidelines

### Test Framework

- **Framework:** Mocha
- **Assertions:** Should.js
- **HTTP Testing:** Supertest
- **Coverage:** NYC (Istanbul)

### Test Location

All tests in `/tests/` directory:
```
tests/
├── api.entries.test.js
├── api.treatments.test.js
├── plugins.iob.test.js
└── ...
```

### Running Tests

**All tests:**
```bash
npm test
# or
make test
```

**Single test:**
```bash
export TEST=api.entries
npm run test-single
```

**With coverage:**
```bash
npm run test-ci
# or
make coverage
```

### Test Structure

**Example test file:**
```javascript
'use strict';

var should = require('should');

describe('My Feature', function () {
  var ctx = {};

  before(function (done) {
    // Setup
    done();
  });

  after(function (done) {
    // Cleanup
    done();
  });

  it('should do something', function (done) {
    // Test code
    var result = myFunction();
    result.should.equal(expected);
    done();
  });
});
```

### Testing with MongoDB

Tests use a separate test database:

**From `tests/ci.test.env`:**
```bash
CUSTOMCONNSTR_mongo=mongodb://127.0.0.1:27017/testdb
API_SECRET=abcdefghij123
```

**In test code:**
```javascript
var env = require('../env')();
var store = require('../lib/storage/mongo-storage')(env);

before(function (done) {
  store(function (err, db) {
    ctx.store = db;
    done();
  });
});
```

### Test Coverage Goals

- Aim for full test coverage of new features
- Cover edge cases and error conditions
- Test both success and failure paths
- Don't just add null checks - test root causes

### Bug Fix Testing

When fixing bugs:

1. Write a test that reproduces the bug
2. Verify the test fails without your fix
3. Implement the fix
4. Verify the test passes
5. Check for similar issues elsewhere

---

## Plugin Development

### Plugin Architecture

Plugins are the primary extension mechanism in Nightscout. They:
- Extend functionality without modifying core
- Have both server and client components
- Run in isolated sandboxes
- Communicate via properties and events

### Plugin File Structure

**Location:** `/lib/plugins/myplugin.js`

**Basic template:**
```javascript
'use strict';

function init (ctx) {
  var translate = ctx.language.translate;

  var myplugin = {
    name: 'myplugin'
    , label: 'My Plugin'
    , pluginType: 'pill-major'
  };

  // Server-side: Calculate values
  myplugin.setProperties = function setProperties (sbx) {
    sbx.offerProperty('myproperty', function () {
      // Calculate and return value
      return calculateMyValue(sbx.data);
    });
  };

  // Server-side: Generate notifications
  myplugin.checkNotifications = function checkNotifications (sbx) {
    var value = sbx.properties.myproperty;

    if (shouldAlert(value)) {
      sbx.notifications.requestNotify({
        level: ctx.notifications.levels.WARN
        , title: 'My Alert'
        , message: 'Something happened'
        , plugin: myplugin
      });
    }
  };

  // Client-side: Update visualization
  myplugin.updateVisualisation = function updateVisualisation (sbx) {
    var value = sbx.properties.myproperty;

    sbx.pluginBase.updatePillText(myplugin, {
      label: 'Label'
      , value: value
      , labelClass: 'info'
      , pillClass: 'warn'
    });
  };

  return myplugin;
}

module.exports = init;
```

### Plugin Types

**pluginType values:**
- `pill-major` - Large, prominent pill
- `pill-minor` - Smaller pill
- `pill-status` - Status indicator
- `bg-status` - Background status
- `report` - Reporting plugin

### Registering a Plugin

**In `/lib/plugins/index.js`:**

```javascript
// For server-side plugins
env.serverDefaultPlugins = [
  require('./delta')(env)
  , require('./direction')(env)
  , require('./myplugin')(env)  // Add here
];

// For client-side plugins
env.clientDefaultPlugins = [
  require('./delta')(env)
  , require('./direction')(env)
  , require('./myplugin')(env)  // Add here
];
```

### Extended Settings

Plugins can use environment variables for configuration:

**Format:** `PLUGINNAME_SETTING_NAME`

**Example:**
```bash
MYPLUGIN_ENABLE_ALERTS=true
MYPLUGIN_WARN_THRESHOLD=100
```

**Access in plugin:**
```javascript
myplugin.setProperties = function setProperties (sbx) {
  var settings = sbx.extendedSettings;
  var enableAlerts = settings.enableAlerts || false;
  var warnThreshold = settings.warnThreshold || 80;
};
```

### Sandbox API

**Data access:**
```javascript
sbx.data.entries      // CGM entries
sbx.data.treatments   // Treatments
sbx.data.profile      // Treatment profile
sbx.data.devicestatus // Device status
```

**Properties (calculated values from other plugins):**
```javascript
sbx.properties.iob    // Insulin on Board
sbx.properties.cob    // Carbs on Board
```

**Offering properties:**
```javascript
sbx.offerProperty('myvalue', function () {
  return calculate();
});
```

**Plugin utilities (client-side):**
```javascript
sbx.pluginBase.updatePillText(plugin, options);
sbx.pluginBase.addForecastPoints(points);
```

### Plugin Lifecycle

1. **Boot:** Plugin loaded and initialized with `ctx`
2. **Enable:** Plugin enabled based on `ENABLE`/`DISABLE` env vars
3. **Data Load:** New data triggers sandbox creation
4. **setProperties:** Calculate derived values (server)
5. **checkNotifications:** Evaluate alert conditions (server)
6. **updateVisualisation:** Update UI (client)

### Example: Simple IOB Plugin

```javascript
'use strict';

function init (ctx) {
  var iob = {
    name: 'iob'
    , label: 'Insulin-on-Board'
    , pluginType: 'pill-major'
  };

  iob.setProperties = function setProperties (sbx) {
    sbx.offerProperty('iob', function () {
      var treatments = sbx.data.treatments;
      var profile = sbx.data.profile;
      var now = sbx.time;

      // Calculate IOB from treatments
      var iob = 0;
      treatments.forEach(function (treatment) {
        if (treatment.insulin) {
          var dia = profile.dia || 3;
          var age = (now - treatment.mills) / 3600000; // hours
          if (age < dia) {
            // Simple linear decay
            iob += treatment.insulin * (1 - age / dia);
          }
        }
      });

      return {
        display: iob.toFixed(2)
        , iob: iob
      };
    });
  };

  iob.updateVisualisation = function updateVisualisation (sbx) {
    var prop = sbx.properties.iob;
    if (!prop) return;

    sbx.pluginBase.updatePillText(iob, {
      label: 'IOB'
      , value: prop.display + 'U'
    });
  };

  return iob;
}

module.exports = init;
```

---

## Common Tasks

### Adding a New Environment Variable

1. **Document in README.md:**
   ```markdown
   * `MY_NEW_VAR` (`default`) - Description of what it does
   ```

2. **Access in code:**
   ```javascript
   var myVar = env.MY_NEW_VAR || 'default';
   ```

3. **Update example template:**
   Add to `docs/example-template.env`

### Adding a New API Endpoint

**For API v3 (recommended):**

1. **Create in `/lib/api3/`:**
   ```javascript
   // /lib/api3/myendpoint.js
   function configure (app, ctx) {
     app.get('/api/v3/myendpoint', function (req, res) {
       res.json({ data: 'result' });
     });
   }

   module.exports = configure;
   ```

2. **Register in `/lib/api3/index.js`:**
   ```javascript
   require('./myendpoint')(app, ctx);
   ```

3. **Update Swagger docs:** `/lib/server/swagger.yaml`

### Modifying the Client UI

1. **Main client code:** `/lib/client/index.js`
2. **Renderer logic:** `/lib/client/renderer.js`
3. **Chart code:** `/lib/client/chart.js`
4. **Templates:** `/views/index.html`
5. **Styles:** `/static/css/main.css`

**Testing UI changes:**
```bash
npm run dev
# Open http://localhost:1337
# Changes auto-reload
```

### Adding a Database Index

**In boot sequence** (`/lib/server/bootevent.js` - `ensureIndexes` event):

```javascript
storage.pool.db.collection('entries')
  .createIndex({ 'mills': -1 }, { background: true });
```

### Adding a Translation

1. **Files located in:** `/translations/`
2. **Format:** JSON files like `en_US.json`, `de_DE.json`
3. **Structure:**
   ```json
   {
     "My Text": "Translated Text"
   }
   ```
4. **Use Crowdin:** https://crowdin.com/project/nightscout

**In code:**
```javascript
var translate = ctx.language.translate;
var text = translate('My Text');
```

---

## Important Files Reference

### Critical Files for Understanding Nightscout

| File | Purpose |
|------|---------|
| `/lib/server/server.js` | Application entry point |
| `/lib/server/bootevent.js` | Boot sequence orchestration |
| `/lib/server/app.js` | Express configuration and routing |
| `/lib/plugins/index.js` | Plugin registry |
| `/lib/sandbox.js` | Plugin isolation environment |
| `/lib/data/dataloader.js` | Data fetching and caching |
| `/lib/client/index.js` | Client-side initialization |
| `/lib/server/websocket.js` | Real-time updates |
| `/package.json` | Dependencies and scripts |
| `/webpack/webpack.config.js` | Build configuration |

### Configuration Files

| File | Purpose |
|------|---------|
| `.eslintrc.js` | Linting rules |
| `.babelrc` | Babel transpilation config |
| `.browserslistrc` | Browser compatibility targets |
| `Makefile` | Build and test targets |
| `docs/example-template.env` | Environment variable template |

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | User documentation |
| `CONTRIBUTING.md` | Contribution guidelines |
| `CLAUDE.md` | This file - AI assistant guide |
| `COPYRIGHT` | License information |

---

## Troubleshooting & Gotchas

### Common Issues

**1. Port already in use:**
```bash
Error: listen EADDRINUSE :::1337
```
Solution: Change PORT in `my.env` or kill process on port 1337

**2. MongoDB connection fails:**
```bash
Error: MongoNetworkError
```
Solution: Verify MongoDB is running and `CUSTOMCONNSTR_mongo` is correct

**3. Bundle not updating:**
Solution: Run `npm run bundle` manually or delete `node_modules/.cache`

**4. Webpack errors in dev mode:**
Solution: Ensure `NODE_ENV=development` in `my.env`

**5. Tests fail with "Cannot find module":**
Solution: Run `npm install` to ensure all dependencies are installed

### Important Gotchas

**Environment Variable Naming:**
- MongoDB connection uses `CUSTOMCONNSTR_mongo` (for Azure compatibility)
- NOT `MONGODB_URI` (though that's mentioned in README)
- Both are supported, but `CUSTOMCONNSTR_mongo` takes precedence

**API_SECRET Requirements:**
- Must be at least 12 characters
- Used for JWT signing
- Changed secret invalidates all existing tokens

**Date Handling:**
- All dates in ISO-8601 format
- Stored as `mills` (milliseconds since epoch)
- Timezone handling via treatment profile

**Plugin Loading Order:**
- Default plugins load first
- Then enabled plugins via `ENABLE`
- Order matters for property dependencies
- IOB should load before BWP (Bolus Wizard Preview)

**Cache Behavior:**
- In-memory cache can grow large
- Restart clears cache
- Cache invalidation on new data only

**Webpack Mode:**
- `NODE_ENV=development` enables hot reload
- `NODE_ENV=production` enables minification
- Different bundle outputs

**Testing Database:**
- Tests use separate database (typically `testdb`)
- Tests do NOT automatically clean up
- May need manual database cleanup

### Performance Considerations

**Database Queries:**
- Use indexes for all time-based queries
- Limit query results (default: 10 entries)
- Use `find().limit().sort()` pattern

**Client Bundle Size:**
- Current bundle is large (~2MB)
- Use code splitting for large features
- Consider lazy loading for admin features

**Socket.io Connections:**
- Each client = one socket connection
- Broadcasts can be expensive with many clients
- Consider throttling updates

**Memory Usage:**
- Server caches 2+ days of data in memory
- Each connected client increases memory
- Monitor with production deployments

### Security Considerations

**Authentication:**
- API_SECRET is the master key
- Support for role-based access (shiro-trie)
- JWT tokens for API access

**CSP (Content Security Policy):**
- Enabled by default (`SECURE_CSP`)
- May break some external integrations
- Configure via `app.js` if needed

**HTTPS:**
- Production should ALWAYS use HTTPS
- `INSECURE_USE_HTTP=true` only for development
- HSTS headers enabled by default

**Input Validation:**
- Validate all user inputs
- Sanitize before database storage
- Use DOMPurify for HTML content

### Best Practices

1. **Always develop on `dev` branch**, not `master`
2. **Test both server and client** changes
3. **Use sandbox** for plugin development
4. **Minimize dependencies** - justify new packages
5. **Document environment variables** in README
6. **Write tests** for new features
7. **Run linter** before committing (`npm run lint`)
8. **Check security** with `npm audit`
9. **Profile performance** for data-intensive features
10. **Consider backwards compatibility** - many users on old versions

---

## Additional Resources

**Official Documentation:**
- User Docs: https://nightscout.github.io/
- Old Docs: http://nightscout.info
- API Docs: https://YOUR-SITE.com/api-docs/

**Community:**
- Discord: https://discord.gg/rTKhrqz
- GitHub Issues: https://github.com/nightscout/cgm-remote-monitor/issues
- Contributing: See CONTRIBUTING.md

**Development:**
- Swagger API: Load your Nightscout site and visit `/api-docs/`
- Crowdin Translations: https://crowdin.com/project/nightscout
- Travis CI: https://travis-ci.org/nightscout/cgm-remote-monitor

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-18 | 1.0.0 | Initial comprehensive CLAUDE.md created |

---

**This document is maintained for AI assistants working on Nightscout. For end-user documentation, see README.md. For contributor guidelines, see CONTRIBUTING.md.**
