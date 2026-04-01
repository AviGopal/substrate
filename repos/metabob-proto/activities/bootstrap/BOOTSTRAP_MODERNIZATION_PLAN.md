# Bootstrap Activities Modernization Plan

> **Purpose**: Update bootstrap activities to embody the impulse-based execution model and encode knowledge about creating executable, learnable activities.

---

## Current State Analysis

### Existing Bootstrap Activities

| Activity | Purpose | Current Approach | Needs Update? |
|----------|---------|------------------|---------------|
| `create-activity-self-contained` | Create new templates | Uses variables, outputs to `/tmp` | ✅ Minor updates |
| `debug-activity-self-contained` | Debug failed executions | Uses MCP tool directly | ✅ Add impulses |
| `evolve-activity-self-contained` | Improve templates | Bash API calls | ✅ Convert to impulses |
| `add-feature-complete` | Add features | Legacy | ⚠️ Deprecated? |
| `fix-bug-complete` | Fix bugs | Legacy | ⚠️ Deprecated? |
| `refactor-with-tests` | Refactor code | Legacy | ⚠️ Deprecated? |

### Issues with Current Implementations

1. **No impulse arrays** - Using bash/curl instead of impulse pointers
2. **Hardcoded API calls** - Should use backend impulse types
3. **Missing validation** - Not teaching validation best practices
4. **No state capture examples** - Not showing how ribosome works
5. **No parameterization examples** - Not teaching variable usage

---

## Modernization Goals

### 1. Impulse-Based Data Access

Replace:
```json
{
  "prompt": {
    "template": "Fetch data with: curl http://api/executions/{{id}}"
  }
}
```

With:
```json
{
  "impulses": [
    {
      "id": "executionTrace",
      "pointer": {
        "type": "activityExecutionTrace",
        "executionId": "{{executionId}}"
      },
      "budget": 15000,
      "priority": "critical"
    }
  ],
  "tasks": [
    {
      "id": "analyze",
      "impulseReferences": ["executionTrace"],
      "prompt": {
        "template": "Analyze the execution trace impulse"
      }
    }
  ]
}
```

### 2. Comprehensive Validation

Every task should demonstrate validation best practices:

```json
{
  "validation": {
    "requiredFiles": ["{{outputFile}}"],
    "requiredPatterns": [
      { "file": "{{outputFile}}", "pattern": "\"status\":" }
    ],
    "forbiddenPatterns": [
      { "file": "{{outputFile}}", "pattern": "TODO|FIXME|ERROR" }
    ],
    "commands": [
      { "command": "cat {{outputFile}} | jq empty", "required": true }
    ]
  }
}
```

### 3. Proper Parameterization

Show how to avoid hardcoding:

```json
{
  "variables": [
    { "name": "executionId", "type": "string", "required": true },
    { "name": "outputDir", "type": "string", "default": "/tmp/analysis" },
    { "name": "includeToolCalls", "type": "boolean", "default": true }
  ],
  "impulses": [
    {
      "id": "trace",
      "pointer": {
        "type": "activityExecutionTrace",
        "executionId": "{{executionId}}",
        "includeToolCalls": "{{includeToolCalls}}"
      },
      "budget": 15000
    }
  ]
}
```

### 4. State Capture Documentation

Include metadata showing what the ribosome extracts:

```json
{
  "metadata": {
    "primordial": true,
    "bootstrap": true,
    "level": 0,
    "teaches": [
      "impulse-based parameterization",
      "comprehensive validation",
      "state capture",
      "variable usage"
    ]
  }
}
```

---

## Modernization Tasks

### Task 1: Update `debug-activity-self-contained.json`

**Current**: Uses `activity_error_inspector` tool directly

