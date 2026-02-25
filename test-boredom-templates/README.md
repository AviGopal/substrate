# Boredom System Test Templates

These templates are designed to test the boredom detection and recommendation system. Each template has metrics that should trigger different boredom scenarios.

## Templates Overview

### 1. test-debug-failures-low-gradient.json
- **Purpose**: Test detection of struggling debug workflows
- **Category**: bugfix
- **Key Metrics**:
  - Execution count: 8 (sufficient history)
  - Success rate: 37.5% (low)
  - Improvement gradient: 0.35 (LOW - should trigger boredom)
  - Performance trend: degrading
  
**Expected Boredom Detection**: ✅ HIGH PRIORITY
- Low gradient + degrading trend = needs intervention
- Multiple failure patterns indicate systemic issues
- Should be recommended for "debug-failures" activity type

### 2. test-optimize-performance-mediocre.json
- **Purpose**: Test detection of stagnating optimization efforts
- **Category**: refactor
- **Key Metrics**:
  - Execution count: 6 (sufficient history)
  - Success rate: 50% (moderate)
  - Improvement gradient: 0.42 (MODERATE - borderline)
  - Performance trend: stable (not improving)
  
**Expected Boredom Detection**: ✅ MEDIUM PRIORITY
- Gradient just below 0.5 threshold
- Stable but not improving
- Should be recommended for "optimize-performance" activity type

### 3. test-improve-template-struggling.json
- **Purpose**: Test detection of meta-template improvement issues
- **Category**: infrastructure
- **Key Metrics**:
  - Execution count: 5 (sufficient history)
  - Success rate: 40% (low)
  - Improvement gradient: 0.38 (LOW - should trigger boredom)
  - Performance trend: degrading
  
**Expected Boredom Detection**: ✅ HIGH PRIORITY
- Low gradient + degrading trend
- Template improvement itself is failing
- Should be recommended for "improve-template" activity type

## Testing Scenarios

### Scenario 1: Idle Detection Trigger
When BoredomManager detects idle state (>60s), it should:
1. Query backend API: `GET /api/v1/activities/boredom/recommend`
2. Receive these 3 templates ranked by urgency
3. Present recommendations to agent

### Scenario 2: Gradient Threshold Testing
- Templates with gradient < 0.4 should be HIGH priority
- Templates with gradient 0.4-0.5 should be MEDIUM priority
- Templates with gradient > 0.5 should NOT be recommended

### Scenario 3: Failure Pattern Analysis
Each template includes realistic failure_patterns:
- Validation errors
- Timeout errors
- Execution errors with specific messages
- Timestamps to simulate recent failures

## Usage in Docker Environment

Copy these templates to the container:
```bash
docker cp test-boredom-templates/. devbob-clean:/workspace/test-templates/
```

Or mount them in docker-compose.yaml:
```yaml
volumes:
  - ./test-boredom-templates:/workspace/test-templates:ro
```

Then test the boredom API:
```bash
curl http://api-server-dev:8080/api/v1/activities/boredom/recommend
```

Expected response should include all 3 templates ranked by priority.
