# CLI Activity Execution Command - Implementation Specification

**Date:** 2026-02-23  
**Purpose:** Add `metabob activity` command to execute OpenCode activities via ACP delegation  
**Method:** Safe self-development using develop-with-devbob-container activity

---

## Context: What We Learned

### OpenCode Activity System (Traced)

**Entry Point:** `ActivityTool.execute(templateId, variables, reason)`

**Flow:**
1. Variable validation with fuzzy matching
2. Template loading (MCP → Local fallback)
3. Pre-flight checks (git, memory agent)
4. Activity creation → Session creation
5. Context gathering (SessionMemoryAgent → impulses)
6. Task execution with topological sort
7. Dual-write metrics (MCP JSON + Redis)
8. Correctness verdict computation

**Key Integration Points:**
- Tool interface: `{ templateId, variables, reason }`
- Response: Activity record with verdict, metrics, artifacts
- Duration: 2-15 minutes average
- ACP-ready: OpenCode can be accessed via ACP

### CLI Activity Manager (Analyzed)

**Current Capabilities:**
- `search_activities()` - Query backend for templates
- `query_activity_impulses()` - Get proven impulses for activity
- `query_high_success_impulses()` - Get session pre-initialization impulses
- `get_activity()` - Get activity metadata (NOT full template)

**Missing:** Direct activity execution - can query but not execute

**Architecture:**
- Python async with httpx
- Backend API client with session token auth
- MCP server embedded (exposes tools to OpenCode)
- ActivityManager singleton pattern

---

## Specification: `metabob activity` Command

### Command Syntax

```bash
metabob activity <template-id> [OPTIONS]

Arguments:
  template-id          Activity template ID to execute

Options:
  -v, --variable KEY=VALUE     Variable assignment (repeatable)
  -r, --reason TEXT            Reason for activity execution (required)
  --opencode-url URL           OpenCode ACP endpoint [default: http://localhost:3000]
  --container NAME             Target devbob container [default: localhost]
  --timeout SECONDS            Activity execution timeout [default: 900]
  --stream / --no-stream       Stream task progress [default: true]
  --dry-run                    Validate without executing
  -h, --help                   Show help message

Examples:
  # Execute activity on local OpenCode
  metabob activity trace-data-flow-single-feature \\
    -v featureName=auth \\
    -r "Map authentication flow"

  # Execute in devbob container
  metabob activity develop-with-devbob-container \\
    -v targetRepository=metabob-cli \\
    -v specificationName=test-feature \\
    -r "Safe development in container" \\
    --container devbob-cli

  # Dry run (validate only)
  metabob activity trace-enforce-validate-loop \\
    -v specificationName=validation \\
    -r "Test spec enforcement" \\
    --dry-run
```

---

## Design: Architecture

### Component: ACP Client

**New File:** `src/metabob_cli/acp_client.py`

**Purpose:** Connect to OpenCode via Agent Client Protocol (ACP)

**Methods:**
```python
class ACPClient:
    """Client for OpenCode Agent Client Protocol (JSON-RPC over HTTP)"""
    
    def __init__(self, base_url: str, timeout: int = 900):
        self.base_url = base_url  # e.g., http://localhost:3000
        self.timeout = timeout
        
    async def execute_activity(
        self,
        template_id: str,
        variables: dict[str, any],
        reason: str,
        stream: bool = True
    ) -> dict:
        """
        Execute activity via ACP delegation.
        
        Flow:
        1. Create ACP session
        2. Send prompt: "Execute activity: {template_id} with variables {variables}"
        3. If stream: poll for progress updates
        4. Wait for completion
        5. Return activity result
        
        Returns:
            {
                "success": bool,
                "activityId": str,
                "verdict": str,
                "duration": float,
                "cost": float,
                "tasks": [...],
                "response": str  # Agent's response text
            }
        """
        pass
        
    async def validate_connection(self) -> bool:
        """Check if OpenCode is reachable"""
        try:
            response = await httpx.get(f"{self.base_url}/config")
            return response.status_code == 200
        except:
            return False
```

