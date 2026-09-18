#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

printf '%s\n' '==> Drizzle migration snapshot check'
bun run --cwd "$ROOT/server" db:check

printf '%s\n' '==> Server typecheck'
bun run --cwd "$ROOT/server" typecheck

printf '%s\n' '==> Server build'
bun run --cwd "$ROOT/server" build

printf '%s\n' '==> Server tests with PostgreSQL'
bun run --cwd "$ROOT/server" test

printf '%s\n' '==> Client Biome check'
bun run --cwd "$ROOT/client" check

printf '%s\n' '==> Client tests'
bun run --cwd "$ROOT/client" test

printf '%s\n' '==> Client production build'
bun run --cwd "$ROOT/client" build

printf '%s\n' '==> GateAuth verification complete'
