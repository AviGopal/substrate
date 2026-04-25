# Local MiniBob Development Setup

**Added**: 2026-04-25 (commit `237cc356`)

## Overview

Run MiniBob locally with automatic discovery registration, connecting to the production activity.metabob.com backend for trace storage and learning.

## Quick Start

```bash
./scripts/start-local-minibob.sh
```

This starts:
- **MiniBob instance** on `http://localhost:8083`
- **Automatic discovery registration** with discovery.metabob.com
- **Trace storage** to activity.metabob.com (canary deployment)

## Configuration

### docker-compose.minibob.yml

The compose file specifies:
- **Port**: 8083 (avoids conflicts with existing containers)
- **Backend**: Points to activity.metabob.com (not local Kubernetes)
- **Discovery Registration**: Automatic with discovery.metabob.com
- **Environment Variables**: Inherits from `~/.metabob/config.json` or env

```yaml
services:
  minibob:
    build:
      context: .
      dockerfile: Dockerfile  # Uses minibob's Dockerfile
    ports:
      - "8083:8080"  # Local 8083 → container 8080
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      METABOB_API_KEY: ${METABOB_API_KEY}
      METABOB_ENDPOINT: https://activity.metabob.com
      DISCOVERY_ENDPOINT: https://discovery.metabob.com
```

### start-local-minibob.sh

The script:
1. Loads environment from `~/.metabob/config.json`
2. Starts docker-compose with the minibob service
3. Waits for MiniBob to be ready
4. Registers with discovery-vessel

## Usage

### Run Development Activity

```bash
# MiniBob automatically discovers itself in workbench
# when you visit the workbench vessel selector
minibob --single "your development goal"
```

### Verify Registration

```bash
# Check that MiniBob is registered with discovery
curl https://discovery.metabob.com/health

# Check MiniBob health
curl http://localhost:8083/health
```

### View Traces

All activity traces are stored in activity.metabob.com, visible via:
- Dashboard: https://activity.metabob.com/dashboard
- Workbench: https://workbench.metabob.com (activity-monitor tab)

## Advantages Over Local Kubernetes

| Aspect | docker-compose | Local K8s |
|--------|---|---|
| Setup time | ~1 minute | 15+ minutes |
| Complexity | Simple .yml | Helm + Istio |
| Persistence | Activity.metabob.com | Local SurrealDB |
| Discovery | Automatic | Manual URL entry |
| Learning loop | Full (canary traces) | Partial (local only) |

## Troubleshooting

### MiniBob won't start

```bash
# Check docker is running
docker ps

# Check logs
docker-compose -f docker-compose.minibob.yml logs minibob

# Verify environment variables
echo $ANTHROPIC_API_KEY $METABOB_API_KEY
```

### Not appearing in workbench selector

```bash
# Verify registration with discovery
curl https://discovery.metabob.com/v2/registry

# Re-register manually
curl -X POST https://discovery.metabob.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "vessel_id": "minibob-local",
    "endpoint": "http://localhost:8083",
    "shapes": ["goal", "activity_template"]
  }'
```

### Traces not appearing in activity.metabob.com

1. Verify API key is correct: `echo $METABOB_API_KEY`
2. Check MiniBob can reach activity.metabob.com: `curl https://activity.metabob.com/health`
3. Check MiniBob logs: `docker-compose -f docker-compose.minibob.yml logs minibob | grep -i "trace\|activity"`

## Environment Variables Required

```bash
# From ~/.metabob/config.json or export
ANTHROPIC_API_KEY=sk-ant-...
METABOB_API_KEY=mb_dev_...
```

## Related Documentation

- [CLAUDE.md - Local Kubernetes Setup](../../CLAUDE.md#local-kubernetes-advanced---usually-not-needed) - For offline development or infrastructure changes
- [MiniBob Development](./MINIBOB_DEVELOPMENT.md) - MiniBob-specific development
- [Canary Deployment](../../repos/deployment/DEPLOYMENT_WORKFLOW.md) - How traces feed the learning loop
