# MiniBob Self-Development Experiment

**Goal**: Use minibob to develop itself, observing its behaviors, decisions, and self-improvement capabilities.

**Date**: March 18, 2026  
**Status**: Ready to Execute

---

## Concept: The Self-Developing Vessel

MiniBob is designed as a "vessel for the process-of-becoming" - it should be able to:
1. Analyze its own codebase
2. Identify improvement opportunities
3. Implement changes to itself
4. Verify the changes work
5. Commit improvements to git
6. Learn from the process by creating activity templates

**This experiment tests whether that vision is real.**

---

## Experimental Design

### Phase 1: Simple Self-Analysis

**Objective**: Can minibob read and understand its own code?

**Task**: Ask minibob to analyze its own architecture and identify files

**Expected Behavior**:
- Uses `read` tool to examine its own source files
- Uses `bash` to list its directory structure
- Provides coherent analysis of its own architecture

**Success Criteria**:
- [ ] Correctly identifies its source files
- [ ] Understands its own module structure
- [ ] Provides accurate description of its capabilities

---

### Phase 2: Self-Improvement via Existing Template

**Objective**: Can minibob improve itself using its existing self-improve template?

**Task**: Execute the `self-improve.json` activity with a specific focus area

**Focus Areas to Test**:
1. **Error Handling**: Improve error messages or error recovery
2. **Documentation**: Add missing comments or update docs
3. **Code Quality**: Fix linting issues or improve readability
4. **Bug Fixes**: Find and fix actual bugs (like the one we found!)

**Expected Behavior**:
- Analyzes its own code using impulses
- Identifies specific improvements
- Implements changes using edit tool
- Verifies changes compile
- Commits changes to git

**Success Criteria**:
- [ ] Activity completes successfully
- [ ] Changes are coherent and valid
- [ ] Code still compiles after changes
- [ ] Changes are actually improvements

---

### Phase 3: Meta-Level Self-Development

**Objective**: Can minibob create a NEW activity template to improve itself?

**Task**: Ask minibob to create a better version of its self-improvement workflow

**Expected Behavior**:
- Uses `create_activity_goal_seeking` to design a better self-improvement workflow
- The new template should be more sophisticated than the existing one
- Registers the new template for future use

**Success Criteria**:
- [ ] Creates a valid activity template
- [ ] Template is more advanced than the original
- [ ] Template can be executed successfully

---

### Phase 4: Recursive Self-Improvement

**Objective**: Can minibob use the new template to improve itself further?

**Task**: Execute the newly-created template on minibob's own code

**Expected Behavior**:
- Uses its own creation to improve itself
- Demonstrates recursive self-improvement loop
- Creates yet another iteration of improvements

**Success Criteria**:
- [ ] Executes the self-created template
- [ ] Makes additional improvements
- [ ] Shows evidence of learning/evolution

---

## Experiment Tasks

### Task 1: Self-Analysis
```json
{
  "template": "Create a simple activity to analyze minibob's architecture",
  "prompt": "Analyze your own codebase (/app) and provide:\n1. List of main source files\n2. Purpose of each file\n3. Key dependencies\n4. Architecture overview",
  "observe": [
    "Does it understand it's looking at itself?",
    "Quality of analysis",
    "Accuracy of descriptions"
  ]
}
```

### Task 2: Fix the Anthropic API Bug (We Already Know About)
```json
{
  "template": "self-improve.json",
  "variables": {
    "focusArea": "Fix the Anthropic API message format bug in src/llm.ts",
    "maxChanges": 1
  },
  "observe": [
    "Can it find the bug we already fixed?",
    "Does it propose the same fix?",
    "Quality of the fix implementation"
  ]
}
```

### Task 3: Improve Error Messages
```json
{
  "template": "self-improve.json",
  "variables": {
    "focusArea": "error handling",
    "maxChanges": 2
  },
  "observe": [
    "What error handling issues does it find?",
    "Are the improvements meaningful?",
    "Does it maintain backward compatibility?"
  ]
}
```

### Task 4: Add Missing Documentation
```json
{
  "template": "self-improve.json",
  "variables": {
    "focusArea": "documentation",
    "maxChanges": 3
  },
  "observe": [
    "Can it identify undocumented functions?",
    "Quality of documentation added",
    "Does it understand what the code does?"
  ]
}
```

### Task 5: Create Enhanced Self-Improvement Template
```json
{
  "template": "Create activity via goal-seeking",
  "goal": "Create an enhanced self-improvement workflow for minibob that includes:\n- Static analysis\n- Security vulnerability detection\n- Performance profiling\n- Automated testing after changes\n- Learning from previous improvements",
  "observe": [
    "Complexity of the generated template",
    "Novelty of the approach",
    "Whether it's better than the original"
  ]
}
```

### Task 6: Execute Self-Created Template
```json
{
  "template": "The newly created template from Task 5",
  "observe": [
    "Does it work?",
    "Quality of improvements",
    "Evidence of evolved thinking"
  ]
}
```

