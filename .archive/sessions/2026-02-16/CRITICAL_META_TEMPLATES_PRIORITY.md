# Critical META Templates Priority

**Date**: February 17, 2026  
**Corrected Focus**: The 3 templates that improve the system itself  
**Status**: 🔴 **URGENT** - These are the self-improvement loop

---

## 🎯 The REAL 3 Critical Templates

You're absolutely right - these are the meta templates that create and improve all other templates:

### 1. **create-activity-template** 
**Purpose**: Create new activity templates  
**Status**: ❓ **UNKNOWN** - Need to check if it exists  
**Why Critical**: Without this, we can't easily create new templates  
**Impact**: Blocks template creation workflow

### 2. **debug-activity-execution-self-contained** ✅
**Purpose**: Debug failed activity executions using activity_error_inspector  
**Status**: 🟡 **EXISTS BUT UNTESTED** (0 executions)  
**Why Critical**: Required to fix broken templates systematically  
**Impact**: Enables fixing all other failing templates

### 3. **improve-bootstrap-template-ductile-rigidity** ✅
**Purpose**: Systematically enhance templates (the "evolve" template)  
**Status**: 🟡 **EXISTS BUT UNTESTED** (0 executions)  
**Why Critical**: Continuous improvement of templates based on metrics  
**Impact**: Self-improving template system

---

## 🔍 Why These Are THE Critical Templates

### Self-Improvement Loop

```
┌─────────────────────────────────────────┐
│     Create Activity Template            │
│  (Generate new templates as needed)     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│     Execute Activities                   │
│  (Run templates, collect data)          │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Debug Activity Execution               │
│  (Identify failures, root causes)       │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Improve Bootstrap Template             │
│  (Enhance templates based on metrics)   │
└──────────────┬──────────────────────────┘
               │
               └────────────┐
                            ↓
               (Loop back to Execute)
```

**This is the self-improvement loop that makes the entire system better over time.**

### What Makes Them Different

**Regular Templates** (add-feature, fix-bug, refactor):
- Work on USER code
- Deliver business value directly
- Important for users

**Meta Templates** (create, debug, evolve):
- Work on THE TEMPLATE SYSTEM ITSELF
- Improve template quality
- Enable continuous system improvement
- **Critical for the system to learn and improve**

---

## 📊 Current State Analysis

### 1. create-activity-template

**Search Results**: Not found in template list

**Possible States**:
- ❓ Built into CLI (`opencode activity init`)?
- ❓ Template exists but not registered?
- ❓ Needs to be created?

**Investigation Needed**:
```bash
# Check for create template
opencode activity template list | grep -i create

# Check CLI create commands
opencode activity --help | grep -i create

# Search local storage
find ~/.local/share/opencode -name "*create*template*"
```

### 2. debug-activity-execution-self-contained ✅

**Template ID**: `debug-activity-execution-self-contained`  
**Status**: Exists (0 executions)  
**Location**: `~/.local/share/opencode/storage/activity-template/`

**Structure**:
```json
{
  "tasks": [
    {
      "id": "fetch-execution-details",
      "description": "Use activity_error_inspector tool",
      "tools": ["activity_error_inspector", "write", "bash"],
      "required_variables": ["executionId"]
    },
    {
      "id": "analyze-failure-patterns",
      "description": "Identify root cause",
      "dependencies": ["fetch-execution-details"]
    },
    {
      "id": "generate-fixes",
      "description": "Create concrete fixes",
      "dependencies": ["analyze-failure-patterns"]
    },
    {
      "id": "apply-fixes",
      "description": "Update template",
      "dependencies": ["generate-fixes"]
    }
  ]
}
```

**Why It's Critical**:
- Uses `activity_error_inspector` tool to diagnose failures
- Analyzes root causes systematically
- Generates concrete fixes
- Can fix templates automatically

**Current Blockers**: None apparent

### 3. improve-bootstrap-template-ductile-rigidity ✅

**Template ID**: `improve-bootstrap-template-ductile-rigidity`  
**Status**: Exists (0 executions)  
**Location**: `~/.local/share/opencode/storage/activity-template/`