**Modernize to**:
```json
{
  "id": "debug-activity-self-contained",
  "name": "Debug Activity Execution",
  "description": "Debug failed executions using impulse-based trace access",
  "tags": ["meta.debug", "bootstrap.primordial"],

  "variables": [
    { "name": "executionId", "type": "string", "required": true },
    { "name": "outputDir", "type": "string", "default": "/tmp/debug-analysis" }
  ],

  "impulses": [
    {
      "id": "failedTrace",
      "pointer": {
        "type": "activityExecutionTrace",
        "executionId": "{{executionId}}",
        "includeState": true,
        "includeToolCalls": true
      },
      "budget": 15000,
      "priority": "critical",
      "description": "Full execution trace with state and tool calls"
    },
    {
      "id": "templateDef",
      "pointer": {
        "type": "activityTemplate",
        "templateId": "{{failedTrace.templateId}}"  // Reference from trace
      },
      "budget": 5000,
      "priority": "high",
      "description": "Original template that failed"
    }
  ],

  "tasks": [
    {
      "id": "analyze-failure",
      "impulseReferences": ["failedTrace", "templateDef"],
      "prompt": {
        "template": "Analyze why this execution failed...",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/FAILURE_ANALYSIS.md"],
        "requiredPatterns": [
          "## Root Cause",
          "## Failed Task",
          "## Recommendations"
        ]
      }
    }
  ],

  "metadata": {
    "primordial": true,
    "teaches": ["impulse-based trace access", "failure analysis"]
  }
}
```

**Key improvements**:
- ✅ Uses `activityExecutionTrace` impulse instead of tool call
- ✅ Uses `activityTemplate` impulse for template access
- ✅ Parameterized output directory
- ✅ Comprehensive validation
- ✅ Tagged as bootstrap primordial

---

### Task 2: Update `evolve-activity-self-contained.json`

**Current**: Makes bash/curl API calls

**Modernize to**:
```json
{
  "id": "evolve-activity-self-contained",
  "name": "Evolve Activity Template",
  "description": "Improve templates based on metrics using impulse-based data access",
  "tags": ["meta.evolve", "bootstrap.primordial"],

  "variables": [
    { "name": "templateId", "type": "string", "required": true },
    { "name": "lookbackDays", "type": "number", "default": 30 },
    { "name": "outputDir", "type": "string", "default": "/tmp/evolution" }
  ],

  "impulses": [
    {
      "id": "template",
      "pointer": {
        "type": "activityTemplate",
        "templateId": "{{templateId}}"
      },
      "budget": 5000,
      "priority": "high"
    },
    {
      "id": "metrics",
      "pointer": {
        "type": "activityMetrics",
        "templateId": "{{templateId}}",
        "lookbackDays": "{{lookbackDays}}"
      },
      "budget": 3000,
      "priority": "high"
    },
    {
      "id": "recentFailures",
      "pointer": {
        "type": "recentExecutions",
        "filter": "failed",
        "activityId": "{{templateId}}",
        "limit": 10
      },
      "budget": 10000,
      "priority": "medium"
    }
  ],

  "tasks": [
    {
      "id": "analyze-performance",
      "impulseReferences": ["template", "metrics", "recentFailures"],
      "prompt": {
        "template": "Analyze template performance using metrics and failure patterns...",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/PERFORMANCE_ANALYSIS.md"],
        "requiredPatterns": ["## Success Rate", "## Failure Patterns"]
      }
    },
    {
      "id": "generate-improvements",
      "dependencies": ["analyze-performance"],
      "prompt": {
        "template": "Generate prioritized improvements...",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/IMPROVEMENTS.md"],
        "requiredPatterns": ["## Priority 1", "## Expected Impact"]
      }
    },
    {
      "id": "create-variant",
      "dependencies": ["generate-improvements"],
      "prompt": {
        "template": "Create improved template variant...",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/{{templateId}}-improved.json"],
        "commands": [
          { "command": "cat {{outputDir}}/{{templateId}}-improved.json | jq empty", "required": true }
        ]
      }
    }
  ],

  "metadata": {
    "primordial": true,
    "teaches": ["metrics-based optimization", "variant creation", "impulse composition"]
  }
}
```

