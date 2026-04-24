# Vessel Discovery Client Build Fix

## Problem

CI/CD build was failing with:
```
ENOENT: failed opening cache/package/version dir for package @metabob/vessel-discovery-client
ERROR: failed to build: process "/bin/sh -c bun install --frozen-lockfile" did not complete successfully: exit code: 1
```

**Failed Build**: gh run 24487298711 in MetabobProject/deployment

**Root Cause**: The `@metabob/vessel-discovery-client` package uses `file:../../packages/vessel-discovery-client` path in package.json, but during Docker builds in the deployment repository, this path didn't exist in the build context.

## Solution

### 1. Added Shared Package Directory

Copied `@metabob/vessel-discovery-client` to deployment repository:
- **Location**: `repos/deployment/packages/vessel-discovery-client/`
- **Contents**: Full source, dist/, node_modules/, package.json, bun.lock
- **Purpose**: Make package available to all vessels during Docker build

### 2. Updated Dockerfiles to Use Parent Context

Modified Dockerfiles for vessels using the package to use `vessels/` as build context:

**vessels/minibob/Dockerfile**:
```dockerfile
FROM oven/bun:1.2 AS build
WORKDIR /app/minibob

# Copy shared packages first
COPY ../packages /app/packages

# Copy package files
COPY minibob/package.json minibob/bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY minibob/src ./src
COPY minibob/index.ts ./
COPY minibob/tsconfig.json ./
```

**vessels/user-vessel/Dockerfile**:
```dockerfile
FROM oven/bun:1.2 AS build
WORKDIR /app/user-vessel

# Copy shared packages first
COPY ../packages /app/packages

# Copy package files
COPY user-vessel/package.json user-vessel/bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY user-vessel/src ./src
COPY user-vessel/sql ./sql
COPY user-vessel/index.ts ./
COPY user-vessel/tsconfig.json ./
```

### 3. Build Script Auto-Detection

The build script (`repos/deployment/scripts/build_changed.sh`) automatically detects the correct build context:

```bash
# If Dockerfile uses COPY {vessel_name}/ paths, use vessels/ as context
# Otherwise, use vessels/{vessel_name}/ as context
```

Since we now use `COPY minibob/...` and `COPY user-vessel/...`, the build context is automatically `vessels/`.

## Files Changed

### Main Workspace (repos/)
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/Dockerfile`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/user-vessel/Dockerfile`

### Deployment Repository (repos/deployment/)
- `packages/vessel-discovery-client/` - **NEW**: Full package directory
- `vessels/minibob/Dockerfile` - Updated build context
- `vessels/user-vessel/Dockerfile` - Updated build context

## Testing

The fix can be tested by:

1. **Local build test**:
   ```bash
   cd repos/deployment
   ./scripts/build_changed.sh --env canary --force
   ```

2. **Push to dev branch** (triggers canary deployment):
   ```bash
   cd repos/deployment
   git add packages/ vessels/user-vessel/Dockerfile
   git commit -m "fix(build): resolve vessel-discovery-client Docker build cache corruption"
   git push origin dev
   ```

3. **Monitor CI/CD**:
   ```bash
   gh run list --repo MetabobProject/deployment --limit 5
   gh run view <run-id> --log
   ```

## Benefits

1. **No more cache corruption**: Package files are copied explicitly, not referenced via Bun's cache
2. **Reproducible builds**: Package version is controlled by what's in `packages/` directory
3. **No lockfile conflicts**: Each vessel resolves dependencies independently
4. **Automatic context detection**: Build script determines context from Dockerfile COPY paths

## Consuming Vessels

Currently, only 2 vessels use `@metabob/vessel-discovery-client`:
- **minibob**: Discovery registration + enhanced impulse resolution
- **user-vessel**: Discovery registration + resolver endpoints

Future vessels can reference the package using the same pattern:
```json
{
  "dependencies": {
    "@metabob/vessel-discovery-client": "file:../../packages/vessel-discovery-client"
  }
}
```

## Related Documentation

- [DISCOVERY_INTEGRATION.md](/home/avi/documents/work/exp-repo/metabob-devbob/DISCOVERY_INTEGRATION.md)
- [packages/vessel-discovery-client/README.md](/home/avi/documents/work/exp-repo/metabob-devbob/packages/vessel-discovery-client/README.md)
- [repos/deployment/DEPLOYMENT_WORKFLOW.md](/home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/DEPLOYMENT_WORKFLOW.md)

## Next Steps

1. Commit and push changes to deployment repo
2. Verify canary build succeeds
3. Validate minibob and user-vessel deploy correctly
4. Check discovery registration works in deployed environment
