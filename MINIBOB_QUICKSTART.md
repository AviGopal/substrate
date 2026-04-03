# MiniBob Quick Start

Get MiniBob running with backend integration in 5 minutes.

## Prerequisites

- MiniBob installed: `npm install -g @metabob/minibob` or `bun install`
- kubectl configured to access the cluster
- Port forwarding to SurrealDB (see setup below)

## Setup (One Time)

### 1. Create config file

```bash
mkdir -p ~/.metabob

cat > ~/.metabob/config.json << 'EOF'
{
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "minibob-local-dev-key",
    "orgId": "metabob"
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "workingDirectory": "."
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
EOF
```

### 2. Set up port forwarding (Terminal 1)

```bash
# Keep this running in a dedicated terminal
kubectl port-forward -n activity-system svc/surrealdb 8000:8000
# Output: Forwarding from 127.0.0.1:8000 -> 8000
```

### 3. Set environment variables (Terminal 2)

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"
```

## Running MiniBob

### Single Goal Execution

```bash
minibob --single "Write a hello world Python script"
```

### Interactive REPL Mode

```bash
minibob

# Inside REPL:
> Create a function to validate email addresses
> Add unit tests for the function
> Refactor the code to use a regex pattern
/exit
```

### Background Daemon

```bash
minibob --daemon  # Runs on port 8080
curl http://localhost:8080/goal -X POST -d '{"goal": "Your goal here"}'
```

## Verification

### Check MiniBob Configuration

```bash
minibob --single "show my configuration" -v
# Should show: Instance ID, API endpoint, organization, etc.
```

### Verify Backend Connectivity

```bash
minibob --single "check if backend is available" -v
# Should return: ✓ Backend at https://activity.metabob.com is reachable
```

### Test Activity Execution

```bash
minibob --single "Create a simple REST API endpoint that returns the current time"
```

This will:
1. ✓ Authenticate with instance credentials
2. ✓ Load available activity templates from backend
3. ✓ Execute the activity that best matches your goal
4. ✓ Record execution trace and metrics
5. ✓ Create impulses from the execution (for learning)

## Troubleshooting

### Error: "Instance not found"

**Problem**: MiniBob can't authenticate

**Solution**:
```bash
# Verify port forward is running
ps aux | grep "port-forward"

# Verify config has correct instance ID
cat ~/.metabob/config.json | jq '.instance'

# Should show: "instanceId": "minibob-local-001"
```

### Error: "Backend not available"

**Problem**: Can't reach activity.metabob.com

**Solution**:
```bash
# Check ACTIVITY_API_ENDPOINT
echo $ACTIVITY_API_ENDPOINT

# Test connectivity
curl -s https://activity.metabob.com/health | jq .

# If fails, use local backend with port forward:
export ACTIVITY_API_ENDPOINT="http://localhost:8080"
```

### Error: "ANTHROPIC_API_KEY not found"

**Problem**: LLM provider key not set

**Solution**:
```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-your-key"

# Or add to ~/.metabob/config.json:
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-your-key"
    }
  }
}
```

### Error: "Port 8000 already in use"

**Problem**: Another process has port 8000

**Solution**:
```bash
# Find and kill the process
lsof -i :8000
kill -9 <PID>

# Or use different port
kubectl port-forward -n activity-system svc/surrealdb 8001:8000
# Then update config to use port 8001
```

## Understanding Output

### Execution Trace

When you run a goal, MiniBob shows:

```
📋 Starting activity: Create REST API endpoint
   Instance: minibob-local-001
   Organization: metabob
   Activity ID: rest-api-creation-v2

🔄 [1/3] Design the API specification
   ✓ Completed in 12.3s

🔄 [2/3] Implement the endpoint
   ✓ Completed in 18.5s

🔄 [3/3] Write unit tests
   ✓ Completed in 8.2s

✅ Activity completed successfully
   Files created: 2 (main.py, test_main.py)
   Total duration: 38.9s
   Cost: $0.24
