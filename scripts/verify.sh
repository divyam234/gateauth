#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

printf '%s\n' '==> Drizzle migration snapshot check'
(cd "$ROOT/server" && npm run db:check)

printf '%s\n' '==> Server typecheck'
(cd "$ROOT/server" && npm run typecheck)

printf '%s\n' '==> Server build'
(cd "$ROOT/server" && npm run build)

printf '%s\n' '==> Server tests with PostgreSQL'
(cd "$ROOT/server" && npm test)

printf '%s\n' '==> Client Biome check'
(cd "$ROOT/client" && npm run check)

printf '%s\n' '==> Client tests'
(cd "$ROOT/client" && npm test)

printf '%s\n' '==> Client production build'
(cd "$ROOT/client" && npm run build)

printf '%s\n' '==> Gatehouse verification complete'
