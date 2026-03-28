# Activity Template Validation Report
**Date:** February 16, 2026  
**Validator:** OpenCode with ActivityTemplate.Schema (Zod validation)

## Executive Summary

✅ **1 template is valid and complete**  
❌ **1 template has 69 validation errors**  
📊 **Total templates validated:** 2

---

## Validation Results

### ✅ Template 1: add-feature-complete.json

**Status:** VALID ✓

**Template Details:**
- **ID:** add-feature-complete
- **Name:** Add Feature Complete
- **Category:** feature
- **Tasks:** 4 (design-feature, implement-feature, test-feature, document-and-annotate)
- **Description:** Complete feature implementation workflow with design, implementation, testing, and quality validation using Metabob integration

**Validation Checks Passed:**
- ✓ Valid JSON syntax
- ✓ All required top-level fields present
- ✓ Valid version structure
- ✓ Valid genealogy metadata
- ✓ All tasks have required fields
- ✓ Task prompt configurations are valid
- ✓ Validation configurations are complete
- ✓ Retry configurations are properly structured
- ✓ Metrics structures are initialized
- ✓ Integration hooks are defined
- ✓ Metabob configuration is valid
- ✓ Composition patterns are defined
- ✓ Learning configuration is complete

**Ready for:**
- ✓ Registration with backend
- ✓ Execution in production
- ✓ Use as template for new activities

---

### ❌ Template 2: add-rest-endpoint.json

**Status:** INVALID ✗

**Critical Issues:** 69 schema validation errors

**Error Categories:**

#### 1. Missing Required Top-Level Fields (9 errors)
- Missing `id` field (has `variant_id` and `activity_id` instead)
- Missing `name` field (has `variant_name` instead)  
- Missing `executions`, `successRate`, `avgDuration`, `avgCost` fields
- Missing `avgTokens` object structure
- Missing `createdAt`, `updatedAt` timestamps

#### 2. Invalid Version Structure (1 error)
- `version` field is a number (1) instead of Version object
- **Expected:** `{ major, minor, patch, timestamp, parent_hash, variant_hash, full_version, generation }`

#### 3. Missing Genealogy Object (1 error)
- `genealogy` field is undefined
- **Expected:** `{ parent, parent_id, ancestors, children, variant_ids, variant_hash, created_at, generation, evolution }`

#### 4. Task Validation Errors (48 errors across 4 tasks)

**Per-task issues (repeated 4 times):**
- `prompt.maxTokens`: undefined (expected number)
- `prompt.compressionStrategy`: invalid value (expected one of "none"|"summarize"|"filter"|"adaptive")
- `prompt.variables`: array of strings instead of objects
  - **Expected:** `{ name, type, required, description, default? }`
- `validation.requiredFiles`: undefined (expected array)
- `validation.requiredPatterns`: undefined (expected array)
- `validation.forbiddenPatterns`: undefined (expected array)  
- `retry.maxAttempts`: undefined (expected number)
- `metrics.successRate`: undefined (expected number)
- `metrics.avgTokens`: undefined (expected number)
- `metrics.avgDuration`: undefined (expected number)
- `metrics.commonFailures`: undefined (expected array)

#### 5. Context Requirements Errors (1 error)
- `contextRequirements[0].impulseTypes[1]`: Invalid value
- Contains "remoteSession" which is not in the enum (missing from old schema version)

#### 6. Composition Errors (2 errors)
- `composition.composesWith[0]`: string instead of object
- `composition.composesWith[1]`: string instead of object
- **Expected:** `{ templateId, relationship, description, example }`

**Root Cause:**

This template uses an **old proto/variant schema format** that is incompatible with the current `ActivityTemplate.Schema`. It appears to be from an earlier version of the activity system.

**Fix Required:**

The template needs to be completely restructured to match `ActivityTemplate.Schema`. Key changes:

1. Rename `variant_id` → `id` and `variant_name` → `name`
2. Convert `version: 1` → Version object
3. Add genealogy metadata
4. Fix all task configurations:
   - Add maxTokens to each prompt
   - Convert prompt.variables from string[] to PromptVariable[]
   - Add validation arrays (requiredFiles, requiredPatterns, forbiddenPatterns)
   - Add retry.maxAttempts
   - Initialize metrics structures
5. Fix composition.composesWith array format
6. Add execution history fields (executions, successRate, etc.)
7. Add timestamps (createdAt, updatedAt)

**Recommendation:** Use `add-feature-complete.json` as a reference template and rebuild this template from scratch.

