# syntax=docker/dockerfile:1
# Build arguments for version embedding
ARG BUILD_SHA
ARG BUILD_VERSION

FROM oven/bun:1.2 AS build
WORKDIR /app/user-vessel

# Copy shared packages first (when built from deployment repo context)
COPY ../packages /app/packages

# Copy package files
COPY user-vessel/package.json user-vessel/bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY user-vessel/src ./src
COPY user-vessel/sql ./sql
COPY user-vessel/index.ts ./
COPY user-vessel/tsconfig.json ./

FROM oven/bun:1.2-slim AS runtime
WORKDIR /app
COPY --from=build /app/user-vessel/node_modules ./node_modules
COPY --from=build /app/user-vessel/src ./src
COPY --from=build /app/user-vessel/sql ./sql
COPY --from=build /app/user-vessel/index.ts ./
COPY --from=build /app/user-vessel/package.json ./
# Re-declare build args
ARG BUILD_SHA
ARG BUILD_VERSION

ENV NODE_ENV=production
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_VERSION=${BUILD_VERSION}
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD bun -e "fetch('http://localhost:8080/health').then(r => process.exit(r.ok ? 0 : 1))"
CMD ["bun", "run", "index.ts"]
