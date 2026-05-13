# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy monorepo structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .npmrc /app/
COPY packages/ /app/packages/

# Install + build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @civint/pipeline-core build && \
    pnpm --filter @civint/mcp-server build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy the full monorepo from builder.
# Docker COPY follows pnpm's virtual store symlinks, resolving them into
# regular directories. This means node_modules/@civint/pipeline-core (which
# is a symlink to .pnpm/@civint+pipeline-core@.../node_modules/@civint/pipeline-core)
# gets copied as a directory WITH its nested node_modules/ containing all
# transitive deps (like fast-xml-parser, undici, etc.).
# IMPORTANT: Do NOT recreate @civint symlinks — that would overwrite the
# .pnpm store entries that already have proper dependency resolution.
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages /app/packages

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "packages/mcp-server/dist/index.js"]
