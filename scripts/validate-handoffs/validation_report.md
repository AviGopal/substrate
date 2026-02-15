# Data Handoff Validation Report

**Generated**: 2026-02-14 03:40:55
**Duration**: 121ms
**Pass Rate**: 0.0% (0/12)

## ⚠️  12 TESTS FAILED

---

## Test Results

| # | Test | Status | Duration | Details |
|---|------|--------|----------|---------|
| 1 | 01 Session Creation | ❌ FAIL | 92ms | Session creation failed: 401 - {"error":"Invalid A |
| 2 | 02 Activity Search | ❌ FAIL | 7ms | Session creation failed: 401 |
| 3 | 03 Activity Execution Start | ❌ FAIL | 6ms | Session creation failed: 401 - {"error":"Invalid A |
| 4 | 04 Activity Step Recording | ❌ FAIL | 7ms | Session creation failed: 401 |
| 5 | 05 Activity Execution Complete | ❌ FAIL | 7ms | Session creation failed: 401 |
| 6 | 06 Component Annotation | ❌ FAIL | 0ms | No module named '06_component_annotation' |
| 7 | 07 Template Creation | ❌ FAIL | 0ms | No module named '07_template_creation' |
| 8 | 08 Template Loading | ❌ FAIL | 0ms | No module named '08_template_loading' |
| 9 | 09 Session Token Refresh | ❌ FAIL | 0ms | No module named '09_session_token_refresh' |
| 10 | 10 Priority Issues | ❌ FAIL | 0ms | No module named '10_priority_issues' |
| 11 | 11 Change Impact Analysis | ❌ FAIL | 0ms | No module named '11_change_impact_analysis' |
| 12 | 12 Deletion Safety Assessment | ❌ FAIL | 0ms | No module named '12_deletion_safety_assessment' |

---

## Detailed Results

### 1. 01 Session Creation

**Status**: ❌ FAILED
**Duration**: 92ms

**Error**:
```
Session creation failed: 401 - {"error":"Invalid API key"}
```

**Details**:
```json
{
  "backend_healthy": true,
  "session_response_status": 401
}
```

### 2. 02 Activity Search

**Status**: ❌ FAILED
**Duration**: 7ms

**Error**:
```
Session creation failed: 401
```

### 3. 03 Activity Execution Start

**Status**: ❌ FAILED
**Duration**: 6ms

**Error**:
```
Session creation failed: 401 - {"error":"Invalid API key"}
```

### 4. 04 Activity Step Recording

**Status**: ❌ FAILED
**Duration**: 7ms

**Error**:
```
Session creation failed: 401
```

### 5. 05 Activity Execution Complete

**Status**: ❌ FAILED
**Duration**: 7ms

**Error**:
```
Session creation failed: 401
```

### 6. 06 Component Annotation

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '06_component_annotation'
```

### 7. 07 Template Creation

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '07_template_creation'
```

### 8. 08 Template Loading

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '08_template_loading'
```

### 9. 09 Session Token Refresh

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '09_session_token_refresh'
```

### 10. 10 Priority Issues

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '10_priority_issues'
```

### 11. 11 Change Impact Analysis

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '11_change_impact_analysis'
```

### 12. 12 Deletion Safety Assessment

**Status**: ❌ FAILED
**Duration**: 0ms

**Error**:
```
No module named '12_deletion_safety_assessment'
```

---

## Summary

- **Total Tests**: 12
- **Passed**: 0
- **Failed**: 12
- **Pass Rate**: 0.0%
- **Total Duration**: 121ms

⚠️  **Some handoffs failed validation. Review failures above.**