**Key improvements**:
- ✅ Uses `activityTemplate`, `activityMetrics`, `recentExecutions` impulses
- ✅ No bash/curl - backend resolves impulses
- ✅ Parameterized lookback period
- ✅ Command validation (JSON syntax check)
- ✅ Shows impulse composition (multiple impulses in one task)

---

### Task 3: Create `validate-activity-template.json` (NEW)

**Purpose**: Teach how to validate templates are executable

```json
{
  "id": "validate-activity-template",
  "name": "Validate Activity Template",
  "description": "Validate template can be executed by MiniBob - checks variables, validation rules, dependencies",
  "tags": ["meta.validate", "bootstrap.quality"],

  "variables": [
    { "name": "templateFile", "type": "string", "required": true },
    { "name": "outputDir", "type": "string", "default": "/tmp/validation" }
  ],

  "impulses": [
    {
      "id": "templateContent",
      "pointer": {
        "type": "file",
        "path": "{{templateFile}}"
      },
      "budget": 8000,
      "priority": "critical"
    }
  ],

  "tasks": [
    {
      "id": "validate-structure",
      "impulseReferences": ["templateContent"],
      "prompt": {
        "template": "Validate template structure and compliance.\n\n**Checks**:\n\n1. **Variable Declaration**:\n   - All {{variables}} in prompts are declared\n   - All {{variables}} in impulse pointers are declared\n   - Variable types are valid (string, number, boolean, array, object)\n   - Required variables have no defaults\n\n2. **Impulse Pointers**:\n   - All impulse IDs are unique\n   - All pointer types are known or custom\n   - Budget values are reasonable (3k-15k typical)\n   - Priority is valid (critical, high, medium, low)\n\n3. **Task Dependencies**:\n   - No circular dependencies (DAG)\n   - All dependency IDs exist\n   - impulseReferences point to declared impulses\n\n4. **Validation Rules**:\n   - requiredFiles use variables properly\n   - requiredPatterns have files or check output\n   - forbiddenPatterns have files\n   - Commands are executable\n\n5. **Schema Compliance**:\n   - All required fields present\n   - Field types match ActivityTemplate.Schema\n   - JSON is valid\n\n**Output**: Create {{outputDir}}/VALIDATION_REPORT.md",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/VALIDATION_REPORT.md"],
        "requiredPatterns": [
          "## Variable Declaration",
          "## Impulse Pointers",
          "## Task Dependencies",
          "## Validation Rules",
          "## Schema Compliance"
        ],
        "forbiddenPatterns": [
          { "file": "{{outputDir}}/VALIDATION_REPORT.md", "pattern": "❌.*CRITICAL" }
        ]
      }
    },
    {
      "id": "test-execution-dry-run",
      "dependencies": ["validate-structure"],
      "prompt": {
        "template": "Test template execution with mock variables.\n\n**Task**:\n1. Generate mock variables for all required variables\n2. Simulate task execution flow\n3. Check validation would pass\n4. Report potential issues\n\n**Output**: Create {{outputDir}}/DRY_RUN_REPORT.md",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/DRY_RUN_REPORT.md"],
        "requiredPatterns": ["## Mock Execution", "## Validation Simulation"]
      }
    }
  ],

  "metadata": {
    "primordial": true,
    "teaches": [
      "template validation",
      "variable checking",
      "dependency analysis",
      "dry-run simulation"
    ]
  }
}
```

**Teaches**:
- ✅ How to validate templates before execution
- ✅ Variable declaration checking
- ✅ DAG analysis (no circular dependencies)
- ✅ Validation rule structure

---

### Task 4: Create `extract-activity-from-trace.json` (NEW)

**Purpose**: Teach the ribosome pattern - extract templates from successful executions

