# Operations

## Startup order

1. PostgreSQL becomes healthy.
2. Gatehouse acquires a PostgreSQL advisory lock and applies pending migrations.
3. Safe runtime configuration defaults are inserted idempotently.
4. Optional administrator and default-application bootstrap runs idempotently.
5. Audit retention cleanup runs at startup and every 24 hours.
6. `/api/ready` becomes healthy after PostgreSQL is reachable.

Set `RUN_MIGRATIONS=false` when migrations are performed by a separate release job.

## Backups

Gatehouse stores identities and application policy in PostgreSQL. Back up the complete database so related records stay consistent.

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --file=gatehouse-$(date +%F).dump \
  "$DATABASE_URL"
```

Restore into an empty database:

```bash
createdb gatehouse_restore
pg_restore \
  --no-owner \
  --clean --if-exists \
  --dbname=gatehouse_restore \
  gatehouse-YYYY-MM-DD.dump
```

Validate a restore before relying on it:

```bash
DATABASE_URL=postgresql://... bun run --cwd server db:migrate
psql "$DATABASE_URL" -c 'select count(*) from "user";'
psql "$DATABASE_URL" -c 'select count(*) from applications;'
psql "$DATABASE_URL" -c 'select count(*) from audit_events;'
```

Do not restore one group of tables without the others. Sessions, accounts, passkeys, API keys, policies, users, and audit events contain cross-domain references.

## Secrets

Keep these outside PostgreSQL and source control:

- `BETTER_AUTH_SECRET`
- OAuth client secrets
- Turnstile secret
- mail webhook token
- PostgreSQL password
- initial administrator password

Changing `BETTER_AUTH_SECRET` is a credential rotation. Expect existing signed state to stop validating, and verify login, password reset, OAuth callbacks, and 2FA afterward.

The browser receives only capability booleans and runtime settings. Provider and delivery secrets are never returned by `/api/admin/config`.

## Email delivery

In production, configure `MAIL_WEBHOOK_URL`. Gatehouse sends a JSON POST containing:

```json
{
  "from": "Gatehouse <noreply@example.com>",
  "kind": "verification",
  "to": "user@example.com",
  "subject": "Gatehouse: verify your email",
  "text": "...",
  "html": "...",
  "metadata": {}
}
```

When `MAIL_WEBHOOK_TOKEN` is set, the request includes `Authorization: Bearer <token>`. The request has a ten-second timeout and non-2xx responses fail the authentication operation instead of pretending delivery succeeded.

Console delivery is controlled by `ALLOW_DEVELOPMENT_MAIL_LOG`; it defaults off in production.

## Trusted proxy boundary

Gatehouse uses configured forwarded headers for client IP and application routing. Therefore:

- keep the Gatehouse service on an internal network;
- expose only Caddy or another trusted edge;
- remove all incoming `X-Auth-*` identity headers;
- overwrite forwarding headers at the edge;
- use TLS externally;
- set `TRUSTED_IP_HEADERS` to headers your edge actually controls.

If Gatehouse must be exposed directly, set `TRUST_PROXY_HEADERS=false` and do not use client-IP policy until the deployment has a trustworthy network boundary.

## Health checks

- `/api/health` is process liveness and does not query PostgreSQL.
- `/api/ready` executes `SELECT 1` and returns 503 while the database is unavailable.
- application health checks use `HEAD`, a five-second timeout, and persist status/latency in PostgreSQL.

## Audit retention

`auditRetentionDays` is editable from the admin settings page and must be between 1 and 3650 days. Cleanup deletes older records at startup and every 24 hours.

Before reducing retention, export needed records or archive them externally. Audit metadata can include IP addresses, user agents, object identifiers, and before/after configuration values.

## Incident actions

From the admin console an operator can:

- ban a user;
- revoke one or all sessions;
- inspect linked accounts, passkeys, API keys, and recent events;
- disable an application;
- add an explicit user deny grant at the database/API layer;
- tighten role/domain/CIDR/MFA/session-age policy;
- export the audit log.

For suspected edge compromise, rotate edge credentials, remove direct access to Gatehouse, revoke sessions and API keys, and inspect audit events for forged forwarding metadata.
