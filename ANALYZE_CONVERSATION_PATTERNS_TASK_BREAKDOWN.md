# Task Breakdown: Analyze Conversation Patterns

**Activity**: analyze-conversation-patterns  
**Category**: infrastructure  
**Date**: 2026-02-05  
**Status**: ✅ Task Structure Defined

---

## Executive Summary

This activity is broken into **6 sequential tasks** that transform raw conversation data into reusable pattern documentation. Each task has clear inputs, outputs, completion criteria, and validation rules.

**Flow**: Data Collection → Analysis → Extraction → Documentation → Validation → Finalization

**Total Estimated Time**: 45-90 minutes  
**Token Budget**: 40,000-60,000 tokens

---

## Task Graph Overview

```
task-1: gather-success-data
    ↓
task-2: identify-recurring-patterns
    ↓
task-3: extract-tool-sequences
    ↓
task-4: analyze-context-validation
    ↓
task-5: create-pattern-catalog
    ↓
task-6: validate-and-finalize
```

**Dependencies**: Sequential execution (each depends on previous)  
**Parallelization**: None (analysis builds progressively)

---

## Task 1: Gather Success Data

### Metadata
- **ID**: `task-1-gather-success-data`
- **Subagent**: `general`
- **Model**: `claude-haiku-4-20250514` (mechanical data gathering)
- **Dependencies**: None
- **Estimated Time**: 5-10 minutes
- **Token Budget**: 6,000-8,000

### Objective
Collect successful conversation data from activity executions, session logs, and documentation files to provide raw material for pattern analysis.

### Inputs
- **Variables**:
  - `dataSourcePath`: Path to conversation data (default: project root)
  - `maxConversations`: Maximum conversations to analyze (default: 20)
  - `includeFailures`: Include failed attempts for anti-pattern analysis (default: true)

- **Context Requirements**:
  - None (task gathers its own data)

### Process Steps

1. **Find Activity Execution Logs**
   ```bash
   # Search for activity execution data
   find ${dataSourcePath} -name "*.md" -path "*/activities/*" -type f
   find ${dataSourcePath} -name "*COMPLETE*.md" -o -name "*SUCCESS*.md"
   ```

2. **Find Session Summaries**
   ```bash
   # Search for session documentation
   find ${dataSourcePath} -name "*SUMMARY*.md" -o -name "*SESSION*.md"
   ```

3. **Identify Test Results**
   ```bash
   # Find test suite results
   find ${dataSourcePath} -name "*test*.json" -o -name "*results*.md"
   ```

4. **Categorize by Outcome**
   - SUCCESS: Activities marked complete with ✅
   - FAILURE: Activities with errors or incomplete status
   - PARTIAL: Mixed results

5. **Create Inventory**
   Generate JSON inventory:
   ```json
   {
     "totalConversations": 20,
     "successful": 15,
     "failed": 3,
     "partial": 2,
     "categories": {
       "bugfix": 5,
       "feature": 7,
       "refactor": 3
     },
     "files": [
       {
         "path": "path/to/file.md",
         "type": "activity_log",
         "outcome": "success",
         "category": "bugfix",
         "tokens": 12000,
         "duration": "15m"
       }
     ]
   }
   ```

### Outputs
- **Required Files**:
  - `DATA_INVENTORY.json` - Complete inventory of conversation data
  - `DATA_SOURCES.md` - Human-readable summary of data sources

### Completion Criteria

#### Required Conditions
- [ ] At least 5 successful conversations found
- [ ] Data categorized by outcome (success/failure/partial)
- [ ] Data categorized by type (bugfix/feature/refactor)
- [ ] Inventory includes metadata (tokens, duration, outcome)
- [ ] Files are accessible and readable

#### Success Indicators
- [ ] `DATA_INVENTORY.json` exists with valid JSON
- [ ] Contains `totalConversations >= 5`
- [ ] Contains `successful >= 3`
- [ ] All listed files exist and are readable

### Validation Rules

```json
{
  "requiredFiles": [
    "DATA_INVENTORY.json",
    "DATA_SOURCES.md"
  ],
  "requiredPatterns": [
    "totalConversations",
    "successful",
    "categories"
  ],
  "forbiddenPatterns": [
    "TODO",
    "No data found"
  ],
  "commands": [
    {
      "name": "validate-json",
      "command": "node -e \"JSON.parse(require('fs').readFileSync('DATA_INVENTORY.json', 'utf8'))\"",
      "required": true
    }
  ]
}
```