```json
{
  "id": "extract-activity-from-trace",
  "name": "Extract Activity from Trace (Ribosome)",
  "description": "Extract reusable template from successful execution trace - teaches parameterization",
  "tags": ["meta.ribosome", "bootstrap.learning"],

  "variables": [
    { "name": "executionId", "type": "string", "required": true },
    { "name": "templateName", "type": "string", "required": true },
    { "name": "outputDir", "type": "string", "default": "/tmp/ribosome" }
  ],

  "impulses": [
    {
      "id": "successfulTrace",
      "pointer": {
        "type": "activityExecutionTrace",
        "executionId": "{{executionId}}",
        "includeState": true,
        "includeToolCalls": true
      },
      "budget": 20000,
      "priority": "critical",
      "description": "Full trace with state for extraction"
    }
  ],

  "tasks": [
    {
      "id": "analyze-state",
      "impulseReferences": ["successfulTrace"],
      "prompt": {
        "template": "Analyze execution state to identify parameterization opportunities.\n\n**Analysis**:\n\n1. **Input State Analysis**:\n   - Files accessed: List all files read\n   - Variables used: Identify values that should be parameterized\n   - Environment dependencies: Note any environment-specific values\n\n2. **Tool Call Analysis**:\n   - Extract tool names and arguments\n   - Identify hardcoded values (paths, names, IDs)\n   - Determine which should be variables\n\n3. **Output State Analysis**:\n   - Files created/modified: Generate validation rules\n   - Patterns in output: Generate pattern validation\n   - Commands run: Generate command validation\n\n4. **Parameterization Strategy**:\n   - Identify all environment-specific values\n   - Create variable for each\n   - Determine appropriate defaults\n   - Choose variable types (string, number, etc.)\n\n**Output**: Create {{outputDir}}/STATE_ANALYSIS.md",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/STATE_ANALYSIS.md"],
        "requiredPatterns": [
          "## Input State Analysis",
          "## Tool Call Analysis",
          "## Output State Analysis",
          "## Parameterization Strategy"
        ]
      }
    },
    {
      "id": "extract-template",
      "dependencies": ["analyze-state"],
      "prompt": {
        "template": "Extract parameterized template from trace.\n\n**Template Structure**:\n\n```json\n{\n  \"id\": \"{{templateName}}\",\n  \"name\": \"[Human-readable name]\",\n  \"description\": \"Extracted from execution {{executionId}}\",\n  \"tags\": [\"ribosome-extracted\"],\n  \n  \"variables\": [\n    // Extract from STATE_ANALYSIS.md\n    // For each hardcoded value, create variable\n  ],\n  \n  \"impulses\": [\n    // Extract from tool calls\n    // File reads → file impulses\n    // Data access → custom impulses\n  ],\n  \n  \"tasks\": [\n    // Extract from execution trace tasks\n    // Tool calls → task prompts\n    // Output state → validation rules\n  ],\n  \n  \"metadata\": {\n    \"generatedFrom\": \"execution\",\n    \"sourceExecutionId\": \"{{executionId}}\",\n    \"ribosomeVersion\": 1\n  }\n}\n```\n\n**Parameterization Rules**:\n1. File paths → variables\n2. Names (functions, classes, files) → variables\n3. IDs → variables\n4. Provide defaults where sensible\n5. Use impulse pointers for data access\n\n**Validation Generation**:\n1. Files created → requiredFiles\n2. Patterns in output → requiredPatterns\n3. Commands run → commands\n4. Forbidden patterns from errors → forbiddenPatterns\n\n**Output**: Create {{outputDir}}/{{templateName}}.json",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/{{templateName}}.json"],
        "requiredPatterns": [
          { "file": "{{outputDir}}/{{templateName}}.json", "pattern": "\"variables\":" },
          { "file": "{{outputDir}}/{{templateName}}.json", "pattern": "\"impulses\":" },
          { "file": "{{outputDir}}/{{templateName}}.json", "pattern": "\"metadata\":" }
        ],
        "commands": [
          { "command": "cat {{outputDir}}/{{templateName}}.json | jq empty", "required": true }
        ]
      }
    },
    {
      "id": "document-extraction",
      "dependencies": ["extract-template"],
      "prompt": {
        "template": "Document what was extracted and how to use it.\n\n**Documentation**:\n\n```markdown\n# Extracted Template: {{templateName}}\n\n## Source\n- Execution ID: {{executionId}}\n- Original goal: [from trace]\n- Success: true\n- Duration: [from trace]\n- Cost: [from trace]\n\n## Parameterization\n\n### Variables Extracted\n| Variable | Type | Required | Default | Source |\n|----------|------|----------|---------|--------|\n| var1 | string | yes | - | File path in tool call |\n| var2 | number | no | 10 | Command argument |\n\n### Impulses Created\n- `impulse1`: file pointer (from read tool call)\n- `impulse2`: memo pointer (from embedded content)\n\n## Usage\n\n```typescript\nactivity({\n  templateId: \"{{templateName}}\",\n  variables: {\n    var1: \"your-value\",\n    var2: 10\n  },\n  reason: \"Description of what you're doing\"\n})\n```\n\n## Validation\n\nThis template validates:\n- Files created: [list]\n- Required patterns: [list]\n- Commands: [list]\n\n## Testing\n\nTest with:\n```bash\nminibob --single \"use {{templateName}} with var1='test'\"\n```\n```\n\n**Output**: Create {{outputDir}}/EXTRACTION_DOC.md",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/EXTRACTION_DOC.md"],
        "requiredPatterns": ["## Source", "## Parameterization", "## Usage"]
      }
    }
  ],

  "metadata": {
    "primordial": true,
    "teaches": [
      "ribosome pattern",
      "trace analysis",
      "parameterization extraction",
      "validation generation",
      "template documentation"
    ]
  }
}
```

**Teaches**:
- ✅ How ribosome works (extract from trace)
- ✅ State analysis for parameterization
- ✅ Variable extraction from hardcoded values
- ✅ Validation generation from output state
- ✅ Documentation generation

---

### Task 5: Create `create-activity-variant.json` (NEW)

**Purpose**: Teach trailblazing - create variants when activities fail

```json
{
  "id": "create-activity-variant",
  "name": "Create Activity Variant (Trailblazing)",
  "description": "Create template variant from failed execution - teaches failure-driven evolution",
  "tags": ["meta.trailblazing", "bootstrap.learning"],

  "variables": [
    { "name": "executionId", "type": "string", "required": true },
    { "name": "outputDir", "type": "string", "default": "/tmp/trailblazing" }
  ],

  "impulses": [
    {
      "id": "failedTrace",
      "pointer": {
        "type": "activityExecutionTrace",
        "executionId": "{{executionId}}",
        "includeState": true
      },
      "budget": 15000,
      "priority": "critical"
    },
    {
      "id": "originalTemplate",
      "pointer": {
        "type": "activityTemplate",
        "templateId": "{{failedTrace.templateId}}"
      },
      "budget": 5000,
      "priority": "high"
    },
    {
      "id": "similarFailures",
      "pointer": {
        "type": "failurePatterns",
        "templateId": "{{failedTrace.templateId}}",
        "limit": 5
      },
      "budget": 8000,
      "priority": "medium"
    }
  ],

  "tasks": [
    {
      "id": "analyze-failure",
      "impulseReferences": ["failedTrace", "originalTemplate", "similarFailures"],
      "prompt": {
        "template": "Analyze failure to determine adjustment strategy.\n\n**Analysis**:\n\n1. **Failure Type**:\n   - Validation failure (which rule?)\n   - Execution error (which task?)\n   - Timeout (which task?)\n   - Other\n\n2. **Root Cause**:\n   - Why did it fail?\n   - Is this a pattern (check similarFailures)?\n   - Is this template issue or input issue?\n\n3. **Adjustment Strategy**:\n   - Increase token budget?\n   - Add/modify validation?\n   - Split task?\n   - Add examples to prompt?\n   - Change dependencies?\n   - Other tactical fix?\n\n**Output**: Create {{outputDir}}/FAILURE_ANALYSIS.md",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/FAILURE_ANALYSIS.md"],
        "requiredPatterns": [
          "## Failure Type",
          "## Root Cause",
          "## Adjustment Strategy"
        ]
      }
    },
    {
      "id": "create-variant",
      "dependencies": ["analyze-failure"],
      "prompt": {
        "template": "Create template variant with adjustments.\n\n**Process**:\n\n1. Load original template (from originalTemplate impulse)\n2. Apply tactical adjustments (from FAILURE_ANALYSIS.md)\n3. Increment version\n4. Add variant metadata\n\n**Common Adjustments**:\n\n- **Token budget**: Increase by 20-30%\n- **Validation**: Add missing rules or relax overly strict ones\n- **Prompt**: Add examples or clarify instructions\n- **Dependencies**: Fix task order\n- **Split task**: Break complex task into subtasks\n\n**Variant Metadata**:\n```json\n{\n  \"metadata\": {\n    \"variantOf\": \"original-template-id\",\n    \"createdFrom\": \"failed-execution\",\n    \"sourceExecutionId\": \"{{executionId}}\",\n    \"adjustments\": [\"list of changes\"],\n    \"trailblazing\": true\n  }\n}\n```\n\n**Output**: Create {{outputDir}}/variant-{{originalTemplate.id}}.json",
        "variables": []
      },
      "validation": {
        "requiredFiles": ["{{outputDir}}/variant-{{originalTemplate.id}}.json"],
        "commands": [
          { "command": "cat {{outputDir}}/variant-*.json | jq empty", "required": true }
        ]
      }
    }
  ],

  "metadata": {
    "primordial": true,
    "teaches": [
      "trailblazing pattern",
      "failure analysis",
      "tactical adjustments",
      "variant creation",
      "thompson sampling integration"
    ]
  }
}
```

**Teaches**:
- ✅ How trailblazing works (learn from failures)
- ✅ Failure pattern analysis
- ✅ Tactical adjustments (not full rewrites)
- ✅ Variant metadata for Thompson Sampling

---

## Implementation Plan

### Phase 1: Modernize Core Activities (Week 1)

1. **Update `debug-activity-self-contained.json`**
   - Add impulses array
   - Remove direct tool calls
   - Add comprehensive validation
   - Tag as primordial

2. **Update `evolve-activity-self-contained.json`**
   - Replace bash/curl with impulses
   - Add multiple impulse types
   - Show impulse composition
   - Tag as primordial

3. **Update `create-activity-self-contained.json`**
   - Review and modernize (if needed)
   - Ensure teaches best practices
   - Tag as primordial

### Phase 2: Create New Meta-Activities (Week 2)

4. **Create `validate-activity-template.json`**
   - Teach template validation
   - Variable checking
   - DAG analysis

5. **Create `extract-activity-from-trace.json`**
   - Teach ribosome pattern
   - State analysis
   - Parameterization

6. **Create `create-activity-variant.json`**
   - Teach trailblazing
   - Failure analysis
   - Variant creation

### Phase 3: Deprecate Legacy Activities (Week 3)

7. **Review and deprecate**:
   - `add-feature-complete.json` → Replace with ribosome
   - `fix-bug-complete.json` → Replace with ribosome
   - `refactor-with-tests.json` → Replace with ribosome

8. **Create migration guide** for users

### Phase 4: Testing and Documentation (Week 4)

9. **Test all bootstrap activities**
   - Execute with MiniBob
   - Verify validation works
   - Check output quality

10. **Document bootstrap system**
    - Update BOOTSTRAP_TEMPLATES.md
    - Create usage examples
    - Add to CLAUDE.md

---

## Success Criteria

✅ **All bootstrap activities**:
- Use `impulses` array (not bash/curl)
- Have comprehensive validation
- Are properly parameterized
- Include teaching metadata
- Execute successfully with MiniBob

✅ **System demonstrates**:
- Impulse-based data access
- Validation best practices
- Parameterization patterns
- Ribosome extraction
- Trailblazing variants

✅ **Documentation**:
- BOOTSTRAP_TEMPLATES.md updated
- Usage examples provided
- Integration with CLAUDE.md

---

## Next Steps

1. Review this plan
2. Prioritize activities to modernize
3. Create updated templates
4. Test with MiniBob
5. Deploy to metabob-activity-api
6. Update documentation
