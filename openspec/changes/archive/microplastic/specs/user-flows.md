# User Flows Specification

## Overview

This spec defines the user experience flows for microplastic. The key insight: users interact with a narrative, not with tools. The TUI presents work as a story unfolding, not as log output.

## Flow 1: First Run Bootstrap

### Trigger
User runs `microplastic` for the first time in a directory.

### Steps

1. **Workspace Detection**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ microplastic v0.1.0                                     │
   │                                                         │
   │ Detecting workspace...                                  │
   │                                                         │
   │ Found:                                                  │
   │   Language: TypeScript                                  │
   │   Framework: Bun + Hono                                 │
   │   Files: 147 files, 12,340 lines                        │
   │   Git: yes (branch: main, clean)                        │
   └─────────────────────────────────────────────────────────┘
   ```

2. **API Key Check**
   - If `ANTHROPIC_API_KEY` set: continue
   - If not set:
     ```
     ┌─────────────────────────────────────────────────────────┐
     │ API key needed                                          │
     │                                                         │
     │ Set ANTHROPIC_API_KEY to use AI capabilities.           │
     │                                                         │
     │ export ANTHROPIC_API_KEY=sk-ant-...                     │
     │                                                         │
     │ [Press Enter to exit]                                   │
     └─────────────────────────────────────────────────────────┘
     ```

3. **Backend Connection (Optional)**
   - Attempt to connect to activity-api
   - If available: "Learning enabled - your successes improve future runs"
   - If unavailable: "Running offline - learning disabled"

4. **Ready State**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ microplastic ready                                      │
   │                                                         │
   │ What would you like to do?                              │
   │                                                         │
   │ > _                                                     │
   │                                                         │
   │ Type a goal (e.g., "Add user authentication")           │
   │ Or /help for commands                                   │
   └─────────────────────────────────────────────────────────┘
   ```

### Acceptance Criteria
- Workspace detection completes in < 2 seconds
- Clear feedback if API key missing
- Graceful degradation if backend unavailable

---

## Flow 2: Goal Submission and Template Selection

### Trigger
User types a goal and presses Enter.

### Steps

1. **Goal Received**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Understanding Phase**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   ├─────────────────────────────────────────────────────────┤
   │ [Understanding]                                         │
   │                                                         │
   │ Thinking about your request...                          │
   │                                                         │
   │ This looks like a bug fix. I'll need to:                │
   │   - Find the null pointer error                         │
   │   - Understand the code flow                            │
   │   - Apply a fix                                         │
   │   - Verify with tests                                   │
   └─────────────────────────────────────────────────────────┘
   ```

3. **Template Selection**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   ├─────────────────────────────────────────────────────────┤
   │ [Selecting template]                                    │
   │                                                         │
   │ Found 3 matching templates:                             │
   │                                                         │
   │   1. debug-null-pointer    [93% success, 42 runs]       │
   │   2. analyze-stack-trace   [85% success, 14 runs]       │
   │   3. generic-debug         [61% success, 89 runs]       │
   │                                                         │
   │ Using: debug-null-pointer (highest success rate)        │
   └─────────────────────────────────────────────────────────┘
   ```

4. **If No Templates Match** (Improvisation)
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Implement GraphQL subscriptions                  │
   ├─────────────────────────────────────────────────────────┤
   │ [Improvising]                                           │
   │                                                         │
   │ No matching template found. I'll figure this out.       │
   │                                                         │
   │ This is new territory - I'll record what works          │
   │ so I can do it faster next time.                        │
   │                                                         │
   │ [Confidence: LOW - first time doing this]               │
   └─────────────────────────────────────────────────────────┘
   ```

### Acceptance Criteria
- Goal enrichment completes in < 3 seconds
- Template selection shows clear reasoning
- Confidence level always visible
- Improvisation clearly communicated

---

## Flow 3: Execution with Narrative Progress

### Trigger
Template selected (or improvisation started).

### Steps

1. **Execution Start**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   ├─────────────────────────────────────────────────────────┤
   │ [Executing: debug-null-pointer]                         │
   │                                                         │
   │ Step 1/4: Analyzing error                               │
   │   Reading auth.ts...                                    │
   │   Found: line 42, user.session.token accessed           │
   │   Issue: session can be undefined                       │
   │                                                         │
   │ [Thinking] The bug is a missing null check.             │
   │            This is a common pattern I've seen before.   │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Progress Updates**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   ├─────────────────────────────────────────────────────────┤
   │ [Executing: debug-null-pointer]                         │
   │                                                         │
   │ Step 2/4: Locating related code                         │
   │   Searching for session handling...                     │
   │   Found: SessionManager in src/session.ts               │
   │   Found: validateSession in src/auth.ts:28              │
   │                                                         │
   │ Step 3/4: Generating fix                                │
   │   Adding null check: if (!user?.session) return null    │
   │   Updating type annotation                              │
   │                                                         │
   │ [In progress] ████████████░░░░░░░░ 60%                  │
   └─────────────────────────────────────────────────────────┘
   ```

