# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PATH=/app/data/kotonoba.db
ENV UPLOAD_DIR=/app/data/uploads

RUN apk add --no-cache curl wget

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

# Leverage Next.js output standalone files for minimal footprint and offline startup
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
