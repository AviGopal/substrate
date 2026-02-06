# OpenCode Configuration Reference

Complete reference for `opencode.json` configuration file with all available keys and options.

## 📋 Table of Contents

- [Schema Overview](#schema-overview)
- [Metabob Integration](#metabob-integration)
- [MCP (Model Context Protocol)](#mcp-model-context-protocol)
- [Workspace Configuration](#workspace-configuration)
- [Provider Configuration](#provider-configuration)
- [Common Configuration Patterns](#common-configuration-patterns)
- [Configuration Hierarchy](#configuration-hierarchy)
- [Validation](#validation)

---

## Schema Overview

All configuration files should reference the JSON schema:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

This enables:
- ✅ Auto-completion in editors
- ✅ Validation of configuration keys
- ✅ Inline documentation

---

## Metabob Integration

### Required Configuration

```json
{
  "metabob": {
    "cli_path": "/home/avi/.local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true
  }
}
```

### All Available Options

```json
{
  "metabob": {
    // REQUIRED
    "cli_path": "/home/avi/.local/bin/metabob-cli",
    
    // Core settings
    "auto_inject": true,               // Auto-inject code quality context
    "base_url": "http://localhost:8080", // Metabob API URL
    "api_key": "your-key-here",        // Optional API key
    
    // Headless mode (NEW)
    "headless": true,                  // Run without GUI
    
    // Context control
    "max_issues": 5,                   // Max issues in context (default: 3)
    "min_severity": "MEDIUM",          // Min severity: HIGH, MEDIUM, LOW
    "context_budget_tokens": 10000,    // Token budget for context
    
    // Feature flags
    "inject_annotations": true,        // Include design decisions
    "auto_impact_analysis": true,      // Auto-analyze change impact
    "include_history": true,           // Include resolution history
    "intent_aware_filtering": true,    // Filter by user intent
    "progressive_disclosure": false,   // Show issues progressively
    
    // Paths
    "state_directory": ".metabob",     // State storage location
    "include_paths": ["src/**"],       // Optional: files to analyze
    "exclude_paths": ["test/**"],      // Optional: files to exclude
    
    // Cache
    "cache_timeout": 300,              // Cache timeout in seconds
    
    // Subagent behavior
    "subagent_mode": "scoped",         // inherit, scoped, tools_only, none
    "subagent_token_budget": 5000,     // Token budget for subagents
    "subagent_include_annotations": true,
    "subagent_include_related": true,
    
    // Template registration
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",       // strict, best-effort
      "strategy": "on-create"          // on-create, on-save, on-load, on-first-use, never
    }
  }
}
```

### Key Options Explained

#### `headless` (boolean, default: false)

**IMPORTANT**: Run Metabob without GUI. Perfect for:
- Server environments without display
- CI/CD pipelines
- Remote development
- Resource-constrained systems

```json
{
  "metabob": {
    "headless": true
  }
}
```

#### `max_issues` (integer, default: 3)

Maximum number of issues to inject into agent context:
- **1-3**: Focused (recommended for most workflows)
- **5**: Balanced (good for code reviews)
- **10+**: Comprehensive (may overwhelm context)

#### `min_severity` (enum, default: "HIGH")

Minimum severity for auto-injected issues:
- **HIGH**: Only critical issues
- **MEDIUM**: Actionable issues (recommended)
- **LOW**: All issues (verbose)

#### `auto_impact_analysis` (boolean, default: true)

Automatically analyze change impact when:
- User mentions refactoring
- Large changes are made
- Critical components modified

#### `inject_annotations` (boolean, default: true)

Include component annotations (design decisions) in context:
- Why code exists
- Design alternatives considered
- Known constraints

#### `subagent_mode` (enum, default: "scoped")

How subagents receive Metabob context:
- **inherit**: All parent context (full visibility)
- **scoped**: Targeted issues only (recommended)
- **tools_only**: No auto-inject, tools available
- **none**: Metabob disabled for subagents

---

## MCP (Model Context Protocol)

### Playwright MCP (CORRECT Configuration)

**❌ INCORRECT** (non-standard):
```json
{
  "development": {
    "playwright": {
      "enabled": true
    }
  }
}
```

**✅ CORRECT** (MCP standard):
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

### MCP Configuration Options

#### Local MCP Server

```json
{
  "mcp": {
    "server-name": {
      "type": "local",                    // REQUIRED
      "command": ["npx", "mcp-server"],   // REQUIRED: Command to start server
      "enabled": true,                    // Optional: Enable on startup
      "environment": {                    // Optional: Environment variables
        "API_KEY": "secret"
      },
      "timeout": 5000                     // Optional: Timeout in ms (default: 5000)
    }
  }
}
```

#### Remote MCP Server

```json
{
  "mcp": {
    "remote-service": {
      "type": "remote",                   // REQUIRED
      "url": "https://mcp.example.com",   // REQUIRED: Server URL
      "enabled": true,                    // Optional: Enable on startup
      "headers": {                        // Optional: HTTP headers
        "Authorization": "Bearer token"
      },
      "timeout": 5000                     // Optional: Timeout in ms
    }
  }
}
```

### Common MCP Servers

#### Playwright (Browser Automation)

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

**Enables**:
- Browser control via AI agents
- Screenshot/video capture
- UI testing automation
- Interactive debugging

#### Metabob (Auto-configured)

When `metabob.auto_inject` is enabled, OpenCode automatically configures:

```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "enabled": true
    }
  }
}
```

**Manual configuration** (if auto-config disabled):
```json
{
  "metabob": {
    "auto_inject": false
  },
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["/custom/path/metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "your-key"
      },
      "enabled": true
    }
  }
}
```

---

## Workspace Configuration

### Multi-Repository Workspace

```json
{
  "workspace": {
    "type": "multi-repo",
    "repositories": [
      {
        "name": "frontend",
        "path": "./frontend",
        "description": "React frontend application",
        "language": "typescript",
        "packageManager": "npm",
        "devServer": {
          "command": "npm run dev",
          "port": 3000
        }
      },
      {
        "name": "backend",
        "path": "./backend",
        "description": "API backend service",
        "language": "python",
        "packageManager": "pip",
        "devServer": {
          "command": "python -m server.app",
          "port": 5000
        }
      }
    ]
  }
}
```

### Ignore Patterns

```json
{
  "ignore": [
    "**/node_modules/**",
    "**/.git/**",
    "**/__pycache__/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

---

## Provider Configuration

### Anthropic Claude

```json
{
  "provider": {
    "anthropic": {
      "models": {
        "claude-sonnet-4-5-thinking": {
          "id": "claude-sonnet-4-5-20250929",
          "name": "Claude Sonnet 4.5 (Thinking)",
          "options": {
            "thinking": {
              "type": "enabled",
              "budgetTokens": 10000
            }
          }
        }
      }
    }
  }
}
```

### Custom Models

```json
{
  "provider": {
    "custom": {
      "models": {
        "my-model": {
          "id": "model-id",
          "name": "Display Name",
          "options": {
            "temperature": 0.7,
            "maxTokens": 8000
          }
        }
      }
    }
  }
}
```

---

## Common Configuration Patterns

### Pattern 1: Development Setup (Headless + MCP)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "/home/user/.local/bin/metabob-cli",
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

### Pattern 2: CI/CD Pipeline

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "headless": true,
    "auto_inject": true,
    "max_issues": 10,
    "min_severity": "MEDIUM",
    "cache_timeout": 600
  },
  "ignore": [
    "**/test/**",
    "**/dist/**",
    "**/coverage/**"
  ]
}
```

### Pattern 3: Multi-Repo Workspace

```json
{
  "$schema": "https://opencode.ai/config.json",
  "workspace": {
    "type": "multi-repo",
    "repositories": [
      {
        "name": "service-a",
        "path": "./service-a",
        "language": "typescript"
      },
      {
        "name": "service-b",
        "path": "./service-b",
        "language": "python"
      }
    ]
  },
  "metabob": {
    "cli_path": "/usr/local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "headless": true
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

### Pattern 4: Remote Development

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "/home/user/.local/bin/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "headless": true
  },
  "remote": {
    "dev-server": {
      "host": "dev.example.com",
      "user": "developer",
      "directory": "/home/developer/project",
      "port": 22,
      "auto_sync": true
    }
  }
}
```

---

## Configuration Hierarchy

OpenCode loads configuration in this order (later overrides earlier):

```
1. Global config (~/.config/opencode/opencode.json)
   ↓
2. Workspace config (/path/to/workspace/.opencode/opencode.json)
   ↓
3. Repository config (/path/to/repo/.opencode/opencode.json)
   ↓
4. Environment variables (OPENCODE_CONFIG, OPENCODE_CONFIG_CONTENT)
   ↓
5. Command-line flags
```

### Example Hierarchy

```
~/.config/opencode/opencode.json
{
  "metabob": {
    "headless": true
  }
}

/workspace/.opencode/opencode.json
{
  "metabob": {
    "max_issues": 5
  }
}

RESULT (merged):
{
  "metabob": {
    "headless": true,    // From global
    "max_issues": 5      // From workspace
  }
}
```

---

## Validation

### Manual Validation

Check configuration syntax:

```bash
# Using jq
cat .opencode/opencode.json | jq .

# Using python
python -m json.tool .opencode/opencode.json
```

### Schema Validation

Validate against OpenCode schema:

```bash
# Using activity (recommended)
opencode "validate my opencode.json configuration"

# Or use the validate-opencode-config activity
# (Created in this session)
```

### Common Validation Errors

#### Error: Invalid MCP configuration

**Problem**:
```json
{
  "development": {
    "playwright": { ... }
  }
}
```

**Solution**: Use `mcp` key:
```json
{
  "mcp": {
    "playwright": { ... }
  }
}
```

#### Error: Missing required keys

**Problem**:
```json
{
  "metabob": {
    "headless": true
  }
}
```

**Solution**: Add required keys:
```json
{
  "metabob": {
    "cli_path": "/path/to/metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "headless": true
  }
}
```

#### Error: Invalid severity level

**Problem**:
```json
{
  "metabob": {
    "min_severity": "CRITICAL"
  }
}
```

**Solution**: Use valid enum:
```json
{
  "metabob": {
    "min_severity": "HIGH"  // Or "MEDIUM", "LOW"
  }
}
```

---

## Quick Reference

### Must-Have Keys

```json
{
  "$schema": "https://opencode.ai/config.json",
  "metabob": {
    "cli_path": "...",
    "base_url": "...",
    "auto_inject": true
  }
}
```

### Recommended for Development

```json
{
  "metabob": {
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

### Recommended for CI/CD

```json
{
  "metabob": {
    "headless": true,
    "auto_inject": true,
    "max_issues": 10,
    "cache_timeout": 600
  }
}
```

---

## Resources

- **Schema**: https://opencode.ai/config.json
- **Activity**: `setup-opencode-workspace` (created in this session)
- **Activity**: `validate-opencode-config` (created in this session)
- **Documentation**: See `.opencode/README.md`
- **Examples**: See `WORKSPACE_GUIDE.md`

---

**Last Updated**: December 22, 2025  
**Version**: 1.0  
**Status**: ✅ Complete and validated