3. **Tool Call Visibility** (Collapsed by default)
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ Step 3/4: Generating fix                                │
   │   Adding null check: if (!user?.session) return null    │
   │                                                         │
   │   [Tools used - press 't' to expand]                    │
   │     read_file: src/auth.ts                              │
   │     edit_file: src/auth.ts:42 (+3 lines)                │
   └─────────────────────────────────────────────────────────┘
   ```

4. **Final Task: Validation**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ Step 4/4: Validating fix                                │
   │   Running tests...                                      │
   │                                                         │
   │   ✓ auth.test.ts passed (12 tests)                      │
   │   ✓ session.test.ts passed (8 tests)                    │
   │   ✓ No type errors                                      │
   └─────────────────────────────────────────────────────────┘
   ```

### Acceptance Criteria
- Progress always visible (step X/Y)
- Thinking/reasoning shown in human terms
- Tool calls available but not overwhelming
- Errors shown clearly with context

---

## Flow 4: Successful Completion with Learning Feedback

### Trigger
Execution completes successfully.

### Steps

1. **Success Display**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Fix the null pointer bug in auth.ts              │
   ├─────────────────────────────────────────────────────────┤
   │ [Complete] ✓                                            │
   │                                                         │
   │ Fixed the null pointer bug:                             │
   │   - Added null check at auth.ts:42                      │
   │   - All tests passing                                   │
   │                                                         │
   │ Files changed:                                          │
   │   M src/auth.ts (+3, -1)                                │
   │                                                         │
   │ Duration: 12s | Cost: $0.04                             │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Learning Feedback** (if backend available)
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Learning]                                              │
   │                                                         │
   │ This success improved future runs:                      │
   │   - debug-null-pointer: 93% → 93.1% success rate        │
   │   - Pattern recorded: null-check-guard                  │
   └─────────────────────────────────────────────────────────┘
   ```

3. **Ribosome Extraction** (if improvisation)
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [New Capability]                                        │
   │                                                         │
   │ I learned something new! Created template:              │
   │   "implement-graphql-subscriptions"                     │
   │                                                         │
   │ Next time you ask for this, I'll be faster.             │
   └─────────────────────────────────────────────────────────┘
   ```

### Acceptance Criteria
- Clear summary of what changed
- Cost/duration always shown
- Learning feedback when available
- Ribosome extraction celebrated

---

## Flow 5: Failure with Variant Creation

### Trigger
Execution fails (validation fails, error occurs).

### Steps

1. **Failure Detection**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Goal] Add caching to the API endpoints                 │
   ├─────────────────────────────────────────────────────────┤
   │ [Failed] ✗                                              │
   │                                                         │
   │ Step 3/4 failed: Tests not passing                      │
   │                                                         │
   │ Error: cache.test.ts                                    │
   │   Expected: data to be cached                           │
   │   Got: cache miss on second request                     │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Failure Analysis**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Analyzing failure]                                     │
   │                                                         │
   │ I think I understand what went wrong:                   │
   │   - Cache key wasn't including request params           │
   │   - Different params = different keys = cache miss      │
   │                                                         │
   │ This template (add-caching-basic) might not be          │
   │ the right approach for parameterized endpoints.         │
   └─────────────────────────────────────────────────────────┘
   ```

3. **Options Presented**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [What next?]                                            │
   │                                                         │
   │ 1. Retry with different approach                        │
   │ 2. Create variant template for this case                │
   │ 3. Let me investigate more                              │
   │ 4. Abandon (I'll clean up changes)                      │
   │                                                         │
   │ > _                                                     │
   └─────────────────────────────────────────────────────────┘
   ```

