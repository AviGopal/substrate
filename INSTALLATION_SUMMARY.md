# convert-spec-to-contract-enforcement Activity Installation

**Date**: 2026-04-15
**Status**: ✅ Successfully Installed

## Installation Summary

The `convert-spec-to-contract-enforcement` activity template has been successfully installed into MiniBob. This meta-activity enables automatic generation of contract enforcement activities from specification documents.

## Files Installed

### 1. Activity Template
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/activities/meta/convert-spec-to-contract-enforcement.json`

**Validation**:
- ✅ Valid JSON structure
- ✅ Activity ID: `convert-spec-to-contract-enforcement`
- ✅ 3 tasks defined: parse-spec, generate-contract-activity, validate-contract-activity
- ✅ 4 variables: specPath (required), specId (required), specName, domain

### 2. Example Specification
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/test-fixtures/specifications/user-auth.md`

**Content**:
- OpenSpec format with YAML frontmatter
- 8 requirements across functional, performance, and security domains
- Mix of bash-testable and API-testable requirements
- Demonstrates critical, high, and medium priority levels

### 3. Documentation
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/activities/meta/README.md`

**Covers**:
- What meta-activities are
- Usage examples
- OpenSpec format guidelines
- Integration with learning loop
- Design principles

## How MiniBob Loads Activities

MiniBob loads activity templates from multiple sources (in priority order):

1. **Backend** (via MCP) - if MCP is configured and available
2. **Embedded templates** - bundled in `src/embedded-templates/` directory
3. **Local files** - activities in `activities/` directory (loaded by path)

For this installation, the activity is in `activities/meta/` and is loaded by providing the full path:

```bash
minibob --template activities/meta/convert-spec-to-contract-enforcement.json \
  --var specPath="..." \
  --var specId="..."
```

## Usage Examples

### Basic Invocation

```bash
cd repos/minibob

# Convert the user-auth specification to a contract enforcement activity
minibob --template activities/meta/convert-spec-to-contract-enforcement.json \
  --var specPath="../../test-fixtures/specifications/user-auth.md" \
  --var specId="user-auth-v1"
```

### With Optional Variables

```bash
minibob --template activities/meta/convert-spec-to-contract-enforcement.json \
  --var specPath="../../test-fixtures/specifications/user-auth.md" \
  --var specId="user-auth-v1" \
  --var specName="User Authentication" \
  --var domain="auth"
```

## Expected Outputs

When the activity executes successfully, it generates:

1. **Requirements Extraction** (`/tmp/spec-requirements-{specId}.json`)
   - Structured requirements with test methods
   - Categorization by testability (bash, API, complex)
   - Priority levels
   - Test commands

2. **Contract Activity** (`/tmp/enforce-{specId}.json`)
   - Executable activity template
   - One task per requirement
   - Deterministic bash-based tests (90%+ target)
   - Metadata linking back to source spec

3. **Generation Summary** (`/tmp/contract-generation-summary-{specId}.md`)
   - Source spec metadata
   - Generated activity details
   - Test coverage breakdown
   - Usage instructions

4. **Validation Report** (`/tmp/contract-validation-{specId}.md`)
   - Schema validation results
   - Test coverage metrics
   - Quality assessment
   - Issues found (if any)

## Validation Checklist

- ✅ Activity JSON is valid
- ✅ Activity can be loaded by MiniBob (path-based loading)
- ✅ Example spec exists and follows OpenSpec format
- ✅ Documentation is comprehensive
- ✅ Required variables are documented
- ✅ Output files are documented
- ✅ Usage examples provided

## Next Steps (Not Executed Yet)

The activity has been installed but **not executed**. To test execution:

1. **Ensure API key is configured**:
   - Set `ANTHROPIC_API_KEY` environment variable, or
   - Configure in `~/.metabob/config.json`

2. **Execute the activity**:
   ```bash
   cd repos/minibob
   minibob --template activities/meta/convert-spec-to-contract-enforcement.json \
     --var specPath="../../test-fixtures/specifications/user-auth.md" \
     --var specId="user-auth-v1"
   ```

3. **Verify outputs**:
   ```bash
   ls -lh /tmp/spec-requirements-user-auth-v1.json
   ls -lh /tmp/enforce-user-auth-v1.json
   ls -lh /tmp/contract-generation-summary-user-auth-v1.md
   ls -lh /tmp/contract-validation-user-auth-v1.md
   ```

4. **Execute generated contract** (if generation succeeds):
   ```bash
   minibob --template /tmp/enforce-user-auth-v1.json
   ```

## Design Principles Implemented

The activity follows MiniBob's core principles:

1. **Deterministic First**: Generates bash-based tests wherever possible (90%+ coverage target)
2. **Zero Cost**: Prefers deterministic resolvers over LLM reasoning
3. **Fast Execution**: Aims for <10s total execution time for generated contracts
4. **Metadata Traceability**: Links generated activities back to source specs via metadata
5. **Learning Loop Integration**: All executions are traced for Thompson Sampling
6. **Self-Development**: Meta-activities enable MiniBob to improve its own capabilities

## Integration Points

### With Learning Loop
- Execution traces show which specs → activities are effective
- Thompson Sampling learns which meta-activities work best
- Ribosome pattern can extract successful meta-patterns

### With CI/CD
- Generated contract activities can run in CI pipelines
- Deterministic tests are fast and zero-cost
- Contract validation ensures code adheres to specifications

### With Discovery-Vessel
- Meta-activities can advertise contract generation capability
- Other vessels can request contract generation via discovery
- Enables distributed specification enforcement

## Known Limitations

1. **Path-based loading only**: Activity is not yet in embedded templates, must provide full path
2. **Not yet in backend**: Activity is not synced to backend for Thompson Sampling
3. **Manual variables**: Must specify specPath and specId each time (no defaults)

## Future Enhancements

Consider these improvements:

1. **Add to embedded templates** (`src/embedded-templates/`) for easier discovery
2. **Sync to backend** for Thompson Sampling and cross-vessel availability
3. **Auto-detect specId** from YAML frontmatter in spec file
4. **Support multiple spec formats** (not just OpenSpec)
5. **Generate test fixtures** alongside contract activities
6. **Integrate with git hooks** to enforce contracts on commit