---

## Validation Tool Performance

**Tool Used:** `register_activity_template` MCP tool  
**Validation Mode:** Zod schema validation (validate_only: true)

**Strengths:**
- ✓ Provides detailed error paths (e.g., "tasks.0.prompt.maxTokens")
- ✓ Shows expected vs actual types
- ✓ Validates against actual TypeScript schema
- ✓ Catches all schema violations in one pass
- ✓ No false positives

**Comparison to bash validator:**
The bash validation script (`scripts/validate-activity-template.sh`) has critical bugs:
- Uses wrong field names (snake_case instead of camelCase)
- Checks for non-existent fields (check, error)
- Does not match actual ActivityTemplate.Schema
- **Recommendation:** Deprecate bash validator, use MCP tool exclusively

---

## Quality Metrics

### add-feature-complete.json Quality Score: 95/100

**Strengths:**
- ✓ Comprehensive task breakdown (4 phases)
- ✓ Excellent documentation in prompts
- ✓ Strong validation patterns
- ✓ Metabob integration properly configured
- ✓ Composition examples provided
- ✓ Learning configuration enabled

**Minor Improvements Suggested:**
- Consider adding task complexity tiers for cost optimization
- Could add pre-flight environment checks
- Optional: Add discovery phase configuration

**Use Case:**
Ideal template for adding new features with full quality assurance, testing, and documentation workflow.

---

## Recommendations

### For Template Authors

1. **Always validate with MCP tool before registration:**
   ```typescript
   register_activity_template({
     file_path: "your-template.json",
     validate_only: true
   })
   ```

2. **Use add-feature-complete.json as reference template**
   - It demonstrates all required fields
   - Shows proper structure for tasks, validation, retry configs
   - Includes composition and learning patterns

3. **Required field checklist:**
   - [ ] id (string)
   - [ ] name (string)  
   - [ ] version (Version object)
   - [ ] genealogy (TemplateGenealogy object)
   - [ ] category (enum)
   - [ ] tasks (Task[])
   - [ ] executions, successRate, avgDuration, avgCost (numbers)
   - [ ] avgTokens (object)
   - [ ] createdAt, updatedAt (timestamps)

### For System Maintainers

1. **Deprecate bash validation script**
   - Current script has critical bugs
   - Does not match schema
   - Replace with MCP tool wrapper

2. **Add schema version migration tool**
   - Many old templates use proto/variant schema
   - Need automated migration to ActivityTemplate.Schema

3. **Update template documentation**
   - Reference add-feature-complete.json as canonical example
   - Document all required vs optional fields
   - Provide migration guide for old templates

---

## Appendix: Valid Template Structure

### Minimal Valid Template

```json
{
  "id": "example-template",
  "name": "Example Template",
  "version": {
    "major": 1,
    "minor": 0,
    "patch": 0,
    "timestamp": 1739750400000,
    "parent_hash": "",
    "variant_hash": "",
    "full_version": "1.0.0",
    "generation": 0
  },
  "genealogy": {
    "parent": null,
    "parent_id": "",
    "ancestors": [],
    "children": [],
    "variant_ids": [],
    "variant_hash": "",
    "created_at": 1739750400000,
    "generation": 0,
    "evolution": {
      "reason": "EVOLUTION_REASON_MANUAL",
      "improvised": false,
      "author": "TEMPLATE_AUTHOR_HUMAN",
      "mutations": [],
      "improvements": []
    }
  },
  "description": "Template description",
  "category": "feature",
  "executions": 0,
  "successRate": 0,
  "avgDuration": 0,
  "avgCost": 0,
  "avgTokens": { "input": 0, "output": 0, "cache": 0 },
  "createdAt": 1739750400000,
  "updatedAt": 1739750400000,
  "tasks": [
    {
      "id": "example-task",
      "subagent": "general",
      "description": "Task description",
      "dependencies": [],
      "prompt": {
        "template": "Task prompt",
        "maxTokens": 8000,
        "compressionStrategy": "adaptive",
        "variables": []
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 3,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    }
  ]
}
```

---

## Validation Summary

| Template | Status | Errors | Warnings | Ready |
|----------|--------|---------|----------|-------|
| add-feature-complete.json | ✅ VALID | 0 | 0 | Yes |
| add-rest-endpoint.json | ❌ INVALID | 69 | 0 | No |

**Overall System Health:** Templates are in mixed state. One high-quality reference template exists, but legacy templates need migration.

