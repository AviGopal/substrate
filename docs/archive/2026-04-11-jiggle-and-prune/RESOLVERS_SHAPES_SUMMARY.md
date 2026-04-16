# MiniBob Resolvers & Shapes - Summary

## What We Have

### ✅ 8 Resolver Implementations

1. **llm-resolver** - LLM reasoning and generation (optional, requires API key)
2. **git-resolver** - Git operations (commit, branch, diff)
3. **bash-resolver** - Shell command execution
4. **file-resolver** - File operations (read, write, edit)
5. **validation-resolver** - Behavioral validation
6. **external-validation-resolver** - Real-world validation (DB, API, tests)
7. **pre-validation-resolver** - Early checks before execution
8. **git-history-resolver** - Git history analysis

### ✅ Shape System

**Input Shapes** (what activities consume):
- `goal` - Task objectives
- `source_code` - Code files
- `error` - Error messages
- `trace` - Execution logs
- `execution_trace` - Activity execution records
- `activity_template` - Template definitions
- `activity_metrics` - Performance statistics
- `test_suite` - Test files
- `sql_schema` - Database schemas
- `config_file` - Configuration files
- `documentation` - Docs and comments

**Output Shapes** (what activities produce):
- `patch` - Code changes
- `test_suite` - Test code
- `source_code` - New/modified code
- `documentation` - Documentation
- `sql_schema` - Database schema
- `config_file` - Configuration
- `analysis` - Analysis reports
- `validation_result` - Validation outcomes
- `tool_output` - Tool execution results

### ✅ 9 Validator Types

1. **file** - File existence and executability
2. **json** - JSON syntax and schema validation
3. **typescript** - TypeScript compilation checks
4. **test** - Test execution and results
5. **build** - Build process validation
6. **lint** - Code style validation
7. **markdown** - Markdown validation
8. **yaml** - YAML syntax validation
9. **environment** - Environment detection and setup

### ✅ Current Capabilities

From the check script:
- ✓ **Docker available** - Sandbox execution supported
- ✓ **Git available** - Version control operations
- ✓ **Bun available** - Build and test validation
- ⚠ **LLM disabled** - No ANTHROPIC_API_KEY (can run deterministic tasks only)

### ✅ Template Shape Usage

**57 templates** in the database use shape metadata for:
- Better activity selection (Thompson Sampling uses shape matching)
- Input validation (check required shapes available)
- Output validation (verify expected shapes produced)
- Early exit optimization (exit when shapes validate)

---

## What You Can Do

### 1. **Create Activities Using Available Resolvers**

#### Feature Development
```json
{
  "category": "feature",
  "inputShapes": ["goal", "source_code"],
  "outputShapes": ["source_code", "test_suite"],
  "resolvers": ["file", "bash", "validation"]
}
```

#### Bug Fixes
```json
{
  "category": "bugfix",
  "inputShapes": ["goal", "error", "trace", "source_code"],
  "outputShapes": ["patch", "test_suite"],
  "resolvers": ["git", "validation"]
}
```

#### Testing
```json
{
  "category": "test",
  "inputShapes": ["source_code", "goal"],
  "outputShapes": ["test_suite"],
  "resolvers": ["file", "bash", "validation"]
}
```

#### Infrastructure
```json
{
  "category": "infrastructure",
  "inputShapes": ["goal", "config_file"],
  "outputShapes": ["config_file", "documentation"],
  "resolvers": ["file", "bash", "external-validation"]
}
```

### 2. **Validate Activities**

```bash
# Built-in validators (no LLM needed)
- File existence checks
- TypeScript compilation
- Test execution
- Build verification
- Lint validation
- JSON/YAML validation

# External validators
- Database dry-run
- API endpoint checks
- Test suite execution
- Custom validation scripts
```

### 3. **Create Sandbox Activities**

With Docker available, you can:

```bash
# Build sandbox image
cd repos/minibob/sandbox
docker build -t minibob-sandbox:latest -f- <<'EOF'
FROM node:20-alpine
RUN apk add --no-cache git bash curl jq
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"
WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
EOF

# Run speculative activity in sandbox
docker run --rm \
  -v $(pwd):/workspace \
  --network none \
  minibob-sandbox:latest \
  /bin/sh -c "bun test && bun run build"
```

### 4. **Optimize for Correctness and Efficiency**

**Correctness metrics:**
- All output shapes validate
- External validation passes
- Expected behavior achieved
- No regressions introduced

