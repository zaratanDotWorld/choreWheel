# ChoreWheel

Cooperative household management system deployed as Slack apps.
Three apps (Chores, Hearts, Things) handle chore tracking, social accountability, and shared purchasing.

## Tech Stack

- **Runtime:** Node 22, pnpm
- **Framework:** Slack Bolt (`@slack/bolt`)
- **Database:** PostgreSQL via Knex (migrations in `migrations/`)
- **Testing:** Mocha + Chai (with `chai-almost` for floating-point comparisons)
- **Linting:** ESLint with `semistandard` base config
- **Config:** `knexfile.js` reads `PG_CONNECTION_{DEV,TEST,PROD}` from `.env`

## Project Structure

```
src/
  core/           # Business logic (chores, hearts, things, polls, admin)
  lib/            # Standalone libraries (power.js = PowerRanker)
  bolt/           # Slack app layer (handlers, views, commands per app)
    chores/
    hearts/
    things/
    common.js     # Shared Slack utilities
  time.js         # Time constants and helpers
test/             # One test file per core module
migrations/       # Knex migrations
research/         # Standalone analysis scripts (not imported by production code)
```

## Commands

- `pnpm test` — full test suite (runs migration rollback/setup via `pretest`)
- `pnpm run lint` — lint the entire repo
- `pnpm run app:chores` / `app:things` / `app:hearts` — run individual Slack apps

## Testing

- Pre-commit hook runs `npx eslint .` on the entire repo, including `research/`.
- Tests use `test/helpers.js` for setup utilities (`generateSlackId`, `resetDb`).
- Each test file manages its own `beforeEach`/`afterEach` lifecycle with `resetDb`.
- When updating algorithm parameters that change numeric outputs, use a standalone `node -e` script to compute all new expected values at once.

## Style Conventions

- `semistandard`: semicolons required, single quotes, 140 char max line length.
- Array bracket spacing: `[ item1, item2 ]` (spaces inside brackets).
- Arrow parens required for block bodies: `(x) => { ... }` but `x => x + 1`.
- `exports.functionName = function (...)` pattern for module exports (not arrow functions).
- NatSpec-style `///` doc comments on public functions in core modules.
- Core modules use `assert()` for precondition checks.

## Architecture Notes

- `PowerRanker` (`src/lib/power.js`) is the ranking engine.
  Algorithm options (like pseudocount `k`) are passed via the constructor `options` parameter.
- Core modules (`src/core/`) are the business logic layer — no Slack dependencies.
- Bolt layer (`src/bolt/`) handles Slack interactions, delegates to core modules.
- `Admin.getNumResidents(houseId, now)` is the standard way to get active resident count.
- Chore preferences are stored normalized (alpha < beta by ID).
  `normalizeChorePreference` and `orientChorePreference` handle the conversion.

## Code Change Patterns

- When changing algorithm behavior, make changes in dependency order: library → business logic → tests.
- Database schema changes go through Knex migrations.

## R&D Best Practices

- **Use real data to evaluate ideas.**
  The `research/` directory contains CSV exports of production preferences and standalone analysis scripts.
  Every proposed algorithm change should be evaluated against these datasets before committing.
  Theoretical arguments alone are insufficient — compare alpha ratios, rank orderings, and spread across multiple houses.

- **Compute expected test values in bulk.**
  When an algorithm change affects numeric outputs, write a standalone `node -e` script that computes all new expected values at once, rather than iterating test-by-test.

- **Verify against the right baseline.**
  When comparing new vs old behavior, implement both the old and new algorithms in the same script to ensure apples-to-apples comparison.
  The `research/compare-rankings.js` script is a good template for this.

- **Simple models beat clever ones.**
  The pseudocount approach replaced sigmoid damping, implicit bidirectional preferences, and per-preference subtraction with a single uniform prior.
  When exploring alternatives, favor the approach that simplifies the code path while preserving the desired behavior.
