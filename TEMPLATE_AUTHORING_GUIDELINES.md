# Activity Template Authoring Guidelines

**Version**: 1.0  
**Date**: February 17, 2026  
**Status**: Production

---

## 🎯 Purpose

This guide provides best practices for creating high-quality activity templates that work reliably in production.

---

## ✅ The Golden Rules

### Rule #1: NO Handlebars Conditionals (**CRITICAL**)

**DON'T USE**:
```handlebars
{{#if variable}}
  Content when true
{{else}}
  Content when false
{{/if}}
```

**USE INSTEAD**:
```handlebars
Variable value: {{variable}}

If variable is not provided, use the default behavior described below.
```

**Why**: Handlebars block helpers (`{{#if}}`, `{{#each}}`, `{{#unless}}`) cause immediate template failures. LLMs handle conditional logic better than template engines.

### Rule #2: Use Instructional Text

**Pattern**: Replace conditionals with clear instructions for the LLM.

**Examples**:

**Optional Content**:
```
Notes: {{notes}}

If notes are not provided above, omit this section entirely.
```

**Default Values**:
```
Test Framework: {{test_framework}}

If test_framework not specified, detect from existing tests (look for jest, vitest, bun:test).
```

**Conditional Behavior**:
```
Cleanup Type: {{cleanup_type}}

If cleanup_type is 'conservative', only remove obviously safe items.
If cleanup_type is 'aggressive', be more thorough but still verify safety.
If not specified, default to conservative.
```

### Rule #3: Keep Templates Focused

**One task per template**: Each template should do ONE thing well.

**Good** (focused):
- add-feature-no-conditionals: Implement features
- fix-bug-no-conditionals: Fix bugs
- refactor-code-no-conditionals: Refactor code

**Bad** (unfocused):
- do-everything: Implement features, fix bugs, refactor, test, document, deploy

### Rule #4: Provide Clear Structure