**Efficiency metrics:**
- Execution time (duration_ms)
- Token usage (input/output/cache)
- Cost (cost_usd)
- Success rate

**Optimization strategies:**
- Early exit when shapes validate
- Cache validation results
- Parallelize independent checks
- Use deterministic resolvers when possible

---

## Example: Create and Test Activity in Sandbox

### Step 1: Create Activity Template

```json
{
  "id": "activity:write-and-test-file",
  "name": "Write and Test File",
  "description": "Creates a file and validates it compiles",
  "category": "tool",
  "inputShapes": ["goal"],
  "outputShapes": ["source_code"],
  "tasks": [{
    "id": "write-file",
    "description": "Write TypeScript file",
    "prompt": {
      "template": "Create a TypeScript file at {{filepath}} with content: {{content}}",
      "variables": ["filepath", "content"]
    },
    "validation": {
      "requiredFiles": ["{{filepath}}"]
    }
  }],
  "variables": [
    {"name": "filepath", "type": "string", "required": true},
    {"name": "content", "type": "string", "required": true}
  ]
}
```

### Step 2: Test in Sandbox

```bash
# Run in Docker sandbox
docker run --rm \
  -v $(pwd):/workspace \
  --network none \
  minibob-sandbox:latest \
  /bin/sh -c "
    # Execute activity
    echo 'export const hello = \"world\"' > /workspace/test.ts

    # Validate
    bun build test.ts --outdir dist/
    exit_code=\$?

    # Report
    echo \"Exit code: \$exit_code\"
    exit \$exit_code
  "
```

### Step 3: Measure and Learn

```typescript
{
  correctness: {
    file_exists: true,
    typescript_compiles: true,
    output_shape_matches: true
  },
  efficiency: {
    duration_ms: 234,
    cost_usd: 0.0000,  // No LLM used
    deterministic: true
  }
}
```

### Step 4: Extract Template

```bash
# If successful, extract template
minibob doctor tutor --from-execution exec_12345 \
  --name "Write and Validate TypeScript" \
  --tags "file-operations,typescript,validation"
```

---

## Quick Reference

### Check Current State
```bash
./scripts/check-resolvers-shapes.sh
```

### Available Commands
```bash
# List validators
ls repos/minibob/src/validators/validators/*.ts

# List resolvers
ls repos/minibob/src/resolvers/*.ts

# Check templates with shapes
curl "https://activity.metabob.com/v2/activities/templates?limit=100" | \
  jq '.templates[] | select(.input_shapes != null) | {id, input_shapes, output_shapes}'

# Run tests
cd repos/minibob
bun test
```

### Key Files
- **Resolvers**: `repos/minibob/src/resolvers/`
- **Shapes**: `repos/minibob/src/shape-resolver.ts`
- **Validators**: `repos/minibob/src/validators/`
- **External Validation**: `repos/minibob/src/resolvers/external-validation-resolver.ts`

---

## Next Steps

1. **Enable LLM Resolver** (optional):
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key"
   ./scripts/check-resolvers-shapes.sh
   # Should show: ✓ LLM Resolver available
   ```

2. **Create Custom Validator**:
   ```typescript
   // repos/minibob/src/validators/validators/my-validator.ts
   export const myValidator: ShapeValidator = async (path, options) => {
     // Custom validation logic
     return {
       valid: true,
       shape: 'my_custom_shape',
       path,
       duration_ms: 0,
       validator: 'my-validator'
     }
   }
   ```

3. **Build Sandbox Image**:
   ```bash
   cd repos/minibob/sandbox
   # Create Dockerfile (see guide)
   docker build -t minibob-sandbox:latest .
   ```

4. **Test Speculative Activity**:
   ```bash
   # Run activity in sandbox
   # Measure correctness and efficiency
   # Extract successful patterns
   # Submit to template registry
   ```

5. **Review Complete Guide**:
   - `MINIBOB_RESOLVERS_SHAPES_SANDBOX.md` - Full documentation
   - `TEACHING_AND_FEEDBACK_GUIDE.md` - Learning system
   - `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Foundation

---

**You now have:**
- ✅ 8 resolvers for different types of operations
- ✅ Comprehensive shape system for type-safe activities
- ✅ 9 validators for deterministic validation
- ✅ Docker support for sandbox testing
- ✅ Shape-based activity matching via Thompson Sampling
- ✅ External validation for real-world checks
- ✅ Tools to create, test, and optimize activities

**Start experimenting with speculative activities in sandboxes to improvise, reflect, learn, and optimize!** 🚀
