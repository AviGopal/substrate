# Boredom Test Templates - Metrics Summary

## Quick Reference Table

| Template | Category | Exec Count | Success Rate | Gradient | Trend | Priority |
|----------|----------|------------|--------------|----------|-------|----------|
| test-debug-failures-low-gradient | bugfix | 8 | 37.5% | **0.35** | degrading | HIGH |
| test-improve-template-struggling | infrastructure | 5 | 40.0% | **0.38** | degrading | HIGH |
| test-optimize-performance-mediocre | refactor | 6 | 50.0% | **0.42** | stable | MEDIUM |

## Gradient Analysis

### Boredom Detection Thresholds
- **< 0.4**: HIGH priority (urgent intervention needed)
- **0.4 - 0.5**: MEDIUM priority (watch closely)
- **> 0.5**: LOW priority (making progress)

### Test Coverage
✅ **2 templates** in HIGH priority range (< 0.4)
✅ **1 template** in MEDIUM priority range (0.4-0.5)
✅ **All templates** have execution_count >= 3 (required for gradient calculation)

## Failure Patterns Included

### test-debug-failures-low-gradient
- 3x validation errors ("Test still failing after attempted fix")
- 2x timeout errors ("Analysis took too long")

### test-optimize-performance-mediocre
- 2x validation errors ("Benchmark command failed - performance regression detected")
- 1x execution error ("Could not identify clear bottleneck")

### test-improve-template-struggling
- 2x validation errors ("Improved template still failing validation")
- 1x execution error ("Could not apply improvements - template structure issues")

## Expected API Response

When querying `/api/v1/activities/boredom/recommend`, the backend should return:

```json
{
  "recommendations": [
    {
      "activity_id": "test-debug-failures-low-gradient",
      "priority": "high",
      "reason": "Low improvement gradient (0.35) with degrading success rate",
      "suggested_action": "debug-failures"
    },
    {
      "activity_id": "test-improve-template-struggling",
      "priority": "high",
      "reason": "Low improvement gradient (0.38) with degrading success rate",
      "suggested_action": "improve-template"
    },
    {
      "activity_id": "test-optimize-performance-mediocre",
      "priority": "medium",
      "reason": "Moderate gradient (0.42) with stable but not improving trend",
      "suggested_action": "optimize-performance"
    }
  ]
}
```

## Testing Workflow

1. **Register templates** with backend API
2. **Wait for idle detection** (60s)
3. **Verify recommendation fetch** from backend
4. **Confirm ranking** matches priority expectations
5. **Test activity execution** for highest priority item
