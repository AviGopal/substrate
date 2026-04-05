# MiniBob Configuration Guide

## Overview

MiniBob uses a **priority-based configuration system** that resolves config values from multiple sources:

1. **Priority 10** (Highest): Environment variables
2. **Priority 20**: Project config (`.metabob/config.json`)
3. **Priority 30**: User config (`~/.metabob/config.json`)
4. **Default**: Hardcoded defaults

## Configuration Locations

```
~/.metabob/config.json          ← User-level (applies to all projects)
.metabob/config.json            ← Project-level (applies to current project)
.metabob.json                   ← Alternative project-level name
metabob.json                    ← Alternative project-level name
Environment variables           ← Highest priority (override everything)
```

## User-Level Configuration

**File**: `~/.metabob/config.json`

This is your personal config that applies to all MiniBob instances on your machine.

### Minimal Example

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "test-api-key-123",
    "orgId": "metabob_internal"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
```

### Complete User Config Schema

```json
{
  "metabob": {
    "apiKey": "optional-api-key-for-backend",
    "endpoint": "https://activity.metabob.com"
  },

  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-your-api-key"
    },
    "openai": {
      "apiKey": "sk-your-openai-key"
    }
  },

  "defaults": {
    "provider": "anthropic",                    // or "openai"
    "model": "claude-sonnet-4-20250514",
    "workingDirectory": "/path/to/work",
    "templatesDir": "./templates",
    "port": 8080,
    "host": "0.0.0.0",
    "autoCommit": false
  },

  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "test-api-key-123",
    "orgId": "metabob_internal",
    "projectId": "optional-project-id"
  },

  "vessels": {
    "metabob": {
      "type": "http",
      "endpoint": "https://activity.metabob.com",
      "capabilities": ["activities", "impulses", "executions", "thompson-sampling"]
    }
  }
}
```

## Project-Level Configuration

**Files**: `.metabob/config.json` or `.metabob.json` or `metabob.json`

Project-specific config that overrides user config (but not environment variables).

### Example

```json
{
  "workingDirectory": "/home/user/project",
  "templatesDir": "./.minibob/templates",
  "autoCommit": true,
  "instance": {
    "instanceId": "minibob-project-dev",
    "apiKey": "project-specific-api-key"
  }
}
```

## Environment Variables

Environment variables have **highest priority** and override all config files.

| Variable | Purpose | Example |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (Priority 10) | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key (Priority 10) | `sk-...` |
| `MINIBOB_PROVIDER` | LLM provider | `anthropic` or `openai` |
| `MINIBOB_MODEL` | Model to use | `claude-sonnet-4-20250514` |
| `MINIBOB_WORKDIR` | Working directory | `/home/user/myproject` |
| `MINIBOB_TEMPLATES` | Templates directory | `./templates` |
| `MINIBOB_PORT` | Server port (for --daemon) | `8080` |
| `MINIBOB_HOST` | Server host | `0.0.0.0` |
| `MINIBOB_AUTO_COMMIT` | Auto-commit changes | `true` or `false` |
| `MINIBOB_INSTANCE_ID` | Instance identifier | `minibob-local-001` |
| `MINIBOB_INSTANCE_API_KEY` | Instance API key | `test-api-key-123` |
| `MINIBOB_ORG_ID` | Organization ID | `metabob_internal` |
| `MINIBOB_PROJECT_ID` | Project ID | `project-123` |
| `ACTIVITY_API_ENDPOINT` | Backend API URL | `https://activity.metabob.com` |
| `IDENTITY_ENDPOINT` | Identity service URL | `http://identity.metabob.local` |

### Setting Environment Variables

```bash
# Temporary (for current session)
export ANTHROPIC_API_KEY="sk-ant-..."
export MINIBOB_INSTANCE_ID="minibob-001"
minibob --single "your goal"

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
echo 'export MINIBOB_INSTANCE_ID="minibob-001"' >> ~/.bashrc
source ~/.bashrc
```

## Required Configuration

### Minimum Requirements

For MiniBob to run, you need **at least one** API key:

```bash
# Option 1: Anthropic (Claude)
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Option 2: OpenAI
export OPENAI_API_KEY="sk-your-key-here"
```

### For Production Backend Integration

To use the learning system, add instance credentials:

```json
{
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "test-api-key-123",
    "orgId": "metabob_internal"
  }
}
```

### For Kubernetes Deployments

```json
{
  "vessels": {
    "metabob": {
      "endpoint": "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
    }
  }
}
```

## Setup Instructions

### Step 1: Create User Config Directory

```bash
mkdir -p ~/.metabob
```

### Step 2: Create User Config File

