# Gatehouse client

Gatehouse client built with React 19, TanStack Query, TanStack Router file-based routing, Tailwind CSS 4, Biome, and Better Auth client integration.

Use the repository-level [README](../README.md) for setup and architecture.

```bash
bun install
bun run --cwd client dev
bun run --cwd client check
bun run --cwd client test
bun run --cwd client build
```

## Routing

Route definitions live in `src/routes`. The TanStack Router plugin generates `src/routeTree.gen.ts`; do not edit that generated file directly.

The Vite plugin is the only route generator. `bun run --cwd client dev`, `bun run --cwd client build`, and Vitest load the plugin and keep the committed route tree current; there is no Router CLI dependency. Route loaders preload TanStack Query data through the typed router context.

## Code quality

Biome is the only formatter and linter:

```bash
bun run --cwd client check          # formatting, linting, and import organization
bun run --cwd client check:write    # apply safe fixes
bun run --cwd client lint           # lint only
bun run --cwd client format         # format in place
bun run --cwd client format:check   # verify formatting only
```

Biome also enforces project rules for Lucide icons, HTML injection, destructive confirmation dialogs, and invalid React Server Component directives.

## UI primitives

`components.json` selects the shadcn `base-nova` style and Lucide icon library. Add or update primitives with the shadcn CLI; application code should compose files from `src/components/ui` instead of recreating native controls.
