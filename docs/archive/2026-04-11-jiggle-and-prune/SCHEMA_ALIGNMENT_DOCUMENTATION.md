# Schema Alignment and Naming Convention Documentation

## Overview

This document describes the recent schema alignment work and camelCase/snake_case naming convention implementations across the metabob codebase. The changes ensure compatibility between different components while maintaining backward compatibility.

## Canonical Field Names Migration

### Activity Template Schema Changes

The following field name migrations have been implemented in the activity template schema:

| Legacy Field Name | Canonical Field Name | Status |
|-------------------|---------------------|--------|
| `variant_id` | `id` | ✅ Both supported |
| `variant_name` | `name` | ✅ Both supported |
| `task_steps` | `tasks` | ✅ Both supported |
| `execution_format` | `execution_type` | ✅ Migrated |
| `genealogy` | `variant_of` | ✅ Both supported |

### Schema Validation Rules

The schema validation now uses refinement rules to ensure backward compatibility:

```typescript
.refine(
  data => data.id || data.variant_id,
  { message: 'Either id or variant_id must be provided' }
).refine(
  data => data.name || data.variant_name,
  { message: 'Either name or variant_name must be provided' }
).refine(
  data => data.tasks || data.task_steps,
  { message: 'Either tasks or task_steps must be provided' }
)
```

## camelCase vs snake_case Support

### Retry Strategy Fields

The system now accepts both naming conventions for retry strategies:

```typescript
retry: z.object({
  // Accept both snake_case (from MiniBob MCP) and camelCase (from ribosome)
  max_attempts: z.number().optional(),
  maxAttempts: z.number().optional(),
  strategy: z.string(),
}).refine(
  (data) => data.max_attempts !== undefined || data.maxAttempts !== undefined,
  { message: "Either max_attempts or maxAttempts is required" }
).optional()
```

### File Pointer Fields

Impulse pointers support both naming conventions:

```typescript
file_path: z.string().optional(), // backend field name
path: z.string().optional(),      // MiniBob field name - accepts both
```

### Validation in Bootstrap Activities

The audit system checks for both naming conventions:

```typescript
// Handle both camelCase and snake_case
const hasTemplateRetry = (template.retry?.maxAttempts > 1) || (template.retry?.max_attempts > 1)
const hasTaskRetry = template.tasks?.some((t: any) =>
  (t.retry?.maxAttempts > 1) || (t.retry?.max_attempts > 1)
)
```

## Data Consistency Validation

### Common Issues Addressed

1. **Field Name Mismatches**: camelCase vs snake_case inconsistencies
2. **Optional vs Required Fields**: Alignment across layers
3. **Type Incompatibilities**: String vs integer mismatches
4. **Date/Datetime Formats**: Standardized to ISO strings

### Validation Points

The user flow validation script checks for:

- Schema compatibility between request/response
- Field names matching across layers (models/routes/actions)
- Field types consistency
- Required vs optional field alignment
- Nested object structure matches

## Input/Output Shape System

### Shape-Based Activity Selection

New paradigm for activity composition based on input/output shapes:

```typescript
// input_shapes: Optional - activities can work with any input
input_shapes: z.array(z.string()).optional(),
// output_shapes: REQUIRED - must declare what the activity produces
output_shapes: z.array(z.string()).min(1, 'output_shapes must have at least one shape'),
```

### Shape Inference

Activities without explicit `output_shapes` will have shapes inferred during template registration.

## Implementation Status

### Completed ✅

- [x] Canonical field name migration in schemas
- [x] Dual naming convention support
- [x] Backward compatibility validation
- [x] Bootstrap activity audit updates
- [x] User flow validation implementation
- [x] Input/output shape system
- [x] Database schema alignment

### Testing and Validation Tools

- **User Flow Validation**: `scripts/validate_user_flows.py`
- **Bootstrap Activity Audit**: `scripts/audit-bootstrap-activities.ts`
- **Schema Consistency Checks**: Validates alignment across API layers

## Best Practices

### For New Development

1. **Use Canonical Names**: Always use canonical field names (`id`, `name`, `tasks`)
2. **Validate Both**: Test with both naming conventions during development
3. **Document Changes**: Update schema documentation when adding new fields
4. **Consistent Types**: Use consistent TypeScript types across components

### For Legacy Integration

1. **Support Both**: Accept legacy field names for backward compatibility
2. **Convert Internally**: Convert to canonical names for internal processing
3. **Gradual Migration**: Plan phased migration for existing systems
4. **Test Coverage**: Ensure tests cover both naming conventions

## Related Files

- `repos/metabob-activity-api/src/models/schemas.ts` - Main schema definitions
- `scripts/validate_user_flows.py` - User flow validation
- `scripts/audit-bootstrap-activities.ts` - Bootstrap activity auditing
- `repos/DOCUMENTATION_STANDARDS.md` - Documentation organization standards

---

**Last Updated:** $(date)
**Maintained By:** Development Team