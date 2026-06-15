# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json client/tsconfig*.json client/components.json client/index.html ./
RUN npm ci
COPY client/src ./src
COPY client/public ./public
COPY client/vite.config.ts client/biome.json ./
COPY client/biome-plugins ./biome-plugins
RUN npm run build

FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json server/tsconfig.json server/drizzle.config.ts ./
RUN npm ci
COPY server/src ./src
COPY server/drizzle ./drizzle
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S gatehouse && adduser -S gatehouse -G gatehouse
COPY --from=server-build --chown=gatehouse:gatehouse /app/server/dist ./server/dist
COPY --from=server-build --chown=gatehouse:gatehouse /app/server/drizzle ./server/drizzle
COPY --from=server-build --chown=gatehouse:gatehouse /app/server/node_modules ./server/node_modules
COPY --from=server-build --chown=gatehouse:gatehouse /app/server/package.json ./server/package.json
COPY --from=client-build --chown=gatehouse:gatehouse /app/client/dist ./client/dist
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
USER gatehouse
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3001/api/ready >/dev/null || exit 1
CMD ["node", "server/dist/index.js"]
