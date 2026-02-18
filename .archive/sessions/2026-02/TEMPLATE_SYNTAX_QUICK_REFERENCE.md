# OpenCode Activity Template Syntax Quick Reference

**Last Updated**: 2026-02-16  
**Purpose**: Quick guide for writing activity template prompts

---

## ✅ What Works (Supported Syntax)

### Simple Variable Interpolation
```json
{
  "prompt": {
    "template": "Create tests for {{feature_name}} using {{test_framework}}"
  }
}
```

**At runtime with variables**: `{ feature_name: "auth", test_framework: "jest" }`
```
Result: "Create tests for auth using jest"
```

### Nested Variable Access
```json
{
  "prompt": {
    "template": "Deploy to {{config.environment}} server at {{config.host}}"
  }
}
```

**At runtime with variables**: `{ config: { environment: "staging", host: "staging.example.com" } }`
```
Result: "Deploy to staging server at staging.example.com"
```

---

## ❌ What Doesn't Work (Unsupported Syntax)

### Conditionals
```json
// ❌ DOES NOT WORK
{
  "template": "{{#if (eq mode 'fast')}}Skip tests{{else}}Run tests{{/if}}"
}
```

**Error**: `Missing helper: "eq"`  
**Execution**: Fails immediately (0.0s duration)

### Helpers
```json
// ❌ DOES NOT WORK
{
  "template": "{{#if (gt count 5)}}Many items{{/if}}"
}
```

**Error**: `Missing helper: "gt"`

### Loops
```json
// ❌ DOES NOT WORK
{
  "template": "Files to process: {{#each files}}{{this}} {{/each}}"
}
```

**Error**: Template fails to render

---

## 🔄 Migration Guide

### From Handlebars Conditional to Plain Instruction

