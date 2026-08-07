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
The dump contains Slack **OAuth bot tokens** from the installation store, so the script streams `pg_dump` straight into Neon and never writes a dump file to disk.

Run `scripts/migrate-db.sh` from the repo root:

```sh
SOURCE_URL=$(node -e "require('dotenv').config({quiet:true});process.stdout.write(process.env.PG_CONNECTION_PROD)") \
TARGET_URL=$(npx neonctl@latest connection-string --project-id noisy-poetry-20219969) \
./scripts/migrate-db.sh
```

`SOURCE_URL` is RDS (your `.env` `PG_CONNECTION_PROD`, while it still points at RDS); `TARGET_URL` is the Neon **direct** endpoint. Pass `-y` to skip the confirmation prompt on re-runs.

The script resets the target schema and restores in one transaction (a failed run leaves Neon untouched; re-runs are safe), then verifies source-vs-target row counts. It handles the three things that bite a manual copy: it checks `pg_dump` is ≥ 17; strips ownership/privileges (`--no-owner --no-privileges --no-acl`, since RDS's `postgres`/`mirror` roles don't exist on Neon); and restores into `neondb` regardless of the source db name.

## Step 2 — Verify parity

The dump carries the `knex_migrations` history, so a migration run against Neon should be a no-op.

```sh
NODE_ENV=production PG_CONNECTION_PROD="$NEON" npx knex migrate:latest
# expect: "Already up to date"
```

`scripts/migrate-db.sh` already compared every table's row counts; this step just confirms schema + migration-history parity via knex (the dump carries the `knex_migrations` history, so it should be a clean no-op).

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