### Edge Case Handling

1. **No Successful Data Found**
   - Document the absence
   - Suggest running activities first
   - Exit gracefully with explanation
   - Don't proceed to analysis tasks

2. **Too Much Data (>100 conversations)**
   - Sample recent conversations
   - Prioritize high-success-rate activities
   - Document sampling strategy
   - Note in DATA_SOURCES.md

3. **Data in Multiple Repositories**
   - Document cross-repo patterns separately
   - Note in inventory
   - Don't attempt multi-agent analysis (out of scope)

### Agent Guidance

**Tone**: Mechanical, systematic data gathering  
**Focus**: Completeness and accuracy of inventory  
**Avoid**: Analysis at this stage (just collect)

**Key Instructions**:
- Be thorough in searching for data sources
- Don't skip failed attempts (valuable for anti-patterns)
- Document what you DON'T find (absence is data)
- Validate file paths before adding to inventory

---

## Task 2: Identify Recurring Patterns

### Metadata
- **ID**: `task-2-identify-recurring-patterns`
- **Subagent**: `general`
- **Model**: `claude-sonnet-4-20250514` (complex pattern recognition)
- **Dependencies**: `task-1-gather-success-data`
- **Estimated Time**: 15-25 minutes
- **Token Budget**: 12,000-18,000

### Objective
Analyze successful conversations to identify recurring patterns in user intents, task sequences, and workflows that led to positive outcomes.

### Inputs
- **Variables**: None

- **Context Requirements**:
  - `dataInventory`: Load DATA_INVENTORY.json (budget: 2000)
  - `successfulConversations`: Load 5-10 successful conversation files (budget: 10000-15000)

- **Impulse References**: 
  - Use data from task-1 output

### Process Steps

1. **Analyze User Intents**
   For each successful conversation:
   - Identify the initial user request
   - Categorize intent (bug fix, feature add, refactor, question, etc.)
   - Note the outcome achieved
   - Extract success factors

2. **Extract Task Sequences**
   Pattern to find:
   ```
   User Intent → Agent Actions → Outcome
   
   Example:
   "Fix bug X" → [diagnose, analyze, fix, test, document] → "Bug fixed"
   ```

3. **Identify Common Workflows**
   Look for repeating sequences:
   - Diagnostic-first: Gather data → Analyze → Fix
   - Activity-first: Search templates → Use template → Validate
   - Incremental: Small change → Test → Iterate
   - Composition: Task A → Task B → Combine results

4. **Find Success Factors**
   What made these conversations successful?
   - Clear problem definition
   - Systematic approach
   - Validation at each step
   - Good context availability
   - Appropriate tool usage

5. **Group by Category**
   Organize patterns by:
   - Bug Fixing Patterns
   - Feature Development Patterns
   - Refactoring Patterns
   - Analysis Patterns
   - Documentation Patterns

### Outputs
- **Required Files**:
  - `PATTERN_ANALYSIS.json` - Structured pattern data
  - `RECURRING_PATTERNS.md` - Human-readable pattern summaries

### Completion Criteria

#### Required Conditions
- [ ] At least 3 distinct patterns identified
- [ ] Each pattern has multiple examples (2+)
- [ ] Patterns categorized by type
- [ ] Success factors documented for each
- [ ] Examples include actual conversation references

#### Success Indicators
- [ ] `PATTERN_ANALYSIS.json` contains `patterns` array with length >= 3
- [ ] Each pattern has `examples`, `successFactors`, `category`
- [ ] `RECURRING_PATTERNS.md` has sections for each pattern
- [ ] Patterns are specific and actionable (not generic)

### Validation Rules

```json
{
  "requiredFiles": [
    "PATTERN_ANALYSIS.json",
    "RECURRING_PATTERNS.md"
  ],
  "requiredPatterns": [
    "\"patterns\":",
    "Pattern [0-9]+:",
    "Success Factors",
    "Examples"
  ],
  "forbiddenPatterns": [
    "TODO",
    "unclear",
    "Use best practices"
  ],
  "commands": []
}
```

### Edge Case Handling

1. **Patterns Too Generic**
   - Go deeper into specific examples
   - Extract concrete tool sequences
   - Provide code snippets
   - Don't accept vague descriptions like "use good prompts"

2. **No Clear Patterns Emerge**
   - Group by category first
   - Look for category-specific patterns
   - Document diversity of approaches
   - Note that different problems need different patterns

