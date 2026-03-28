# Mad Libs Vessel Development

## The Core Insight

**Development is already Mad Libs:**
- **Template**: Activity with tasks
- **Blanks**: Variables to fill (`{{endpoint}}`, `{{errorType}}`)
- **Word Bank**: Impulses pointing to similar implementations
- **Filled Story**: Executed code changes

**Vessel creation is learning what blanks to create and what word banks to provide.**

## The Meta-Learning Loop

```
┌─────────────────────────────────────────────────────────────┐
│  USER SAYS: "I want rate limiting"                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 1: Find Similar (The Word Bank)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  find_similar_implementations("rate limiting")         │ │
│  │                                                         │ │
│  │  Results:                                              │ │
│  │  A. rate-limiter.ts (sliding window, Redis, 95% success)│ │
│  │  B. throttle.ts (token bucket, in-memory, 80% success) │ │
│  │  C. quota.ts (fixed window, Redis, 90% success)       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 2: User Picks Options (Filling the Blanks)           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MCP Tool: create_from_template                        │ │
│  │                                                         │ │
│  │  "I want to create: [rate limiting]                   │ │
│  │   Based on: [Option A - rate-limiter.ts]              │ │
│  │   For endpoint: [/api/v2/analysis/search]             │ │
│  │   With storage: [Redis]                               │ │
│  │   Window size: [60 seconds]                           │ │
│  │   Max requests: [100]"                                │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 3: System Generates Activity (The Mad Lib Template)  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  {                                                      │ │
│  │    "id": "implement_rate_limiting_analysis_search",    │ │
│  │    "name": "Add rate limiting to /api/v2/analysis/search", │
│  │    "impulses": [                                       │ │
│  │      {                                                 │ │
│  │        "id": "reference_implementation",               │ │
│  │        "pointer": {                                    │ │
│  │          "type": "codeComponent",                      │ │
│  │          "component_id": "rate-limiter.ts::RateLimiter" │ │
│  │        }                                               │ │
│  │      }                                                 │ │
│  │    ],                                                  │ │
│  │    "tasks": [                                          │ │
│  │      {                                                 │ │
│  │        "description": "Create rate limiter middleware",│ │
│  │        "prompt": {                                     │ │
│  │          "template": "Using this reference:\n{{impulse:reference_implementation}}\n\nCreate rate limiting for {{endpoint}} with {{storage}} backend, {{window_size}} window, {{max_requests}} max.", │
│  │          "variables": [                                │ │
│  │            {"name": "endpoint", "value": "/api/v2/analysis/search"}, │
│  │            {"name": "storage", "value": "Redis"},      │ │
│  │            {"name": "window_size", "value": "60s"},    │ │
│  │            {"name": "max_requests", "value": "100"}    │ │
│  │          ]                                             │ │
│  │        }                                               │ │
│  │      }                                                 │ │
│  │    ]                                                   │ │
│  │  }                                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 4: Execute Activity (Fill in the Story)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MiniBob executes activity                             │ │
│  │  - Loads reference implementation                      │ │
│  │  - Substitutes variables                               │ │
│  │  - Generates code with LLM                             │ │
│  │  - Creates files, runs tests                           │ │
│  │  SUCCESS: rate-limiting.ts created                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 5: Extract Pattern (New Template for Word Bank)      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Ribosome extracts:                                    │ │
│  │  - What blanks were filled: endpoint, storage, window  │ │
│  │  - What references were used: rate-limiter.ts          │ │
│  │  - What worked: Redis + sliding window                 │ │
│  │                                                         │ │
│  │  Creates reusable template:                            │ │
│  │  "add_rate_limiting_to_endpoint"                       │ │
│  │                                                         │ │
│  │  Next time: This is an option in the word bank!        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  STEP 6: You Just Created a Vessel Capability!             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  The template you created is now:                      │ │
│  │  ✓ A reusable activity                                 │ │
│  │  ✓ Part of MiniBob's capabilities                      │ │
│  │  ✓ Available for Thompson Sampling                     │ │
│  │  ✓ Will improve with each use                          │ │
│  │                                                         │ │
│  │  YOU LEARNED:                                          │ │
│  │  - How to identify variables (the blanks)              │ │
│  │  - How to find reference implementations (word bank)   │ │
│  │  - How to structure tasks (the story)                  │ │
│  │  - How to create impulses (context injection)          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## The Mad Libs Interface

### New MCP Tool: `create_from_template`

```typescript
// repos/metabob-mcp/src/tools/create-from-template.ts

