# Bootstrap Template Storage and Update Strategy

**Date**: 2026-02-26  
**Purpose**: Define how bootstrap templates are stored, included in containers, and updated

---

## Problem Statement

DevBob containers crash on startup because they expect bootstrap activity templates at `/metabob-proto/activities/bootstrap/` but these files are not included in the Docker image.

**Error**:
```
Bootstrap template file read failed for create-activity: ENOENT: no such file or directory, 
open '/metabob-proto/activities/bootstrap/create-activity-self-contained.json'
```

---

## Bootstrap Templates

**Required templates** (from `bootstrap-templates.ts`):
1. `create-activity-self-contained.json` - Activity creation
2. `debug-activity-self-contained.json` - Activity debugging
3. `evolve-activity-self-contained.json` - Activity evolution
4. `manage-session-memory.json` - Session memory management
5. `trace-data-flow-single-feature.json` - Data flow tracing
6. `trace-enforce-validate-loop.json` - Validation loop tracing

**Current location**: `repos/metabob-proto/activities/bootstrap/`

**Expected location in container**: `/metabob-proto/activities/bootstrap/`

---

## Storage Strategy

### Option 1: Direct Copy in Dockerfile (Simplest)
**Pros**: Simple, no dependencies, fast builds  
**Cons**: Templates are baked in, require image rebuild to update

```dockerfile
# In Dockerfile.devbob-ci, add after builder stage:
COPY repos/metabob-proto/activities/bootstrap /metabob-proto/activities/bootstrap/
```

### Option 2: Volume Mount (Most Flexible)
**Pros**: Easy updates, no rebuild needed  
**Cons**: Requires volume management, more complex deployment

```bash
docker run -v $(pwd)/repos/metabob-proto/activities/bootstrap:/metabob-proto/activities/bootstrap devbob:fixed
```

### Option 3: Git Submodule + Copy (Version Controlled)
**Pros**: Version controlled, can track updates  
**Cons**: Requires submodule management, more complex

```dockerfile
# Add metabob-proto as submodule
RUN git submodule update --init --recursive
COPY metabob-proto/activities/bootstrap /metabob-proto/activities/bootstrap/
```

### Option 4: Download on Startup (Dynamic)
**Pros**: Always latest, no rebuild  
**Cons**: Requires network, slower startup, needs update endpoint

```bash
# In entrypoint.sh:
if [ ! -d "/metabob-proto/activities/bootstrap" ]; then
  curl -o /tmp/bootstrap.tar.gz https://templates.metabob.com/bootstrap.tar.gz
  tar -xzf /tmp/bootstrap.tar.gz -C /metabob-proto/activities/
fi
```

### Option 5: Hybrid - Copy + Update Mechanism (Recommended)
**Pros**: Fast startup (local copy), can update without rebuild  
**Cons**: More complex, requires update script

```dockerfile
# Copy bootstrap templates into image
COPY repos/metabob-proto/activities/bootstrap /metabob-proto/activities/bootstrap/

# Add update script
COPY scripts/update-bootstrap-templates.sh /usr/local/bin/
```

```bash
# update-bootstrap-templates.sh
#!/bin/bash
# Update bootstrap templates from volume mount or git repo
if [ -d "/workspace/repos/metabob-proto/activities/bootstrap" ]; then
  rsync -av /workspace/repos/metabob-proto/activities/bootstrap/ /metabob-proto/activities/bootstrap/
  echo "✅ Bootstrap templates updated from workspace"
fi
```

---

## Recommended Solution: Hybrid Approach

### Implementation

#### 1. Update Dockerfile
```dockerfile
# =============================================================================
# Stage 4: Bootstrap Templates
# =============================================================================
FROM runtime AS with-templates

# Copy bootstrap templates from metabob-proto repository
# These templates are required for OpenCode ACP server startup
WORKDIR /build
COPY repos/metabob-proto/activities/bootstrap /metabob-proto/activities/bootstrap/

# Verify templates are present
RUN ls -la /metabob-proto/activities/bootstrap/ && \
    echo "✓ Bootstrap templates installed"

# Add template update script (optional, for runtime updates)
COPY scripts/update-bootstrap-templates.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/update-bootstrap-templates.sh

# Return to workspace
WORKDIR /workspace
```

#### 2. Create Update Script
```bash
#!/bin/bash
# /usr/local/bin/update-bootstrap-templates.sh
# Update bootstrap templates from mounted workspace

set -e

WORKSPACE_TEMPLATES="/workspace/repos/metabob-proto/activities/bootstrap"
CONTAINER_TEMPLATES="/metabob-proto/activities/bootstrap"

echo "🔄 Checking for bootstrap template updates..."

if [ -d "$WORKSPACE_TEMPLATES" ]; then
  echo "📦 Found templates in workspace: $WORKSPACE_TEMPLATES"
  
  # Compare timestamps
  if [ "$WORKSPACE_TEMPLATES" -nt "$CONTAINER_TEMPLATES" ]; then
    echo "⬆️  Updating templates from workspace..."
    rsync -av --delete "$WORKSPACE_TEMPLATES/" "$CONTAINER_TEMPLATES/"
    echo "✅ Bootstrap templates updated"
  else
    echo "✅ Templates are up to date"
  fi
else
  echo "ℹ️  No workspace templates found, using bundled templates"
fi
```

#### 3. Update Entrypoint
```bash
# In entrypoint-self-config.sh, add before starting service:

log_info "Updating bootstrap templates..."
if command -v update-bootstrap-templates.sh > /dev/null 2>&1; then
  update-bootstrap-templates.sh || log_warn "Template update failed (non-fatal)"
fi
```

