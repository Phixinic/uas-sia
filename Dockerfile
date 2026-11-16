# SIA D'Production: image produksi multi-tahap (Next.js standalone) untuk VPS kecil.
# Migrasi dan seed dijalankan layanan `migrasi` di docker-compose.yml (memakai tahap `build` yang masih punya Prisma CLI).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall menjalankan `prisma generate`; URL tiruan cukup karena generate tidak menyentuh database
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci --no-audit --no-fund --loglevel=error

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Jakarta
RUN addgroup -S sia && adduser -S sia -G sia
COPY --from=build --chown=sia:sia /app/.next/standalone ./
COPY --from=build --chown=sia:sia /app/.next/static ./.next/static
COPY --from=build --chown=sia:sia /app/public ./public
USER sia
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/sehat || exit 1
CMD ["node", "server.js"]
