# TUI Activity Execution Feature

## Overview

This feature enables users to execute activity templates directly from the TUI session using a special `%` prefix syntax. The system provides minimalist fuzzy autocomplete suggestions and leverages the memory agent to automatically infer activity variables based on context.

## User Experience

### Basic Syntax

```
%<activity-name> <description of goal>
```

### Examples

```
%add-feature-complete Add user authentication with JWT tokens
%fix-bug-complete Fix the login error in authentication flow
%refactor-with-tests Clean up database connection pooling code
%hello-world-minimal
```

### Autocomplete

As users type `%`, the system provides fuzzy-matched suggestions from available activity templates:

```
Query: "add"
  → add-rest-endpoint-feature
  → add-comprehensive-logging
  → add-feature-complete

Query: "fix"
  → fix-bug-complete
  → fix-api-container-surrealdb-package
  → fix-compile-error
```

## Architecture

### Components

1. **ActivityPrefix** (`repos/metabob-opencode/packages/opencode/src/session/activity-prefix.ts`)
   - Parses `%` prefix syntax
   - Validates activity template existence
   - Formats requests for memory agent

2. **ActivityAutocomplete** (`repos/metabob-opencode/packages/opencode/src/session/activity-autocomplete.ts`)
   - Minimalist fuzzy search
   - Scores matches on ID, name, and description
   - Returns ranked suggestions

3. **SessionPrompt Integration** (`repos/metabob-opencode/packages/opencode/src/session/prompt.ts`)
   - Detects `%` prefix in user input
   - Validates activity template
   - Transforms to activity execution request
   - Provides helpful error messages with suggestions

4. **Memory Agent Integration** (`manage-session-memory` activity)
   - Detects "ACTIVITY EXECUTION REQUEST" messages
   - Infers activity variables from goal and context
   - Executes activity tool with inferred parameters

### Data Flow

```
User Input: "%add-feature-complete Add user auth"
    ↓
ActivityPrefix.parse()
    ↓
ActivityPrefix.validate()
    ↓
If valid: Transform to structured request
If invalid: Show suggestions
    ↓
SessionPrompt.prompt()
    ↓
Memory agent lifecycle hook
    ↓
Memory agent detects activity request
    ↓
Infers variables from goal + context
    ↓
Calls activity() tool
    ↓
Activity executes
```

## Fuzzy Matching Algorithm

The autocomplete uses a simple but effective scoring system:

- **Exact match**: 100 points
- **Starts with**: 80 points
- **Contains substring**: 50 points
- **Fuzzy character match**: 1-40 points (based on match quality)

Results are sorted by score (descending) then alphabetically.

## Variable Inference

The memory agent (`manage-session-memory` activity) automatically infers variables by:

1. Analyzing the user's goal description
2. Examining recent session context (files, messages, Metabob issues)
3. Matching expected variable types from template definition
4. Providing sensible defaults or asking for clarification

Example inference:

```
Input: "%add-feature-complete Add user profile endpoint"

Inferred variables:
{
  featureName: "user profile endpoint",
  files: ["src/api/users.ts"], // from recent context
  description: "Add GET /api/users/:id endpoint with validation"
}
```

## Integration Points

### TUI Client (Future Work)

The TUI client can enhance UX by:

1. **Live autocomplete** as user types `%`
2. **Template hints** showing required variables
3. **Activity progress** display during execution
4. **Result summary** when activity completes

### Configuration

No additional configuration needed. The feature is enabled by default and works with:

- Existing activity templates (local and Metabob)
- Standard session memory lifecycle
- All configured agents

## Error Handling

### Invalid Activity

```
User: "%nonexistent-activity Do something"

Response:
Did you mean one of these?
  - %implement-acp-activity-tracking
  - %implement-activity-execution
```

### Validation Failure

```
User: "%add-feat Something"

Response:
Did you mean one of these?
  - %add-rest-endpoint-feature
  - %add-feature-complete
  - %add-comprehensive-logging
```

### Execution Errors

Activity execution errors are handled by the standard activity error recovery system (retry, trailblazing, etc).

## Testing

Run the test suite:

```bash
bun run test-tui-activity-execution.ts
```

Tests cover:
- Prefix parsing (with and without description)
- Fuzzy autocomplete search
- Activity validation
- Memory agent formatting

## Benefits

1. **Faster workflow**: Direct activity execution without manual tool calls
2. **Autocomplete discovery**: Users can explore available activities
3. **Context-aware**: Memory agent infers variables intelligently
4. **Error-tolerant**: Fuzzy matching and suggestions for typos
5. **Minimalist UX**: Simple `%` prefix, no complex syntax

## Future Enhancements

1. **Rich autocomplete UI** in TUI with template descriptions and variable hints
2. **Variable preview** before execution
3. **Quick templates** for common workflows (bookmarks)
4. **History** of recently used activities
5. **Alias support** for frequently used activities (`%add` → `add-feature-complete`)

## Implementation Summary

**Files Created:**
- `repos/metabob-opencode/packages/opencode/src/session/activity-prefix.ts` (155 lines)
- `repos/metabob-opencode/packages/opencode/src/session/activity-autocomplete.ts` (142 lines)
- `test-tui-activity-execution.ts` (135 lines)

**Files Modified:**
- `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` (added 35 lines for prefix detection)

**Total Implementation:** ~500 lines of code

## Example Session

```
User: %add-feature

Suggestions:
  [80] add-rest-endpoint-feature - REST endpoint creation
  [80] add-comprehensive-logging - Logging infrastructure
  [80] add-feature-complete - Full feature workflow

User: %add-feature-complete Add user authentication

Activity: add-feature-complete
Goal: Add user authentication
Status: Inferring variables from context...

Memory Agent: Analyzing session context
  - Recent files: src/auth.ts, src/middleware.ts
  - Intent: Feature implementation
  - Detected patterns: Authentication, user management

Variables inferred:
  - featureName: "user authentication"
  - files: ["src/auth.ts", "src/middleware/auth.ts"]
  - description: "Implement JWT-based authentication with middleware"

Executing activity: add-feature-complete...

[Activity executes normally with full workflow]
```
