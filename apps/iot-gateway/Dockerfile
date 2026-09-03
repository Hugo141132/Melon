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
COPY apps/iot-gateway ./apps/iot-gateway

ENV NODE_ENV=production
RUN npm run db:generate --workspace=packages/database

RUN npm run build --workspace=packages/contracts && \
    npm run build --workspace=packages/database && \
    npm run build --workspace=apps/iot-gateway

# Stage 4: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST="0.0.0.0"

# Create unprivileged system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gateway

# Copy runtime node_modules including generated Prisma client
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /app/package.json ./package.json
COPY --from=builder --chown=gateway:nodejs /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder --chown=gateway:nodejs /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder --chown=gateway:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=gateway:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=gateway:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=gateway:nodejs /app/apps/iot-gateway/package.json ./apps/iot-gateway/package.json
COPY --from=builder --chown=gateway:nodejs /app/apps/iot-gateway/dist ./apps/iot-gateway/dist

USER gateway

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "apps/iot-gateway/dist/index.js"]
