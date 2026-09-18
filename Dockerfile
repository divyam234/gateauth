# syntax=docker/dockerfile:1.7
FROM oven/bun:alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN bun install --frozen-lockfile

COPY client ./client
COPY server ./server
RUN bun run --cwd client build
RUN bun run --cwd server build

FROM oven/bun:alpine AS runtime
WORKDIR /app

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./drizzle
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER bun
CMD ["bun", "dist/index.js"]
