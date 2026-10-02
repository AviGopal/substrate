# Prompt 14: Registry lookup + fix

This prompt exercises activity-api's shape resolvers: it asks minibob to:
1. Look up execution history and activity templates from the registry
2. Use what it finds to inform how it fixes the failing test

This triggers `activityExecutionTrace`, `activityTemplate`, and `activityTemplateRecommendation`
impulse shapes to be resolved via activity-api — demonstrating cross-vessel resolver usage.

---

The TypeScript project in /workspace has a failing test. Before fixing it:

1. Query the activity registry for templates that match "fix failing test in TypeScript". Use the available backend tools to look up relevant execution history and existing templates — this lets the learning loop inform the approach.

2. Fix the failing test using the approach that the registry recommends (or improvise if no recommendation is available).

3. Run `bun test` to confirm all tests pass.

4. Briefly note which activity template (if any) was used from the registry, along with its success rate if visible.