**Dependencies:**
- `httpx` for HTTP client (already in requirements)
- JSON-RPC message formatting
- Async/await for non-blocking execution

---

### Component: Command Handler

**File:** `src/metabob_cli/commands.py`

**New Command:**
```python
@cli.command()
@click.argument("template_id")
@click.option("-v", "--variable", "variables", multiple=True, help="Variable assignment (key=value)")
@click.option("-r", "--reason", required=True, help="Reason for activity execution")
@click.option("--opencode-url", default="http://localhost:3000", help="OpenCode ACP endpoint")
@click.option("--container", default=None, help="Target devbob container name")
@click.option("--timeout", default=900, type=int, help="Execution timeout (seconds)")
@click.option("--stream/--no-stream", default=True, help="Stream task progress")
@click.option("--dry-run", is_flag=True, help="Validate without executing")
async def activity(
    template_id: str,
    variables: tuple[str],
    reason: str,
    opencode_url: str,
    container: str | None,
    timeout: int,
    stream: bool,
    dry_run: bool
):
    """
    Execute an OpenCode activity via ACP delegation.
    
    Connects to OpenCode (localhost or container), delegates activity execution,
    streams progress, and returns results.
    
    Examples:
        metabob activity trace-data-flow-single-feature -v featureName=auth -r "Map auth"
        metabob activity develop-with-devbob-container -v targetRepository=cli -r "Safe dev"
    """
    
    # 1. Parse variables from key=value strings
    parsed_vars = parse_variables(variables)
    
    # 2. Determine target URL (localhost or docker container)
    if container:
        # Connect to container: docker://devbob-cli → http://devbob-cli:3000
        target_url = f"http://{container}:3000"
    else:
        target_url = opencode_url
    
    # 3. Create ACP client
    client = ACPClient(target_url, timeout)
    
    # 4. Validate connection
    if not await client.validate_connection():
        click.echo(f"❌ Cannot connect to OpenCode at {target_url}", err=True)
        click.echo("   Is OpenCode running?", err=True)
        sys.exit(1)
    
    # 5. Dry run: validate only
    if dry_run:
        click.echo(f"🔍 Dry run mode: validating activity '{template_id}'")
        click.echo(f"   Variables: {parsed_vars}")
        click.echo(f"   Reason: {reason}")
        click.echo("✅ Validation passed (would execute)")
        return
    
    # 6. Execute activity
    click.echo(f"🚀 Executing activity: {template_id}")
    click.echo(f"   Target: {target_url}")
    click.echo(f"   Variables: {parsed_vars}")
    click.echo(f"   Reason: {reason}")
    click.echo("")
    
    try:
        result = await client.execute_activity(
            template_id=template_id,
            variables=parsed_vars,
            reason=reason,
            stream=stream
        )
        
        # 7. Display results
        if result["success"]:
            click.echo(f"✅ Activity completed successfully")
            click.echo(f"   Activity ID: {result['activityId']}")
            click.echo(f"   Verdict: {result['verdict']}")
            click.echo(f"   Duration: {result['duration']:.1f}s")
            click.echo(f"   Cost: ${result['cost']:.4f}")
            click.echo(f"   Tasks: {len(result['tasks'])} executed")
        else:
            click.echo(f"❌ Activity failed")
            click.echo(f"   Activity ID: {result.get('activityId', 'N/A')}")
            click.echo(f"   Error: {result.get('error', 'Unknown error')}")
            sys.exit(1)
            
    except TimeoutError:
        click.echo(f"❌ Activity execution timed out after {timeout}s", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ Activity execution failed: {e}", err=True)
        sys.exit(1)


def parse_variables(variables: tuple[str]) -> dict[str, any]:
    """Parse key=value strings into dictionary"""
    parsed = {}
    for var in variables:
        if "=" not in var:
            raise ValueError(f"Invalid variable format: {var} (expected key=value)")
        key, value = var.split("=", 1)
        # Try to parse as JSON for complex values
        try:
            parsed[key] = json.loads(value)
        except json.JSONDecodeError:
            # Plain string value
            parsed[key] = value
    return parsed
```