**Structure**:
```json
{
  "tasks": [
    {
      "id": "assess-current-state",
      "subagent": "activity",
      "description": "Analyze template against ductile rigidity paradigm",
      "maxTokens": 16000
    },
    {
      "id": "design-improvements",
      "subagent": "activity", 
      "description": "Design improvements across 7 dimensions",
      "maxTokens": 24000,
      "dependencies": ["assess-current-state"]
    },
    {
      "id": "implement-improvements",
      "subagent": "activity",
      "description": "Implement designed improvements",
      "maxTokens": 20000,
      "dependencies": ["design-improvements"]
    },
    {
      "id": "validate-improvements",
      "subagent": "activity",
      "description": "Validate improvements work correctly",
      "dependencies": ["implement-improvements"]
    },
    {
      "id": "register-improved-template",
      "subagent": "activity",
      "description": "Register to backend with version increment",
      "dependencies": ["validate-improvements"]
    }
  ]
}
```

**Why It's Critical**:
- Systematically enhances templates based on ductile rigidity paradigm
- Analyzes execution metrics
- Improves prompts, validation, error handling
- Adds model complexity tuning
- Registers improved versions to backend

**Current Blockers**: Requires extensive variables (assessment, design, etc.)

---

## 🚀 Immediate Action Plan

### Priority 1: Find/Create "create-activity-template" (1-2 hours)

**Investigation Steps**:

1. **Search for existing template**:
   ```bash
   find ~/.local/share/opencode -name "*.json" | xargs grep -l "create.*activity.*template"
   opencode activity template list | grep -i create
   ```

2. **Check CLI functionality**:
   ```bash
   opencode activity init --help
   opencode activity template --help
   ```

3. **If not found, create it**:
   - Use `debug-activity-execution` as reference structure
   - Design tasks:
     - Task 1: Define template purpose and structure
     - Task 2: Design tasks and dependencies
     - Task 3: Write prompts with examples
     - Task 4: Add validation rules
     - Task 5: Test template with simple example
     - Task 6: Register to backend

### Priority 2: Test "debug-activity-execution" (30 min - 1 hour)

**Test Cases**:

1. **Debug a known failed activity**:
   ```bash
   # Get failed activity ID
   opencode activity list | grep Failed | head -1
   
   # Run debug template
   activity({
     templateId: "debug-activity-execution-self-contained",
     variables: {
       executionId: "<failed-activity-id>"
     },
     reason: "Test debug template with real failed activity"
   })
   ```

2. **Expected Output**:
   - EXECUTION_DETAILS.md with full error report
   - ROOT_CAUSE_ANALYSIS.md with diagnosis
   - FIXES.md with concrete improvements
   - Updated template registered

3. **Success Criteria**:
   - Debug template completes successfully
   - Produces actionable fixes
   - Can apply fixes to broken template

### Priority 3: Test "improve-bootstrap-template" (1-2 hours)

**Test Cases**:

1. **Improve a simple template** (test-failure-activity):
   ```bash
   activity({
     templateId: "improve-bootstrap-template-ductile-rigidity",
     variables: {
       assessment: "<from assess task>",
       improvementDesign: "<from design task>",
       changesSummary: "<changes made>",
       targetTemplatePath: "test-failure-activity.json",
       validationResults: "<test results>",
       templateName: "Test Failure Activity",
       templateId: "test-failure-activity",
       category: "infrastructure",
       oldVersion: "1",
       newVersion: "2"
     },
     reason: "Test improve template with simple working template"
   })
   ```

2. **Expected Output**:
   - ASSESSMENT.json with scores
   - IMPROVEMENT_DESIGN.json with enhancements
   - Updated template with improvements
   - Validation passing
   - Registered to backend

3. **Success Criteria**:
   - Template improvement completes
   - New version has higher scores
   - Improvements are measurable

---

## 🔄 Self-Improvement Workflow

Once all 3 meta templates work:

### Step 1: Create Template
```bash
# Use create-activity-template to generate new template
activity create-activity-template \
  purpose="Add logging to functions" \
  category="feature"

# Result: new template registered
```

### Step 2: Execute & Collect Data
```bash
# Run the new template multiple times
for i in {1..10}; do
  activity add-logging target="file.py"
done

# Result: Execution data in backend
```

### Step 3: Debug Failures
```bash
# For any failures, run debug template
activity debug-activity-execution \
  executionId="<failed-id>"

# Result: Root cause analysis + fixes
```

### Step 4: Improve Template
```bash
# Run improve template with execution metrics
activity improve-bootstrap-template \
  templateId="add-logging" \
  executionMetrics="<from backend>"

# Result: Enhanced template with better prompts, validation, etc.
```

### Step 5: Deploy Improvement
```bash
# New version automatically registered to backend
# Next executions use improved version
# Gradient analysis shows improvements

# Result: Template gets better over time
```

---

## 📊 Expected Impact

