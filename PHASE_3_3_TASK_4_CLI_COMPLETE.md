# Phase 3.3 Task 4: CLI Commands - COMPLETE ✅

## Overview

Implemented CLI commands for querying and managing activity template metrics via the new metrics backend.

## Files Modified

### 1. `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts`

**Changes:**
- Added import: `import { TemplateMetricsClient } from "../../session/template-metrics-client"`
- Added 3 new subcommands under `opencode activity`:
  - `metrics <template-id>` - View template performance metrics
  - `recommend <template-id>` - Get A/B testing recommendation
  - `promote <candidate-id>` - Promote candidate template to stable

## Commands Implemented

### 1. `opencode activity metrics <template-id>`

**Purpose:** View performance metrics for a template (stable + candidates)

**Features:**
- Displays stable version metrics:
  - Template ID
  - Execution count
  - Success rate
  - Average cost
  - Average duration
  - Average tokens (input, output, cache)
- Lists all candidate versions with their metrics
- Graceful error handling if metrics service unavailable
- Suggests next command: `opencode activity recommend <template-id>`

**Example Output:**
```
Fetching metrics for: add-feature-complete

Stable Version:
  Template ID: add-feature-complete-v1
  Executions: 47
  Success Rate: 85.1%
  Avg Cost: $0.0234
  Avg Duration: 45.3s
  Avg Tokens: 12,543
    Input: 8,234, Output: 3,456, Cache: 853

Candidate Versions (2):

  Candidate: add-feature-complete-v2-candidate-1
    Executions: 15
    Success Rate: 93.3%
    Avg Cost: $0.0198
    Avg Duration: 38.7s
    Avg Tokens: 10,234

  Candidate: add-feature-complete-v2-candidate-2
    Executions: 8
    Success Rate: 87.5%
    Avg Cost: $0.0245
    Avg Duration: 42.1s
    Avg Tokens: 11,876

Get recommendation: opencode activity recommend add-feature-complete
```

### 2. `opencode activity recommend <template-id>`

**Purpose:** Get A/B testing recommendation for template promotion

**Features:**
- Displays recommendation action:
  - `PROMOTE` - Candidate outperforms stable significantly
  - `KEEP_TESTING` - Need more data
  - `PRUNE` - Candidate underperforms
  - `NO_CANDIDATES` - No candidates available
- Shows reason for recommendation
- Displays confidence level (if available)
- Shows metrics comparison between stable and candidate
- Suggests promotion command if action is PROMOTE

**Example Output:**
```
Fetching recommendation for: add-feature-complete

Action: PROMOTE
Reason: Candidate v2-candidate-1 shows 8.2% improvement in success rate and 15.4% cost reduction with statistical significance (p < 0.05, n=15)
Candidate: add-feature-complete-v2-candidate-1
Confidence: 95.3%

Metrics Comparison:

  Stable:
    Success: 85.1%, Cost: $0.0234, Duration: 45.3s

  Candidate:
    Success: 93.3%, Cost: $0.0198, Duration: 38.7s

To promote: opencode activity promote add-feature-complete-v2-candidate-1
```

### 3. `opencode activity promote <candidate-id>`

**Purpose:** Promote a candidate template to stable version

**Options:**
- `--reason <text>` - Optional reason for promotion (recommended for audit trail)

**Features:**
- Promotes candidate to stable
- Archives old stable version
- Updates template registry
- Displays promotion results
- Shows old and new stable IDs

**Example Output:**
```
Promoting candidate: add-feature-complete-v2-candidate-1

✓ Template promoted successfully!

Message: Candidate add-feature-complete-v2-candidate-1 promoted to stable. Old stable add-feature-complete-v1 archived.
New Stable: add-feature-complete-v2
Old Stable: add-feature-complete-v1

View metrics: opencode activity metrics add-feature-complete-v2
```

## Implementation Details

### Error Handling

All commands check for metrics service availability:
```typescript
const available = await TemplateMetricsClient.isAvailable()
if (!available) {
  UI.error("Metrics service not available. Check MCP configuration.")
  process.exit(1)
}
```

