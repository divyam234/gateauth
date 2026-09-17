# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN bun install --frozen-lockfile

COPY client ./client
COPY server ./server
RUN bun run --cwd client build
RUN bun run --cwd server build

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app

COPY package.json bun.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN bun install --frozen-lockfile --production

COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/drizzle ./server/drizzle
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "if (!(await fetch('http://127.0.0.1:3001/api/ready')).ok) throw new Error('not ready')"
CMD ["bun", "src/index.ts"]
