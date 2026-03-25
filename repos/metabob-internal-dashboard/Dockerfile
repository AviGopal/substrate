# Build stage
# NOTE: This Dockerfile must be built from repos/ directory context
# to access @metabob/minibob dependency
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# First, build minibob (required dependency)
WORKDIR /app/minibob
COPY minibob/package.json minibob/bun.lock* ./
RUN bun install --frozen-lockfile
COPY minibob/tsconfig.json minibob/tsconfig.build.json ./
COPY minibob/src ./src
COPY minibob/index.ts ./
RUN bun run build

# Now build the internal dashboard
WORKDIR /app/dashboard

# Copy package files - update the minibob path for Docker context
COPY metabob-internal-dashboard/package.json ./
RUN sed -i 's|"file:../minibob"|"file:/app/minibob"|g' package.json

# Install dependencies (now minibob is available at /app/minibob)
RUN bun install

# Copy source files
COPY metabob-internal-dashboard/tsconfig.json ./
COPY metabob-internal-dashboard/tailwind.config.ts ./
COPY metabob-internal-dashboard/src ./src

# Build the frontend
RUN mkdir -p public/assets && \
    bun build src/frontend.tsx --outdir=public/assets --minify --sourcemap=external

# Production stage
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy minibob (built library)
COPY --from=builder /app/minibob /app/minibob

# Copy node_modules from builder (already has @metabob/minibob linked properly)
COPY --from=builder /app/dashboard/node_modules ./node_modules
COPY --from=builder /app/dashboard/package.json ./

# Clean up dev dependencies
RUN rm -rf node_modules/@types node_modules/@playwright node_modules/typescript

# Copy built assets and source
COPY --from=builder /app/dashboard/public ./public
COPY --from=builder /app/dashboard/src ./src
COPY metabob-internal-dashboard/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

# Start the server
CMD ["bun", "run", "src/index.ts"]