3. **Too Many Patterns (>10)**
   - Consolidate similar patterns
   - Focus on highest-impact patterns
   - Group variations under main patterns
   - Document variations in subsections

### Agent Guidance

**Tone**: Analytical, insightful pattern recognition  
**Focus**: Identifying genuine recurring patterns, not one-offs  
**Avoid**: Generic "best practices" that lack specificity

**Key Instructions**:
- Look for patterns that appear in 2+ conversations
- Be specific about what made the approach successful
- Include actual examples with file references
- Don't force patterns where none exist
- Validate each pattern against multiple examples

**Prompt Excerpt**:
```
You are analyzing successful conversations to extract reusable patterns.

CRITICAL: Patterns must be:
1. SPECIFIC - Not "use good prompts" but "use diagnostic-first with 3 steps"
2. RECURRING - Appears in 2+ conversations
3. ACTIONABLE - Clear steps someone can follow
4. VALIDATED - Multiple examples support it

Bad Pattern: "Write clear code"
Good Pattern: "Diagnostic-first bug fixing: (1) gather diagnostics, (2) search similar issues with metabob_search_codebase_issues, (3) analyze impact with metabob_analyze_change_impact, (4) fix with tests, (5) document with metabob_mark_problem_complete"
```

---

## Task 3: Extract Tool Sequences

### Metadata
- **ID**: `task-3-extract-tool-sequences`
- **Subagent**: `general`
- **Model**: `claude-sonnet-4-20250514` (complex sequence analysis)
- **Dependencies**: `task-2-identify-recurring-patterns`
- **Estimated Time**: 10-20 minutes
- **Token Budget**: 8,000-12,000

### Objective
Extract specific tool call sequences from successful conversations, documenting which tools were used, in what order, with what parameters, and for what purpose.

### Inputs
- **Variables**: None

- **Context Requirements**:
  - `patternAnalysis`: Load PATTERN_ANALYSIS.json from task-2 (budget: 3000)
  - `successfulConversations`: Subset of conversations showing tool usage (budget: 8000)

### Process Steps

1. **Identify Tool Call Chains**
   Search for sequences like:
   ```typescript
   metabob_search_codebase_issues → 
   metabob_analyze_change_impact → 
   [fix] → 
   metabob_mark_problem_complete → 
   metabob_suggest_related_changes
   ```

2. **Document Tool Parameters**
   For each tool in sequence:
   - Tool name
   - Key parameters used
   - Purpose at that step
   - Expected output

3. **Categorize Sequences**
   - **Bug Fix Sequences**: Diagnostic → Analysis → Fix → Documentation
   - **Feature Add Sequences**: Pattern Search → Template Search → Implementation → Annotation
   - **Refactor Sequences**: Impact Analysis → Refactor → Related Changes → Annotation
   - **Session Start Sequences**: Priority Issues → Template Search → Work → Documentation

4. **Extract Metabob Integration Patterns**
   Specifically look for:
   - When `metabob_get_priority_issues` is called (session start)
   - When `metabob_search_codebase_issues` is used (finding similar patterns)
   - When `metabob_analyze_change_impact` is called (before major changes)
   - When `metabob_mark_problem_complete` is used (after fixes)
   - When `metabob_annotate_component` is called (design decisions)

5. **Create Copy-Paste Examples**
   For each sequence, provide:
   ```typescript
   // Sequence: Fix Bug with Full Context
   
   // Step 1: Search for similar issues
   const issues = await metabob_search_codebase_issues({
     query: "SQL injection vulnerability",
     severity_filter: ["HIGH", "MEDIUM"],
     limit: 5
   });
   
   // Step 2: Analyze impact of change
   const impact = await metabob_analyze_change_impact({
     file_path: "src/database/query.ts",
     component_name: "executeQuery"
   });
   
   // Step 3: Implement fix
   // [Fix SQL injection by using parameterized queries]
   
   // Step 4: Document resolution
   await metabob_mark_problem_complete({
     problem_id: "issue_123",
     file_path: "src/database/query.ts",
     resolution_notes: "Fixed SQL injection by replacing string concatenation with parameterized queries"
   });
   
   // Step 5: Check for related changes needed
   const related = await metabob_suggest_related_changes({
     changed_files: ["src/database/query.ts"]
   });
   ```

