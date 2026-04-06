## Why

Goal execution in MiniBob has drifted from the foundation idioms defined in `IMPULSE_ACTIVITY_FOUNDATION.md`. Key violations include: error context passed as string concatenation instead of impulses, validation only running after LLM calls (wasting tokens), failure patterns not being recorded for learning, template generation missing schema extraction, composition graphs lacking impulse flow data, and all tools being provided to every task regardless of need. These gaps prevent the learning loop from reaching its full potential and violate principles like "Impulses Are Universal Data" and "LLMs Are Tools, Not Controllers."

## What Changes

- **Pre-execution validation**: Check validators BEFORE calling LLM to skip unnecessary LLM calls when validation would already pass (~30-40% of tasks)
- **Errors as impulses**: Convert error context from string concatenation to proper impulses with shapes, enabling relevance filtering and learning
- **Failure pattern recording**: Record tool argument patterns on failure (not just success), enabling learning from what doesn't work
- **Schema extraction integration**: Connect existing `extractInputSchema()` and `extractOutputSchema()` to `assembleTemplateFromExecution()` for complete template metadata
- **Composition impulse flow**: Track which impulses connect parent-child activities, enabling "after X with inputs Y, Z happens 78%" patterns
- **Resolver requirements per task**: Allow tasks to declare required/excluded tools, reducing context size and enabling safer execution

## Capabilities

### New Capabilities
- `pre-execution-validation`: Check validation rules before LLM execution to skip unnecessary calls when state already satisfies requirements
- `error-impulse-context`: Convert retry error context from string concatenation to proper impulses with metadata and relevance tracking
- `failure-pattern-learning`: Record tool argument patterns on validation/execution failures, not just successes
- `composition-impulse-tracking`: Track input/output impulse shapes through activity composition edges for pattern learning

### Modified Capabilities
- `template-generation`: Integrate schema extraction into `assembleTemplateFromExecution()` to populate `inputSchema` and `outputSchema` fields
- `task-execution`: Add per-task resolver/tool requirements with filtering before LLM calls

## Impact

**MiniBob (repos/minibob)**:
- `src/activity.ts`: Pre-validation check, error impulse creation, failure recording, tool filtering
- `src/template-generator.ts`: Schema extraction integration
- `src/types.ts`: New types for pre-validation, resolver requirements
- `src/mcp.ts`: Enhanced composition recording, failure pattern fields
- New file: `src/pre-execution-validator.ts`

**Activity API (repos/metabob-activity-api)**:
- `src/routes/activities.ts`: Composition endpoint enhancements
- `src/models/schemas.ts`: Failure pattern fields, composition impulse tracking
- New table: `composition_impulse_flow` for per-impulse composition tracking
- Schema migration for `tool_argument_pattern` failure fields

**Estimated Effort**: 40-60 hours total