export const CreateFromTemplateTool = {
  name: 'create_from_template',
  description: 'Mad Libs-style development: pick a pattern and fill in the blanks',
  inputSchema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'What you want to create (e.g., "rate limiting for search endpoint")',
      },
      // System will present options, user picks
      // This becomes a multi-turn interaction
    },
    required: ['goal'],
  },
  handler: async (input, apiClient, sessionId) => {
    // TURN 1: Find similar implementations (word bank)
    const similar = await apiClient.post('/v2/analysis/similar-implementations', {
      session_id: sessionId,
      query: input.goal,
      limit: 5,
    });

    if (similar.results.length === 0) {
      return `No similar implementations found. Would you like to:
      1. Create from scratch (I'll guide you through vessel creation)
      2. Search a different query
      3. Browse by category`;
    }

    // TURN 2: Present options with Mad Libs preview
    const options = similar.results.map((r: any, i: number) => {
      return `
Option ${String.fromCharCode(65 + i)}: ${r.name}
  File: ${r.file_path}
  Intent: ${r.intent.description}
  Success Rate: ${(r.success_rate * 100).toFixed(0)}%
  Times Used: ${r.times_referenced}

  Variables you'll need to fill:
  ${r.variables.map((v: any) => `  - ${v.name}: ${v.description}`).join('\n')}

  This will create:
  ${r.outcome_preview}
`;
    });

    return `Found ${similar.results.length} similar implementations:\n\n${options.join('\n---\n')}\n\nWhich option would you like to use? (Reply with A, B, C, etc.)`;
  },
};
```

### New MCP Tool: `fill_template_blanks`

```typescript
// repos/metabob-mcp/src/tools/fill-template-blanks.ts

export const FillTemplateBlanks Tool = {
  name: 'fill_template_blanks',
  description: 'Fill in the blanks for a template (Mad Libs step 2)',
  inputSchema: {
    type: 'object',
    properties: {
      template_choice: {
        type: 'string',
        description: 'Which template to use (A, B, C, etc.)',
      },
      blanks: {
        type: 'object',
        description: 'The blanks to fill in',
        additionalProperties: true,
      },
    },
    required: ['template_choice', 'blanks'],
  },
  handler: async (input, apiClient, sessionId) => {
    // Generate activity from template + filled blanks
    const activity = await apiClient.post('/v2/activities/generate-from-template', {
      session_id: sessionId,
      template_id: input.template_choice,
      variables: input.blanks,
    });

    // Preview what will be created
    return `
Generated activity: ${activity.name}

This will:
${activity.tasks.map((t: any, i: number) => `${i + 1}. ${t.description}`).join('\n')}

Files that will be modified/created:
${activity.predicted_changes.map((f: any) => `  - ${f}`).join('\n')}

Impulses (reference code) to be used:
${activity.impulses.map((imp: any) => `  - ${imp.id}: ${imp.description}`).join('\n')}

Ready to execute? (yes/no)
`;
  },
};
```

### New Backend Endpoint: Generate Activity from Template

```typescript
// repos/metabob-activity-api/src/routes/activities.ts

