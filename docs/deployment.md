# PayERupee Deployment & Infrastructure Guide

This guide covers deploying the PayERupee platform on modern cloud providers (Vercel, Railway, Render, or a VPS with Docker).

---

## 1. Environment Variables Configuration

Ensure the following variables are configured in your production environment:

```bash
# Database Connections (Neon / Supabase / Self-Hosted PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-pooler.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-direct.aws.neon.tech/neondb?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-ultra-secure-random-secret-key-at-least-32-chars"
BETTER_AUTH_URL="https://yourdomain.com"

# Redis (Upstash / Redis Cloud / Local)
REDIS_URL="redis://default:password@your-redis-instance:6379"

# System Environment
NODE_ENV="production"
```

---

## 2. Database Migration & Schema Deployment

When deploying updates:

1. **Push Schema Changes:**
   ```bash
   npx prisma db push
   ```
2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

---

## 3. Production Build & Start

1. **Install Dependencies:**
   ```bash
   npm install --frozen-lockfile
   ```
2. **Build the Next.js Bundle:**
   ```bash
   npm run build
   ```
3. **Start the Production Server:**
   ```bash
   npm run start
   ```

---

## 4. Docker Deployment (Optional)

A standardized `Dockerfile` for containerized hosting:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start"]
```
