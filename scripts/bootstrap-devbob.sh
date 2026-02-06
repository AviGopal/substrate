#!/bin/bash
# Bootstrap DevBob environment with templates and initial setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_ROOT="$(cd "$PROJECT_ROOT/.." && pwd)"

echo "🔧 Bootstrapping DevBob Environment"
echo "===================================="

# 1. Copy activity templates from metabob-proto (canonical source)
echo ""
echo "Step 1: Installing activity templates from metabob-proto..."
mkdir -p "$PARENT_ROOT/.metabob/activities"

PROTO_BOOTSTRAP_DIR="$PROJECT_ROOT/repos/metabob-proto/activities/bootstrap"
if [ -d "$PROTO_BOOTSTRAP_DIR" ]; then
    for template in "$PROTO_BOOTSTRAP_DIR"/*.json; do
        if [ -f "$template" ]; then
            filename=$(basename "$template")
            cp "$template" "$PARENT_ROOT/.metabob/activities/"
            echo "  ✓ Installed: $filename"
        fi
    done
else
    echo "  ⚠ Warning: metabob-proto/activities/bootstrap not found at $PROTO_BOOTSTRAP_DIR"
    echo "    Skipping template installation."
fi

# 2. Create initial impulses directory
echo ""
echo "Step 2: Setting up impulses directory..."
mkdir -p "$PARENT_ROOT/.metabob/impulses"
echo "  ✓ Created: .metabob/impulses/"

# 3. Copy helper scripts to scripts/
echo ""
echo "Step 3: Installing helper scripts..."
mkdir -p "$PARENT_ROOT/scripts"

cat > "$PARENT_ROOT/scripts/find-messages-for.sh" << 'EOF'
#!/bin/bash
# Find MESSAGE_FOR annotations for a specific target

TARGET=$1
REPO_PATH=${2:-.}

if [ -z "$TARGET" ]; then
    echo "Usage: $0 <target> [repo-path]"
    echo "Example: $0 dashboard"
    exit 1
fi

cd "$REPO_PATH"

echo "Searching for MESSAGE_FOR:$TARGET annotations..."
echo ""

# Search in Metabob annotations
if [ -d ".metabob" ]; then
    find .metabob -name "*.json" -exec grep -l "MESSAGE_FOR:$TARGET" {} \; 2>/dev/null | while read file; do
        echo "=== $file ==="
        cat "$file" | jq -r '.annotations[]? | select(.reason | contains("MESSAGE_FOR:'$TARGET'")) | .reason' 2>/dev/null || true
        echo ""
    done
fi

# Search in source code annotations
rg "MESSAGE_FOR:$TARGET" --type-add 'code:*.{ts,js,py,go}' -t code 2>/dev/null || true
EOF

chmod +x "$PARENT_ROOT/scripts/find-messages-for.sh"
echo "  ✓ Installed: find-messages-for.sh"

# 4. Create conventions documentation
echo ""
echo "Step 4: Creating conventions documentation..."
cat > "$PARENT_ROOT/.metabob/IMPULSE_CONVENTIONS.md" << 'EOF'
# Impulse and Annotation Conventions

## Impulse Types

### specification
Requirements, constraints, and success criteria for features/fixes.

**Format**:
```typescript
{
  id: "spec-feature-name",
  pointer: { type: "memo", content: "# Spec..." },
  type: "specification",
  metadata: {
    targetRepository: ["metabob-rpc-api"],
    constraints: ["< 5s", "backward-compatible"],
    dependencies: ["other-service"]
  }
}
```

### test-result
Test execution output and results.

**Format**:
```typescript
{
  id: "test-result-<timestamp>",
  pointer: { type: "memo", content: "<test output>" },
  type: "test-result",
  metadata: {
    passed: true,
    timestamp: "ISO-8601",
    specId: "spec-...",
    files: ["file1.ts", "file2.ts"]
  }
}
```

### activity-result
Activity execution summary.

**Format**:
```typescript
{
  id: "activity-result-<activityId>",
  pointer: { type: "memo", content: JSON.stringify({...}) },
  type: "activity-result",
  metadata: {
    success: true,
    duration: 300000,
    filesChanged: [...],
    summary: "..."
  }
}
```

### design-decision
Documentation of why technical choices were made.

### api-contract
Interface definitions for APIs.

## Annotation Conventions

### DESIGN_DECISION
Mark design rationale in annotations.

**Format**:
```
DESIGN_DECISION: <what was decided>
WHY: <reasoning>
ALTERNATIVES: <other options considered>
TRADEOFFS: <what was sacrificed>
CONSTRAINTS: <what forced this decision>
VALIDATED_BY: <test-result-id>
```

### MESSAGE_FOR
Cross-container coordination.

**Format**:
```
MESSAGE_FOR:<target1>,<target2> - <action required>
```

**Example**:
```
MESSAGE_FOR:dashboard,cli - Update auth API calls to pass algorithm parameter
```

### VALIDATED_BY
Link to test results that prove the implementation works.

**Format**:
```
VALIDATED_BY: test-result-1706389200000
```

## Query Patterns

### Find specifications
```typescript
await impulse_list({ type: "specification" });
```

### Find test results
```typescript
await impulse_list({ type: "test-result" });
```

### Find cross-container messages
```bash
./scripts/find-messages-for.sh dashboard
```

### Find design decisions
```typescript
await metabob_search_codebase_issues({ query: "DESIGN_DECISION" });
```
EOF

echo "  ✓ Created: IMPULSE_CONVENTIONS.md"

# 5. Test connectivity
echo ""
echo "Step 5: Testing DevBob connectivity..."
PORTS=(3001 3002 3003 3004)
NAMES=("devbob-rpc-api" "devbob-dashboard" "devbob-cli" "devbob-opencode")
ALL_OK=true

for i in "${!PORTS[@]}"; do
    PORT="${PORTS[$i]}"
    NAME="${NAMES[$i]}"
    
    if curl -sf "http://localhost:$PORT/acp/sessions" > /dev/null 2>&1; then
        echo "  ✓ $NAME - ACP accessible"
    else
        echo "  ✗ $NAME - ACP not accessible (is container running?)"
        ALL_OK=false
    fi
done

echo ""
echo "===================================="
if [ "$ALL_OK" = true ]; then
    echo "✨ Bootstrap Complete!"
    echo ""
    echo "DevBob is ready for dogfooding."
    echo ""
    echo "Next steps:"
    echo "1. Open OpenCode: opencode"
    echo "2. Create your first specification impulse"
    echo "3. See: metabob-devbob/QUICK_START.md"
else
    echo "⚠️  Bootstrap Complete (with warnings)"
    echo ""
    echo "Some containers are not accessible."
    echo "Start them with: cd metabob-devbob && ./scripts/start-devbob.sh"
fi
