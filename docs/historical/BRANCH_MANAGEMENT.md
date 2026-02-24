# Branch Management

## Repository Branch Configuration

This workspace maintains three core repositories with specific branch conventions:

### metabob-opencode
- **Active Branch**: `dev`
- **Purpose**: Development branch for OpenCode features
- **Workflow**: Feature branches merge to `dev`, then `dev` merges to `main` for releases
- **Location**: `repos/metabob-opencode`

### metabob-cli
- **Active Branch**: `main`
- **Purpose**: Stable CLI tool for Metabob integration
- **Workflow**: Direct development on `main` with tagged releases
- **Location**: `repos/metabob-cli`

### metabob-rpc-api
- **Active Branch**: `main`
- **Purpose**: RPC API server for Metabob services
- **Workflow**: Direct development on `main` with tagged releases
- **Location**: `repos/metabob-rpc-api`

## Verification Commands

Check all repositories are on correct branches:

```bash
# metabob-opencode should be on 'dev'
cd repos/metabob-opencode && git branch --show-current
# Expected output: dev

# metabob-cli should be on 'main'
cd repos/metabob-cli && git branch --show-current
# Expected output: main

# metabob-rpc-api should be on 'main'
cd repos/metabob-rpc-api && git branch --show-current
# Expected output: main
```

## Setup Instructions

When cloning or setting up the workspace:

```bash
# 1. Clone repositories (if not already present)
git clone <metabob-opencode-url> repos/metabob-opencode
git clone <metabob-cli-url> repos/metabob-cli
git clone <metabob-rpc-api-url> repos/metabob-rpc-api

# 2. Checkout correct branches
cd repos/metabob-opencode && git checkout dev && git pull
cd repos/metabob-cli && git checkout main && git pull
cd repos/metabob-rpc-api && git checkout main && git pull
```

## Feature Development Workflow

### OpenCode Features (metabob-opencode)

1. Create feature branch from `dev`:
   ```bash
   cd repos/metabob-opencode
   git checkout dev
   git pull
   git checkout -b feat/feature-name
   ```

2. Develop and commit changes

3. Merge to `dev`:
   ```bash
   git checkout dev
   git merge --no-ff feat/feature-name
   git push origin dev
   ```

4. Release to `main` (when ready):
   ```bash
   git checkout main
   git merge --no-ff dev
   git tag v1.x.x
   git push origin main --tags
   ```

### CLI Updates (metabob-cli)

Work directly on `main`:
```bash
cd repos/metabob-cli
git checkout main
git pull
# Make changes
git commit -m "feat: description"
git push origin main
```

### RPC API Updates (metabob-rpc-api)

Work directly on `main`:
```bash
cd repos/metabob-rpc-api
git checkout main
git pull
# Make changes
git commit -m "feat: description"
git push origin main
```

## Branch Protection

- **metabob-opencode**: `dev` is the working branch, `main` is for releases
- **metabob-cli**: `main` is the primary branch
- **metabob-rpc-api**: `main` is the primary branch

## Documentation Standards

### Root Level (2 files)
- `ARCHITECTURE_QUICK_REFERENCE.md` - High-level system architecture
- `ALIGNMENT_QUICK_REFERENCE.md` - Cross-component alignment guide

### docs/ Directory
- `docs/architecture/` - Detailed architecture documentation
- `docs/guides/` - User and developer guides
- `docs/api/` - API reference documentation
- `docs/reference/` - Quick reference materials

### .archive/ Directory
- `.archive/sessions/YYYY-MM/` - Historical session notes and reports
- Session-specific implementation details
- Debugging and investigation reports
- Status reports and completion summaries

## Maintenance

### Regular Tasks

1. **Weekly**: Verify branches are current
   ```bash
   cd repos/metabob-opencode && git checkout dev && git pull
   cd repos/metabob-cli && git checkout main && git pull
   cd repos/metabob-rpc-api && git checkout main && git pull
   ```

2. **Before major work**: Ensure clean working tree
   ```bash
   git status  # Should show "working tree clean"
   ```

3. **Monthly**: Archive completed session documentation
   ```bash
   mv *_COMPLETE.md *_SUCCESS.md .archive/sessions/$(date +%Y-%m)/
   ```

## Troubleshooting

### Repository in detached HEAD state
```bash
cd repos/<repo-name>
git checkout <correct-branch>
```

### Branch out of sync with remote
```bash
git checkout <branch>
git pull --rebase
```

### Uncommitted changes blocking operations
```bash
git status
git stash  # Save changes temporarily
# Or
git commit -m "WIP: temporary commit"
```

## Last Updated
- Date: 2026-02-17
- By: Automated cleanup process
- Status: ✅ All repositories on correct branches