### Outputs
- **Required Files**:
  - `TOOL_SEQUENCES.json` - Structured tool sequence data
  - `TOOL_SEQUENCES.md` - Copy-paste ready tool sequences

### Completion Criteria

#### Required Conditions
- [ ] At least 5 distinct tool sequences documented
- [ ] Each sequence has 3+ steps
- [ ] Each sequence has copy-paste code example
- [ ] Each sequence explains when to use it
- [ ] Metabob integration patterns included

#### Success Indicators
- [ ] `TOOL_SEQUENCES.json` contains `sequences` array with length >= 5
- [ ] Each sequence has `steps`, `example`, `useCase`
- [ ] `TOOL_SEQUENCES.md` has copy-paste TypeScript code
- [ ] Code examples are complete (not pseudocode)

### Validation Rules

```json
{
  "requiredFiles": [
    "TOOL_SEQUENCES.json",
    "TOOL_SEQUENCES.md"
  ],
  "requiredPatterns": [
    "\"sequences\":",
    "Sequence [0-9]+:",
    "await.*metabob_",
    "Step [0-9]+:"
  ],
  "forbiddenPatterns": [
    "TODO",
    "\\[implement\\]",
    "pseudocode"
  ],
  "commands": []
}
```

### Edge Case Handling

1. **Sequences Too Long (>7 steps)**
   - Break into sub-sequences
   - Group related steps
   - Highlight the core sequence
   - Note variations separately

2. **Tool Parameters Vary Widely**
   - Document common parameter patterns
   - Show 2-3 variations
   - Explain when to use each
   - Provide parameter decision logic

3. **Mix of Metabob and Non-Metabob Tools**
   - Document the full sequence
   - Highlight integration points
   - Show data flow between tools
   - Explain why tools are combined

### Agent Guidance

**Tone**: Practical, code-focused extraction  
**Focus**: Exact tool calls with real parameters  
**Avoid**: Vague descriptions or pseudocode

**Key Instructions**:
- Extract ACTUAL tool calls from conversations
- Use real parameter values (or realistic examples)
- Provide complete, working code
- Explain the PURPOSE of each step
- Show data flow between steps

**Prompt Excerpt**:
```
Extract tool call sequences from successful conversations.

REQUIREMENTS:
1. EXACT tool names and parameters
2. COMPLETE code (not "// do something")
3. EXPLAIN each step's purpose
4. SHOW when to use this sequence

Example Structure:
```typescript
// Sequence: [Name]
// Use Case: [When to use]

// Step 1: [Purpose]
const result1 = await tool1({ param: "value" });

// Step 2: [Purpose]
const result2 = await tool2({ 
  input: result1.output,
  param: "value" 
});
```
```

---

## Task 4: Analyze Context and Validation Patterns

### Metadata
- **ID**: `task-4-analyze-context-validation`
- **Subagent**: `general`
- **Model**: `claude-sonnet-4-20250514` (pattern analysis)
- **Dependencies**: `task-2-identify-recurring-patterns`, `task-3-extract-tool-sequences`
- **Estimated Time**: 10-15 minutes
- **Token Budget**: 6,000-10,000

### Objective
Extract patterns for effective context requirements and validation strategies from successful conversations.

### Inputs
- **Variables**: None

- **Context Requirements**:
  - `patternAnalysis`: Load PATTERN_ANALYSIS.json (budget: 3000)
  - `activityTemplates`: Load 3-5 successful activity templates (budget: 6000)

### Process Steps

1. **Analyze Context Requirements**
   
   For successful activities, extract:
   - What context was loaded (impulse types)
   - How much budget was allocated
   - When context was loaded (pre-task, during task)
   - How context was used in prompts
   
   Pattern structure:
   ```json
   {
     "contextPattern": "metabob-priority-issues",
     "impulseType": "metabobPriorityIssues",
     "budgetRange": [2000, 4000],
     "timing": "session-start",
     "useCase": "Check HIGH severity issues before work",
     "effectiveness": "high"
   }
   ```

2. **Extract Budget Allocation Patterns**
   
   Document typical budgets:
   - Small context (tool output): 1000-2000 tokens
   - Medium context (file, analysis): 2000-4000 tokens
   - Large context (multiple files): 4000-8000 tokens
   - Very large context (comprehensive): 8000-15000 tokens

