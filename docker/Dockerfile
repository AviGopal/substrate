# =============================================================================
# DevBob Base Image
# =============================================================================
# Production container with metabob-cli and metabob-opencode.
#
# Services started by entrypoint:
#   1. metabob-cli MCP (stdio) - sidecar for opencode, started automatically
#   2. metabob-cli dashboard (SSE) - local web dashboard on DASHBOARD_PORT
#   3. opencode ACP - agent server on ACP_PORT
#
# Build:
#   docker build -f docker/Dockerfile -t devbob:latest .
#
# Prerequisites:
#   cd repos/metabob-opencode/packages/opencode && bun run build --single
# =============================================================================

# =============================================================================
# Stage 1: Build metabob-cli
# =============================================================================
FROM python:3.12-slim AS cli-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /build

# Copy metabob-proto (dependency of metabob-cli)
COPY repos/metabob-proto/pyproject.toml /build/metabob-proto/
COPY repos/metabob-proto/proto/ /build/metabob-proto/proto/
COPY repos/metabob-proto/activities/ /build/metabob-proto/activities/
COPY repos/metabob-proto/scripts/ /build/metabob-proto/scripts/

# Copy metabob-cli
WORKDIR /build/metabob-cli
COPY repos/metabob-cli/pyproject.toml repos/metabob-cli/uv.lock ./
COPY repos/metabob-cli/lib/ ./lib/
COPY repos/metabob-cli/src/ ./src/

RUN echo "metabob-cli" > ./README.md && touch ./LICENSE ./NOTICE
RUN uv sync --frozen --no-dev && uv pip install . --no-deps

# =============================================================================
# Stage 2: Collect pre-built opencode binaries
# =============================================================================
FROM alpine:3.19 AS opencode-builder

WORKDIR /build/opencode
COPY repos/metabob-opencode/packages/opencode/dist/ ./dist/

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM python:3.12-slim AS runtime

# Runtime packages (minimal - no dev tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates openssh-client \
    jq procps unzip gettext-base netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# uv (for metabob-cli venv)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Bun runtime (opencode dependency)
RUN curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -s /root/.bun/bin/bunx /usr/local/bin/bunx

# Directory layout
RUN mkdir -p /opt/metabob-cli /opt/opencode /workspace /config /root/.ssh

# ---------------------------------------------------------------------------
# metabob-cli
# ---------------------------------------------------------------------------
COPY --from=cli-builder /build/metabob-cli /opt/metabob-cli

# Fix venv shebangs (built at /build/metabob-cli, now at /opt/metabob-cli)
RUN find /opt/metabob-cli/.venv/bin -type f \
    -exec sed -i 's|#!/build/metabob-cli/.venv|#!/opt/metabob-cli/.venv|g' {} \; 2>/dev/null || true

# Wrapper avoids pydantic_settings parsing .env files in CWD
RUN printf '#!/bin/bash\ncd /opt && exec /opt/metabob-cli/.venv/bin/python -m metabob_cli "$@"\n' \
    > /usr/local/bin/metabob-cli && chmod +x /usr/local/bin/metabob-cli

ENV PATH="/opt/metabob-cli/.venv/bin:${PATH}"

# ---------------------------------------------------------------------------
# opencode
# ---------------------------------------------------------------------------
COPY --from=opencode-builder /build/opencode/dist /opt/opencode/dist

RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then BIN="opencode-linux-x64"; \
    elif [ "$ARCH" = "aarch64" ]; then BIN="opencode-linux-arm64"; \
    else echo "Unsupported arch: $ARCH" && exit 1; fi && \
    ln -sf /opt/opencode/dist/${BIN}/bin/opencode /usr/local/bin/opencode && \
    chmod +x /opt/opencode/dist/${BIN}/bin/opencode

# ---------------------------------------------------------------------------
# SSH setup for git
# ---------------------------------------------------------------------------
RUN chmod 700 /root/.ssh && \
    touch /root/.ssh/known_hosts && chmod 600 /root/.ssh/known_hosts && \
    ssh-keyscan github.com gitlab.com bitbucket.org >> /root/.ssh/known_hosts 2>/dev/null || true && \
    git config --global core.sshCommand "ssh -o StrictHostKeyChecking=accept-new"

# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# ---------------------------------------------------------------------------
# Environment defaults
# ---------------------------------------------------------------------------
ENV PYTHONUNBUFFERED=1 \
    OPENCODE_HOME=/workspace/.opencode \
    # ACP server
    ACP_PORT=3000 \
    ACP_HOSTNAME=0.0.0.0 \
    # Dashboard (metabob-cli SSE server)
    DASHBOARD_PORT=8001 \
    DASHBOARD_HOST=0.0.0.0 \
    # Backend
    METABOB_API_URL=http://api-server-dev:8080 \
    METABOB_PROJECT_ID=devbob-default \
    # LLM (override via .env / docker-compose)
    ANTHROPIC_API_KEY="" \
    OPENAI_API_KEY=""

WORKDIR /workspace

EXPOSE ${ACP_PORT} ${DASHBOARD_PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:${ACP_PORT}/health || \
        curl -sf http://localhost:${DASHBOARD_PORT}/metrics || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["acp"]
