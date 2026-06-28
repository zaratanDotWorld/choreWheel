# AWS → Render + Neon migration

Operational runbook for moving ChoreWheel off AWS (EC2 + ALB + RDS) onto Render (compute) and Neon (Postgres).
Master plan and rationale: [issue #332](https://github.com/zaratanDotWorld/choreWheel/issues/332).
Delete this file once cutover is complete and AWS is decommissioned.

## Sequence

- [x] **Blueprint + cleanup** (PR #335): `render.yaml`, `process.env.PORT` binding, drop New Relic + `.deploy/`.
- [ ] **Neon data load** (Steps 1–2): copy RDS → Neon **before** Render goes up.
  The chores service's preDeploy runs `migrate:latest` on first deploy; against an empty Neon that would build the schema and then collide with the full restore — so populate Neon first and the migrate cleanly no-ops.
- [ ] **Render services live** (Step 3): set secrets, deploy, smoke-test on `*.onrender.com` against the **dev** Slack apps.
- [ ] **DNS cutover** (Step 4): final fresh re-sync (RDS → Neon, low-activity window), then repoint DNS / attach custom domains (Slack manifests unchanged).
- [ ] **Decommission**: tear down ALB / NAT / EC2 / RDS, update `CLAUDE.md`, close #324.

## Neon project

- Project `ChoreWheel` (`noisy-poetry-20219969`), org Zaratan, region `aws-us-west-2` — same region as RDS.
- Default branch `production`, database `neondb`, role `neondb_owner`.
- Authenticate as `krono@zaratan.world`: `npx neonctl@latest auth`.
- Fetch connection strings (never hardcode — they carry the password):
  - **Direct** (restore + migrations): `npx neonctl@latest connection-string --project-id noisy-poetry-20219969`
  - **Pooled** (app / `PG_CONNECTION_PROD`): `npx neonctl@latest connection-string --project-id noisy-poetry-20219969 --pooled`

## Step 1 — Copy data (RDS `mirror` → Neon `neondb`)

Run this twice: now, to populate Neon so the preDeploy migrate no-ops and Render can be smoke-tested against real data; and again at cutover (Step 4) to capture writes since.
The dump contains Slack **OAuth bot tokens** from the installation store.
Treat any dump file as a secret; prefer the direct pipe (Option B), which persists nothing to disk.
Three gotchas bite every RDS → Neon dump:

1. **Client version ≥ 17.** `pg_dump` must be at least the server version (RDS is 17.7). Local Homebrew tooling is 18.4, which is fine. In pgAdmin, if it errors on version, point *Preferences → Paths → Binary paths* at `/opt/homebrew/bin`.
2. **Strip ownership/privileges.** RDS objects are owned by `postgres`/`mirror`, roles that don't exist on Neon. Restoring them as-is fails. Use `--no-owner --no-privileges` (CLI) or check "Do not save → Owner" and "Privileges" in pgAdmin's Backup *and* Restore dialogs.
3. **Database names differ.** Dump from `mirror`, restore into `neondb`.

### Option A — pgAdmin (GUI)

Register the Neon server (host from the direct connection string, port `5432`, database `neondb`, user `neondb_owner`, **SSL mode: Require**).
Backup: right-click RDS `mirror` → *Backup…* → Format **Custom** → set the Owner/Privileges options → save `mirror.dump`.
Restore: right-click Neon `neondb` → *Restore…* → Format **Custom** → select `mirror.dump` → same Owner/Privileges options.

### Option B — CLI (direct pipe, nothing written to disk)

```sh
# RDS source: PG_CONNECTION_PROD from .env (read-only). NEON: the direct connection string.
RDS=$(node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.PG_CONNECTION_PROD)")
NEON='postgresql://neondb_owner:...@ep-...us-west-2.aws.neon.tech/neondb?sslmode=require'

PGSSLMODE=require pg_dump "$RDS" --no-owner --no-privileges --no-acl \
  | psql "$NEON" -v ON_ERROR_STOP=1
```

## Step 2 — Verify parity

The dump carries the `knex_migrations` history, so a migration run against Neon should be a no-op.

```sh
NODE_ENV=production PG_CONNECTION_PROD="$NEON" npx knex migrate:latest
# expect: "Already up to date"
```

Spot-check row counts against RDS for the core tables (e.g. `chore_claims`, `hearts`, `things`, and the installation/OAuth table) and confirm all expected tables are present.

## Step 3 — Wire the app

Set two Neon connection strings in the Render `chorewheel-shared` env group (and local `.env` for testing):

- `PG_CONNECTION_PROD` → the Neon **pooled** string (`-pooler` host). The app runtime uses this.
- `PG_CONNECTION_PROD_DIRECT` → the Neon **direct/unpooled** string. Migrations use this.

Migrations run automatically: the chores service's `preDeployCommand` (in `render.yaml`) runs `knex migrate:latest` against the direct endpoint before each deploy goes live. Only chores migrates, so the three services don't race on the migration lock. Never point migrations at the pooled endpoint — PgBouncer transaction mode breaks DDL/session operations.

- **SSL gotcha to verify:** Neon strings carry `sslmode=require&channel_binding=require`, while `knexfile.js` passes `ssl: { rejectUnauthorized: false }`. node-postgres normally connects fine, but if a SASL/channel-binding error appears, drop `channel_binding=require` from the string. Confirm with a real connection before relying on it.

## Step 4 — Cutover & rollback

- Smoke-test on `*.onrender.com` against the **dev** Slack apps before touching prod DNS.
- `pg_dump` is a point-in-time snapshot: do the final dump/restore in a low-activity window close to cutover, or accept the few minutes of RDS writes that land after the snapshot.
- Cutover is a DNS repoint / custom-domain attach — the Slack manifests' URLs stay identical, so no re-install.
- **Rollback:** point `PG_CONNECTION_PROD` back at RDS and revert DNS. Keep RDS + EC2 alive (EC2 stopped, not terminated) for ~2 weeks as insurance.
