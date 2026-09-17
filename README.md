# Gatehouse

Gatehouse is a PostgreSQL-backed identity control plane and forward-auth gateway built with Better Auth, Bun, React, and Caddy. Bun provides the HTTP server/router and PostgreSQL client, while Drizzle owns the schema and migrations. Gatehouse protects upstream applications from one admin console and stores authentication, policy, sessions, API keys, and audit history in PostgreSQL.

## Core features

- Email/password, OAuth, magic link, OTP, passkey, and MFA sign-in through Better Auth
- Account linking limited to verified same-email providers
- Forward-auth endpoint for Caddy at `/api/verify`
- Application registry with domains, upstream URLs, public routes, health checks, and stable slugs
- Access policy for roles, email domains, CIDR ranges, MFA, session age, and per-user grants
- Admin console for applications, users, sessions, API keys, audit logs, and runtime settings
- PostgreSQL-backed sessions, policy, audit events, rate limits, and migrations
- Docker Compose setup with Caddy, Gatehouse, PostgreSQL, and a sample protected upstream

## Architecture

```text
Browser / API client
        |
        v
Caddy (public entry point)
  | Gatehouse routes ----------------------.
  |                                        |
  | forward_auth /api/verify               v
  '---------------------------------> Gatehouse Bun server
                                          |  Better Auth
                                          |  Policy engine
                                          |  Admin API + SPA
                                          |  Audit service
                                          v
                                      PostgreSQL 18

Authorized requests -> protected upstream application
```

Caddy sends requests to `/api/verify?application=<slug>`, copies only Gatehouse-produced identity headers, and proxies authorized requests to the upstream. Application policy stays in PostgreSQL and can change without editing Caddy.

## Quick start with Docker Compose

```bash
cp .env.example .env
openssl rand -base64 48   # use this for BETTER_AUTH_SECRET
openssl rand -base64 32   # use this for POSTGRES_PASSWORD
openssl rand -base64 24   # use this for SEED_ADMIN_PASSWORD

docker compose up --build
```

Open `http://app.localhost/login`. Compose creates:

- PostgreSQL 18.6
- Gatehouse server and built React application
- a sample `traefik/whoami` protected upstream
- Caddy on ports 80 and 443

The seeded administrator is controlled by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Change or remove seed credentials after initial provisioning.

## Local development

### Install and run

```bash
bun install
cp .env.example server/.env
# Set DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.
bun run --cwd server db:migrate
bun run dev:server
```

In another terminal, start the client:

```bash
bun run dev:client
```

Client routes live in `client/src/routes`. UI primitives live in `client/src/components/ui` and are managed with the shadcn CLI. Feature components compose those primitives instead of reimplementing controls. The TanStack Router Vite plugin generates the typed route tree during development, tests, and production builds; the Router CLI is not installed. Biome is the only client formatter and linter; run `bun run --cwd client check` before committing.

Vite proxies `/api/auth`, `/api/verify`, and `/api/admin` to `http://localhost:8080`.

## Database schema and migrations

`server/src/db/schema.ts` defines Better Auth and Gatehouse tables. Better Auth uses the official Drizzle adapter against that schema, and Drizzle Kit writes generated migrations to `server/drizzle`.

```bash
bun run --cwd server db:generate   # create a migration after changing the schema
bun run --cwd server db:check      # validate migration snapshots
DATABASE_URL=postgresql://... bun run --cwd server db:migrate
bun run --cwd server db:studio     # optional local database browser
```

When `RUN_MIGRATIONS=true`, the server applies pending Drizzle migrations automatically during startup under a PostgreSQL advisory lock. The Drizzle schema and generated migrations define the database. Never rewrite an applied migration; update the schema and generate a new migration.

## Forward-auth contract

```http
GET /api/verify?application=default-app
```

Gatehouse also accepts application resolution from `X-Auth-Application` or the forwarded host. It uses the original forwarded path for public-route and policy decisions.

Successful decisions may return:

```text
X-Auth-User-Id
X-Auth-User-Email
X-Auth-User-Name
X-Auth-User-Role
X-Auth-MFA
X-Auth-Method
X-Auth-Application-Id
X-Auth-Application-Slug
X-Auth-Public
```

Never trust these headers from an internet client. Strip them at the edge and copy only the headers returned by the authorization subrequest, as the included `Caddyfile` does.

## Account linking

Gatehouse keeps one local user identity with multiple Better Auth account records.

- A Google or GitHub login can join an existing user only when the provider returns the same verified email and the local email is already verified.
- Signed-in users can connect another configured provider from the dashboard. The provider must return the same verified email.
- Different-email linking is rejected. Provider profile data does not overwrite the local name, email, or avatar during linking.
- Users can disconnect social providers, but Better Auth prevents removal of the final sign-in method.
- Disabling public signup blocks new users from email, OAuth callback, OTP, and magic-link flows while authenticated administrators can still provision users.
- Account creation, linking, and unlinking produce structured audit events.

OAuth redirect URIs remain:

```text
https://your-gatehouse.example/api/auth/callback/google
https://your-gatehouse.example/api/auth/callback/github
```

## Important environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Better Auth signing/encryption secret; mandatory in production |
| `BETTER_AUTH_URL` | Public Gatehouse origin |
| `TRUSTED_ORIGINS`, `CORS_ORIGINS` | Comma-separated allowed origins |
| `TRUST_PROXY_HEADERS` | Trust proxy-provided client metadata; keep Gatehouse private behind the edge proxy |
| `TRUSTED_IP_HEADERS` | Ordered client-IP headers accepted from the trusted proxy |
| `REQUIRE_EMAIL_VERIFICATION` | Require verified email before normal password access |
| `ENABLE_HIBP` | Enable compromised-password checks |
| `TURNSTILE_SECRET_KEY` | Enable Cloudflare Turnstile protection |
| `MAIL_WEBHOOK_URL` | Production email-delivery webhook |
| `GOOGLE_CLIENT_ID/SECRET` | Enable Google OAuth |
| `GITHUB_CLIENT_ID/SECRET` | Enable GitHub OAuth |
| `SEED_ADMIN_EMAIL/PASSWORD` | Optional idempotent initial administrator provisioning |

See `.env.example` and [Operations](docs/operations.md) for the full deployment guidance.

## Verification

Run local verification:

```bash
./scripts/verify.sh
```

It performs:

- strict server typechecking, including integration tests
- Bun-targeted server production build
- 37 server tests against a fresh real PostgreSQL 18 cluster
- client Biome formatting, linting, import, and architecture checks
- 25 React/Vitest tests running under Bun with `happy-dom`
- strict client TypeScript and production build

The PostgreSQL test harness looks for binaries in this order:

1. `POSTGRES_HOME`
2. `POSTGRES_ARCHIVE`
3. PostgreSQL binaries available on `PATH`

No SQLite fallback or database mock is used.

## Production notes

- Do not expose the Gatehouse container directly when `TRUST_PROXY_HEADERS=true`.
- Require TLS at the external edge outside local development.
- Configure real email delivery before requiring verification, magic links, resets, or email MFA.
- Back up PostgreSQL, not individual application files.
- Treat audit records as sensitive data and choose retention accordingly.
- API-key secrets are reveal-once values; only hashes are persisted.
- Session inventory endpoints return opaque row IDs for revocation and never return raw session tokens.

More detail:

- [Operations and backups](docs/operations.md)
- [Caddy and multi-application routing](docs/caddy.md)
- [Testing with PostgreSQL 18](docs/testing.md)