router.post('/v2/activities/generate-from-template', async (c) => {
  const { session_id, template_id, variables } = await c.req.json();
  const { org_id } = c.get('scope');

  // Get the reference component
  const component = await metadataService.getById(template_id);

  if (!component) {
    return c.json({ error: 'Template not found' }, 404);
  }

  // Extract variables from the component pattern
  const pattern = await catalogService.findPatternForComponent(org_id, component.component_id);

  if (!pattern) {
    // Create ad-hoc activity from single component
    const activity = {
      id: `generated_${Date.now()}`,
      name: `Implement ${component.intent.category} based on ${component.name}`,
      category: component.intent.category,
      impulses: [
        {
          id: 'reference_implementation',
          pointer: {
            type: 'codeComponent',
            component_id: component.component_id,
            include_dependencies: true,
          },
          budget: 5000,
          priority: 'high',
        },
      ],
      tasks: [
        {
          id: 'implement',
          description: `Create ${component.intent.description}`,
          prompt: {
            template: `Using this reference implementation:\n\n{{impulse:reference_implementation}}\n\nCreate similar functionality with these specifics:\n${Object.entries(variables).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`,
            variables: Object.entries(variables).map(([name, value]) => ({
              name,
              type: typeof value,
              value,
            })),
          },
        },
      ],
    };

    return c.json({
      activity,
      predicted_changes: [component.file_path], // Estimate
    });
  }

  // Use existing pattern
  const activity = pattern.activity_template;

  // Substitute variables
  activity.tasks.forEach((task: any) => {
    task.prompt.variables = Object.entries(variables).map(([name, value]) => ({
      name,
      type: typeof value,
      value,
    }));
  });

  return c.json({
    activity,
    predicted_changes: pattern.typical_changes,
  });
});
```

## Teaching Vessel Creation Through Mad Libs

### The Pedagogy

Each time you use Mad Libs development, you're learning:

1. **What makes a good blank (variable)?**
   - Specific enough to be useful
   - General enough to be reusable
   - Type-constrained (string, number, enum)

2. **What makes a good word bank (impulse)?**
   - Similar intent
   - High success rate
   - Clear dependencies

3. **What makes a good story (task sequence)?**
   - Logical order
   - Clear validation
   - Proper error handling

4. **What makes a good template (activity)?**
   - Reusable across contexts
   - Measurable outcomes
   - Documented intent

### The Learning Artifacts

After each Mad Libs session, you get:

```typescript
{
  "session_id": "madlibs_001",
  "what_you_created": {
    "goal": "rate limiting for search endpoint",
    "reference_used": "rate-limiter.ts::RateLimiter",
    "blanks_filled": {
      "endpoint": "/api/v2/analysis/search",
      "storage": "Redis",
      "window_size": "60s",
      "max_requests": 100
    },
    "outcome": {
      "files_created": ["src/middleware/rate-limit-search.ts"],
      "tests_passed": true,
      "success": true
    }
  },
  "what_you_learned": {
    "vessel_concepts": [
      "Variables are the contract between template and user",
      "Impulses provide proven patterns as context",
      "Tasks decompose work into measurable steps",
      "Outcomes determine future recommendations"
    ],
    "blanks_you_identified": [
      "endpoint (string) - which route to protect",
      "storage (enum: Redis|Memory) - where to track limits",
      "window_size (duration) - sliding window duration",
      "max_requests (number) - requests per window"
    ],
    "patterns_you_learned": [
      "Rate limiting uses sliding window + Redis",
      "Middleware pattern for cross-cutting concerns",
      "Success rate guides future recommendations"
    ]
  },
  "your_template_is_now": {
    "id": "add_rate_limiting_to_endpoint",
    "times_used": 1,
    "success_rate": 1.0,
    "available_for_reuse": true,
    "contributes_to_vessel": "metabob-analysis-api"
  }
}
```

## The Self-Improvement Loop

### How This Teaches You to Build Vessels

1. **Week 1: User of Mad Libs**
   - "I want rate limiting" → Pick from options → Fill blanks → Code created
   - Learning: What variables matter, what patterns work

2. **Week 2: Creator of Mad Libs**
   - "This worked well, let me save it as a template"
   - System extracts: variables, impulses, tasks
   - Learning: What makes a reusable activity

3. **Week 3: Vessel Designer**
   - "I notice we often need rate limiting... let me create a vessel"
   - Bundle related activities (rate limiting, caching, auth)
   - Add lifecycle hooks (startup, shutdown)
   - Learning: What makes a coherent vessel

4. **Week 4: Vessel Architect**
   - "Multiple vessels need rate limiting... let me extract common capabilities"
   - Create shared impulse types
   - Define resolver contracts
   - Learning: How vessels compose and share capabilities

### Mad Libs Difficulty Levels

**Level 1: Fill-in-the-blanks (Beginner)**
```
Template: "Add rate limiting"
Blanks: [ endpoint, max_requests ]
Reference: Provided automatically
```

**Level 2: Choose-your-references (Intermediate)**
```
Template: "Add resilience"
Blanks: [ endpoint, strategy: [rate_limit, circuit_breaker, timeout] ]
Reference: You pick from word bank
```

**Level 3: Create-the-template (Advanced)**
```
Goal: "Add resilience"
You identify: What are the blanks? What references? What tasks?
System helps: Suggests based on similar patterns
```

**Level 4: Design-the-vessel (Expert)**
```
Goal: "Create a resilience vessel"
You design: Activities, impulses, lifecycle, dependencies
System validates: Does it follow foundation principles?
```

## New Dashboard: Mad Libs Development View

```typescript
// repos/activity-dashboard/src/components/MadLibsDevelopment.tsx