**Every template should include**:
1. **Step-by-step workflow** (Step 1, Step 2, etc.)
2. **Time estimates** per step (helps LLM plan)
3. **Success criteria** (what "done" looks like)
4. **Examples** (show, don't just tell)
5. **Guidelines** (best practices to follow)

### Rule #5: No Compression (For Now)

**Use**: `"compressionStrategy": "none"`

**Why**: Compression strategies may interact with Handlebars issues. Keep it simple until we verify compression works reliably.

---

## 📐 Template Structure

### Minimum Viable Template

```json
{
  "id": "template-id",
  "name": "Template Name",
  "description": "What this template does - production ready",
  "category": "feature|bugfix|refactor|infrastructure",
  "tasks": [
    {
      "id": "task-id",
      "subagent": "general",
      "description": "What this task does",
      "dependencies": [],
      "tools": {
        "required": [],
        "optional": [],
        "disabled": []
      },
      "prompt": {
        "template": "Your prompt here (NO {{#if}} conditionals!)",
        "maxTokens": 16000,
        "compressionStrategy": "none",
        "variables": [
          {
            "name": "variable_name",
            "type": "string",
            "required": true,
            "description": "Clear description of what this variable is"
          }
        ]
      },
      "validation": {
        "requiredFiles": ["OUTPUT_FILE.md"],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    }
  ],
  "contextRequirements": [],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": false,
    "targetContextTokens": 3000,
    "annotationStrategy": "failures-only"
  }
}
```

---

## 📝 Prompt Writing Best Practices

### Structure Your Prompts

**Use this template**:

```markdown
[Brief introduction explaining the task]

**Input Variables**:
- Variable 1: {{var1}}
- Variable 2: {{var2}}

Note: [Instructions for handling missing variables]

---

## Your Task

### Step 1: [Action] (Time estimate)

**What to do**:
- [Specific instruction 1]
- [Specific instruction 2]

**How to do it**:
[Examples, commands, code snippets]

**Why it matters**:
[Context and reasoning]

### Step 2: [Next Action] (Time estimate)

[Same structure]

---

## Success Criteria

Task is complete when:
- ✅ [Criterion 1]
- ✅ [Criterion 2]
- ✅ [Criterion 3]

---

**Important**: [Key takeaway or reminder]
```

### Make Instructions Actionable

**Bad** (vague):
```
Make the code better.
```

**Good** (specific):
```
Improve code readability by:
1. Breaking down functions over 50 lines
2. Adding descriptive variable names
3. Removing nested conditionals (use early returns)
4. Adding JSDoc comments to public APIs
```

### Provide Examples

**Show, don't tell**:

```markdown
**Code Examples**:
```typescript
// Good: Clear, simple, readable
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// Bad: Complex, hard to understand
function calculateTotal(items) {
  let total = 0
  for (let i = 0; i < items.length; i++) {
    if (items[i] && items[i].price) {
      total = total + items[i].price
    }
  }
  return total
}
```
```

### Use Time Estimates

Help the LLM plan by providing time estimates:

```markdown
### Step 1: Analyze Code (10-15 minutes)
### Step 2: Write Tests (30-45 minutes)
### Step 3: Verify (5-10 minutes)
```

This helps the LLM understand complexity and allocate effort appropriately.

---

## 🧪 Testing Templates

### Before Registering to Production

1. **Create the template** (no conditionals!)
2. **Register locally** first
3. **Test with real scenario** (3+ times)
4. **Measure success rate** (aim for ≥70%)
5. **Verify output quality**
6. **Register to production**

### Testing Checklist

- [ ] Template has no `{{#if}}` or `{{#each}}` conditionals
- [ ] All required variables clearly documented
- [ ] Prompt is well-structured with steps
- [ ] Examples are complete and realistic
- [ ] Success criteria are clear
- [ ] Tested 3+ times with real scenarios
- [ ] Success rate ≥70%
- [ ] Output is production-quality

---

## 📊 Template Quality Criteria

### Production-Ready Template Must Have:

**✅ Structure**:
- Clear step-by-step workflow
- Time estimates for each step
- Success criteria at the end
- Examples throughout

**✅ Quality**:
- No Handlebars conditionals
- Variables clearly documented
- Instructions are actionable
- Success rate ≥70% (tested)

**✅ Documentation**:
- Clear description
- Variable descriptions
- Usage examples (in comments or README)

**✅ Validation**:
- At least one required output file
- Optional validation commands
- Clear success indicators

---

## 🚫 Common Mistakes to Avoid

### Mistake #1: Using Conditionals

**DON'T**:
```handlebars
{{#if optional_var}}
Content here
{{/if}}
```

**DO**:
```handlebars
Optional content: {{optional_var}}

If not provided, skip this section.
```

### Mistake #2: Vague Instructions

**DON'T**:
```
Improve the code.
```

**DO**:
```
Improve code by:
1. Breaking down functions over 50 lines into smaller functions
2. Replacing magic numbers with named constants
3. Adding error handling for edge cases
```

### Mistake #3: No Examples

**DON'T**:
```
Follow best practices.
```

**DO**:
```
Follow best practices:

**Example**:
```typescript
// Good: Clear error handling
try {
  const result = await fetchData()
  return result
} catch (error) {
  log.error('Failed to fetch data', error)
  throw new FetchError('Data unavailable')
}
```
```

### Mistake #4: Missing Success Criteria

**DON'T**:
```
Complete the task.
```

**DO**:
```
## Success Criteria

Task is complete when:
- ✅ Feature works as described
- ✅ Tests pass (≥80% coverage)
- ✅ Documentation updated
- ✅ No type errors
```

### Mistake #5: Too Complex

**DON'T**: Create one template that does 10 different things

**DO**: Create 10 focused templates that each do one thing well

---

## 📚 Example Templates

### Minimal Working Template

See: `ultra-simple-test.json`
- Simplest possible template
- Proves framework works
- Good starting point

### Production Template

See: `add-feature-no-conditionals.json`
- Well-structured workflow
- Clear instructions
- Tested successfully
- Production-ready

### All Production Templates

Current templates in production (ide.metabob.com):
1. `add-feature-no-conditionals` - Feature implementation
2. `fix-bug-no-conditionals` - Bug fixing
3. `refactor-code-no-conditionals` - Code refactoring
4. `add-comprehensive-tests` - Test writing
5. `commit-organized-changes` - Git commits
6. `cleanup-code` - Code cleanup
7. `generate-documentation` - Documentation generation

---

## 🔄 Template Development Workflow

### Step 1: Design (30 min)
1. Identify clear, focused use case
2. Define required variables
3. Outline step-by-step workflow
4. Write success criteria

### Step 2: Implement (1 hour)
1. Create JSON template file
2. Write structured prompt (no conditionals!)
3. Add examples and guidelines
4. Set validation rules

### Step 3: Test Locally (30 min)
1. Register template locally
2. Test with real scenario
3. Verify output quality
4. Iterate if needed

### Step 4: Validate (1 hour)
1. Run 3+ test executions
2. Measure success rate
3. Calculate average cost/duration
4. Document results

### Step 5: Register to Production (5 min)
1. Use `register_activity_template` with `register_with_metabob: true`
2. Verify registration succeeded
3. Test from production (ide.metabob.com)
4. Document in template catalog

---

## 🎯 Template Naming Conventions

**Pattern**: `action-target-modifier`

**Examples**:
- `add-feature-no-conditionals` (good)
- `fix-bug-v2` (good)
- `refactor-code` (good)
- `template1` (bad - not descriptive)
- `my-awesome-template` (bad - not clear)

**Rules**:
- Use lowercase with hyphens
- Start with action verb (add, fix, refactor, generate, cleanup)
- Include target (feature, bug, code, tests, docs)
- Add modifier if needed (v2, no-conditionals, comprehensive)

---

## 📦 Template Categories

**feature**: Implementing new functionality
- add-feature-no-conditionals
- extend-api
- add-endpoint

**bugfix**: Fixing issues
- fix-bug-no-conditionals
- debug-error
- patch-security

**refactor**: Improving existing code
- refactor-code-no-conditionals
- cleanup-code
- optimize-performance

**infrastructure**: Development workflows
- add-comprehensive-tests
- commit-organized-changes
- generate-documentation
- setup-ci-cd

---

## 💡 Tips for Success

### Tip #1: Start Simple
Begin with a minimal template, test it, then gradually add features.

### Tip #2: Test Early, Test Often
Don't wait until the template is "perfect". Test with real scenarios as soon as possible.

### Tip #3: Learn from Working Templates
Study existing production templates. Copy their structure and adapt.

### Tip #4: Get Feedback
Have someone else test your template. Fresh eyes catch issues you might miss.

### Tip #5: Iterate
Templates improve over time. Version 1 doesn't have to be perfect.

---

## 🔧 Troubleshooting

### Template Fails Immediately (0.0s, $0.00)

**Cause**: Handlebars conditionals in prompt

**Solution**: Remove all `{{#if}}`, `{{#each}}`, `{{#unless}}` and replace with instructional text

### Template Works But Output is Poor

**Cause**: Instructions too vague or missing examples

**Solution**: Add more specific instructions, provide examples, clarify success criteria

### Template Success Rate Low (<70%)

**Cause**: Task too complex, instructions unclear, or unrealistic expectations

**Solution**: Break into smaller tasks, clarify instructions, or adjust success criteria

### Variable Validation Fails

**Cause**: Required variables not provided or mismatched types

**Solution**: Check variable definitions, ensure clear descriptions, make optional if appropriate

---

## ✅ Checklist: Production-Ready Template

Use this checklist before registering to production:

**Template Structure**:
- [ ] No Handlebars conditionals (`{{#if}}`, `{{#each}}`, etc.)
- [ ] Clear description
- [ ] Appropriate category
- [ ] Focused on one task

**Prompt Quality**:
- [ ] Step-by-step workflow
- [ ] Time estimates per step
- [ ] Clear, actionable instructions
- [ ] Examples provided
- [ ] Success criteria defined
- [ ] Important notes/reminders

**Variables**:
- [ ] All variables documented
- [ ] Required vs optional clear
- [ ] Descriptions helpful
- [ ] Types correct

**Validation**:
- [ ] At least one required output file
- [ ] Validation rules appropriate
- [ ] Commands optional (don't fail builds)

**Testing**:
- [ ] Tested locally 3+ times
- [ ] Success rate ≥70%
- [ ] Output quality verified
- [ ] Cost and duration acceptable

**Documentation**:
- [ ] Usage examples (in code or README)
- [ ] Variable requirements documented
- [ ] Success criteria clear

**Ready for Production**:
- [ ] All above checkboxes checked
- [ ] Registered to Metabob MCP
- [ ] Tested from production
- [ ] Added to template catalog

---

## 📚 Further Reading

- **ROOT_CAUSE_IDENTIFIED_HANDLEBARS_CONDITIONALS.md** - Why no conditionals
- **SESSION_SUMMARY_ACTIVITY_TEMPLATES_FEB17.md** - Investigation process
- **PRODUCTION_TEMPLATES_STATUS.md** - Current production templates

---

## 🎓 Summary

**The Three Keys to Great Templates**:

1. **NO CONDITIONALS** - Use instructional text instead
2. **CLEAR STRUCTURE** - Step-by-step with examples
3. **TEST THOROUGHLY** - Real scenarios, measure success

Follow these guidelines and you'll create production-ready templates that users love.

---

**Last Updated**: February 17, 2026  
**Status**: Production  
**Feedback**: improvements welcome
