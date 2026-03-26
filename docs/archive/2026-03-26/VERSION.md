# DevBob Versioning

## Current Version

**v1.0.1** - Production-ready with Helmfile configuration management

## Deployment Workflow

```bash
# 1. Build new version
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
docker push metabobapp/devbob:v1.0.2

# 2. Update Chart.yaml
vim repos/platform/metabob-apps/charts/opencode-server/charts/Chart.yaml
# version: 1.0.2
# appVersion: "1.0.2"

# 3. Update values
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
# tag: "v1.0.2"

# 4. Deploy
cd repos/platform/metabob-apps
helmfile -e production apply
```

## Version History

### v1.0.1 (2026-02-19) - Current
**Changes**:
- Multi-stage Dockerfile with standalone binary
  - metabob-cli-builder stage (Python venv)
  - opencode-builder stage (Bun builds standalone binary)
  - runtime stage (minimal Debian with only binaries)
- ConfigMap-based configuration management
  - Config managed through Helmfile values
  - No image rebuilds for config changes
  - Environment-specific configurations
- Proper Helmfile integration
  - ConfigMap template for opencode.json
  - Volume mount in deployment
  - GitOps-compliant workflow

**Image Details**:
- SHA256: TBD (build in progress)
- Base: debian:12-slim
- Runtime: OpenCode standalone binary (no bun, no source code)
- Size: ~1-2GB (down from 11GB dev image)

**Fixed Issues**:
- ❌ OLD: Bun runtime in production (unnecessary)
- ❌ OLD: Source code in production image (security risk)
- ❌ OLD: Config baked into image (requires rebuild)
- ❌ OLD: Manual kubectl commands (bypasses GitOps)
- ✅ NEW: Standalone binary only
- ✅ NEW: ConfigMap for configuration
- ✅ NEW: Helmfile workflow

### v1.0.0 (2026-02-19) - Deprecated
**Issues**:
- Used `opencode acp` command (wrong - stdin/stdout mode)
- tsx dependency issue in slack package
- bun path issues
- Config baked into image

**What Was Fixed in v1.0.1**:
- Fixed: `args: ["serve"]` (correct HTTP server mode)
- Fixed: tsx dependency from "catalog:" to "^4.19.0"
- Fixed: bun path to `/usr/local/bin/bun`
- Fixed: slack-bot backend URL to internal service
- Added: ConfigMap-based configuration
- Added: Multi-stage build for production

## Semantic Versioning

- **MAJOR** (v2.0.0): Breaking changes, incompatible API changes
- **MINOR** (v1.1.0): New features, backwards compatible
- **PATCH** (v1.0.1): Bug fixes, backwards compatible

## Build Instructions

### Production Build
```bash
# Build multi-stage production image
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.1 .

# Tag as latest
docker tag metabobapp/devbob:v1.0.1 metabobapp/devbob:latest

# Push both tags
docker push metabobapp/devbob:v1.0.1
docker push metabobapp/devbob:latest
```

### Development Build (Specific Target)
```bash
# Build specific stage for testing
docker build -f docker/Dockerfile.devbob \
  --target opencode-builder \
  -t opencode-builder:test .
```

## Configuration Management

Configuration is now managed through Kubernetes ConfigMaps via Helmfile.

### Update Configuration (No Image Rebuild)
```bash
# Edit values file
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml

# Deploy
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

See `HELMFILE_CONFIG_MANAGEMENT.md` for details.

## Deployment Checklist

When releasing a new version:

- [ ] Update code
- [ ] Build Docker image with new version tag
- [ ] Push to registry (`docker push`)
- [ ] Update `Chart.yaml` version
- [ ] Update `values.yaml` image tag
- [ ] Preview changes (`helmfile diff`)
- [ ] Deploy (`helmfile apply`)
- [ ] Verify deployment (`kubectl get pods`)
- [ ] Check logs (`kubectl logs`)
- [ ] Update this VERSION.md
- [ ] Git commit and tag

## Rollback

### Using Helm
```bash
helm rollback opencode-server -n metabob
```

### Using Helmfile
```bash
# Revert values file to previous version
git revert <commit>

# Deploy previous version
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

## Image Locations

- **Registry**: Docker Hub
- **Repository**: `metabobapp/devbob`
- **Tags**: `v1.0.1`, `latest`
- **URL**: https://hub.docker.com/r/metabobapp/devbob

## Next Version Planning

### v1.0.2 (Patch)
- Bug fixes
- Performance improvements
- Security patches

### v1.1.0 (Minor)
- New features
- Additional MCP integrations
- Enhanced monitoring

### v2.0.0 (Major)
- Breaking API changes
- New architecture
- Major feature releases