### Without Meta Templates
- ❌ Manual template creation (slow, inconsistent)
- ❌ Manual debugging (ad-hoc, incomplete)
- ❌ No systematic improvement (templates stagnate)
- ❌ Learning doesn't accumulate

### With Meta Templates Working
- ✅ Automated template creation (fast, consistent)
- ✅ Systematic debugging (comprehensive, actionable)
- ✅ Continuous improvement (templates evolve)
- ✅ Learning compounds over time

**System gets smarter with every execution.**

---

## 🎯 Success Metrics

### Short Term (1 Day)
- [ ] Find/create create-activity-template
- [ ] Test debug-activity-execution (1+ successful run)
- [ ] Test improve-bootstrap-template (1+ successful run)
- [ ] All 3 meta templates operational

### Medium Term (1 Week)
- [ ] Use create-activity-template to generate 3 new templates
- [ ] Use debug-activity-execution to fix 5 broken templates
- [ ] Use improve-bootstrap-template to evolve 3 templates
- [ ] Measure improvement: before/after success rates

### Long Term (1 Month)
- [ ] Self-improvement loop running continuously
- [ ] Average template success rate: 85%+
- [ ] Average template cost: -30% vs baseline
- [ ] Average template duration: -20% vs baseline
- [ ] System demonstrably learning and improving

---

## 💡 Key Insights

### Why This Matters More Than Regular Templates

**Regular templates deliver value**:
- add-feature → new functionality
- fix-bug → fixed issues
- refactor → better code

**Meta templates multiply value**:
- create → enables all future templates
- debug → fixes all broken templates
- improve → enhances all existing templates

**1 hour improving meta templates = 100 hours of improved regular templates**

### The Leverage Point

```
Regular Template:
  1 execution = 1 unit of value

Meta Template:
  1 execution = N improved templates × M executions each
              = N × M units of value
```

**This is the leverage point for the entire system.**

---

## 🚀 Immediate Next Steps

### Step 1: Investigation (30 minutes)
```bash
# Find create-activity-template
opencode activity template list | grep -i create
find ~/.local/share/opencode -name "*create*" -name "*.json"

# If not found, flag for creation
```

### Step 2: Test Debug Template (30 minutes)
```bash
# Get a failed activity ID
FAILED_ID=$(opencode activity list | grep "Failed" | head -1 | awk '{print $1}')

# Run debug template
opencode activity run --template debug-activity-execution-self-contained \
  --var executionId="$FAILED_ID"

# Review output: EXECUTION_DETAILS.md, ROOT_CAUSE_ANALYSIS.md, FIXES.md
```

### Step 3: Test Improve Template (1 hour)
```bash
# Pick a simple template to improve
opencode activity run --template improve-bootstrap-template-ductile-rigidity \
  --var templateId="test-failure-activity" \
  # ... other required variables

# Review output: improved template version
```

### Step 4: Sync to Backend (30 minutes)
```bash
# Register all 3 meta templates to backend
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -d @debug-activity-execution-self-contained.json

# Repeat for improve-bootstrap-template
# Repeat for create-activity-template (once found/created)
```

---

## 📚 Documentation Updates Needed

1. **CRITICAL_META_TEMPLATES_PRIORITY.md** (this file)
2. Update **GRADIENT_ANALYSIS_SYSTEM_COMPLETE.md**:
   - Add section on meta template priority
   - Explain self-improvement loop
   - Update success metrics

3. Update **CORE_ACTIVITIES_STATUS_AND_NEXT_STEPS.md**:
   - Shift focus to meta templates
   - Deprioritize regular templates temporarily
   - Add meta template testing plan

4. Create **META_TEMPLATE_TESTING_GUIDE.md**:
   - Step-by-step testing instructions
   - Expected outputs for each template
   - Troubleshooting guide
   - Success criteria

---

## 🎓 Conclusion

**You're absolutely right** - the 3 meta templates (create, debug, improve) are far more critical than regular feature/bug/refactor templates.

**Why**:
- They improve the SYSTEM, not just user code
- They create a self-improvement loop
- They have multiplicative impact
- They enable continuous learning

**Next Session Priority**:
1. Find/create create-activity-template
2. Test debug-activity-execution
3. Test improve-bootstrap-template
4. Sync all to backend
5. Run self-improvement loop

**Once these 3 work, all other templates can be systematically created, debugged, and improved.**

---

**Status**: 🔴 **CRITICAL PRIORITY**  
**Action**: Test meta templates FIRST before anything else  
**Timeline**: 2-3 hours to get all 3 operational  
**Impact**: Unlocks self-improving template system
