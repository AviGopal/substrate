# user-vessel Dockerfile
# Build lightweight TypeScript user management vessel
#
# Build context: Parent directory containing user-vessel/ as a subdirectory
#
# Deployment: docker build -f user-vessel/Dockerfile -t user-vessel:latest vessels/

FROM oven/bun:1 as build
WORKDIR /app

# Copy package files
COPY user-vessel/package.json user-vessel/bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY user-vessel/src ./src
COPY user-vessel/sql ./sql
COPY user-vessel/tsconfig.json ./
COPY user-vessel/index.ts ./

# Verify TypeScript compilation
RUN bun build index.ts --target bun --outdir dist

FROM oven/bun:1-slim
WORKDIR /app

# Copy dependencies and source from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/sql ./sql
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/package.json ./
COPY --from=build /app/index.ts ./

# Environment configuration
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Expose HTTP port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the server
CMD ["bun", "run", "index.ts"]
