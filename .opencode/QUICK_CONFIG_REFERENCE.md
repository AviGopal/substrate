# OpenCode Configuration Quick Reference

## 🚀 Minimal Configuration

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "/home/avi/.local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true
  }
}
```

## 🎯 Recommended Development Setup

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "/home/avi/.local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "headless": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true
  },
  "mcp": {
    "playwright": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"]
    }
  }
}
```

## ⚠️ Common Mistakes

### ❌ WRONG: development.playwright

```json
{
  "development": {
    "playwright": { "enabled": true }
  }
}
```

### ✅ CORRECT: mcp.playwright

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

## 🔑 Key Configuration Options

### Metabob (27 options available)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cli_path` | string | - | Path to metabob-cli |
| `base_url` | string | `https://ide.metabob.com` | API URL |
| `auto_inject` | boolean | `true` | Auto-inject context |
| `headless` | boolean | `false` | No GUI mode |
| `max_issues` | number | `3` | Max issues in context |
| `min_severity` | enum | `HIGH` | HIGH/MEDIUM/LOW |
| `inject_annotations` | boolean | `true` | Include design docs |
| `auto_impact_analysis` | boolean | `true` | Auto change analysis |

[See CONFIG_REFERENCE.md for all 27 options]

### MCP Servers

#### Local MCP (Runs as process)

```json
{
  "mcp": {
    "server-name": {
      "type": "local",
      "command": ["npx", "server"],
      "enabled": true
    }
  }
}
```

#### Remote MCP (HTTP connection)

```json
{
  "mcp": {
    "server-name": {
      "type": "remote",
      "url": "https://mcp.example.com",
      "enabled": true
    }
  }
}
```

## 📚 Quick Links

- **Full Reference**: [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md)
- **Setup Activity**: `setup-opencode-workspace-configuration`
- **Validate Activity**: `validate-opencode-setup`
- **Schema**: https://opencode.ai/config.json

## 🔧 Quick Commands

```bash
# Validate configuration
opencode "validate my configuration"

# Setup new workspace
opencode "setup opencode workspace"

# View current config
cat .opencode/opencode.json

# Test MCP connectivity
# (Use test_metabob_mcp tool in OpenCode)
```

## 🎓 Configuration Hierarchy

```
1. Global: ~/.config/opencode/opencode.json
   ↓
2. Workspace: /workspace/.opencode/opencode.json
   ↓
3. Repository: /repo/.opencode/opencode.json
   ↓
4. Environment: OPENCODE_CONFIG
   ↓
5. CLI flags: --config
```

Later configs override earlier ones.

---

**Last Updated**: December 22, 2025  
**For full details**: See [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md)
