# NEXUS CRM — local production image (talks to the Supabase local stack).
# Mirrors the original nexus-crm:local-supabase setup: build with `next build`,
# run with `next start`. NEXT_PUBLIC_* are inlined at build time from .env.local.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at build time and used by BOTH the browser and the
# server. Override the .env.local value (which may be a Tailscale IP the
# container can't reach) with a host address reachable from browser + container.
# process.env wins over .env.local during `next build`.
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/app/fonts ./app/fonts
COPY --from=builder /app/.env.local ./.env.local
EXPOSE 3000
CMD ["npm", "run", "start"]
