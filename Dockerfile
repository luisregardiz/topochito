# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
# El store fuera de /app: con el bind mount del compose acabaría dentro del repo
ENV npm_config_store_dir=/pnpm/store
WORKDIR /app

# Desarrollo: lo usa docker-compose (bind mount + hot reload)
FROM base AS dev
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm dev -H 0.0.0.0"]

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Producción: imagen mínima, usuario no root
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