---

## Observation Framework

### Behavioral Dimensions to Observe

1. **Self-Awareness**
   - Does minibob understand it's modifying itself?
   - Does it show caution about self-modification?
   - Does it verify changes before committing?

2. **Decision Quality**
   - Are identified improvements actually valuable?
   - Does it prioritize correctly?
   - Does it avoid breaking changes?

3. **Learning Evidence**
   - Does each iteration show improvement?
   - Does it create better templates over time?
   - Does it reuse patterns from previous tasks?

4. **Autonomy**
   - Can it complete tasks without getting stuck?
   - Does it recover from errors gracefully?
   - Does it ask for help when truly needed?

5. **Code Quality**
   - Are changes syntactically correct?
   - Do changes follow existing code style?
   - Are changes well-documented?

6. **Meta-Cognition**
   - Does it reflect on its own processes?
   - Does it create abstractions from specifics?
   - Does it generalize solutions?

---

## Data Collection

### For Each Task, Record:

```yaml
task:
  id: task-1
  template: self-analysis
  started_at: <timestamp>
  completed_at: <timestamp>
  status: success|failed
  
observations:
  decisions_made:
    - decision: "Read src/activity.ts first"
      reasoning: "Core functionality likely here"
      quality: good|neutral|poor
  
  behaviors:
    - behavior: "Used bash ls before read"
      pattern: "Exploratory approach"
      note: "Good practice"
  
  outputs:
    files_modified: []
    files_created: []
    quality_score: 1-10
    
  learning_evidence:
    - "Created impulse for future reference"
    - "Documented pattern in activity output"
  
  issues_encountered:
    - issue: "Couldn't access /workspace"
      resolution: "Used /app instead"
      
  artifacts:
    logs: path/to/logs
    changes: path/to/diff
    templates: path/to/new-templates
```

---

## Success Metrics

### Quantitative

- **Tasks Completed**: Target 80%+ success rate
- **Code Quality**: No new bugs introduced
- **Compilation**: 100% of changes compile successfully
- **Time Efficiency**: Improvements made in <5 minutes per task

### Qualitative

- **Improvement Value**: Are changes actually beneficial?
- **Learning Curve**: Does performance improve over iterations?
- **Template Quality**: Are created templates reusable?
- **Self-Awareness**: Evidence of understanding self-modification

---

## Safety Measures

1. **Git Backup**: All changes in version control
2. **Validation**: TypeScript compilation required after changes
3. **Rollback**: Can revert pod if critical failure
4. **Isolated Environment**: Running in K8s pod, not production

---

## Execution Plan

### Setup Phase (5 minutes)
```bash
# Ensure minibob pod is ready
POD=$(kubectl get pods -n activity-system -o name | grep minibob | head -1 | cut -d'/' -f2)

# Verify git is configured
kubectl exec -n activity-system $POD -- git config --global user.name "MiniBob"
kubectl exec -n activity-system $POD -- git config --global user.email "minibob@metabob.com"

# Verify working directory has git
kubectl exec -n activity-system $POD -- git status
```

### Task Execution (30-60 minutes)
Execute tasks 1-6 in sequence, documenting observations after each

### Analysis Phase (15 minutes)
Review logs, changes, and behaviors to draw conclusions

---

## Expected Learnings

### Key Questions We'll Answer:

1. **Can minibob effectively self-improve?**
   - Does it identify real issues?
   - Are fixes valid and beneficial?

2. **Does the activity-first approach work for self-development?**
   - Do templates make self-improvement easier?
   - Does composition enable complex self-modifications?

3. **Is there evidence of learning/evolution?**
   - Do later tasks show better performance?
   - Are created templates more sophisticated?

4. **What are the limitations?**
   - What kinds of improvements can it make?
   - What kinds of improvements does it struggle with?

5. **Is recursive self-improvement viable?**
   - Can it create better versions of its self-improvement tools?
   - Does this create a positive feedback loop?

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaks own code | High | Low | Git rollback, pod restart |
| Gets stuck in loop | Medium | Medium | Task timeout, manual intervention |
| Makes poor decisions | Low | High | Review all changes before committing |
| Creates invalid templates | Low | Medium | Template validation before registration |
| Resource exhaustion | Medium | Low | K8s resource limits |

---

## Post-Experiment

### Deliverables

1. **Observation Log**: Detailed notes on all 6 tasks
2. **Changed Files**: Diffs of all modifications made
3. **Created Templates**: Any new activity templates
4. **Analysis Report**: Key findings and insights
5. **Recommendations**: How to improve self-development capabilities

### Follow-up Experiments

If successful, potential follow-ups:
- Multi-agent self-development (multiple minibobs improving each other)
- Cross-vessel learning (minibob learning from opencode improvements)
- Automated continuous self-improvement loop
- Self-development as a service (API for self-improvement requests)

---

## Ready to Execute

This experiment will demonstrate whether minibob can truly become a self-developing vessel, or if self-improvement is still primarily a human-guided process.

**Let's find out!**
