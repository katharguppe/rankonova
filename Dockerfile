FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# ── development target (used by docker-compose for local dev) ──────────────────
FROM base AS development
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

# ── build stage ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

# ── production target ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN addgroup -g 1001 nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000
CMD ["node", "dist/app/main"]
