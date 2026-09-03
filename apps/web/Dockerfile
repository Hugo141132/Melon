# Stage 1: Base Alpine image with compatibility libraries
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma/schema.prisma ./packages/database/prisma/
COPY apps/web/package.json ./apps/web/
COPY apps/iot-gateway/package.json ./apps/iot-gateway/
RUN npm ci

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY packages/database ./packages/database
COPY apps/web ./apps/web
COPY scripts ./scripts

ENV NODE_ENV=production
RUN npm run db:generate --workspace=packages/database

RUN npm run build --workspace=packages/contracts && \
    npm run build --workspace=packages/database && \
    npm run build --workspace=apps/web

# Stage 4: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone build artifacts and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/web/server.js"]
