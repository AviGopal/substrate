---
name: minibob
description: Achieve development goals using MiniBob - a goal-driven autonomous vessel that searches for proven solutions, adapts to context, recovers from failures, and improvises when needed.
license: MIT
compatibility: Requires bun installed. MiniBob source is in repos/minibob
metadata:
  author: metabob
  version: "3.0"
---

Use MiniBob to achieve development goals autonomously. MiniBob will automatically choose the best approach: trying routine activities, recovering from issues, or improvising solutions.

**When to use this skill:**
- User wants to achieve a specific development goal
- User asks to "fix", "add", "optimize", "debug", or "improve" something
- User wants MiniBob to handle the entire process autonomously
- Testing self-development capabilities

**How MiniBob works:**
1. **Search first**: Looks for proven solutions (existing activity templates via Thompson Sampling)
2. **Adapt**: Interpolates context via impulses from goal description
3. **Recover**: If routine fails, tries recovery strategies and creates variants
4. **Improvise**: If no template exists, improvises and learns from success
5. **Learn**: Records traces, extracts templates, updates metrics

---

## Quick Start

### 1. Environment Setup

MiniBob uses **built-in instance authentication** - no external scripts needed. Set up your environment:

```bash
# Required: LLM access
export ANTHROPIC_API_KEY="sk-ant-..."

# Required for backend connection (learning, templates, traces)
export MINIBOB_MCP_ENDPOINT="http://activity.metabob.local"

# Instance authentication (MiniBob authenticates automatically)
export MINIBOB_INSTANCE_ID="minibob-local-001"
export MINIBOB_INSTANCE_API_KEY="test-api-key-123"

# Optional: Configuration
export MINIBOB_WORKDIR="/path/to/project"
export MINIBOB_MODEL="claude-sonnet-4-20250514"
export MINIBOB_AUTO_COMMIT="false"
```

### 2. Run MiniBob Goals

```bash
# Basic goal execution
cd repos/minibob
bun run index.ts goal "your goal description"

# With specific working directory
MINIBOB_WORKDIR=/path/to/project bun run index.ts goal "fix the bug"

# With backend connection (authenticates automatically)
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local bun run index.ts goal "add feature"
```

**One-liner for full setup:**
```bash
export MINIBOB_MCP_ENDPOINT="http://activity.metabob.local" \
  MINIBOB_INSTANCE_ID="minibob-local-001" \
  MINIBOB_INSTANCE_API_KEY="test-api-key-123"
```

---

## Usage Patterns

### Primary: Goal Command (Recommended)
When the user describes what they want:

```bash
cd repos/minibob
bun run index.ts goal "user's goal description here"
```

**Examples:**
- "Fix the login bug" → `bun run index.ts goal "Fix the login bug"`
- "Add logout button to header" → `bun run index.ts goal "Add logout button to header"`
- "Optimize slow database queries" → `bun run index.ts goal "Optimize slow database queries"`

### Advanced Commands

**Diagnose a problem:**
```bash
bun run index.ts diagnose "description of the problem"
```

**Understand a codebase:**
```bash
bun run index.ts understand ./path/to/code [optional-focus]
```

**Pure improvisation (no template search):**
```bash
bun run index.ts improvise "goal description"
```

**Run specific template:**
```bash
bun run index.ts run templates/template-name.json --var key=value
```

---

## Development & Testing Workflow

When using MiniBob to develop MiniBob (self-development), follow this pattern:

### 1. Setup Session
```bash
# Set environment (MiniBob authenticates automatically on first API call)
export MINIBOB_MCP_ENDPOINT="http://activity.metabob.local"
export MINIBOB_INSTANCE_ID="minibob-local-001"
export MINIBOB_INSTANCE_API_KEY="test-api-key-123"

# Verify backend access
curl -s http://activity.metabob.local/health | jq .
```

### 2. Run Development Tasks
```bash
cd repos/minibob
bun run index.ts goal "implement impulse tracking in improviser"
```

### 3. Check Results
```bash
# View execution traces via API
curl -s "http://activity.metabob.local/v2/activities/execution-traces?limit=5" | jq .

# View in dashboard
open http://graph.metabob.local
```

### 4. Verify Changes
```bash
# Type check
bun run typecheck

# Run tests
bun test
```

---

## Execution Flow

### Step 1: Understand the Goal
Extract the core goal from the user's request:
- What needs to be fixed/added/changed?
- What's the desired outcome?
- Are there any constraints or requirements?

### Step 2: Check Authentication (Only If Needed)
**IMPORTANT:** Only prompt for credentials if backend learning is needed AND credentials are missing.

```bash
# Check if already authenticated (silent check)
if [ -n "$MINIBOB_INSTANCE_ID" ] && [ -n "$MINIBOB_INSTANCE_API_KEY" ]; then
  echo "✓ Instance credentials already set"
elif [ -n "$MINIBOB_MCP_ENDPOINT" ]; then
  # Backend configured but no credentials - prompt user
  echo "Backend configured but missing credentials."
  echo "Set MINIBOB_INSTANCE_ID and MINIBOB_INSTANCE_API_KEY"
else
  # No backend - MiniBob works offline (no learning)
  echo "Running without backend connection (offline mode)"
fi
```

