---
name: minibob
description: Achieve development goals using MiniBob - a goal-driven autonomous vessel that searches for proven solutions, adapts to context, recovers from failures, and improvises when needed.
license: MIT
compatibility: Requires minibob installed (npm install -g @metabob/minibob) or available in repos/minibob
metadata:
  author: metabob
  version: "1.0"
---

Use MiniBob to achieve development goals autonomously. MiniBob will automatically choose the best approach: trying routine activities, recovering from issues, or improvising solutions.

**When to use this skill:**
- User wants to achieve a specific development goal
- User asks to "fix", "add", "optimize", "debug", or "improve" something
- User wants MiniBob to handle the entire process autonomously

**How MiniBob works:**
1. **Search first**: Looks for proven solutions (existing activity templates)
2. **Adapt**: Interpolates context via impulses from goal description
3. **Recover**: If routine fails, tries recovery strategies and creates variants
4. **Improvise**: If no template exists, improvises and learns from success
5. **Learn**: Uses Thompson Sampling to optimize future executions

---

## Usage Patterns

### Primary: Goal Command (Recommended)
When the user describes what they want, invoke MiniBob's goal command:

```bash
cd repos/minibob
bun run index.ts goal "user's goal description here"
```

**Examples:**
- "Fix the login bug" → `bun run index.ts goal "Fix the login bug"`
- "Add logout button to header" → `bun run index.ts goal "Add logout button to header"`
- "Optimize slow database queries" → `bun run index.ts goal "Optimize slow database queries"`

### Advanced: Direct Commands (When Needed)

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

**Run specific template (when user requests it):**
```bash
bun run index.ts run templates/template-name.json --var key=value
```

---

## Execution Flow

### Step 1: Understand the Goal
Extract the core goal from the user's request:
- What needs to be fixed/added/changed?
- What's the desired outcome?
- Are there any constraints or requirements?

### Step 2: Choose MiniBob Command
- **Default**: Use `goal` command (90% of cases)
- **Diagnosis needed**: Use `diagnose` if user reports unclear problem
- **Exploration needed**: Use `understand` if user wants codebase analysis
- **User specifies template**: Use `run` only if explicitly requested

### Step 3: Execute MiniBob
Run the appropriate command in the minibob directory:

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

MiniBob will:
1. Analyze the codebase
2. Identify root cause
3. Propose fixes
4. Execute the fix (if goal mode enabled)

### Example 2: Add a Feature
**User:** "Add a logout button to the header"

**Action:**
```bash
cd repos/minibob
bun run index.ts goal "Add a logout button to the header"
```

MiniBob will:
1. Search for similar features (button addition templates)
2. Adapt to header context
3. Implement the logout button
4. Create template if none existed

### Example 3: Optimize Performance
**User:** "The API is really slow, can you optimize it?"

**Action:**
```bash
cd repos/minibob
bun run index.ts goal "Optimize API performance to reduce response time"
```

MiniBob will:
1. Profile the API
2. Identify bottlenecks
3. Apply optimizations
4. Verify improvements

### Example 4: Understand Before Acting
**User:** "I want to understand how authentication works before adding 2FA"

**Action:**
```bash
cd repos/minibob
bun run index.ts understand ./src/auth authentication
```

Then after understanding:
```bash
bun run index.ts goal "Add two-factor authentication to the login flow"
```

---

## Important Notes

### Working Directory
Always run MiniBob from `repos/minibob` directory:
```bash
cd repos/minibob
bun run index.ts [command]
```

### Environment Variables
MiniBob requires `ANTHROPIC_API_KEY` to be set. It's configured in `repos/minibob/.env`.

### Execution Traces
MiniBob stores all executions in the backend. You can reference them:
- Execution ID format: `act_{timestamp}_{random}`
- View in dashboard: http://dashboard.minibob.local
- Query via API: http://api.minibob.local/v2/activities/execution-traces

### Template Learning
When MiniBob improvises successfully:
- New template is automatically created via ribosome pattern
- Registered with backend for future use
- Available for Thompson Sampling selection

### Failure Recovery
If MiniBob fails:
- It automatically attempts recovery strategies
- Creates template variants (trailblazing)
- Learns from failures to improve future attempts

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

## Integration with Other Tools

MiniBob works well with:
- **Activity Dashboard**: View execution history and metrics
- **MCP Backend**: Template storage and Thompson Sampling
- **Git**: Auto-commit changes (if MINIBOB_AUTO_COMMIT=true)
- **OpenSpec**: Can be used during OpenSpec change implementation

**Workflow example:**
1. `/openspec-explore` - Think through the change
2. `/openspec-propose` - Create change proposal
3. `/minibob` - Implement the change autonomously
4. `/openspec-apply-change` - Continue if needed
5. `/openspec-archive-change` - Archive when complete

---

## Troubleshooting

### MiniBob not found
If you get "command not found", MiniBob might not be in the path.
Run from source:
```bash
cd repos/minibob
bun run index.ts [command]
```

### API key missing
If you get authentication errors:
```bash
cd repos/minibob
cat .env | grep ANTHROPIC_API_KEY
# Should show the API key
```

### Backend connection failed
If MCP backend is unreachable:
```bash
# Check if backend is running
curl http://api.minibob.local/health

# Or start the backend
cd repos/metabob-activity-api
bun run start
```

### Execution trace not stored
Check backend logs:
```bash
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

---

## Configuration

MiniBob can be configured via environment variables or command-line args:

**Working directory:**
```bash
MINIBOB_WORKDIR=/path/to/project bun run index.ts goal "..."
```

**Use different model:**
```bash
MINIBOB_MODEL=claude-opus-4 bun run index.ts goal "..."
```

**Auto-commit changes:**
```bash
MINIBOB_AUTO_COMMIT=true bun run index.ts goal "..."
```

**Connect to different backend:**
```bash
MINIBOB_MCP_ENDPOINT=http://localhost:8080 bun run index.ts goal "..."
```

---

## Advanced Usage

### Chaining Goals
For complex multi-step workflows, chain goals:

```bash
# Step 1: Understand
bun run index.ts understand ./src/api

# Step 2: Optimize
bun run index.ts goal "Optimize API endpoints for better performance"

# Step 3: Verify
bun run index.ts goal "Add performance tests to verify API optimization"
```

### Using Impulses
Pass additional context as impulses:

```bash
bun run index.ts goal "Fix the bug described in BUGFIX.md"
# MiniBob will read BUGFIX.md as an impulse
```

### Template Variants
When MiniBob fails, it creates variants. To retry with a specific variant:

```bash
bun run index.ts run templates/fix-bug-variant-2.json
```

---

Remember: **Just describe the goal. MiniBob figures out how to achieve it.**
