#!/bin/bash
# =============================================================================
# Validation Script: Metabob Component Tracking ↔ OpenCode Impulse Bridge
# =============================================================================
# Purpose: Validate the bridge between component tracking and impulse system
# Success Criteria:
#   - Component tracking data is being written
#   - Impulse system is loading context
#   - Bridge correlation can be analyzed
#   - Data flow is traceable
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
TOTAL=0

# Config
AGENT_NAME="${1:-devbob-opencode}"
OUTPUT_DIR="$PROJECT_ROOT/.validation-results/bridge-analysis-$(date +%Y%m%d-%H%M%S)"

test_start() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL=$((TOTAL + 1))
}

test_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

test_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_info() {
    echo -e "       $1"
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Create output directory
mkdir -p "$OUTPUT_DIR"

section "Metabob Bridge Validation"

echo "Agent: $AGENT_NAME"
echo "Timestamp: $(date -Iseconds)"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# =============================================================================
# Pre-Flight: Check Prerequisites
# =============================================================================
section "Pre-Flight Checks"

test_start "Agent container is running"
if docker ps --format '{{.Names}}' | grep -q "^${AGENT_NAME}$"; then
    test_pass "Container $AGENT_NAME is running"
else
    test_fail "Container $AGENT_NAME is NOT running"
    exit 1
fi

test_start "Shared .metabob directory exists"
if [ -d "$PROJECT_ROOT/.metabob" ]; then
    test_pass ".metabob directory exists on host"
else
    test_fail ".metabob directory NOT found"
    exit 1
fi

echo ""

# =============================================================================
# Step 1: Component Tracking Data
# =============================================================================
section "Step 1: Component Tracking (Metabob)"

test_start "Metabob metadata file exists"

METADATA_FILE="$PROJECT_ROOT/.metabob/metadata"

if [ -f "$METADATA_FILE" ]; then
    test_pass "Metadata file exists"
    
    # Copy to output dir for analysis
    cp "$METADATA_FILE" "$OUTPUT_DIR/metabob-metadata.txt"
    
    # Analyze content
    FILE_SIZE=$(wc -c < "$METADATA_FILE")
    LINE_COUNT=$(wc -l < "$METADATA_FILE")
    
    test_info "Size: $FILE_SIZE bytes"
    test_info "Lines: $LINE_COUNT"
    
    if [ "$FILE_SIZE" -gt 0 ]; then
        test_pass "Metadata file has content"
        
        # Try to parse as JSON if possible
        if jq -e . "$METADATA_FILE" >/dev/null 2>&1; then
            test_info "Metadata is valid JSON"
            
            # Extract component count
            COMPONENT_COUNT=$(jq '. | length' "$METADATA_FILE" 2>/dev/null || echo "0")
            test_info "Components tracked: $COMPONENT_COUNT"
            
            # Extract component names
            jq -r 'keys[]' "$METADATA_FILE" 2>/dev/null | head -10 > "$OUTPUT_DIR/tracked-components.txt"
        else
            test_info "Metadata is not JSON (may be custom format)"
        fi
    else
        test_warn "Metadata file is empty"
        test_info "No component tracking data yet"
    fi
else
    test_fail "Metadata file does NOT exist"
    test_info "Component tracking may not be initialized"
fi

echo ""

test_start "Component tracking in container"

if docker exec "$AGENT_NAME" test -f "/workspace/.metabob/metadata" 2>/dev/null; then
    test_pass "Container can access .metabob/metadata"
    
    # Check if content matches host
    CONTAINER_SIZE=$(docker exec "$AGENT_NAME" wc -c < "/workspace/.metabob/metadata" 2>/dev/null)
    
    if [ "$CONTAINER_SIZE" = "$FILE_SIZE" ]; then
        test_pass "Container metadata matches host (shared correctly)"
    else
        test_warn "Container metadata size differs from host"
        test_info "Host: $FILE_SIZE bytes, Container: $CONTAINER_SIZE bytes"
    fi
else
    test_fail "Container cannot access .metabob/metadata"
    test_info "Check volume mount: ./.metabob:/workspace/.metabob"
fi

echo ""

# =============================================================================
# Step 2: Impulse System Data
# =============================================================================
section "Step 2: Impulse System (OpenCode)"

test_start "OpenCode impulses file exists"

# Check in container (where OpenCode runs)
if docker exec "$AGENT_NAME" test -f "/workspace/repos/metabob-opencode/.opencode/impulses.json" 2>/dev/null; then
    test_pass "Impulses file exists in container"
    
    # Copy to host for analysis
    docker exec "$AGENT_NAME" cat "/workspace/repos/metabob-opencode/.opencode/impulses.json" 2>/dev/null > "$OUTPUT_DIR/impulses.json"
    
    if [ -f "$OUTPUT_DIR/impulses.json" ]; then
        # Analyze impulses
        if jq -e . "$OUTPUT_DIR/impulses.json" >/dev/null 2>&1; then
            test_pass "Impulses file is valid JSON"
            
            IMPULSE_COUNT=$(jq '. | length' "$OUTPUT_DIR/impulses.json" 2>/dev/null || echo "0")
            test_info "Impulses loaded: $IMPULSE_COUNT"
            
            if [ "$IMPULSE_COUNT" -gt 0 ]; then
                test_pass "Impulses have been created"
                
                # Extract impulse IDs
                jq -r '.[] | .id' "$OUTPUT_DIR/impulses.json" 2>/dev/null | head -10 > "$OUTPUT_DIR/impulse-ids.txt"
                
                # Extract impulse types
                jq -r '.[] | .type // "unknown"' "$OUTPUT_DIR/impulses.json" 2>/dev/null | sort | uniq -c > "$OUTPUT_DIR/impulse-types.txt"
                
                test_info "Impulse types:"
                cat "$OUTPUT_DIR/impulse-types.txt" | while read -r line; do
                    test_info "  $line"
                done
            else
                test_warn "No impulses loaded yet"
            fi
        else
            test_fail "Impulses file is not valid JSON"
        fi
    fi
else
    test_fail "Impulses file does NOT exist"
    test_info "OpenCode may not have run yet or impulses not created"
fi

echo ""

# =============================================================================
# Step 3: Session Memory Context
# =============================================================================
section "Step 3: Session Memory"

test_start "Check session memory state"

if docker exec "$AGENT_NAME" test -f "/workspace/repos/metabob-opencode/.opencode/session.json" 2>/dev/null; then
    docker exec "$AGENT_NAME" cat "/workspace/repos/metabob-opencode/.opencode/session.json" 2>/dev/null > "$OUTPUT_DIR/session.json"
    
    if [ -f "$OUTPUT_DIR/session.json" ] && jq -e . "$OUTPUT_DIR/session.json" >/dev/null 2>&1; then
        test_pass "Session data captured"
        
        # Extract session info
        SESSION_ID=$(jq -r '.id // "unknown"' "$OUTPUT_DIR/session.json" 2>/dev/null)
        test_info "Session ID: $SESSION_ID"
        
        # Check for impulse references
        IMPULSE_REFS=$(jq -r '.impulses // [] | length' "$OUTPUT_DIR/session.json" 2>/dev/null || echo "0")
        test_info "Impulses in session: $IMPULSE_REFS"
    fi
else
    test_info "No session file found (may not be persisted)"
fi

echo ""

# =============================================================================
# Step 4: Bridge Correlation Analysis
# =============================================================================
section "Step 4: Bridge Correlation"

test_start "Analyze component → impulse correlation"

COMPONENTS_FILE="$OUTPUT_DIR/tracked-components.txt"
IMPULSES_FILE="$OUTPUT_DIR/impulse-ids.txt"

if [ -f "$COMPONENTS_FILE" ] && [ -f "$IMPULSES_FILE" ]; then
    test_pass "Both datasets available for correlation"
    
    # Create correlation report
    cat > "$OUTPUT_DIR/correlation-report.txt" <<EOF
Component Tracking → Impulse Bridge Correlation Report
========================================================

Generated: $(date -Iseconds)
Agent: $AGENT_NAME

Component Tracking (Metabob):
$(cat "$COMPONENTS_FILE" 2>/dev/null | nl)

Impulse System (OpenCode):
$(cat "$IMPULSES_FILE" 2>/dev/null | nl)

Analysis Questions:
-------------------
1. Which components are tracked by Metabob?
2. Which impulses are loaded by OpenCode?
3. Is there a correlation between component changes and impulse loading?
4. Are the right impulses being loaded for the components that changed?

Current State:
--------------
- This is a BASELINE capture
- Manual analysis required to establish correlation
- Next step: Instrument the bridge with logging

Instrumentation Needed:
-----------------------
1. Log when components are detected/changed
2. Log when impulses are selected for loading
3. Log the decision logic (why these impulses?)
4. Log activity execution outcomes
5. Correlate outcomes with impulse selection

Data Collection Goals:
----------------------
- Collect 50-100 execution samples
- Track: component_ids → impulse_ids → outcome
- Build dataset for ML model training
- Identify patterns: which impulses → success

EOF
    
    test_pass "Correlation report generated"
    test_info "Report: $OUTPUT_DIR/correlation-report.txt"
else
    test_warn "Incomplete data for correlation analysis"
    test_info "Need both component and impulse data"
    
    if [ ! -f "$COMPONENTS_FILE" ]; then
        test_info "Missing: Component tracking data"
    fi
    
    if [ ! -f "$IMPULSES_FILE" ]; then
        test_info "Missing: Impulse data"
    fi
fi

echo ""

# =============================================================================
# Step 5: Backend Component API
# =============================================================================
section "Step 5: Backend Component API"

test_start "Query components from backend API"

COMPONENTS_API_RESPONSE=$(curl -s "http://localhost:8080/components?project=devbob-distributed" 2>/dev/null)

if echo "$COMPONENTS_API_RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo "$COMPONENTS_API_RESPONSE" > "$OUTPUT_DIR/backend-components.json"
    test_pass "Backend components API responded"
    
    BACKEND_COMPONENT_COUNT=$(echo "$COMPONENTS_API_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
    test_info "Components in backend: $BACKEND_COMPONENT_COUNT"
    
    if [ "$BACKEND_COMPONENT_COUNT" -gt 0 ]; then
        test_pass "Backend has component tracking data"
    else
        test_info "Backend has no components yet"
    fi
else
    test_fail "Backend components API not available"
    test_info "Endpoint may not be implemented yet"
fi

echo ""

# =============================================================================
# Step 6: Data Flow Traceability
# =============================================================================
section "Step 6: Data Flow Traceability"

test_start "Create data flow trace document"

cat > "$OUTPUT_DIR/data-flow-trace.md" <<'EOF'
# Data Flow Trace: Component Tracking → Impulse Loading

## Purpose
Trace how component tracking data flows to impulse loading decisions.

## Data Sources

### 1. Component Detection (Metabob)
- **Location**: `.metabob/metadata`
- **Format**: JSON or custom format
- **Written by**: Metabob file watcher
- **Updated when**: File changes detected

### 2. Impulse Loading (OpenCode)
- **Location**: `.opencode/impulses.json`
- **Format**: JSON
- **Written by**: OpenCode impulse system
- **Updated when**: Activity execution starts

### 3. Activity Execution (OpenCode)
- **Location**: `.opencode/activities/executions/`
- **Format**: JSON
- **Written by**: Activity execution engine
- **Updated when**: Activity completes

### 4. Session Data (Backend)
- **Location**: SurrealDB `sessions` table
- **Format**: Database records
- **Written by**: Backend API
- **Updated when**: Session events occur

## Current Bridge Logic

**Question**: How does component tracking influence impulse loading?

**Current State**: Unknown/Manual
- Components are tracked by Metabob
- Impulses are loaded by OpenCode
- Bridge between them is unclear

**Goal**: Automatic bridge
- Component changes → Trigger impulse loading
- Select relevant impulses based on component context
- Learn which impulses lead to successful outcomes

## Instrumentation Plan

### Phase 1: Logging
1. Log component detection events
2. Log impulse selection decisions
3. Log activity outcomes
4. Capture all data in structured format

### Phase 2: Collection
1. Run 50-100 activity executions
2. Capture full data flow for each
3. Store in analysis-friendly format

### Phase 3: Analysis
1. Correlate component changes → impulses loaded
2. Correlate impulses loaded → outcomes
3. Identify patterns (which impulses → success)

### Phase 4: Model
1. Build recommendation model
2. Given component changes, recommend impulses
3. Test model: does it improve outcomes?

## Expected Data Points (Per Execution)

```json
{
  "execution_id": "uuid",
  "timestamp": "2026-02-10T12:34:56Z",
  "components_changed": [
    "auth.py::login",
    "auth.py::validate_token"
  ],
  "impulses_loaded": [
    "impulse-auth-context",
    "impulse-security-patterns"
  ],
  "activity_id": "bug-fix-v1",
  "outcome": "success",
  "metrics": {
    "tests_passed": 10,
    "tests_failed": 0,
    "duration_ms": 45000
  }
}
```

## Next Steps

1. ✅ Capture baseline data (this validation)
2. ⏭️ Instrument the bridge
3. ⏭️ Collect execution data
4. ⏭️ Analyze patterns
5. ⏭️ Build recommendation model
6. ⏭️ Test and iterate

EOF

test_pass "Data flow trace document created"
test_info "Document: $OUTPUT_DIR/data-flow-trace.md"

echo ""

# =============================================================================
# Summary
# =============================================================================
section "Validation Summary"

echo "Agent: $AGENT_NAME"
echo "Total Tests: $TOTAL"
echo -e "Passed:      ${GREEN}$PASSED${NC}"
echo -e "Failed:      ${RED}$FAILED${NC}"
echo ""

echo "Output Directory: $OUTPUT_DIR"
echo ""
echo "Generated Files:"
ls -1 "$OUTPUT_DIR" | while read -r file; do
    SIZE=$(wc -c < "$OUTPUT_DIR/$file" 2>/dev/null || echo "0")
    printf "  • %-40s (%'d bytes)\n" "$file" "$SIZE"
done

echo ""

# Create summary JSON
jq -n \
    --arg agent "$AGENT_NAME" \
    --arg timestamp "$(date -Iseconds)" \
    --argjson passed "$PASSED" \
    --argjson failed "$FAILED" \
    --argjson total "$TOTAL" \
    '{
        agent: $agent,
        timestamp: $timestamp,
        tests: {
            passed: $passed,
            failed: $failed,
            total: $total
        },
        output_dir: "'"$OUTPUT_DIR"'"
    }' > "$OUTPUT_DIR/validation-summary.json"

echo "Validation Summary: $OUTPUT_DIR/validation-summary.json"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Bridge validation PASSED${NC}"
    echo ""
    echo "All checks passed. This establishes a baseline for bridge analysis."
    echo "Next step: Instrument the bridge with logging"
    exit 0
else
    echo -e "${YELLOW}⚠ Bridge validation COMPLETED WITH WARNINGS${NC}"
    echo ""
    echo "Some checks failed. This may be expected if system is not fully running."
    echo "Review the output directory for captured data."
    exit 1
fi
