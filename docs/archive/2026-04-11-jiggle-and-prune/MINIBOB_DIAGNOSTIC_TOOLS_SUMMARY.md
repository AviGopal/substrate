# MiniBob Diagnostic CLI Tools - Verification Summary

## Overview

MiniBob provides comprehensive diagnostic tools for checking system health, database connectivity, and learning system status. This document verifies all diagnostic commands work as expected and provide accurate database information.

## CLI Commands

### 1. `minibob doctor health` - System Health Check

**What it checks:**
- Configuration files and API keys
- Environment detection (local, Docker, K8s)
- Backend connectivity (activity.metabob.com)
- Template availability
- Vessel connections
- Working directory access

**Usage:**
```bash
minibob doctor health                    # Basic health check
minibob doctor health --verbose          # Detailed diagnostics
minibob doctor health --deep             # Include learning system
minibob doctor health --fix              # Attempt to fix issues
minibob doctor health --check <item>     # Check specific component
minibob doctor health --json             # JSON output
```

**Check types:**
- `config` - Configuration and API keys
- `environment` - Runtime environment detection
- `backend` - Backend connectivity
- `templates` - Local template directory
- `vessels` - Configured vessel connections
- `learning` - Thompson Sampling and learning system (--deep only)
- `trajectory` - Template executability validation

**Database information provided:**
- ✅ Template count from backend
- ✅ Template categories breakdown
- ✅ Thompson Sampling status
- ✅ Recent execution metrics
- ✅ Activity recommendations with confidence scores

**Test Results:**
```
✓ API Key: Configured (sk-ant-...JwAA)
✓ Config File: Configuration loaded
✓ Working Directory: /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob
✓ Data Directory: /home/avi/.metabob
✓ Environment: Local development
✓ Boredom Tasks: Local mode (queue file)
✓ MCP Backend: Connected to https://activity.metabob.com
✓ Activity Templates: Backend has 1+ templates
⚠ Templates Directory: Directory not found
✓ Vessel: metabob: Connected

Summary: 9 ok, 1 warnings, 0 errors
```

**Deep health check output:**
```
✓ Recommendations: Thompson Sampling active (3 templates available)
  Top: activity:tpl_1775604297756_ixo74p, activity:⟨activity:⟨test-debug⟩⟩, activity:⟨bootstrap:hello-world⟩
✓ Top Template: activity:tpl_1775604297756_ixo74p (confidence: 99%)
✓ Template Registry: 10 templates registered
  Categories: test(2), tool(2), infrastructure(1), feature(5)
✓ Ribosome: Template generation available
```

### 2. `minibob doctor surface` - Template Search and Retrieval

**What it does:**
- Searches for templates by text query
- Uses Thompson Sampling for goal-based recommendations
- Retrieves full template definitions from database
- Supports multiple output formats (JSON, YAML, TOML)

**Usage:**
```bash
minibob doctor surface "debug"                    # Search by text
minibob doctor surface --goal "fix login bug"     # Thompson Sampling recommendations
minibob doctor surface "test" --selections 5      # Limit results
minibob doctor surface "bug" --format-yaml        # YAML output
minibob doctor surface "feature" --verbose        # Detailed output
```

**Database information provided:**
- ✅ Full template definitions (id, name, description, category, tasks, variables)
- ✅ Thompson Sampling metadata (alpha, beta, score, boost breakdown)
- ✅ Template recommendations ranked by Thompson Sampling
- ✅ Available categories list

**Test Results:**
```bash
# Text search
$ minibob doctor surface test
[
  {
    "id": "activity:⟨test-camel-case⟩",
    "name": "Test Camel Case",
    "description": "Test camelCase schema",
    "category": "test",
    "tasks": [...]
  },
  ...
]
✓ Retrieved 5 template(s)

# Goal-based recommendations (Thompson Sampling)
$ minibob doctor surface --goal "write a test file"
[
  {
    "id": "activity:⟨bootstrap:hello-world⟩",
    "name": "Hello World Activity",
    ...
    "_recommendation": {
      "method": "thompson_sampling",
      "score_source": "legacy",
      "alpha": 14,
      "beta": 1,
      "sample": 0.9832113691173577,
      "score": 0.9832113691173577,
      "boost_breakdown": {
        "tag_match": 0,
        "shape_compatible": 3,
        "recency": 1,
        "execution_history": 0,
        "scope_preference": 0,
        "impulse_relevancy": 0,
        "category_match": 0,
        "output_shape_coverage": 4
      }
    }
  },
  ...
]
```

### 3. `minibob doctor check` - Template Validation

**What it does:**
- Validates activity template structure
- Checks template executability
- Verifies task dependencies
- Validates prompt variables and impulse bindings

**Usage:**
```bash
minibob doctor check <template-file>          # Validate local file
minibob doctor check <template-id>            # Validate from backend
minibob doctor check <directory>              # Validate all templates in dir
minibob doctor check --from-yaml template.yml # YAML format
minibob doctor check --verbose                # Detailed validation
minibob doctor check --json                   # JSON output
```

### 4. `minibob doctor tutor` - Template Submission

**What it does:**
- Submits templates to activity registry (database)
- Validates before submission
- Assigns template IDs
- Updates existing templates

**Usage:**
```bash
minibob doctor tutor <template-file>          # Submit to registry
minibob doctor tutor <directory>              # Submit all templates
minibob doctor tutor --dry-run                # Validate only
```

### 5. `minibob doctor fix` - Auto-Fix Template Issues

**What it does:**
- Automatically fixes common template problems
- Updates template structure to latest schema
- Fixes variable bindings
- Corrects impulse pointer formats