```

### Learning Integration

The execution is recorded with:
- **Execution Trace**: Full task-by-task breakdown
- **Success Metrics**: Duration, cost, token usage
- **Composition Graph**: How activities were combined
- **Tool Usage**: Which tools (bash, read, write, edit, git) were used

This data feeds into:
- **Thompson Sampling**: Improves template selection
- **Ribosome Pattern**: Extracts successful patterns into new templates
- **Dashboard**: Visualizes learning progress

## Configuration Files

### Global Config (~/.metabob/config.json)

Your user-level settings (applied to all projects):

```json
{
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "mb_inst_local_...",
    "orgId": "metabob"
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "port": 8080,
    "host": "0.0.0.0"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
```

### Project Config (.metabob/config.json)

Project-specific overrides (checked into version control):

```json
{
  "instance": {
    "instanceId": "minibob-local-dev"
  },
  "defaults": {
    "workingDirectory": "./src",
    "autoCommit": true
  }
}
```

Environment variables override both files (highest priority).

## Development Workflow

### 1. Start session with goal

```bash
minibob --single "Implement user authentication"
```

### 2. Check dashboard

Open `http://dashboard.minibob.local` (with .local domain) or:
```bash
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
open http://localhost:3000
```

### 3. Review execution metrics

The dashboard shows:
- ✅ Template success rate
- 📊 Activity execution timeline
- 🔄 Thompson Sampling recommendations
- 💰 Cost and token usage
- 📈 Learning progress

### 4. Continue with next goal

```bash
minibob --single "Add email verification to authentication"
```

## Advanced Usage

### Using Different Instances

```bash
# For canary testing
export MINIBOB_INSTANCE_ID="minibob-canary-001"

# For production
export MINIBOB_INSTANCE_ID="minibob-production-001"

minibob --single "Your goal"
```

### Custom Project Setup

```bash
cd my-project

# Create project config
mkdir -p .metabob
cat > .metabob/config.json << 'EOF'
{
  "instance": {
    "instanceId": "minibob-local-dev"
  },
  "defaults": {
    "workingDirectory": "./src",
    "autoCommit": false
  }
}
EOF

# Run MiniBob in this project
minibob --single "Implement feature X"
```

### Integration with CI/CD

```bash
# In your CI pipeline
export MINIBOB_INSTANCE_ID="minibob-production-001"
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"

minibob --single "Generate weekly report"
minibob --single "Run performance benchmarks"
minibob --single "Update dependencies"
```

## Next Steps

1. ✅ Set up config and port forward
2. ✅ Run `minibob --single "hello world"`
3. ✅ Check dashboard for execution metrics
4. ✅ Read [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) for advanced options
5. ✅ Explore [MINIBOB_INSTANCES_SUMMARY.md](./MINIBOB_INSTANCES_SUMMARY.md) for instance management

## Common Patterns

### Goal-Driven Development

```bash
# Define goals, MiniBob implements
minibob --single "Add API endpoint for user registration"
minibob --single "Add email verification"
minibob --single "Add password reset flow"
```

### Iterative Refinement

```bash
# Start with basic implementation
minibob --single "Implement sorting algorithm"

# Improve based on feedback
minibob --single "Optimize sorting for large datasets"

# Add features
minibob --single "Add sorting configuration options"
```

### Bug Fixing with Context

```bash
# MiniBob analyzes error and fixes it
minibob --single "Fix the failing test in src/__tests__/auth.test.ts"

# Verify fix
minibob --single "Run all tests and ensure they pass"
```

## Performance Tips

- Use specific, well-written goals for better results
- Break large goals into smaller steps
- Review the dashboard to understand what's working
- Leverage activity templates for common patterns
- Use project config to set working directory and auto-commit

## Getting Help

```bash
# Show available commands
minibob --help

# Show configuration
minibob --single "show configuration" -v

# Verbose output for debugging
minibob --single "your goal" -vv

# View logs
tail -f ~/.minibob/logs/minibob.log
```

## Documentation

- **Quick Start**: This file (you are here)
- **Configuration**: [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md)
- **Instances**: [MINIBOB_INSTANCES_SUMMARY.md](./MINIBOB_INSTANCES_SUMMARY.md)
- **Backend**: [IMPULSE_ACTIVITY_FOUNDATION.md](./docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

Happy coding! 🚀
