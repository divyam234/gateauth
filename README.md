# Gatehouse

Gatehouse is a PostgreSQL-backed identity control plane and forward-auth gateway built with Better Auth, Hono, React, and Caddy. It protects multiple upstream applications from one admin console while keeping authentication, application policy, sessions, API keys, and audit history in a single database.

## What is implemented

### Authentication and account security

- Email/password sign-in with verification and password reset delivery hooks
- Google and GitHub OAuth when credentials are configured; unavailable providers are hidden from the UI
- Verified same-email account linking, explicit connect/disconnect controls, different-email rejection, and last-method protection
- The public-signup switch applies to every user-creation path, including OAuth callbacks, OTP, and magic links
- Magic-link and email-OTP sign-in
- Passkeys with required user verification
- TOTP two-factor authentication, email second factor, recovery codes, trusted-device support, enrollment QR flow, rotation, and disable controls
- Have I Been Pwned password checks and Cloudflare Turnstile support
- PostgreSQL-backed rate limiting
- Better Auth admin operations, impersonation, bans, sessions, and API keys
- Session assurance metadata (`authMethod` and `mfaVerifiedAt`) so MFA policy checks the current session, not merely whether a user enrolled 2FA

### Protected applications and access policy

- Application registry with stable slugs, domains, upstream URLs, public routes, and health checks
- Host or explicit application resolution in `/api/verify`
- Role, email-domain, IPv4/IPv6 CIDR, MFA, and maximum-session-age policy
- Per-user allow/deny grants in the policy engine
- Policy simulator in the admin console
- Trusted identity headers for upstream applications
- Caller-supplied identity headers stripped by Caddy before authorization
- Browser sessions, bearer sessions, and API-key authentication

### Admin console

- Operational overview with users, sessions, sign-ins, denied decisions, application health, MFA/passkey adoption, API-key status, activity trend, and recent events
- Application and policy editor
- User inspector with accounts, passkeys, sessions, API keys, grants, and activity
- Global session inventory and revocation without exposing raw tokens
- API-key management
- Searchable audit log with severity/outcome filters, before/after data, and CSV export
- Security-posture page
- Safe runtime settings separated from deployment secrets
- Global command search, responsive sidebar, light/dark modes, route-level code splitting, and an OKLCH design system

### PostgreSQL and operations

- One PostgreSQL database for Better Auth and Gatehouse control-plane data
- Drizzle schema as the database source of truth, generated SQL migrations, and a PostgreSQL advisory migration lock
- Readiness and liveness endpoints
- Structured immutable audit events with configurable retention cleanup
- Docker multi-stage production image and Compose deployment
- Real PostgreSQL integration tests using the supplied PostgreSQL 18.4 binary distribution

## Architecture

```text
Browser / API client
        |
        v
Caddy (public entry point)
  | Gatehouse routes ----------------------.
  |                                        |
  | forward_auth /api/verify               v
  '---------------------------------> Gatehouse Hono server
                                          |  Better Auth
                                          |  Policy engine
                                          |  Admin API + SPA
                                          |  Audit service
                                          v
                                      PostgreSQL 18

Authorized requests -> protected upstream application
```

Caddy is deliberately thin. It sends the request to `/api/verify?application=<slug>`, copies only Gatehouse-produced identity headers, and then proxies to the upstream. Application policy remains in PostgreSQL and can be changed without editing Caddy.

## Quick start with Docker Compose

```bash
cp .env.example .env
openssl rand -base64 48   # use this for BETTER_AUTH_SECRET
openssl rand -base64 32   # use this for POSTGRES_PASSWORD
openssl rand -base64 24   # use this for SEED_ADMIN_PASSWORD

docker compose up --build
```

Open `http://app.localhost/login`. Compose creates:

- PostgreSQL 18.4
- Gatehouse server and built React application
- a sample `traefik/whoami` protected upstream
- Caddy on ports 80 and 443

The seeded administrator is controlled by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Change or remove seed credentials after initial provisioning.

## Local development

### Server

```bash
cd server
npm ci
cp ../.env.example .env
# Set DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.
npm run db:migrate
npm run dev
```

### Client

```bash
cd client
npm ci
npm run dev
```

Client routes live in `client/src/routes`. UI primitives live in `client/src/components/ui` and are managed through the shadcn CLI; feature components compose those primitives rather than reimplementing controls. The TanStack Router Vite plugin generates the typed route tree during development, tests, and production builds; the Router CLI is not installed. Biome is the only client formatter and linter; run `npm run check` before committing.

Vite proxies `/api/auth`, `/api/verify`, and `/api/admin` to `http://localhost:3001`.

## Database schema and migrations

`server/src/db/schema.ts` is the single source of truth for Better Auth and Gatehouse tables. Better Auth uses the official Drizzle adapter against that schema, and Drizzle Kit writes generated migrations to `server/drizzle`.

```bash
cd server
npm run db:generate   # create a migration after changing the schema
npm run db:check      # validate migration snapshots
DATABASE_URL=postgresql://... npm run db:migrate
npm run db:studio     # optional local database browser
```

When `RUN_MIGRATIONS=true`, the server applies pending Drizzle migrations automatically during startup under a PostgreSQL advisory lock. The Drizzle schema and generated migrations are the only supported database definition. Never rewrite an applied migration; update the schema and generate a new migration.

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

## Account linking behavior

Gatehouse keeps one local user identity with multiple Better Auth account records:

- A Google or GitHub login can implicitly join an existing user only when the provider returns the same verified email and the local email is already verified.
- Signed-in users can explicitly connect another configured provider from the dashboard. The provider must return the same verified email.
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

Run the complete local verification pipeline:

```bash
./scripts/verify.sh
```

It performs:

- strict server typechecking, including integration tests
- server TypeScript production build
- 37 server tests against a fresh real PostgreSQL 18.4 cluster
- client Biome formatting, linting, import, and architecture checks
- 25 React/Vitest tests
- strict client TypeScript and production build

The PostgreSQL test harness uses, in order:

1. `POSTGRES_HOME`
2. `POSTGRES_ARCHIVE`
3. PostgreSQL binaries available on `PATH`

No SQLite fallback or database mock is used.

## Production notes

- Do not expose the Gatehouse container directly when `TRUST_PROXY_HEADERS=true`.
- Require TLS at the external edge outside local development.
- Configure real email delivery before requiring verification, magic links, resets, or email MFA.
- Back up PostgreSQL, not individual application files.
- Treat audit records as sensitive security data and choose retention accordingly.
- API-key secrets are reveal-once values; only hashes are persisted.
- Session inventory endpoints return opaque row IDs for revocation and never return raw session tokens.

More detail:

- [Operations and backups](docs/operations.md)
- [Caddy and multi-application routing](docs/caddy.md)
- [Testing with PostgreSQL 18.4](docs/testing.md)
- [Final UI and API integration audit](UI_AUDIT.md)
