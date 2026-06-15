# Gatehouse client

React 19, TanStack Query, TanStack Router file-based routing, Tailwind CSS 4, Biome, and Better Auth client integration for the Gatehouse identity control plane.

Use the repository-level [README](../README.md) for setup and architecture.

```bash
npm ci
npm run dev
npm run check
npm test
npm run build
```

## Routing

Route definitions live in `src/routes`. The TanStack Router plugin generates `src/routeTree.gen.ts`; do not edit that generated file directly.

The Vite plugin is the only route generator. `npm run dev`, `npm run build`, and Vitest all load the plugin and keep the committed route tree current; there is no separate Router CLI dependency. Route loaders preload TanStack Query data through the typed router context.

## Code quality

Biome is the only formatter and linter:

```bash
npm run check          # formatting, linting, and import organization
npm run check:write    # apply safe fixes
npm run lint           # lint only
npm run format         # format in place
npm run format:check   # verify formatting only
```

Biome also enforces project-specific safety rules for Lucide icons, HTML injection, destructive confirmation dialogs, and invalid React Server Component directives.

## UI primitives

`components.json` selects the shadcn `base-nova` style and Lucide icon library. Add or update design-system primitives with the shadcn CLI; application code should compose files from `src/components/ui` rather than recreate native controls.