**Before** (doesn't work):
```json
{
  "template": "{{#if (eq test_framework \"auto\")}}Auto-detect framework{{else}}Use {{test_framework}}{{/if}}"
}
```

**After** (works):
```json
{
  "template": "If test_framework is 'auto', auto-detect the framework. Otherwise, use the specified test_framework (currently: {{test_framework}})."
}
```

**Why it works**: The agent reads the instruction and makes the decision. The variable `{{test_framework}}` is still substituted.

### From Handlebars Loop to Plain Instruction

**Before** (doesn't work):
```json
{
  "template": "Process these files: {{#each files}}{{this}}, {{/each}}"
}
```

**After** (works):
```json
{
  "template": "Process these files: {{files_list}}\n\nFor each file, run validation and tests."
}
```

**Variables**: Pass `files_list` as a pre-formatted string: `"auth.ts, user.ts, session.ts"`

---

## 🎯 Best Practices

### 1. Use Plain Instructions Instead of Logic

**Philosophy**: Keep logic in the agent's reasoning, not in template syntax.

**Good**:
```json
"If the optimize variable is true, enable performance profiling. Otherwise, skip profiling."
```

**Bad**:
```json
"{{#if optimize}}Enable profiling{{else}}Skip profiling{{/if}}"
```

### 2. Pre-Format Complex Variables

**Good**:
```json
// In activity code, format the variable before passing:
const filesFormatted = files.join("\n- ")
variables = { files_list: filesFormatted }

// In template:
"Process these files:\n- {{files_list}}"
```

**Bad**:
```json
// Don't try to iterate in the template:
"{{#each files}}- {{this}}\n{{/each}}"
```

### 3. Provide Context, Let Agent Decide

**Good**:
```json
"Current mode: {{mode}}\n\nIf mode is 'strict', require 100% test coverage. If mode is 'standard', require 80% coverage. If mode is 'quick', skip coverage checks."
```

**Bad**:
```json
"{{#if (eq mode 'strict')}}Coverage: 100%{{else if (eq mode 'standard')}}Coverage: 80%{{else}}No coverage{{/if}}"
```

### 4. Use Boolean Variables with Plain Instructions

**Good**:
```json
"Skip tests: {{skip_tests}}\n\nIf skip_tests is true, do not run the test suite. Otherwise, run all tests and report results."
```

**Variables**: `{ skip_tests: "true" }` or `{ skip_tests: "false" }`

**Why**: The agent can read "true" or "false" and act accordingly. No conditional syntax needed.

---

## 🔍 Debugging Tips

### If Your Template Fails Immediately (0.0s)

**Symptoms**:
- Execution duration: 0.0s
- No output or empty result
- Error in logs: "Missing helper: [helper_name]"

**Diagnosis**:
1. Check template for `{{#if}}`, `{{else}}`, `{{#each}}`
2. Check for helper functions: `(eq ...)`, `(gt ...)`, `(lt ...)`, etc.
3. Look for any `{{` followed by `#` or `/`

**Fix**: Replace with plain instructions (see migration guide above)

### If Variables Aren't Substituting

**Symptom**: Template shows `{{variable_name}}` literally in the output

**Diagnosis**:
1. Check variable name matches exactly (case-sensitive)
2. Verify variable is in the `variables` object passed to activity
3. Check for typos in variable names

**Fix**: Ensure variable names in template match variable names in `variables` object

---

## 📋 Template Creation Checklist

When creating a new activity template:

- [ ] Use ONLY `{{variable}}` syntax for interpolation
- [ ] NO `{{#if}}`, `{{else}}`, `{{#unless}}`
- [ ] NO helpers: `(eq ...)`, `(gt ...)`, etc.
- [ ] NO loops: `{{#each}}`
- [ ] Use plain instructions for conditional behavior
- [ ] Pre-format complex data (arrays, objects) in activity code
- [ ] Provide context and let agent decide
- [ ] Test with minimal variables first
- [ ] Validate JSON syntax with `jq empty template.json`

---

## 🛠️ Technical Details

### How Interpolation Works

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

```typescript
export function interpolatePrompt(
  template: string,
  variables: Record<string, any>
): string {
  // Simple regex-based variable substitution
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match
  })
}
```

**Key Points**:
- Uses regex replacement, NOT a Handlebars compiler
- Only matches `{{word}}` pattern (word characters only)
- Returns original `{{var}}` if variable not found
- No logic, no helpers, no control flow

### Why Not Full Handlebars?

**Design Decision**: Intentional simplicity

**Benefits**:
- ✅ Templates are more readable (plain instructions)
- ✅ Logic stays in agent reasoning (transparent)
- ✅ No security concerns (no code execution in templates)
- ✅ Easier to debug (no opaque template logic)
- ✅ Forces good design (separation of concerns)

**Trade-offs**:
- ❌ Can't use conditional logic in templates
- ❌ Can't iterate over arrays in templates
- ❌ Requires pre-formatting complex data

**Verdict**: The benefits outweigh the trade-offs for this use case.

---

## 📚 Related Documentation

- **Full Analysis**: `ACTIVITY_CREATE_HANDLEBARS_FIX.md`
- **Schema Issues**: `SCHEMA_UNIFICATION_ANALYSIS.md`
- **System Validation**: `ACTIVITY_SYSTEM_VALIDATION_REPORT_FEB16.md`

---

## 🆘 Quick Help

**Question**: Can I use `{{#if condition}}...{{/if}}`?  
**Answer**: ❌ No. Use plain instructions: "If condition is X, do Y. Otherwise, do Z."

**Question**: How do I iterate over an array?  
**Answer**: Pre-format the array into a string in your activity code, then pass as a variable.

**Question**: Can I use `{{#each items}}{{name}}{{/each}}`?  
**Answer**: ❌ No. Format items as a string before passing to template.

**Question**: Why does my template fail with "Missing helper"?  
**Answer**: You're using Handlebars syntax that isn't supported. Replace with plain instructions.

**Question**: What if I really need conditional logic?  
**Answer**: Put the logic in your activity code or agent prompt instructions, not template syntax.

---

**Remember**: Templates are for **variable substitution**, not **logic execution**. Keep it simple!
