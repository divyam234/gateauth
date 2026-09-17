# Testing

## Full verification

```bash
./scripts/verify.sh
```

## Server integration tests

```bash
POSTGRES_HOME=/path/to/postgresql-18 bun run --cwd server test
```

The harness creates a temporary cluster on a random loopback port with trust authentication, applies generated Drizzle migrations, creates a temporary database, runs tests sequentially, stops PostgreSQL, and deletes the cluster.

Instead of `POSTGRES_HOME`, set:

```bash
POSTGRES_ARCHIVE=/path/to/postgresql-18-x86_64-unknown-linux-gnu.tar.gz bun run --cwd server test
```

The archive is unpacked into a temporary directory. It must contain `bin/initdb`, `bin/pg_ctl`, and the matching libraries.

`TEST_DATABASE_URL` can point at a dedicated external test database. The harness will not create or stop PostgreSQL in that mode, so never point it at production.

The integration suite covers the main auth, policy, admin, and audit paths, including:

- clean Drizzle migration application and Better Auth adapter integration;
- liveness/readiness;
- capabilities;
- Better Auth signup and bearer sessions;
- application public/protected route decisions;
- trusted identity headers;
- role, domain, CIDR, MFA, session-age, and user-grant policy behavior;
- policy simulation;
- safe runtime settings;
- overview, sessions, user details, and search;
- audit querying/export and retention pruning;
- API-key default expiry;
- token-free administrative session inventory and revocation.

## Client tests

```bash
bun run --cwd client check
bun run --cwd client test
bun run --cwd client build
```

Biome checks formatting, import organization, React correctness, accessibility, and project rules. The React suite covers login/sign-up, passkey and social actions, admin overview, application editing, policy simulation, settings, security posture, session management, second-factor choices, and QR enrollment.

## Dependency audits

The Bun workspace lock can be checked for published dependency vulnerabilities with:

```bash
bun audit
```

Drizzle Kit is development-only. The runtime image installs the workspace with `bun install --production --frozen-lockfile`; production startup uses the Drizzle runtime migrator against committed SQL migrations.