### Graceful Degradation

- Commands use `TemplateMetricsClient` which wraps MCP calls
- If MCP client unavailable, returns `null` gracefully
- Commands display user-friendly error messages
- No crashes or stack traces for missing backend

### UI Styling

Commands use existing UI style constants:
- `UI.Style.TEXT_INFO_BOLD` - Headings
- `UI.Style.TEXT_HIGHLIGHT_BOLD` - Important text
- `UI.Style.TEXT_DIM` - Secondary information
- `UI.Style.TEXT_SUCCESS` - Success messages (e.g., PROMOTE)
- `UI.Style.TEXT_DANGER` - Warning messages (e.g., PRUNE)
- `UI.Style.TEXT_INFO` - Informational text

## Integration with Existing CLI

Commands follow existing patterns from `activity.ts`:
- Use `bootstrap()` for initialization
- Use `UI.println()` for output
- Use `log.error()` for error logging
- Use `process.exit(1)` for failures
- Use `yargs` builder pattern for arguments

## Testing Verification

### Build Status: ✅ PASSING
```bash
cd repos/metabob-opencode
npm run build -w packages/opencode
# Result: All builds successful (11 targets)
```

### Command Registration: ✅ VERIFIED
```bash
opencode activity --help
# Output shows all 3 new commands:
#   - metrics <template-id>
#   - recommend <template-id>
#   - promote <candidate-id>
```

### Command Help: ✅ VERIFIED
```bash
opencode activity metrics --help
opencode activity recommend --help
opencode activity promote --help
# All display correct help text with arguments
```

## Dependencies

### Internal Dependencies
- `TemplateMetricsClient` - MCP client wrapper (Phase 3.3 Task 2)
- `TemplateMetricsResponse`, `PromotionRecommendation`, `PromotionResponse` - Types (Phase 3.3 Task 1)
- `UI` - Terminal output utilities
- `Log` - Logging utilities
- `bootstrap()` - CLI initialization

### External Dependencies
- MCP Gateway (Phase 3.1) - Routes calls to backend
- Backend API (Phase 3.2) - `/api/activity-execution/*` endpoints

## Usage Examples

### Workflow 1: View Metrics
```bash
# List available templates
opencode activity template list

# View metrics for specific template
opencode activity metrics add-feature-complete
```

### Workflow 2: Check Recommendation
```bash
# Get recommendation
opencode activity recommend add-feature-complete

# If PROMOTE recommended, view detailed metrics
opencode activity metrics add-feature-complete

# Promote if satisfied
opencode activity promote add-feature-complete-v2-candidate-1 --reason "15% cost reduction verified"
```

### Workflow 3: Manual Promotion
```bash
# View all candidates
opencode activity metrics add-feature-complete

# Promote specific candidate
opencode activity promote add-feature-complete-v2-candidate-2 --reason "Manual override for testing"
```

## Next Steps

**Task 5: Testing & Verification** (Final Task)
- Create unit tests for `TemplateMetricsClient`
- Create integration tests for CLI commands
- Test error handling and edge cases
- Verify end-to-end metrics flow
- Document test coverage

## Completion Criteria: ✅ MET

- [x] Three CLI commands implemented
- [x] All commands follow existing patterns
- [x] Graceful error handling
- [x] User-friendly output formatting
- [x] Help text for all commands
- [x] TypeScript compilation passes
- [x] Commands registered in CLI
- [x] Integration with `TemplateMetricsClient`

## Time Taken

**Estimated:** 30-45 minutes  
**Actual:** ~35 minutes

## Summary

Task 4 is complete. The CLI commands provide a user-friendly interface for:
1. **Viewing** template performance metrics
2. **Querying** A/B testing recommendations
3. **Promoting** candidate templates to stable

All commands integrate seamlessly with the existing OpenCode CLI structure and leverage the metrics backend via MCP Gateway.

**Phase 3.3 Progress: 80% complete (4/5 tasks)**
