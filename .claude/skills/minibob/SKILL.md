---
name: minibob
description: Achieve development goals using MiniBob - a goal-driven autonomous vessel that searches for proven solutions, adapts to context, recovers from failures, and improvises when needed.
license: MIT
compatibility: Requires bun installed. MiniBob source is in repos/minibob
metadata:
  author: metabob
  version: "2.0"
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

### 1. Ensure Authentication

Before using MiniBob, ensure you have a valid JWT token:

```bash
# Get token (auto-detects API endpoint)
./scripts/minibob-auth.sh login

# Export to environment (do this once per session)
eval $(./scripts/minibob-auth.sh export)
```

### 2. Run MiniBob Goals

```bash
# Basic goal execution
cd repos/minibob
bun run index.ts goal "your goal description"

# With specific working directory
MINIBOB_WORKDIR=/path/to/project bun run index.ts goal "fix the bug"

# With backend connection (uses authenticated token)
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local bun run index.ts goal "add feature"
```

---

## Environment Setup

MiniBob needs these environment variables:

```bash
# Required: LLM access
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional: Backend connection (for learning)
export MINIBOB_MCP_ENDPOINT="http://activity.metabob.local"
export MINIBOB_JWT="$(./scripts/minibob-auth.sh token)"

# Optional: Configuration
export MINIBOB_WORKDIR="/path/to/project"
export MINIBOB_MODEL="claude-sonnet-4-20250514"
export MINIBOB_AUTO_COMMIT="false"
```

**One-liner for full setup:**
```bash
eval $(./scripts/minibob-auth.sh export) && \
export MINIBOB_MCP_ENDPOINT="http://activity.metabob.local"
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
# Get auth token
./scripts/minibob-auth.sh login
eval $(./scripts/minibob-auth.sh export)

# Verify backend access
curl -s http://activity.metabob.local/health | jq .
```

### 2. Run Development Tasks
```bash
cd repos/minibob
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local \
  bun run index.ts goal "implement impulse tracking in improviser"
```

### 3. Check Results
```bash
# View execution traces
./scripts/minibob-data.sh summary

# Export learned data
./scripts/minibob-data.sh export dev-session-$(date +%Y%m%d)
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

### Step 2: Ensure Auth
Before running MiniBob, check auth is set up:
```bash
# Quick check
if [ -f ~/.minibob/token ]; then
  ./scripts/minibob-auth.sh verify || ./scripts/minibob-auth.sh login
else
  ./scripts/minibob-auth.sh login
fi
eval $(./scripts/minibob-auth.sh export)
```

### Step 3: Execute MiniBob
Run the appropriate command:
```bash
cd repos/minibob
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local \
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
eval $(./scripts/minibob-auth.sh export)
cd repos/minibob
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local \
  bun run index.ts diagnose "Dashboard crashes when clicking Executions tab"
```

### Example 2: Add a Feature
**User:** "Add a logout button to the header"

**Action:**
```bash
eval $(./scripts/minibob-auth.sh export)
cd repos/minibob
MINIBOB_WORKDIR=../metabob-cloud-dashboard \
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local \
  bun run index.ts goal "Add a logout button to the header"
```

### Example 3: Self-Development Task
**User:** "Implement impulse tracking in the improviser"

**Action:**
```bash
eval $(./scripts/minibob-auth.sh export)
cd repos/minibob
MINIBOB_WORKDIR=. \
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local \
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

### Auth Token Management
Tokens are valid for 24 hours. The auth script caches them at `~/.minibob/token`.

```bash
# Check token status
./scripts/minibob-auth.sh verify

# Refresh if needed
./scripts/minibob-auth.sh refresh

# View current token
./scripts/minibob-auth.sh token
```

### Data Backup
Before making major changes, backup learning data:
```bash
./scripts/minibob-data.sh export pre-change-backup
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
# Re-login
./scripts/minibob-auth.sh login

# Check token is exported
echo $MINIBOB_JWT | head -c 20
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
| `ANTHROPIC_API_KEY` | - | Required for Claude |
| `MINIBOB_MCP_ENDPOINT` | - | Activity API URL |
| `MINIBOB_JWT` | - | Auth token (from auth script) |
| `MINIBOB_WORKDIR` | `.` | Working directory |
| `MINIBOB_MODEL` | claude-sonnet-4-20250514 | Model to use |
| `MINIBOB_AUTO_COMMIT` | false | Auto-commit changes |
| `MINIBOB_PORT` | 8080 | Server port (for serve mode) |

---

Remember: **Describe the goal. MiniBob figures out how to achieve it.**
