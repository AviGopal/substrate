## Impulse Chaining Patterns

### Pattern 1: Sequential Processing

The most basic pattern - output of Activity A becomes input to Activity B:

```
[Source Code] → Activity A: Code Analysis → [Analysis Report] → Activity B: Generate Tests → [Test Files]
```

### Pattern 2: Fan-Out Processing

One activity's output feeds multiple downstream activities:

```
                    → Activity B: Generate Tests
[Analysis Report]   → Activity C: Generate Docs  
                    → Activity D: Security Scan
```

### Pattern 3: Fan-In Aggregation

Multiple activities' outputs are combined:

```
[Test Results]     ↘
[Security Report]   → Activity: Generate Summary → [Final Report]
[Performance Data] ↗
```

### Pattern 4: Conditional Branching

Different activities execute based on conditions:

```
[Code Analysis] → Decision Point → [Bug Fix Activity] (if bugs found)
                                → [Optimization Activity] (if performance issues)
```

## Variable Substitution in Impulses

Impulses support variable substitution using {{variable}} syntax:

```json
{
  "impulses": [{
    "id": "target-file",
    "pointer": {
      "type": "file",
      "path": "{{file_path}}"
    },
    "budget": 3000,
    "priority": "high"
  }]
}
```