**Decision tree:**
1. **Credentials set?** → Run MiniBob (auto-authenticates on first call)
2. **Backend configured but no creds?** → Ask user for credentials
3. **No backend configured?** → Run MiniBob in offline mode (no learning)

### Step 3: Execute MiniBob
Run the appropriate command:
```bash
cd repos/minibob
bun run index.ts goal "extracted goal description"
```

### Step 4: Report Results
After MiniBob completes:
- Summarize what MiniBob accomplished
- Show execution trace ID for reference
- Highlight any files changed
- Note if new templates were created
- Report any errors or issues

---

## Examples

### Example 1: Fix a Bug
**User:** "The dashboard crashes when clicking the Executions tab"

**Action:**
```bash
cd repos/minibob
bun run index.ts diagnose "Dashboard crashes when clicking Executions tab"
```

### Example 2: Add a Feature
**User:** "Add a logout button to the header"

**Action:**
```bash
cd repos/minibob
MINIBOB_WORKDIR=../metabob-cloud-dashboard \
  bun run index.ts goal "Add a logout button to the header"
```

### Example 3: Self-Development Task
**User:** "Implement impulse tracking in the improviser"

**Action:**
```bash
cd repos/minibob
MINIBOB_WORKDIR=. \
  bun run index.ts goal "Implement impulse tracking in improviser - track which impulses are loaded and created during execution"
```

---

## Important Notes

### API Endpoints
- **activity.metabob.local**: Activity API (templates, executions, learning)
- **dashboard.minibob.local**: Activity dashboard UI

If endpoints aren't accessible, use port-forward:
```bash
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
export MINIBOB_MCP_ENDPOINT="http://localhost:8080"
```

### Authentication
MiniBob uses **RECORD-based instance authentication**:
- Authentication happens automatically on first API call
- Tokens are valid for 24 hours
- MiniBob handles token refresh internally
- No manual token management required

**How it works:**
1. MiniBob reads `MINIBOB_INSTANCE_ID` and `MINIBOB_INSTANCE_API_KEY`
2. On first backend call, it POSTs to `/v2/auth/minibob/signin`
3. Receives JWT token with `org_id` claim
4. Caches token and uses for subsequent calls
5. Token auto-refreshes before expiry

**Verify authentication:**
```bash
# Test signin endpoint directly
curl -X POST http://activity.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq .
# Expected: {"token": "eyJ...", "org_id": "metabob_internal"}
```

### Execution Traces
All executions are stored in the backend:
- Execution ID format: `act_{timestamp}_{random}`
- View in dashboard: http://dashboard.minibob.local
- Query via API: http://activity.metabob.local/v2/activities/execution-traces

---

## When NOT to Use MiniBob

**Don't use MiniBob for:**
- Simple file reads (use Read tool directly)
- Quick grep/search operations (use Grep/Glob tools)
- Questions about code (answer directly or use Task tool with explore agent)
- Non-coding tasks (documentation writing, planning, etc.)

**Use MiniBob for:**
- Actual code changes (fixes, features, refactoring)
- Multi-step workflows (diagnosis → fix → test → commit)
- Learning from patterns (Thompson Sampling optimization)
- Autonomous goal achievement
- Self-development testing

---

## Reporting Template

After MiniBob execution, report to the user:

```
MiniBob completed: [goal description]

Execution ID: [execution_id]
Status: [success/failed]
Duration: [duration]
Cost: $[cost]

Changes made:
- [file1]: [description]
- [file2]: [description]

[If new template created]
New template learned: [template_id]

[If failed]
Error: [error message]
Next steps: [suggestions]
```

---

## Troubleshooting

### Auth Errors
```bash
# Check instance credentials are set
echo "Instance: $MINIBOB_INSTANCE_ID"
echo "API Key: ${MINIBOB_INSTANCE_API_KEY:0:10}..."

# Test authentication directly
curl -X POST http://activity.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d "{\"instance_id\":\"$MINIBOB_INSTANCE_ID\",\"api_key\":\"$MINIBOB_INSTANCE_API_KEY\"}"
```

### Backend Unreachable
```bash
# Check deployment
kubectl get pods -n activity-system

# Start port-forward
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
export MINIBOB_MCP_ENDPOINT="http://localhost:8080"
```

### ANTHROPIC_API_KEY Missing
```bash
# Check .env
cat repos/minibob/.env | grep ANTHROPIC

# Or export directly
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Type Errors
```bash
cd repos/minibob
bun run typecheck
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | - | Required for Claude LLM access |
| `MINIBOB_MCP_ENDPOINT` | - | Activity API URL for backend connection |
| `MINIBOB_INSTANCE_ID` | - | Instance ID for RECORD-based auth |
| `MINIBOB_INSTANCE_API_KEY` | - | API key for instance authentication |
| `MINIBOB_WORKDIR` | `.` | Working directory for goals |
| `MINIBOB_MODEL` | claude-sonnet-4-20250514 | Model to use |
| `MINIBOB_AUTO_COMMIT` | false | Auto-commit changes |
| `MINIBOB_PORT` | 8080 | Server port (for serve mode) |

---

Remember: **Describe the goal. MiniBob figures out how to achieve it.**
