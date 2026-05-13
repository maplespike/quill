# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm (pin to v10 to match dev environemnt)
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy monorepo structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json /app/
COPY packages/ /app/packages/

# Install all workspace dependencies
# pnpm 10+ blocks build scripts by default; onlyBuiltDependencies in
# package.json allows specific packages (better-sqlite3, esbuild) to compile
RUN pnpm install --frozen-lockfile

# Build all packages (pipeline-core first, then dependents)
RUN pnpm --filter @civint/pipeline-core build
RUN pnpm --filter @civint/mcp-server build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy built artifacts and runtime deps
COPY --from=builder /app/packages/mcp-server/dist /app/packages/mcp-server/dist
COPY --from=builder /app/packages/mcp-server/package.json /app/packages/mcp-server/package.json
COPY --from=builder /app/packages/pipeline-core/dist /app/packages/pipeline-core/dist
COPY --from=builder /app/packages/pipeline-core/package.json /app/packages/pipeline-core/package.json
COPY --from=builder /app/packages/engine/dist /app/packages/engine/dist
COPY --from=builder /app/packages/engine/package.json /app/packages/engine/package.json
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run the SSE transport (hosted server mode)
CMD ["node", "packages/mcp-server/dist/index.js"]