3. **Analyze Validation Rules**
   
   Multi-layer validation patterns:
   
   **Layer 1: File Validation**
   ```json
   {
     "requiredFiles": ["OUTPUT.md", "SUMMARY.md"],
     "reasoning": "Ensures documentation created"
   }
   ```
   
   **Layer 2: Content Patterns**
   ```json
   {
     "requiredPatterns": ["✅", "Pattern [0-9]+:"],
     "reasoning": "Confirms success markers and structured output"
   }
   ```
   
   **Layer 3: Forbidden Patterns**
   ```json
   {
     "forbiddenPatterns": ["TODO", "setTimeout", "while\\(true\\)"],
     "reasoning": "Prevents incomplete work and anti-patterns"
   }
   ```
   
   **Layer 4: Command Validation**
   ```json
   {
     "commands": [
       {
         "name": "typecheck",
         "command": "tsc --noEmit",
         "required": true
       }
     ]
   }
   ```

4. **Extract Retry Strategies**
   
   Document when to use:
   - Simple retry (deterministic tasks): maxAttempts: 2
   - Progressive context (complex tasks): maxAttempts: 3
   - No retry (one-shot tasks): maxAttempts: 1

5. **Identify Timing Patterns**
   
   When to validate:
   - After each task (light validation)
   - Between phases (medium validation)
   - At end (comprehensive validation)

### Outputs
- **Required Files**:
  - `CONTEXT_PATTERNS.json` - Context requirement patterns
  - `VALIDATION_PATTERNS.json` - Validation strategy patterns
  - `CONTEXT_VALIDATION_GUIDE.md` - Human-readable guide

### Completion Criteria

#### Required Conditions
- [ ] At least 5 context patterns documented
- [ ] Budget ranges specified for each pattern
- [ ] Multi-layer validation structure explained
- [ ] Retry strategies documented with use cases
- [ ] Timing guidance provided

#### Success Indicators
- [ ] `CONTEXT_PATTERNS.json` has `patterns` array with length >= 5
- [ ] `VALIDATION_PATTERNS.json` has all 4 layers documented
- [ ] Examples show real validation rules from templates
- [ ] Guide explains WHEN to use each pattern

### Validation Rules

```json
{
  "requiredFiles": [
    "CONTEXT_PATTERNS.json",
    "VALIDATION_PATTERNS.json",
    "CONTEXT_VALIDATION_GUIDE.md"
  ],
  "requiredPatterns": [
    "budgetRange",
    "requiredFiles",
    "requiredPatterns",
    "forbiddenPatterns",
    "Multi-layer"
  ],
  "forbiddenPatterns": [
    "TODO",
    "unclear"
  ],
  "commands": []
}
```

### Edge Case Handling

1. **Context Budgets Vary Widely**
   - Document ranges, not fixed values
   - Explain factors affecting budget
   - Show how to estimate needed budget
   - Provide budget calculation examples

2. **Validation Rules Conflict**
   - Document rule precedence
   - Explain when rules can conflict
   - Show resolution strategies
   - Provide decision logic

3. **No Clear Validation Pattern**
   - Document minimal validation baseline
   - Show progressive enhancement
   - Explain risk-based validation
   - Provide decision tree

### Agent Guidance

**Tone**: Systematic, structured extraction  
**Focus**: Extracting provable patterns from data  
**Avoid**: Speculation without evidence

**Key Instructions**:
- Extract patterns from ACTUAL successful activities
- Document the reasoning behind each pattern
- Provide concrete budget numbers
- Show real validation rules from templates
- Explain WHEN to apply each pattern

---

## Task 5: Create Pattern Catalog

### Metadata
- **ID**: `task-5-create-pattern-catalog`
- **Subagent**: `general`
- **Model**: `claude-sonnet-4-20250514` (synthesis and organization)
- **Dependencies**: `task-2`, `task-3`, `task-4`
- **Estimated Time**: 15-25 minutes
- **Token Budget**: 10,000-15,000

### Objective
Synthesize all extracted patterns into a comprehensive, well-organized catalog with copy-paste examples, decision trees, and usage guidance.

### Inputs
- **Variables**:
  - `outputFormat`: Format for catalog (default: "markdown")
  - `includeAntiPatterns`: Include anti-pattern section (default: true)

- **Context Requirements**:
  - Load all outputs from tasks 2, 3, 4 (budget: 8000)

### Process Steps