4. **Variant Creation** (if selected)
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Creating variant]                                      │
   │                                                         │
   │ New template: add-caching-with-params                   │
   │   - Based on: add-caching-basic                         │
   │   - Difference: includes param hashing in cache key     │
   │                                                         │
   │ Want me to try this new approach? [Y/n]                 │
   └─────────────────────────────────────────────────────────┘
   ```

### Acceptance Criteria
- Failure reason clearly explained
- Options always available (not stuck)
- Variant creation explains the difference
- Easy to retry or abandon

---

## Flow 6: Power User Slash Commands

### Trigger
User types `/` followed by command name.

### Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Show current execution state |
| `/abort` | Stop current execution |
| `/templates` | List available templates |
| `/template <id>` | Show template details |
| `/history` | Show recent executions |
| `/clear` | Clear screen |
| `/config` | Show/edit configuration |
| `/debug` | Toggle debug mode (show tool calls) |
| `/improvise` | Force improvisation (skip templates) |
| `/offline` | Work without backend |

### Command: `/templates`

```
┌─────────────────────────────────────────────────────────┐
│ /templates                                              │
├─────────────────────────────────────────────────────────┤
│ Available templates (23 total):                         │
│                                                         │
│ [Bootstrap - Level 0]                                   │
│   create-activity-template     [100% - immutable]       │
│   execute-goal                 [100% - immutable]       │
│                                                         │
│ [Core Development - Level 3]                            │
│   implement-feature            [87% success, 156 runs]  │
│   fix-bug                      [91% success, 89 runs]   │
│   refactor-code                [78% success, 34 runs]   │
│                                                         │
│ [Learned - Level 5+]                                    │
│   add-caching-with-params      [100% success, 3 runs]   │
│   implement-graphql-subs       [66% success, 3 runs]    │
│                                                         │
│ [Press 'q' to close]                                    │
└─────────────────────────────────────────────────────────┘
```

### Command: `/history`

```
┌─────────────────────────────────────────────────────────┐
│ /history                                                │
├─────────────────────────────────────────────────────────┤
│ Recent executions:                                      │
│                                                         │
│ 1. [✓] Fix null pointer bug        12s    $0.04        │
│    Template: debug-null-pointer                         │
│                                                         │
│ 2. [✗] Add caching to API          45s    $0.12        │
│    Template: add-caching-basic → created variant        │
│                                                         │
│ 3. [✓] Implement user search       28s    $0.08        │
│    Template: implement-feature                          │
│                                                         │
│ Total today: 3 goals, 2 success, 1 failed               │
│ Total cost: $0.24                                       │
│                                                         │
│ [Press 'q' to close]                                    │
└─────────────────────────────────────────────────────────┘
```

### Command: `/debug`

Toggles verbose mode:

```
┌─────────────────────────────────────────────────────────┐
│ [Debug mode: ON]                                        │
├─────────────────────────────────────────────────────────┤
│ Step 2/4: Locating related code                         │
│                                                         │
│ [Tool] read_file                                        │
│   path: src/session.ts                                  │
│   result: 245 lines read                                │
│   tokens: 1,234 in / 0 out                              │
│                                                         │
│ [Tool] search_codebase                                  │
│   query: "validateSession"                              │
│   result: 3 matches                                     │
│   tokens: 89 in / 156 out                               │
│                                                         │
│ [LLM] claude-sonnet-4-20250514                          │
│   prompt: 2,456 tokens                                  │
│   response: 234 tokens                                  │
│   cost: $0.008                                          │
└─────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- All commands respond in < 100ms
- `/help` always accessible
- `/abort` works even during execution
- Debug mode doesn't break narrative flow

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit goal / Confirm |
| `Ctrl+C` | Abort current execution |
| `Ctrl+D` | Exit microplastic |
| `↑/↓` | Navigate history |
| `Tab` | Autocomplete commands |
| `t` | Toggle tool visibility |
| `d` | Toggle debug mode |
| `?` | Show keyboard shortcuts |

---

## Error States

### Network Error (Backend Unavailable)

```
┌─────────────────────────────────────────────────────────┐
│ [Warning] Backend unavailable                           │
│                                                         │
│ Can't connect to activity-api. Running in offline mode. │
│                                                         │
│ - Template selection: local templates only              │
│ - Learning: disabled                                    │
│ - Ribosome: local extraction only                       │
│                                                         │
│ Retry connection? [Y/n]                                 │
└─────────────────────────────────────────────────────────┘
```

### LLM Error (Rate Limited)

```
┌─────────────────────────────────────────────────────────┐
│ [Error] Rate limited by Anthropic                       │
│                                                         │
│ Too many requests. Waiting 30 seconds...                │
│                                                         │
│ [████████████░░░░░░░░] 60%                              │
│                                                         │
│ Press 'c' to cancel and try later                       │
└─────────────────────────────────────────────────────────┘
```

### Validation Error (Bad Input)

```
┌─────────────────────────────────────────────────────────┐
│ [Error] Couldn't understand that goal                   │
│                                                         │
│ Your input was too vague:                               │
│   "make it better"                                      │
│                                                         │
│ Try being more specific:                                │
│   "Improve the performance of the search endpoint"      │
│   "Fix the bug where users can't log in"                │
│   "Add unit tests for the auth module"                  │
│                                                         │
│ > _                                                     │
└─────────────────────────────────────────────────────────┘
```