export function MadLibsDevelopment() {
  return (
    <div className="madlibs-development">
      <h2>Mad Libs Development</h2>

      {/* Step 1: What do you want to create? */}
      <section className="goal-input">
        <input
          placeholder="I want to create..."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <button onClick={findSimilar}>Find Similar</button>
      </section>

      {/* Step 2: Word Bank (Similar Implementations) */}
      {similar.length > 0 && (
        <section className="word-bank">
          <h3>Word Bank: Choose Your Reference</h3>
          {similar.map((comp) => (
            <div key={comp.id} className="reference-option">
              <input
                type="radio"
                name="reference"
                value={comp.id}
                onChange={() => setReference(comp)}
              />
              <div className="reference-details">
                <strong>{comp.name}</strong>
                <p>{comp.intent.description}</p>
                <div className="stats">
                  <span>✓ Success: {comp.success_rate * 100}%</span>
                  <span>🔁 Used: {comp.times_referenced}x</span>
                  <span>📈 Confidence: {comp.intent.confidence * 100}%</span>
                </div>
                <details>
                  <summary>Preview Variables</summary>
                  <ul>
                    {comp.variables.map((v) => (
                      <li key={v.name}>{v.name}: {v.description}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Step 3: Fill in the Blanks */}
      {reference && (
        <section className="fill-blanks">
          <h3>Fill in the Blanks</h3>
          <form>
            {reference.variables.map((variable) => (
              <div key={variable.name} className="blank">
                <label>{variable.name}</label>
                <p className="hint">{variable.description}</p>
                {variable.type === 'enum' ? (
                  <select
                    value={blanks[variable.name]}
                    onChange={(e) => setBlanks({...blanks, [variable.name]: e.target.value})}
                  >
                    {variable.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={blanks[variable.name] || ''}
                    onChange={(e) => setBlanks({...blanks, [variable.name]: e.target.value})}
                    placeholder={variable.example}
                  />
                )}
              </div>
            ))}
          </form>
        </section>
      )}

      {/* Step 4: Preview Generated Activity */}
      {blanks && (
        <section className="preview">
          <h3>Preview: What Will Be Created</h3>
          <div className="activity-preview">
            <h4>{generatedActivity.name}</h4>
            <ol>
              {generatedActivity.tasks.map((task) => (
                <li key={task.id}>{task.description}</li>
              ))}
            </ol>
            <div className="files">
              <strong>Files to be modified/created:</strong>
              <ul>
                {generatedActivity.predicted_changes.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
            <button onClick={execute}>Execute Activity</button>
          </div>
        </section>
      )}

      {/* Step 5: Learning Report */}
      {executed && (
        <section className="learning-report">
          <h3>🎓 What You Learned</h3>

          <div className="vessel-concepts">
            <h4>Vessel Concepts</h4>
            <ul>
              {learningReport.vessel_concepts.map((concept, i) => (
                <li key={i}>{concept}</li>
              ))}
            </ul>
          </div>

          <div className="blanks-identified">
            <h4>Blanks You Identified</h4>
            <ul>
              {learningReport.blanks_you_identified.map((blank, i) => (
                <li key={i}>{blank}</li>
              ))}
            </ul>
          </div>

          <div className="patterns-learned">
            <h4>Patterns You Learned</h4>
            <ul>
              {learningReport.patterns_you_learned.map((pattern, i) => (
                <li key={i}>{pattern}</li>
              ))}
            </ul>
          </div>

          <div className="your-contribution">
            <h4>Your Contribution to the Vessel</h4>
            <p>
              Template "<strong>{learningReport.your_template_is_now.id}</strong>" is now available for reuse!
            </p>
            <p>
              Success rate: {learningReport.your_template_is_now.success_rate * 100}%<br/>
              Times used: {learningReport.your_template_is_now.times_used}
            </p>
          </div>

          <button onClick={saveAsTemplate}>Save as Reusable Template</button>
          <button onClick={startAgain}>Create Something Else</button>
        </section>
      )}
    </div>
  );
}
```

## Progressive Revelation of Vessel Concepts

### Session 1: Just Fill Blanks
```
You: "I want rate limiting"
System: "Pick one: A, B, or C"
You: "A"
System: "Fill in: endpoint, max_requests"
You: "/api/search, 100"
System: "Done! ✓"
```
**Learning**: None yet, just experiencing the flow

### Session 5: Notice the Pattern
```
System: "You've created rate limiting 5 times. Notice anything?"
You: "I always use Redis and 60s window"
System: "Want to save those as defaults?"
```
**Learning**: Variables can have defaults, patterns emerge from usage

### Session 10: Suggest a Template
```
System: "You've created 10 rate limiters. Want to make this a template?"
You: "Yes"
System: "What should the blanks be?"
You: "endpoint (required), max_requests (default: 100), window (default: 60s)"
System: "Great! Now others can use your template"
```
**Learning**: You just created an activity template (vessel capability)

### Session 20: Compose a Vessel
```
System: "You've created: rate limiting, caching, auth, logging. These often go together. Want to bundle them?"
You: "Yes, make a 'resilient-api' vessel"
System: "What dependencies? What lifecycle?"
You: "Needs Redis, starts rate limiter on boot"
System: "You've created a vessel! 🎉"
```
**Learning**: Vessels are bundles of related activities with lifecycle

### Session 50: You're a Vessel Architect
```
You: "I want to create a vessel for..."
System: "I'll help you identify the blanks and references"
You: Design the full vessel from scratch
System: Validates against foundation principles
```
**Learning**: You understand impulse-activity foundation deeply

## Implementation: Mad Libs Layer on Top of Existing System

### What Already Works
- ✅ Activities have variables
- ✅ Impulses provide context
- ✅ Thompson Sampling ranks options
- ✅ Ribosome extracts patterns
- ✅ Dashboard shows metrics

### What to Add

**1. Variable Extraction from Successful Activities**
```typescript
// After successful execution, identify what was parameterized
const variables = extractVariables(executionTrace);
// { endpoint: "/api/search", max_requests: 100, window: "60s" }
```

**2. Reference Component Discovery**
```typescript
// What impulses were used?
const references = executionTrace.impulses.map(imp => imp.pointer);
// [{ type: "codeComponent", component_id: "rate-limiter.ts::RateLimiter" }]
```

**3. Mad Libs Metadata on Activities**
```typescript
interface MadLibsMetadata {
  difficulty_level: 1 | 2 | 3 | 4;  // Fill | Choose | Create | Design
  blanks: Variable[];               // What to fill in
  word_bank: ComponentMetadata[];   // Reference options
  learning_objectives: string[];    // What this teaches
  vessel_contribution: string;      // What capability this adds
}
```

**4. Learning Report Generation**
```typescript
// After execution, generate pedagogical report
const report = generateLearningReport(executionTrace, madlibsMetadata);
// Shows: what you created, what you learned, what you contributed
```

## Success Metrics

**Development Velocity:**
- Time from "I want X" to "X is working" (target: <5 minutes)
- % of development that uses Mad Libs vs. from-scratch (target: >80%)

**Learning Progression:**
- % of users who create their own templates after 10 sessions (target: >60%)
- % of users who understand impulse-activity model after 20 sessions (target: >80%)
- % of users who create vessels after 50 sessions (target: >40%)

**Template Quality:**
- Success rate of user-created templates (target: >70%)
- Reuse rate of user-created templates (target: >3 uses per template)
- Coverage of codebase by templates (target: >60% of development tasks)

## The Ultimate Goal

**Everyone becomes a vessel creator** because:
1. They experience what good templates feel like (Mad Libs)
2. They see patterns in their own work (repetition)
3. They're guided to extract those patterns (system suggestions)
4. They understand the structure deeply (progressive revelation)
5. They can create vessels from first principles (expertise)

**Development becomes:**
- Fast (pick from options, fill blanks)
- Consistent (proven patterns)
- Measurable (success rates guide choices)
- Educational (learning reports after each session)
- Self-improving (your templates help others)

**Vessel creation becomes:**
- Natural (you've done it many times via Mad Libs)
- Guided (system teaches the concepts progressively)
- Validated (foundation principles checked automatically)
- Rewarding (see your contributions used by others)