---

## Implementation Plan

### Phase 1: ACP Client (Core)

**Files to Create:**
- `src/metabob_cli/acp_client.py` - ACP client implementation

**Implementation:**
1. HTTP client with JSON-RPC support
2. Session creation and management
3. Activity execution via prompt
4. Progress streaming (polling)
5. Result collection

**Tests:**
- Unit tests: ACP message formatting
- Integration tests: Connect to OpenCode container
- E2E tests: Execute sample activity

---

### Phase 2: CLI Command (Interface)

**Files to Modify:**
- `src/metabob_cli/commands.py` - Add `activity` command

**Implementation:**
1. Click command with options
2. Variable parsing (key=value)
3. Container URL resolution
4. Connection validation
5. Progress display
6. Result formatting

**Tests:**
- Unit tests: Variable parsing
- Integration tests: Command execution
- E2E tests: Full workflow

---

### Phase 3: Documentation (Usage)

**Files to Create/Modify:**
- `README.md` - Add activity command section
- `docs/activity-execution.md` - Detailed guide

**Content:**
- Command syntax and examples
- Integration with OpenCode
- Container usage
- Troubleshooting

---

## Validation Strategy

### Unit Tests

```python
# tests/test_acp_client.py
async def test_parse_variables():
    """Test variable parsing"""
    result = parse_variables(("key1=value1", "key2=123", 'key3={"nested": "json"}'))
    assert result == {
        "key1": "value1",
        "key2": 123,
        "key3": {"nested": "json"}
    }

async def test_acp_client_execute_activity():
    """Test ACP client activity execution"""
    client = ACPClient("http://localhost:3000")
    # Mock response
    result = await client.execute_activity(
        template_id="trace-data-flow-single-feature",
        variables={"featureName": "test"},
        reason="Test execution"
    )
    assert result["success"] == True
```

### Integration Tests

```python
# tests/integration/test_activity_command.py
async def test_activity_command_local():
    """Test activity command against local OpenCode"""
    # Start OpenCode server
    # Execute: metabob activity trace-data-flow featureName=test -r "Test"
    # Verify: Command completes successfully
    pass

async def test_activity_command_container():
    """Test activity command against devbob container"""
    # Start devbob-clean container
    # Execute: metabob activity trace-data-flow --container devbob-clean
    # Verify: Command connects to container and executes
    pass
```

### E2E Tests

```bash
# Test 1: Local OpenCode
metabob activity trace-data-flow-single-feature \\
  -v featureName=test-feature \\
  -r "Test CLI activity execution" \\
  --dry-run

# Expected: Validation passes

# Test 2: Execute in container
docker-compose up -d devbob-clean
metabob activity trace-data-flow-single-feature \\
  -v featureName=test-feature \\
  -r "Test CLI activity execution in container" \\
  --container devbob-clean

# Expected: Activity executes in container, results returned

# Test 3: Invalid variables
metabob activity trace-data-flow-single-feature \\
  -v invalidVar=value \\
  -r "Test validation"

# Expected: Error with suggestions for correct variables
```

---

## Expected Behavior

### Success Case

