# Node 20
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl wget

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7788

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodejs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p logs && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 7788

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7788/api/v1/health || exit 1

CMD ["npm", "run", "start:prod"]
