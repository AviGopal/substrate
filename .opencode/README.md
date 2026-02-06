# Multi-Repository Workspace Configuration

This directory contains the OpenCode configuration for managing all Metabob ecosystem repositories from a single location.

## 🎯 Purpose

This configuration allows you to work on multiple repositories simultaneously with:
- Unified Metabob integration (headless mode)
- Shared Playwright MCP configuration
- Consistent AI model settings
- Cross-repository code analysis

## 📁 Repository Structure

```
exp-repo/
├── .opencode/
│   ├── opencode.json          ← This workspace configuration
│   └── README.md              ← This file
├── metabob-opencode/          ← OpenCode CLI & SDK (TypeScript/Bun)
├── metabob-cli/               ← Metabob analysis engine (Python)
├── metabob-rpc-api/           ← Backend API service (Python/FastAPI)
├── metabob-dashboard/         ← Web dashboard UI (TypeScript/React)
└── metabob-proto/             ← Protocol buffer definitions
```

## 🔧 Configuration Overview

### Metabob Integration

```json
{
  "metabob": {
    "headless": true,              // No GUI - perfect for development
    "max_issues": 5,               // Focused context
    "min_severity": "MEDIUM",      // Actionable issues only
    "inject_annotations": true,    // Learn from past decisions
    "auto_impact_analysis": true   // Track change blast radius
  }
}
```

**Benefits:**
- ✅ Works across all repositories
- ✅ Consistent code quality standards
- ✅ Cross-repository issue detection
- ✅ No display server required

### Playwright MCP Integration

```json
{
  "mcp": {
    "playwright": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"]
    }
  }
}
```

**Enables:**
- Browser automation for `metabob-dashboard` testing
- UI component testing for `metabob-opencode` console
- Screenshot/video capture
- Interactive debugging

### Repository Definitions

Each repository is defined with:
- **name**: Repository identifier
- **path**: Relative path from workspace root
- **description**: Purpose of the repository
- **language**: Primary programming language
- **packageManager**: Dependency manager (bun, npm, pip)
- **devServer**: Development server configuration

## 🚀 Usage

### Working from Workspace Root

When you're in `/home/avi/documents/work/exp-repo`, OpenCode will:
1. Load this configuration
2. Scan all defined repositories
3. Provide cross-repository code analysis
4. Enable multi-repo workflows

### Working in Individual Repositories

When you're in a specific repository (e.g., `metabob-opencode/`):
1. The repository's local `.opencode/opencode.json` takes precedence
2. Falls back to workspace config for missing settings
3. Workspace-level Metabob and MCP settings still apply

### Hierarchy

```
/home/avi/documents/work/exp-repo/.opencode/opencode.json    ← Workspace-level
    ↓ inherits/overrides
metabob-opencode/.opencode/opencode.json                     ← Repo-level
```

## 💡 Common Workflows

### 1. Cross-Repository Analysis

```bash
# From workspace root
cd /home/avi/documents/work/exp-repo

# OpenCode will analyze all repositories
opencode "Find all REST API endpoints across metabob-rpc-api and metabob-opencode"
```

### 2. Multi-Repo Feature Development

```bash
# Work on a feature that spans multiple repos
opencode "Add user authentication to metabob-dashboard and metabob-rpc-api"
```

### 3. Consistent Refactoring

```bash
# Refactor patterns across all TypeScript codebases
opencode "Update all TypeScript repos to use async/await instead of promises"
```

### 4. Protocol Buffer Updates

```bash
# Update proto definitions and regenerate code in all repos
opencode "Add new field to User message in metabob-proto and update all consumers"
```

## 📊 Repository-Specific Commands

### metabob-opencode (TypeScript/Bun)

```bash
cd metabob-opencode
bun run dev          # Start development server
bun test             # Run tests
bunx playwright test # Run E2E tests
```

### metabob-cli (Python)

```bash
cd metabob-cli
python -m metabob_cli.commands serve  # Start CLI server
pytest tests/                          # Run tests
metabob-cli analyze ./                 # Analyze codebase
```

### metabob-rpc-api (Python/FastAPI)

```bash
cd metabob-rpc-api
python -m server.app       # Start API server
pytest tests/              # Run tests
```

### metabob-dashboard (TypeScript/React)

```bash
cd metabob-dashboard
npm run dev                # Start dev server
npm test                   # Run tests
npx playwright test        # Run E2E tests
```

## 🔍 File Ignoring

The workspace configuration ignores common build artifacts:
- `node_modules/` - NPM dependencies
- `__pycache__/` - Python bytecode
- `dist/`, `build/` - Build outputs
- `.venv/` - Python virtual environments
- `test-results/` - Test artifacts
- `.metabob/` - Metabob analysis cache

## 🎓 Best Practices

### 1. Start from Workspace Root

When working on features that span multiple repos:
```bash
cd /home/avi/documents/work/exp-repo
opencode "implement feature X"
```

### 2. Use Repo-Specific for Focused Work

For focused work on a single repo:
```bash
cd /home/avi/documents/work/exp-repo/metabob-opencode
opencode "refactor authentication module"
```

### 3. Keep Configurations in Sync

When updating settings:
1. Update workspace config for global settings
2. Update repo configs for repo-specific overrides
3. Test from both workspace and repo levels

### 4. Leverage Cross-Repo Analysis

Use Metabob to find patterns across repos:
- Duplicate code across services
- Inconsistent error handling
- API contract mismatches
- Proto definition usage

## 🐛 Troubleshooting

### Issue: Metabob not finding code in subdirectories

**Solution**: Ensure you're running from the workspace root:
```bash
cd /home/avi/documents/work/exp-repo
```

### Issue: Different behavior in workspace vs repo

**Check configuration hierarchy**:
```bash
# View workspace config
cat .opencode/opencode.json

# View repo config
cat metabob-opencode/.opencode/opencode.json
```

### Issue: MCP tools not available

**Verify MCP server**:
```bash
# Check if Playwright MCP is installed in any repo
find . -name "@playwright" -type d

# Install if missing
cd metabob-opencode
npm install --save-dev @playwright/mcp
```

## 📚 Related Documentation

- [Metabob OpenCode Setup](../metabob-opencode/DEV_SETUP.md)
- [Multi-Repo Development Guide](./MULTI_REPO_GUIDE.md) (if exists)
- [OpenCode Configuration Schema](https://opencode.ai/config.json)

## 🔄 Keeping Updated

When adding new repositories:

1. Add to workspace config:
   ```json
   {
     "workspace": {
       "repositories": [
         {
           "name": "new-repo",
           "path": "./new-repo",
           "description": "Description",
           "language": "typescript"
         }
       ]
     }
   }
   ```

2. Ensure repo has its own `.opencode/opencode.json` if needed

3. Update this README with new repo details

---

**Configuration Status**: ✅ Active and ready for multi-repo development

For questions or issues, refer to individual repository documentation or create an issue in the relevant repo.
