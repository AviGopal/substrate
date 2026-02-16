# Obsolete Docker Compose Files

**Archived**: 2026-02-16  
**Reason**: Superseded by main `docker-compose.yaml` with 3 profiles

## Files Archived

- `docker-compose.devbob.yaml` - Old devbob integration setup
- `docker-compose.devbob-integration.yaml` - Old multi-agent setup
- `docker-compose.devbob-integration-clean.yaml` - Old clean environment setup

These files are kept for historical reference only.  
**DO NOT USE** - Use `/docker-compose.yaml` instead.

## Migration

All functionality moved to:
- **Orchestration**: `/docker-compose.yaml` (3 profiles: stable, devbob, devbob-dev)
- **Build/Push**: Per-repo `docker-compose.build.yaml` files (to be created)

## Usage (New)

```bash
# Backend only
docker-compose --profile stable up -d

# Backend + clean devbob
docker-compose --profile stable --profile devbob up -d

# Backend + 4 devbob agents
docker-compose --profile stable --profile devbob-dev up -d
```