```
$ metabob activity trace-data-flow-single-feature -v featureName=auth -r "Map auth"

🚀 Executing activity: trace-data-flow-single-feature
   Target: http://localhost:3000
   Variables: {'featureName': 'auth'}
   Reason: Map auth

⏳ Task 1/7: Identify entry point... ✅ (45.2s, $0.12)
⏳ Task 2/7: Trace dependencies via CPG... ✅ (67.8s, $0.23)
⏳ Task 3/7: Document transformations... ✅ (89.1s, $0.31)
⏳ Task 4/7: Identify boundaries... ✅ (52.3s, $0.19)
⏳ Task 5/7: Check code quality... ✅ (43.7s, $0.15)
⏳ Task 6/7: Annotate components... ✅ (38.9s, $0.14)
⏳ Task 7/7: Generate documentation... ✅ (102.4s, $0.28)

✅ Activity completed successfully
   Activity ID: act_xyz123
   Verdict: CORRECT
   Duration: 439.4s (7.3 min)
   Cost: $1.42
   Tasks: 7 executed
   
📄 Documentation: docs/data-flows/auth-flow.md
```

### Error Case: Connection Failed

```
$ metabob activity trace-data-flow-single-feature -v featureName=auth -r "Map auth"

❌ Cannot connect to OpenCode at http://localhost:3000
   Is OpenCode running?
```

### Error Case: Invalid Variable

```
$ metabob activity trace-data-flow-single-feature -v invalidVar=test -r "Test"

❌ Activity execution failed: Variable validation error

   Unexpected variables:
     - invalidVar

   Expected variables:
     - featureName (string, required)

   Did you mean 'featureName'?
```

---

## Dependencies

### New Dependencies

None - all dependencies already in requirements:
- `httpx` - HTTP client (already used)
- `click` - CLI framework (already used)
- `asyncio` - Async support (stdlib)

### Container Requirements

For container execution:
- Docker network access (devbob-network)
- Container must expose ACP port (3000)
- Container must have OpenCode running

---

## Success Criteria

**Implementation Successful When:**

1. ✅ `metabob activity` command exists
2. ✅ Can execute activities on local OpenCode
3. ✅ Can execute activities in devbob containers
4. ✅ Variable parsing works (strings, numbers, JSON)
5. ✅ Progress streaming displays task execution
6. ✅ Results formatted clearly
7. ✅ Error handling with helpful messages
8. ✅ Unit tests pass (>95% coverage)
9. ✅ Integration tests pass (local + container)
10. ✅ Documentation complete

**Performance Targets:**
- Command startup: <2 seconds
- Activity execution: Same as OpenCode native (2-15 min)
- Result display: <1 second after completion

**Usability Targets:**
- Command help clear and comprehensive
- Error messages actionable
- Progress updates every 5 seconds
- Works with all OpenCode activity templates

---

## Next Step: Safe Development

Use `develop-with-devbob-container` activity to implement this specification:

```typescript
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    targetRepository: 'metabob-cli',
    containerTarget: 'docker://devbob-cli',
    specificationName: 'cli-activity-execution',
    specificationDescription: 'Add metabob activity command to execute OpenCode activities via ACP delegation',
    expectedBehavior: 'CLI connects to OpenCode (localhost or container), delegates activity execution via ACP, streams progress, returns results',
    validationStrategy: 'Test suite: (1) Unit tests for ACPClient and parse_variables, (2) Integration test: execute activity on local OpenCode, (3) Integration test: execute activity in devbob-clean container, (4) E2E test: full workflow with result validation',
    targetFiles: [
      'src/metabob_cli/acp_client.py',  // New file
      'src/metabob_cli/commands.py',    // Modify: add activity command
      'tests/test_acp_client.py',       // New file
      'tests/integration/test_activity_command.py',  // New file
      'README.md',                       // Modify: add activity section
      'docs/activity-execution.md'      // New file
    ],
    workingBranch: 'self-dev/cli-activity-execution'
  },
  reason: 'Add activity execution to CLI using safe container workflow. This enables users to run OpenCode activities from command line, integrates CLI with OpenCode activity system, and supports both local and container-based execution.'
})
```

---

**Status:** ✅ Specification complete  
**Next:** Execute develop-with-devbob-container activity  
**Safety:** Development in devbob-cli container, validated before incorporating to host
