# Activity System Runtime Validation Test Cases

## Specification
Activity System Runtime Validation with Complete Log Confirmation

## Test Case 1: Simple File Creation Activity
**Impulse ID**: `validation-activity-system-runtime-validation-case-1`

### Input
```
Analyze the test directory structure and create a summary file named analysis.txt
```

### Expected Output Patterns (8 total)

1. **Activity Start Pattern**
   - Pattern: `Activity.*starting`
   - Expected: Log line containing activity initialization with template metadata
   - Example: `Activity: analyze-and-document starting templateId=general-task-001 taskCount=2`

2. **Memory Agent Initialization**
   - Pattern: `Memory agent initializing`
   - Expected: Log line showing context gathering start
   - Example: `Memory agent initializing requirementCount=3 recentMessageCount=5`

3. **Memory Agent Completion**
   - Pattern: `Memory agent gathered.*impulses`
   - Expected: Log line with impulse collection results
   - Example: `Memory agent gathered 12 impulses elapsed=2500ms`

4. **Task Start**
   - Pattern: `Task starting:`
   - Expected: Log line for each task execution start
   - Example: `Task starting: task-1 description="Analyze directory" subagent=general`

5. **Task Completion**
   - Pattern: `Task completed:`
   - Expected: Log line with task metrics
   - Example: `Task completed: task-1 duration=45s cost=$0.023 validation=PASS`

6. **Storage Write Confirmation**
   - Pattern: `storage write confirmed`
   - Expected: Log line for persistence operations
   - Example: `storage write confirmed path=/workspace/.opencode/storage/activity/act_123.json sizeKB=42`

7. **Git Commit Creation**
   - Pattern: `Git commit created:`
   - Expected: Log line with commit details
   - Example: `Git commit created: a1b2c3d filesChanged=3 message="feat: Add analysis file"`

8. **Activity Completion**
   - Pattern: `Activity completed:`
   - Expected: Final log with comprehensive metrics
   - Example: `Activity completed: analyze-and-document duration=120s cost=$0.078 status=SUCCESS`

### Validation Criteria
- **PASS**: All 8 patterns found at least once in captured logs
- **FAIL**: Any pattern missing from logs

### Execution Environment
- **Pod**: devbob-794b69b4f4-rhnwg
- **Namespace**: metabob
- **Timeout**: 180 seconds
- **Log Capture**: Last 1000 lines from pod logs

### Historical Results
- **Timestamp**: 1773156046 (activity-runtime-logs-1773156046.txt)
- **Result**: FAILED (0/8 patterns found)
- **Duration**: 160s
- **Cost**: $0.78
- **Issue**: Activity executed successfully but lifecycle logs not visible in output

## Test Case 2: Simple Read Activity (Minimal Execution)
**Impulse ID**: `validation-activity-system-runtime-validation-case-2`

### Input
```
List the files in the current directory
```

### Expected Output Patterns
Same 8 patterns as Test Case 1, but with minimal execution time (expected <30s)

### Validation Criteria
- **PASS**: All 8 patterns found at least once
- **PARTIAL**: Activity completes but some lifecycle logs missing (indicates logging issue)
- **FAIL**: Activity fails or times out

## Test Case 3: Activity with Git Operations
**Impulse ID**: `validation-activity-system-runtime-validation-case-3`

### Input
```
Create a test file named validation-test.txt with content "Test passed at $(date)"
```

### Expected Output Patterns
Same 8 patterns, with particular focus on:
- Git commit created (pattern 7)
- Storage write confirmed (pattern 6)

### Validation Criteria
- **PASS**: All 8 patterns found, including git commit
- **FAIL**: Missing git commit or storage write patterns

## Harness Execution

### Bash Script
```bash
./tests/validation-harnesses/activity-system-runtime-validation-harness.sh [POD] [NAMESPACE]
```

### TypeScript
```typescript
import { runValidation } from './activity-system-runtime-validation-harness';

const result = await runValidation({
  pod: 'devbob-794b69b4f4-rhnwg',
  namespace: 'metabob',
  timeout: 180,
  testPrompt: 'Analyze the test directory structure and create a summary file'
});

console.log('Validation result:', result.pass ? 'PASS' : 'FAIL');
console.log('Patterns found:', result.patterns.found, '/', result.patterns.total);
```

## Troubleshooting

### If Patterns Are Missing

1. **Check Pod Image Currency**
   ```bash
   kubectl describe pod -n metabob devbob-794b69b4f4-rhnwg | grep Image:
   ```

2. **Verify OpenCode Commit**
   ```bash
   kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- opencode --version
   ```

3. **Check Log Level**
   ```bash
   kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- env | grep LOG
   ```

4. **Rebuild and Redeploy**
   ```bash
   cd repos/metabob-opencode
   bun run build --single
   cd ../..
   docker build -f docker/Dockerfile.devbob -t devbob:lifecycle-v1 .
   kubectl set image deployment/devbob -n metabob devbob=devbob:lifecycle-v1
   kubectl rollout status deployment/devbob -n metabob
   ```

### If Activity Times Out

1. Increase timeout in harness config
2. Use simpler test prompt
3. Check pod resources: `kubectl describe pod -n metabob <pod>`

### If No Logs Captured

1. Verify pod is running: `kubectl get pods -n metabob`
2. Check pod logs manually: `kubectl logs -n metabob <pod> --tail=100`
3. Check for pod restart: `kubectl get pod -n metabob <pod> -o jsonpath='{.status.containerStatuses[0].restartCount}'`
