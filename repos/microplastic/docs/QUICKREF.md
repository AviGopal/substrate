# microplastic Quick Reference

## Basic Commands

```bash
microplastic "goal"           # Execute a goal
microplastic -d "goal"        # Dry run (preview)
microplastic -v "goal"        # Verbose output
microplastic templates        # List templates
microplastic history          # View execution history
microplastic status           # Check system status
```

## Goal Writing

```bash
# ✓ Good goals
"fix the TypeError in src/auth.ts line 42"
"add a logout button to the HeaderComponent"
"write tests for UserService.validate method"
"run tests and fix any failures"

# ✗ Bad goals
"make it work"
"fix bugs"
"improve the code"
```

## Recovery Patterns

```bash
# After failure - provide context
microplastic "the API returns paginated results, retry with pagination handling"

# Revert and try different approach
microplastic "revert last changes, use Redis caching instead of in-memory"

# Force improvisation
microplastic --improvise "create a novel solution for X"
```

## Template Selection

```
Thompson Sampling picks templates based on success history:
- High α (successes) → Higher selection probability
- High β (failures) → Lower selection probability
- New templates → Explored occasionally
```

## Boredom Activities

Create `.microplastic/boredom.json`:

```json
{
  "enabled": true,
  "idleThresholdMs": 300000,
  "activities": [
    { "id": "tests", "priority": 1, "goal": "run tests" },
    { "id": "lint", "priority": 2, "goal": "fix linting errors" }
  ]
}
```

## The Cycle

```
GOAL → TEMPLATE (or improvise) → EXECUTE → TRACE → LEARN
              ↑                                   │
              └───────────────────────────────────┘
                      (ribosome extracts new templates)
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-...      # Required for LLM
ACTIVITY_API_URL=http://...   # Backend URL
ACTIVITY_API_KEY=mb_live_...  # Backend auth
```

## Key Files

```
.microplastic/
  boredom.json      # Boredom activity config
  cache/            # Offline template cache (gitignored)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No template found" | Let it improvise, or seed primordials |
| Execution fails | Check narrative, provide guidance |
| Wrong template selected | Be more specific in goal |
| Boredom not running | Check idleThresholdMs, verify enabled |