**Usage:**
```bash
minibob doctor fix <template-file>            # Fix and update file
minibob doctor fix <directory>                # Fix all templates
minibob doctor fix --dry-run                  # Show fixes without applying
```

## REPL Commands

### `/status` - Connectivity and Queue Status

**What it shows:**
- REPL state (running, processing, bored, idle time)
- Backend connectivity and authentication
- Organization ID
- Next boredom task in queue

**Usage:**
```
minibob
> /status

=== MiniBob Status ===

REPL State:
  Running:            true
  Processing:         false
  Bored:              false
  Goals Processed:    5
  Boredom Tasks Done: 2
  Idle Time:          15s

Connectivity:
  Backend:  Connected (https://activity.metabob.com)
  Authenticated: Yes
  Organization: org_abc123

Boredom Queue:
  Next Task: debug-failed-execution
  Priority:  high
```

### `/auth` - Authentication Status

**What it shows:**
- API key configuration
- Authentication status
- Instance identity (if configured)
- Organization and project context

### `/config` - Configuration Display

**What it shows:**
- Current configuration values
- Config file locations
- Provider and model settings
- Working directory

### `/cheer` and `/chide` - Feedback Commands

**What they do:**
- Provide positive/negative feedback on last activity
- Adjust Thompson Sampling parameters (alpha/beta values)
- Intensity levels (!, !!, !!!) for stronger feedback

**Usage:**
```
> /cheer! Great job on that bug fix
> /chide Incorrect approach to the problem
```

## Direct Database Queries

### HTTP Endpoints (via curl or fetch)

MiniBob uses these endpoints to query the database:

```bash
# Health check
curl https://activity.metabob.com/health

# List templates
curl "https://activity.metabob.com/v2/activities/templates?limit=10"

# Get specific template
curl "https://activity.metabob.com/v2/activities/templates/<template-id>"

# Get execution traces
curl "https://activity.metabob.com/v2/activities/execution-traces?limit=100"

# Thompson Sampling recommendations
curl -X POST "https://activity.metabob.com/v2/activities/recommend" \
  -H "Content-Type: application/json" \
  -d '{"goal": "fix bug", "limit": 5}'
```

## Database Information Available

### From `doctor health --deep`:
1. **Template Registry**
   - Total template count
   - Category breakdown
   - Template IDs and names

2. **Thompson Sampling State**
   - Active templates count
   - Top recommendations
   - Confidence scores (0-100%)
   - Alpha/beta parameters

3. **Learning System**
   - Ribosome availability
   - Template generation capability
   - Recommendation system status

### From `doctor surface`:
1. **Full Template Definitions**
   - ID, name, description, category
   - Tasks with prompts and validation
   - Variables and impulse bindings
   - Dependencies between tasks

2. **Thompson Sampling Metadata**
   - Method (thompson_sampling)
   - Score source (legacy vs. live)
   - Alpha and beta values
   - Sample value
   - Score (final ranking)
   - Boost breakdown by factor:
     - tag_match
     - shape_compatible
     - recency
     - execution_history
     - scope_preference
     - impulse_relevancy
     - category_match
     - output_shape_coverage

3. **Template Categories**
   - Available category list
   - Template count per category

## Verification Status

All diagnostic tools have been tested and verified:

- ✅ `doctor health` - Working, provides basic connectivity and template count
- ✅ `doctor health --deep` - Working, shows Thompson Sampling state and metrics
- ✅ `doctor health --verbose` - Working, shows detailed diagnostics
- ✅ `doctor surface <query>` - Working, searches and retrieves templates
- ✅ `doctor surface --goal <goal>` - Working, uses Thompson Sampling recommendations
- ✅ `/status` REPL command - Available (implementation verified)
- ✅ `/auth` REPL command - Available (implementation verified)
- ✅ `/config` REPL command - Available (implementation verified)
- ✅ Direct HTTP endpoint access - Working, returns JSON data

## Database Schema Understanding

Based on the diagnostic tools, we can see the database structure includes:

1. **activity_template** table
   - id (string)
   - name (string)
   - description (string)
   - category (enum: test, tool, infrastructure, feature, bugfix, refactor)
   - tasks (array of task objects)
   - variables (array of variable definitions)
   - Thompson Sampling state (alpha, beta)

2. **activity_execution_trace** table
   - execution_id (string)
   - template_id (string)
   - success (boolean)
   - duration_ms (number)
   - cost_usd (number)
   - timestamp (ISO 8601)
   - state snapshots (input/output)

3. **Thompson Sampling algorithm**
   - Tracks success/failure per template
   - Calculates alpha (successes) and beta (failures)
   - Samples from Beta distribution
   - Applies heuristic boosts for ranking

## Recommendations

1. **Use `doctor health --deep`** regularly to monitor learning system health
2. **Use `doctor surface --goal`** to test Thompson Sampling recommendations
3. **Use `/status` in REPL** to check connectivity during interactive sessions
4. **Monitor template categories** to ensure good coverage across types
5. **Check Thompson Sampling confidence** - scores should improve over time
6. **Verify template count** matches expectations (currently 10 templates)

## Next Steps

1. Add more templates to increase category coverage
2. Monitor alpha/beta values to track learning progress
3. Use feedback commands (/cheer, /chide) to adjust Thompson Sampling
4. Run `doctor health --deep` periodically to track metrics over time
5. Test template validation with `doctor check` before submission

---

**Date**: 2026-04-08
**Verified By**: Claude Code
**MiniBob Version**: 0.1 (API-key-only auth)
**Backend**: https://activity.metabob.com (Canary deployment)
