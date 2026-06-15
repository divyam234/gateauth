# Testing

## Full verification

```bash
./scripts/verify.sh
```

## Server integration tests

```bash
cd server
POSTGRES_HOME=/path/to/postgresql-18.4 npm test
```

The harness creates a temporary cluster on a random loopback port with trust authentication, applies every generated Drizzle migration, creates a temporary database, runs tests sequentially, stops PostgreSQL, and deletes the cluster.

Instead of `POSTGRES_HOME`, set:

```bash
POSTGRES_ARCHIVE=/path/to/postgresql-18.4.0-x86_64-unknown-linux-gnu.tar.gz
```

The archive is unpacked into a temporary directory. It must contain `bin/initdb`, `bin/pg_ctl`, and the matching libraries.

`TEST_DATABASE_URL` can point at a dedicated external test database. The harness will not create or stop PostgreSQL in that mode, so never point it at production.

The integration suite covers:

- clean Drizzle migration application and Better Auth adapter integration;
- liveness/readiness;
- capabilities;
- Better Auth signup and bearer sessions;
- application public/protected route decisions;
- trusted identity headers;
- role, domain, CIDR, MFA, session-age, and user-grant policy behavior;
- policy simulation;
- safe runtime settings validation;
- overview, sessions, user details, and search;
- structured audit querying/export and retention pruning;
- API-key default expiry;
- token-free administrative session inventory and revocation.

## Client tests

```bash
cd client
npm run check
npm test
npm run build
```

Biome checks formatting, import organization, React correctness, accessibility, and project safety rules. The React suite covers login/sign-up surfaces, passkey and social actions, admin overview, application editing, policy simulation, settings, security posture, global session management, email/TOTP/recovery second-factor choices, and QR enrollment.

## Dependency audits

Production dependencies are checked with:

```bash
npm --prefix server audit --omit=dev
npm --prefix client audit --omit=dev
```

Drizzle Kit is development-only and is excluded from the runtime image by `npm prune --omit=dev`; production startup uses the lightweight Drizzle runtime migrator against committed SQL migrations.