```bash
cat > ~/.metabob/config.json << 'EOF'
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-YOUR-API-KEY-HERE"
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "test-api-key-123",
    "orgId": "metabob_internal"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
EOF
```

### Step 3: Verify Configuration

```bash
minibob --single "test configuration" -v
```

## Configuration Priority Examples

### Example 1: Using Environment Variable

```bash
# Set via environment (Priority 10 - overrides everything)
export ANTHROPIC_API_KEY="sk-ant-env-key"

# This key will be used, not the one in config files
minibob --single "goal"
```

### Example 2: User Config Fallback

```bash
# No environment variable set
# ~/.metabob/config.json has:
# { "providers": { "anthropic": { "apiKey": "sk-ant-user-key" } } }

# This key will be used from user config
minibob --single "goal"
```

### Example 3: Project Config Override

```bash
# In your project directory:
# .metabob/config.json has:
# { "instance": { "instanceId": "project-specific-001" } }

# The project instance ID is used, not the user config one
minibob --single "goal"
```

## Configuration for Different Scenarios

### Local Development

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "workingDirectory": ".",
    "autoCommit": false
  },
  "instance": {
    "instanceId": "minibob-dev",
    "apiKey": "dev-key",
    "orgId": "metabob_internal"
  },
  "vessels": {
    "metabob": {
      "endpoint": "http://activity.metabob.local"
    }
  }
}
```

### Production Deployment

```json
{
  "defaults": {
    "provider": "anthropic",
    "model": "claude-opus-4-5-20251101",
    "autoCommit": true,
    "port": 8080,
    "host": "0.0.0.0"
  },
  "instance": {
    "instanceId": "minibob-prod-001",
    "orgId": "production_org"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
```

### Kubernetes Cluster

```json
{
  "defaults": {
    "provider": "anthropic",
    "workingDirectory": "/workspace"
  },
  "instance": {
    "instanceId": "minibob-k8s-001",
    "apiKey": "generated-by-helm",
    "orgId": "k8s-cluster"
  },
  "vessels": {
    "metabob": {
      "endpoint": "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
    }
  }
}
```

## Troubleshooting Configuration

### Problem: "API key not found"

**Solution 1**: Set environment variable
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
minibob --single "test"
```

**Solution 2**: Add to user config
```bash
echo '{"providers":{"anthropic":{"apiKey":"sk-ant-..."}}}' > ~/.metabob/config.json
```

### Problem: "Backend not available"

**Solution**: Check endpoint configuration
```bash
# Check current endpoint
minibob --single "show config" -v

# Override endpoint
export ACTIVITY_API_ENDPOINT="http://localhost:8080"
minibob --single "test"
```

### Problem: "Instance credentials missing"

**Solution**: Add instance config
```bash
# Edit ~/.metabob/config.json and add:
{
  "instance": {
    "instanceId": "minibob-001",
    "apiKey": "your-api-key"
  }
}
```

### Problem: "Configuration not being loaded"

**Solution**: Check file exists and is valid JSON
```bash
# Verify user config
ls -la ~/.metabob/config.json
cat ~/.metabob/config.json | jq .

# Verify project config
ls -la .metabob/config.json
cat .metabob/config.json | jq .

# Check what config is loaded
minibob --single "show config" -vv
```

## Configuration Commands

```bash
# View current configuration location
minibob --single "show me config location"

# Validate configuration
minibob --single "validate my setup"

# Check connectivity
minibob --single "check if backend is reachable"

# In REPL mode:
/config    # Show current configuration
/auth      # Show and configure authentication
/status    # Check system status
```

## Default Values

If no configuration is provided, MiniBob uses these defaults:

```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "workingDirectory": "current-working-directory",
  "templatesDir": "./templates",
  "autoCommit": false,
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com",
      "capabilities": ["activities", "impulses", "executions", "thompson-sampling"]
    }
  }
}
```

## Best Practices

1. **Store sensitive data in user config**
   - Keep API keys in `~/.metabob/config.json`
   - Don't commit to version control

2. **Use project config for project-specific settings**
   - Store in `.metabob/config.json`
   - Commit to version control (without API keys)

3. **Use environment variables for deployment**
   - Perfect for containerized environments
   - Override config in CI/CD pipelines

4. **Priority order reminder**
   - Environment variables always win
   - Then project config
   - Then user config
   - Then defaults

5. **Validate configuration**
   - Use `minibob --single "validate setup"` regularly
   - Check logs with `-v` or `-vv` flags

---

**Quick Start**:
```bash
mkdir -p ~/.metabob
export ANTHROPIC_API_KEY="sk-ant-your-key"
minibob --single "hello world"
```