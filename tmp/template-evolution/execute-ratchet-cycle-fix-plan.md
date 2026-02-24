# Fix Plan: execute-ratchet-cycle Template

## Problem
Template contains Handlebars conditionals that aren't supported:
- Task 1 (line 58): `{{#if focus_areas}}...{{/if}}`
- Task 2 (line 126): `{{#if focus_areas}}...{{/if}}`
- Task 3 (line 198): `{{#if auto_commit}}...{{/if}}`
- Task 5 (line 302): Multiple `{{#if decision == "..."}}...{{/if}}`

## Solution
Replace conditionals with unconditional text + documentation.

### Pattern
**Before**:
```
{{#if focus_areas}}
## Focus Areas
Prioritize: {{focus_areas}}
{{/if}}
```

**After**:
```
## Focus Areas (Optional)
{{focus_areas}}

(Leave empty if no specific focus areas)
```

## Implementation Steps

1. Read current template
2. For each conditional block:
   - Remove `{{#if variable}}` opening
   - Remove `{{/if}}` closing
   - Keep the content
   - Add "(Optional)" to section headers
   - Add note about leaving empty
3. Update version metadata
4. Write fixed template
5. Register as new version

## Expected Result
- Template uses ONLY Mustache syntax
- All variables still interpolated correctly
- Optional sections documented as "(Optional)"
- Template can execute without errors
