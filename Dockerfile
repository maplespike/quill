# =============================================================================
# MapleSpike — Production Multi-Stage Dockerfile
# Builds all packages and produces runtime images.
# =============================================================================
FROM docker.io/node:22-bookworm AS build

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy dependency manifests first (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json turbo.json ./
RUN mkdir -p packages/api-server packages/mcp-server packages/database packages/pipeline-core packages/engine packages/create-module packages/notification-service packages/legal-core packages/legislation packages/sdk packages/docs packages/portal
COPY packages/api-server/package.json packages/api-server/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/database/package.json packages/database/
COPY packages/pipeline-core/package.json packages/pipeline-core/
COPY packages/engine/package.json packages/engine/
COPY packages/create-module/package.json packages/create-module/
COPY packages/notification-service/package.json packages/notification-service/
COPY packages/legal-core/package.json packages/legal-core/
COPY packages/legislation/package.json packages/legislation/
COPY packages/sdk/package.json packages/sdk/
COPY packages/docs/package.json packages/docs/
COPY packages/portal/package.json packages/portal/

# Install dependencies (native modules like better-sqlite3 need build tools)
RUN apt-get update -qq && apt-get install -y -qq python3 make g++ && \
    pnpm install --no-frozen-lockfile

# Ensure tsx is available for extensionless ESM imports

# Copy source code
COPY . .

# Build packages needed for all targets
RUN pnpm build --filter=@maplespike/pipeline-core --filter=@maplespike/api-server --filter=@maplespike/database --filter=@maplespike/mcp-server --filter=@maplespike/engine

# Fix ESM imports in dist/ (Node.js requires .js extensions for local imports)
RUN node scripts/fix-esm-imports.ts packages/database/dist && \
    node scripts/fix-esm-imports.ts packages/mcp-server/dist && \
    node scripts/fix-esm-imports.ts packages/pipeline-core/dist || true

# Fix package.json exports to point to dist/ for production
COPY scripts/fix-package-exports.js /tmp/
RUN node /tmp/fix-package-exports.js

# =============================================================================
# Runtime: API Server
# =============================================================================
FROM docker.io/node:22-bookworm AS api-server

WORKDIR /app
COPY --from=build /app /app

EXPOSE 8082
ENV NODE_ENV=production
CMD ["node", "packages/api-server/dist/dev-server.js"]

# =============================================================================
# Runtime: MCP Server
# =============================================================================
FROM docker.io/node:22-bookworm AS mcp-server

WORKDIR /app
COPY --from=build /app /app

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "packages/mcp-server/dist/index.js"]

# =============================================================================
# Runtime: Portal (static file server via Python)
# =============================================================================
FROM docker.io/python:3.13-slim AS portal

WORKDIR /app
COPY packages/portal/dist /app

EXPOSE 8080
CMD ["python3", "-m", "http.server", "8080"]

# =============================================================================
# Runtime: Ingestion Runner (runs a single pipeline by MAPLESPIKE_PIPELINE env)
# =============================================================================
FROM docker.io/node:22-bookworm AS ingestion

WORKDIR /app
COPY --from=build /app /app

ENV NODE_ENV=production
CMD ["sh", "-c", "node --experimental-specifier-resolution=node packages/pipeline-core/dist/ingestion/run-pipeline.js --name=$MAPLESPIKE_PIPELINE"]
