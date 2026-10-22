# Node 20
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl wget
# CI=1 keeps the `prepare` script from trying to install husky git hooks.
ENV CI=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Production-only dependency tree, copied into the runner as-is.
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generates the Prisma client, then compiles TS to ./dist (dist/src + dist/prisma).
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=2001

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodejs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

RUN mkdir -p logs uploads && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 2001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:2001/api/v1/health || exit 1

CMD ["npm", "run", "start:prod"]