1. **Organize Pattern Categories**
   
   Create hierarchical structure:
   ```
   PATTERN CATALOG
   ├─ Core Patterns (7)
   │  ├─ Activity-First Workflow
   │  ├─ Diagnostic-First Bug Fixing
   │  ├─ Example-Driven Template Creation
   │  ├─ Behavioral Testing
   │  ├─ Activity Composition
   │  ├─ Metabob-Guided Quality
   │  └─ ACP Multi-Agent Coordination
   │
   ├─ Tool Sequences (5+)
   │  ├─ Fix Bug with Full Context
   │  ├─ Add Feature Following Patterns
   │  ├─ Create Activity Template
   │  ├─ Refactor Safely
   │  └─ Start Work Session
   │
   ├─ Context Patterns (5+)
   │  ├─ Priority Issues at Start
   │  ├─ File Context for Fixes
   │  ├─ Historical Context for Analysis
   │  └─ ...
   │
   ├─ Validation Patterns
   │  ├─ Multi-Layer Validation
   │  ├─ Progressive Validation
   │  └─ Risk-Based Validation
   │
   └─ Anti-Patterns (5+)
      ├─ Ad-Hoc Without Planning
      ├─ Skipping Impact Analysis
      ├─ Missing Validation Rules
      └─ ...
   ```

2. **Create Decision Trees**
   
   For pattern selection:
   ```
   User Intent?
     ├─ Bug Fix
     │  └─ Use: Diagnostic-First Bug Fixing Pattern
     │     └─ Tool Sequence: Fix Bug with Full Context
     │
     ├─ Feature Add
     │  └─ Use: Activity-First Workflow Pattern
     │     └─ Tool Sequence: Add Feature Following Patterns
     │
     └─ Refactor
        └─ Use: Metabob-Guided Quality Pattern
           └─ Tool Sequence: Refactor Safely
   ```

3. **Add Copy-Paste Examples**
   
   For each pattern:
   - Full working code example
   - Parameter explanations
   - Expected outputs
   - Success criteria

4. **Document When to Use**
   
   For each pattern:
   - Primary use case
   - Success indicators
   - Prerequisites
   - Expected outcome

5. **Create Quick Reference Section**
   
   One-page summary:
   - Pattern name → Use case
   - Tool sequence → Purpose
   - Context pattern → Budget
   - Validation pattern → Timing

6. **Add Anti-Patterns Section**
   
   Document common mistakes:
   - What not to do
   - Why it fails
   - How to avoid
   - Correct alternative

### Outputs
- **Required Files**:
  - `PATTERN_CATALOG.md` - Comprehensive pattern documentation
  - `PATTERN_QUICK_REFERENCE.md` - One-page quick reference
  - `PATTERN_DECISION_TREES.md` - Decision trees for pattern selection
  - `ANTI_PATTERNS.md` - Common mistakes and prevention

### Completion Criteria

#### Required Conditions
- [ ] At least 7 core patterns documented
- [ ] Each pattern has copy-paste example
- [ ] Decision trees for pattern selection
- [ ] Quick reference is 1-2 pages
- [ ] Anti-patterns section with 5+ examples
- [ ] Cross-references between patterns

#### Success Indicators
- [ ] `PATTERN_CATALOG.md` has structured sections
- [ ] Examples are complete and working
- [ ] Quick reference fits on 1-2 pages
- [ ] Decision trees are clear and actionable
- [ ] Anti-patterns explain prevention

### Validation Rules

```json
{
  "requiredFiles": [
    "PATTERN_CATALOG.md",
    "PATTERN_QUICK_REFERENCE.md",
    "PATTERN_DECISION_TREES.md",
    "ANTI_PATTERNS.md"
  ],
  "requiredPatterns": [
    "Pattern [0-9]+:",
    "```typescript",
    "Use Case:",
    "Decision Tree",
    "Anti-Pattern"
  ],
  "forbiddenPatterns": [
    "TODO",
    "TBD",
    "\\[example\\]",
    "pseudocode"
  ],
  "commands": []
}
```

### Edge Case Handling

1. **Catalog Too Large (>10,000 words)**
   - Split into main catalog + appendices
   - Create focused quick reference
   - Use hierarchical organization
   - Add navigation/TOC

2. **Patterns Have Variations**
   - Document base pattern
   - Show variations as subsections
   - Explain when to use each
   - Cross-reference related patterns

3. **Anti-Patterns Overlap with Patterns**
   - Clearly separate "Do" and "Don't"
   - Show correct alternative for each anti-pattern
   - Use visual markers (✅/❌)
   - Explain WHY it's an anti-pattern

### Agent Guidance

**Tone**: Educational, comprehensive, practical  
**Focus**: Creating usable documentation for developers  
**Avoid**: Academic/theoretical descriptions without examples

**Key Instructions**:
- Organize for easy navigation
- Provide working code examples
- Include decision-making guidance
- Cross-reference related patterns
- Make quick reference truly quick (1-2 pages)
- Explain WHY, not just WHAT

**Prompt Excerpt**:
```
Create a comprehensive pattern catalog that developers can actually use.