---

## Directory Structure

```
metabob-devbob/
├── repos/
│   ├── metabob-proto/
│   │   └── activities/
│   │       └── bootstrap/                    # Source of truth
│   │           ├── create-activity-self-contained.json
│   │           ├── debug-activity-self-contained.json
│   │           ├── evolve-activity-self-contained.json
│   │           ├── manage-session-memory.json
│   │           ├── trace-data-flow-single-feature.json
│   │           └── trace-enforce-validate-loop.json
│   └── metabob-opencode/
│       └── docker/
│           ├── Dockerfile.devbob-ci          # Updated to include templates
│           └── scripts/
│               └── update-bootstrap-templates.sh
└── Docker Container:
    └── /metabob-proto/activities/bootstrap/  # Destination in container
        └── (same files as above)
```

---

## Update Workflows

### Workflow 1: Update Templates in Development
```bash
# 1. Edit templates in repos/metabob-proto/activities/bootstrap/
vim repos/metabob-proto/activities/bootstrap/manage-session-memory.json

# 2. Restart container (templates auto-update via volume mount)
docker restart devbob-clean

# 3. Or manually trigger update
docker exec devbob-clean update-bootstrap-templates.sh
```

### Workflow 2: Update Templates in Production
```bash
# 1. Update templates in metabob-proto repo
git pull origin main  # in repos/metabob-proto

# 2. Rebuild image with new templates
cd repos/metabob-opencode
docker build -f docker/Dockerfile.devbob-ci -t devbob:v1.1.0 .

# 3. Deploy new image
docker-compose pull devbob-clean
docker-compose up -d devbob-clean
```

### Workflow 3: Hot Update (No Rebuild)
```bash
# If volume mounted:
# 1. Update templates on host
vim repos/metabob-proto/activities/bootstrap/manage-session-memory.json

# 2. Container automatically picks up changes
docker exec devbob-clean update-bootstrap-templates.sh

# 3. Verify update
docker exec devbob-clean ls -la /metabob-proto/activities/bootstrap/
```

---

## Template Versioning

### Version Control Strategy
1. **Git Repository**: Store templates in `repos/metabob-proto`
2. **Semantic Versioning**: Tag releases (v1.0.0, v1.1.0, etc.)
3. **Change Log**: Document changes in CHANGELOG.md
4. **Docker Image Tags**: Match image tags to template versions

### Template Update Detection
```bash
# Check template versions in container
docker exec devbob-clean cat /metabob-proto/activities/bootstrap/manage-session-memory.json | jq '.version'

# Compare with source
cat repos/metabob-proto/activities/bootstrap/manage-session-memory.json | jq '.version'
```

---

## Deployment Configurations

### Docker Compose
```yaml
services:
  devbob-clean:
    image: devbob:fixed
    volumes:
      # Mount workspace for auto-updates
      - ./repos/metabob-proto/activities/bootstrap:/metabob-proto/activities/bootstrap:ro
    environment:
      - BOOTSTRAP_UPDATE_MODE=auto  # auto, manual, disabled
```

### Kubernetes
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bootstrap-templates
data:
  # Include all template JSON files
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devbob
spec:
  template:
    spec:
      containers:
      - name: devbob
        volumeMounts:
        - name: bootstrap-templates
          mountPath: /metabob-proto/activities/bootstrap
      volumes:
      - name: bootstrap-templates
        configMap:
          name: bootstrap-templates
```

---

## Testing Strategy

### Verify Templates in Image
```bash
# Build image
docker build -f docker/Dockerfile.devbob-ci -t devbob:test .

# Check templates are present
docker run --rm devbob:test ls -la /metabob-proto/activities/bootstrap/

# Verify count
docker run --rm devbob:test sh -c "ls /metabob-proto/activities/bootstrap/*.json | wc -l"
# Should output: 6
```

### Test Template Updates
```bash
# Start container with volume
docker run -d --name test-devbob \
  -v $(pwd)/repos/metabob-proto/activities/bootstrap:/workspace/repos/metabob-proto/activities/bootstrap \
  devbob:test

# Update a template
echo '{"version": "2.0.0"}' > repos/metabob-proto/activities/bootstrap/test.json

# Trigger update
docker exec test-devbob update-bootstrap-templates.sh

# Verify update
docker exec test-devbob cat /metabob-proto/activities/bootstrap/test.json
```

---

## Rollback Strategy

### If Templates Break Container
```bash
# Option 1: Revert to previous image
docker run devbob:v1.0.0  # Known good version

# Option 2: Mount old templates
docker run -v /backup/bootstrap:/metabob-proto/activities/bootstrap devbob:latest

# Option 3: Disable bootstrap loading
docker run -e OPENCODE_SKIP_BOOTSTRAP=true devbob:latest
```

---

## Summary

**Recommended Approach**: **Hybrid - Copy + Update Mechanism**

1. **Copy templates into image** for fast startup and offline capability
2. **Add update script** for runtime updates without rebuild
3. **Support volume mounts** for development flexibility
4. **Version control** via git for tracking changes

**Benefits**:
- ✅ Fast container startup (templates bundled)
- ✅ Can update without rebuild (via volume or script)
- ✅ Version controlled in git
- ✅ Works offline (bundled fallback)
- ✅ Flexible deployment (Docker Compose, K8s)

**Implementation Priority**:
1. **Immediate**: Update Dockerfile to copy templates (fixes crash)
2. **Short-term**: Add update script for development convenience
3. **Long-term**: Implement versioning and K8s ConfigMap deployment

---

**Next Action**: Update `Dockerfile.devbob-ci` to include bootstrap templates and rebuild image.