STRUCTURE:
1. Overview (what's in this catalog)
2. Core Patterns (7 main patterns)
3. Tool Sequences (copy-paste ready)
4. Context Patterns (with budgets)
5. Validation Patterns (multi-layer)
6. Decision Trees (when to use what)
7. Anti-Patterns (what to avoid)
8. Quick Reference (1-2 pages)

REQUIREMENTS:
- Every pattern has WORKING code example
- Every example explains parameters
- Decision trees are clear and actionable
- Quick reference fits on 1-2 pages
- Anti-patterns show correct alternative

AUDIENCE: Developers who want to apply patterns immediately
```

---

## Task 6: Validate and Finalize

### Metadata
- **ID**: `task-6-validate-and-finalize`
- **Subagent**: `general`
- **Model**: `claude-haiku-4-20250514` (mechanical validation)
- **Dependencies**: `task-5-create-pattern-catalog`
- **Estimated Time**: 5-10 minutes
- **Token Budget**: 4,000-6,000

### Objective
Validate all pattern documentation for completeness, correctness, and usability. Create final summary and metrics.

### Inputs
- **Variables**: None

- **Context Requirements**:
  - Load all output files from task 5 (budget: 4000)

### Process Steps

1. **Validate File Completeness**
   ```bash
   # Check all required files exist
   ls -1 DATA_INVENTORY.json \
        PATTERN_ANALYSIS.json \
        TOOL_SEQUENCES.md \
        CONTEXT_PATTERNS.json \
        VALIDATION_PATTERNS.json \
        PATTERN_CATALOG.md \
        PATTERN_QUICK_REFERENCE.md \
        PATTERN_DECISION_TREES.md \
        ANTI_PATTERNS.md
   ```

2. **Validate Content Structure**
   
   For each file, verify:
   - [ ] Has required sections
   - [ ] Has code examples (where applicable)
   - [ ] Has success criteria
   - [ ] Has cross-references
   - [ ] No TODOs or incomplete sections

3. **Validate Code Examples**
   
   Check all code blocks:
   - [ ] Syntax is correct (TypeScript)
   - [ ] Parameters are realistic
   - [ ] Examples are complete
   - [ ] Comments explain purpose

4. **Check Cross-References**
   
   Verify links between documents:
   - [ ] Decision trees reference patterns
   - [ ] Quick reference matches catalog
   - [ ] Anti-patterns reference correct alternatives

5. **Generate Metrics**
   
   Create summary:
   ```json
   {
     "conversations_analyzed": 15,
     "patterns_identified": 7,
     "tool_sequences": 5,
     "context_patterns": 6,
     "validation_patterns": 4,
     "anti_patterns": 5,
     "code_examples": 15,
     "total_documentation": "~25,000 words",
     "quick_reference": "1,850 words"
   }
   ```

6. **Create Final Summary**
   
   Document:
   - What was analyzed
   - What patterns were found
   - Where documentation is located
   - How to use the patterns
   - Next steps (optional)

### Outputs
- **Required Files**:
  - `PATTERN_EXTRACTION_SUMMARY.md` - Final summary
  - `PATTERN_METRICS.json` - Quantitative metrics

### Completion Criteria

#### Required Conditions
- [ ] All 9 output files exist
- [ ] No TODOs in any file
- [ ] Code examples are complete
- [ ] Cross-references are valid
- [ ] Metrics document quantitative results
- [ ] Summary explains how to use patterns

#### Success Indicators
- [ ] Validation passes for all files
- [ ] No broken cross-references
- [ ] Quick reference is actually quick (1-2 pages)
- [ ] Code examples are syntactically correct
- [ ] Summary provides clear next steps

### Validation Rules

```json
{
  "requiredFiles": [
    "DATA_INVENTORY.json",
    "PATTERN_ANALYSIS.json",
    "TOOL_SEQUENCES.md",
    "CONTEXT_PATTERNS.json",
    "VALIDATION_PATTERNS.json",
    "PATTERN_CATALOG.md",
    "PATTERN_QUICK_REFERENCE.md",
    "PATTERN_DECISION_TREES.md",
    "ANTI_PATTERNS.md",
    "PATTERN_EXTRACTION_SUMMARY.md",
    "PATTERN_METRICS.json"
  ],
  "requiredPatterns": [
    "conversations_analyzed",
    "patterns_identified",
    "✅"
  ],
  "forbiddenPatterns": [
    "TODO",
    "TBD",
    "FIXME",
    "\\[incomplete\\]"
  ],
  "commands": [
    {
      "name": "validate-all-json",
      "command": "for f in *.json; do node -e \"JSON.parse(require('fs').readFileSync('$f', 'utf8'))\"; done",
      "required": true
    }
  ]
}
```

### Edge Case Handling

1. **Validation Finds Incomplete Sections**
   - Document what's incomplete
   - Note why (insufficient data, out of scope, etc.)
   - Don't mark as failure if justified
   - Add to recommendations for future work

2. **Cross-References Have Broken Links**
   - Fix broken internal links
   - Remove or update external links
   - Verify all pattern references resolve

3. **Code Examples Have Errors**
   - Fix syntax errors
   - Validate parameter types
   - Ensure examples are runnable
   - Test at least one example per pattern

### Agent Guidance

**Tone**: Thorough, systematic validation  
**Focus**: Catching errors and ensuring completeness  
**Avoid**: Rubber-stamping without actual checks

**Key Instructions**:
- Actually run validation commands
- Check each file individually
- Verify code syntax
- Test cross-references
- Don't skip validation because "it looks good"

**Prompt Excerpt**:
```
Perform comprehensive validation of pattern documentation.

VALIDATION CHECKLIST:

File Completeness:
- [ ] All 11 files exist
- [ ] All files are non-empty
- [ ] No placeholder files

Content Quality:
- [ ] No TODO or FIXME markers
- [ ] All sections are complete
- [ ] Examples are working code
- [ ] Cross-references are valid

Structural Validation:
- [ ] JSON files parse correctly
- [ ] Markdown files are well-formed
- [ ] Code blocks have language tags
- [ ] Headers are hierarchical

Usability:
- [ ] Quick reference is 1-2 pages
- [ ] Decision trees are clear
- [ ] Examples are copy-pasteable
- [ ] Anti-patterns show alternatives

Run actual validation commands. Report specific issues found.
```

---

## Summary: Complete Task Flow

### Sequential Execution
```
1. gather-success-data (5-10 min, Haiku)
   ↓ DATA_INVENTORY.json, DATA_SOURCES.md
   
2. identify-recurring-patterns (15-25 min, Sonnet)
   ↓ PATTERN_ANALYSIS.json, RECURRING_PATTERNS.md
   
3. extract-tool-sequences (10-20 min, Sonnet)
   ↓ TOOL_SEQUENCES.json, TOOL_SEQUENCES.md
   
4. analyze-context-validation (10-15 min, Sonnet)
   ↓ CONTEXT_PATTERNS.json, VALIDATION_PATTERNS.json
   
5. create-pattern-catalog (15-25 min, Sonnet)
   ↓ PATTERN_CATALOG.md, QUICK_REFERENCE.md, etc.
   
6. validate-and-finalize (5-10 min, Haiku)
   ↓ SUMMARY.md, METRICS.json
```

### Total Resources
- **Time**: 60-105 minutes
- **Tokens**: 43,000-69,000 tokens
- **Model Mix**: 70% Sonnet (analysis), 30% Haiku (mechanical)

### Output Files (11 total)
1. DATA_INVENTORY.json
2. DATA_SOURCES.md
3. PATTERN_ANALYSIS.json
4. RECURRING_PATTERNS.md
5. TOOL_SEQUENCES.json
6. TOOL_SEQUENCES.md
7. CONTEXT_PATTERNS.json
8. VALIDATION_PATTERNS.json
9. CONTEXT_VALIDATION_GUIDE.md
10. PATTERN_CATALOG.md
11. PATTERN_QUICK_REFERENCE.md
12. PATTERN_DECISION_TREES.md
13. ANTI_PATTERNS.md
14. PATTERN_EXTRACTION_SUMMARY.md
15. PATTERN_METRICS.json

---

**Status**: ✅ Task Breakdown Complete  
**Date**: 2026-02-05  
**Next Step**: Implement as activity template JSON
