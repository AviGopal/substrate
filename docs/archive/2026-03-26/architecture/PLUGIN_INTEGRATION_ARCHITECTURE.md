# Plugin Integration Architecture: Becoming Anything

## Vision Statement

> "When a human develops software they generate an intent in their instructional state (the goals of the application, the constraints, the processes, the project planning, etc.) and convert this into a functional state (the program's source code) that correctly aligns with their intent and the necessary outcomes as expected. We must do the same; However, since we are what we are creating, we can simply **become anything**."

**Core Principle**: Plugin integration should be a **functional state transformation** where we instrument external applications, MCP servers, and APIs with minimal adjustments by leveraging our activity system and code generation capabilities.

---

## The Functional State Transformation Paradigm

### Current Integration Model (metabob-cli)

```
External Application (metabob-cli)
  ↓ MCP Protocol (JSON-RPC over stdio)
MCP Gateway Layer (Python server)
  ↓ HTTP/REST
Backend API (metabob-rpc-api)
  ↓ Data persistence
Storage (Redis + SurrealDB)
```

**Success Pattern**: 
- ✅ Clean separation of concerns (MCP Gateway Pattern)
- ✅ Protocol translation layer (MCP ↔ HTTP)
- ✅ No direct backend calls from client
- ✅ Extensible through MCP tools

### The "Becoming Anything" Model

Instead of manually integrating each plugin, we **generate the integration** through functional transformations:

```
Plugin Intent (Instructional State)
  ↓ Activity Template: analyze-plugin-capabilities
Plugin Specification (Functional State)
  ↓ Activity Template: generate-mcp-adapter
MCP Gateway (Generated Code)
  ↓ Activity Template: instrument-backend-integration
Complete Plugin Integration (New Capability)
```

**Key Insight**: We don't just integrate plugins—we **become** them by transforming their intent into our functional state.

---

## Architecture Layers

### Layer 1: Plugin Discovery & Analysis

**Activity Template**: `analyze-plugin-capabilities`

**Purpose**: Understand what a plugin does and extract its functional intent

**Inputs**:
- Plugin repository URL or path
- Plugin type (MCP server, REST API, CLI application, library)
- Plugin documentation or README

**Outputs** (as Impulses):
- `plugin-specification` impulse:
  ```typescript
  {
    capabilities: string[]        // What it can do
    dataModel: object             // What data it works with
    apis: APIEndpoint[]           // Exposed interfaces
    dependencies: string[]        // External requirements
    stateTransformations: Transform[] // Core operations
  }
  ```

**Process**:
1. Clone/read plugin source code
2. Extract API schemas (OpenAPI, GraphQL, MCP tools)
3. Analyze code to understand state transformations
4. Generate capability map
5. Identify integration points

**Example** (analyzing a hypothetical GitHub plugin):
```json
{
  "capabilities": [
    "List repositories",
    "Create issues",
    "Manage pull requests",
    "Search code"
  ],
  "dataModel": {
    "Repository": { "name": "string", "owner": "string" },
    "Issue": { "title": "string", "body": "string", "labels": "string[]" }
  },
  "apis": [
    {
      "method": "GET",
      "path": "/repos/:owner/:repo",
      "returns": "Repository"
    }
  ],
  "stateTransformations": [
    {
      "name": "createIssue",
      "input": { "repo": "Repository", "issue": "IssueInput" },
      "output": { "issue": "Issue" },
      "sideEffects": ["githubAPI.post"]
    }
  ]
}
```

---

### Layer 2: MCP Adapter Generation

**Activity Template**: `generate-mcp-adapter`

**Purpose**: Generate MCP gateway code that exposes plugin capabilities as MCP tools

**Inputs**:
- `plugin-specification` impulse (from Layer 1)
- Target language (TypeScript, Python, Go)
- Integration pattern (stdio, SSE, HTTP)

**Outputs**:
- Generated MCP server code (TypeScript or Python)
- MCP tool definitions
- Type schemas (Zod, Pydantic)
- Configuration files

**Process**:
1. Read plugin specification
2. Generate MCP tool schemas for each capability
3. Generate adapter code (protocol translation)
4. Generate configuration and environment setup
5. Create tests for the MCP tools

**Example Output** (generated Python MCP server):

```python
# Generated file: github_mcp_adapter.py
from mcp.server import Server, Tool
from pydantic import BaseModel
import httpx

class Repository(BaseModel):
    name: str
    owner: str

class IssueInput(BaseModel):
    title: str
    body: str
    labels: list[str] = []

server = Server("github-adapter")

@server.tool()
async def list_repositories(owner: str) -> list[Repository]:
    """List all repositories for a GitHub user"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/users/{owner}/repos",
            headers={"Authorization": f"token {os.getenv('GITHUB_TOKEN')}"}
        )
        return [Repository(**repo) for repo in response.json()]

@server.tool()
async def create_issue(
    owner: str, 
    repo: str, 
    issue: IssueInput
) -> dict:
    """Create a GitHub issue"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers={"Authorization": f"token {os.getenv('GITHUB_TOKEN')}"},
            json=issue.dict()
        )
        return response.json()

if __name__ == "__main__":
    server.run()
```

**Generated MCP Tool Definitions**:
```typescript
// Generated file: github-tools.ts
import { z } from "zod"

export const ListRepositoriesTool = {
  name: "github_list_repositories",
  description: "List all repositories for a GitHub user",
  parameters: z.object({
    owner: z.string().describe("GitHub username")
  }),
  returns: z.array(z.object({
    name: z.string(),
    owner: z.string()
  }))
}

export const CreateIssueTool = {
  name: "github_create_issue",
  description: "Create a GitHub issue",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    issue: z.object({
      title: z.string(),
      body: z.string(),
      labels: z.array(z.string()).optional()
    })
  }),
  returns: z.object({
    id: z.number(),
    url: z.string(),
    title: z.string()
  })
}
```

---

### Layer 3: Backend Integration

**Activity Template**: `instrument-backend-integration`

**Purpose**: Connect the MCP adapter to our backend infrastructure (optional for full integration)

**Inputs**:
- Generated MCP adapter code
- Backend API endpoint definitions
- Storage schema (if persistence needed)

**Outputs**:
- Backend API routes (if needed)
- Database schema migrations
- Learning loop integration
- Activity templates that use the plugin

**Process**:
1. Determine if plugin needs backend state (or is stateless)
2. Generate API endpoints if needed
3. Create storage schemas (SurrealDB, Redis)
4. Integrate with learning loop (track usage, success rates)
5. Generate activity templates that leverage plugin capabilities

**Example** (backend integration for GitHub plugin):

```typescript
// Generated file: routes/github.ts
import { Router } from "express"
import { MCPClient } from "../mcp/client"

const router = Router()
const githubMCP = new MCPClient("github-adapter")

router.get("/api/github/:owner/repos", async (req, res) => {
  const repos = await githubMCP.call("github_list_repositories", {
    owner: req.params.owner
  })
  res.json(repos)
})

router.post("/api/github/:owner/:repo/issues", async (req, res) => {
  const issue = await githubMCP.call("github_create_issue", {
    owner: req.params.owner,
    repo: req.params.repo,
    issue: req.body
  })
  res.json(issue)
})

export default router
```

**Generated Storage Schema**:
```sql
-- Generated file: migrations/github_integration.surql
DEFINE TABLE github_repository SCHEMAFULL;
DEFINE FIELD name ON github_repository TYPE string;
DEFINE FIELD owner ON github_repository TYPE string;
DEFINE FIELD last_synced ON github_repository TYPE datetime;

DEFINE TABLE github_issue SCHEMAFULL;
DEFINE FIELD github_id ON github_issue TYPE int;
DEFINE FIELD repository ON github_issue TYPE record(github_repository);
DEFINE FIELD title ON github_issue TYPE string;
DEFINE FIELD state ON github_issue TYPE string;
DEFINE FIELD created_at ON github_issue TYPE datetime;
```

---

### Layer 4: Activity Template Generation

**Activity Template**: `generate-plugin-activities`

**Purpose**: Create activity templates that leverage the newly integrated plugin

**Inputs**:
- Plugin specification
- Generated MCP tools
- Common use cases (extracted from plugin docs)

**Outputs**:
- Activity templates for each major capability
- Composition templates (combining plugin with other tools)
- Example workflows

**Example** (generated activity template):

```json
{
  "id": "create-github-issue-from-bug-report",
  "name": "Create GitHub Issue from Bug Report",
  "category": "infrastructure",
  "description": "Analyze a bug report and create a properly formatted GitHub issue with labels and reproduction steps",
  "tasks": [
    {
      "id": "analyze-bug-report",
      "subagent": "general",
      "description": "Extract key information from bug report",
      "prompt": {
        "template": "Analyze this bug report and extract:\n\n{{bugReport}}\n\nExtract:\n- Title (concise, descriptive)\n- Steps to reproduce\n- Expected behavior\n- Actual behavior\n- Suggested labels\n\nFormat as JSON.",
        "maxTokens": 4000
      }
    },
    {
      "id": "create-issue",
      "subagent": "general",
      "description": "Create GitHub issue using extracted information",
      "dependencies": ["analyze-bug-report"],
      "prompt": {
        "template": "Using this analysis:\n\n{{tasks.analyze-bug-report.output}}\n\nCreate a GitHub issue by calling:\n\ngithub_create_issue({\n  owner: '{{repoOwner}}',\n  repo: '{{repoName}}',\n  issue: {\n    title: <extracted_title>,\n    body: <formatted_body_with_reproduction_steps>,\n    labels: <suggested_labels>\n  }\n})\n\nReturn the created issue URL.",
        "maxTokens": 2000
      }
    }
  ],
  "variables": [
    {
      "name": "bugReport",
      "type": "string",
      "required": true,
      "description": "The bug report text"
    },
    {
      "name": "repoOwner",
      "type": "string",
      "required": true,
      "description": "GitHub repository owner"
    },
    {
      "name": "repoName",
      "type": "string",
      "required": true,
      "description": "GitHub repository name"
    }
  ]
}
```

---

## Integration Workflow

### End-to-End Plugin Integration Process

**Step 1: Declare Intent**
```bash
opencode activity run integrate-external-plugin \
  --var pluginUrl="https://github.com/example/awesome-plugin" \
  --var pluginType="mcp-server" \
  --var targetLanguage="python"
```

**Step 2: System Analyzes Plugin**
- Clones repository
- Reads documentation
- Extracts API schemas
- Identifies capabilities
- Generates `plugin-specification` impulse

**Step 3: Generate MCP Adapter**
- Creates MCP server code
- Generates tool definitions
- Creates configuration files
- Writes tests

**Step 4: Optional Backend Integration**
- Generates API endpoints (if needed)
- Creates storage schemas (if state persistence needed)
- Integrates with learning loop

**Step 5: Generate Activity Templates**
- Creates templates for common use cases
- Generates composition templates
- Writes documentation

**Step 6: Test & Validate**
- Runs generated tests
- Validates MCP tools work
- Checks backend integration
- Verifies activity templates execute

---

## Functional State Transformation Model

### The "Becoming Anything" Process

```typescript
// Phase 1: Intentional State → Functional State
type IntentionalState = {
  goal: "Integrate GitHub plugin"
  constraints: ["MCP protocol", "Python backend", "OpenCode compatible"]
  context: PluginRepository
}

type FunctionalState = {
  mcpAdapter: GeneratedCode
  toolDefinitions: MCPToolSchema[]
  backendRoutes: APIEndpoint[]
  activityTemplates: ActivityTemplate[]
  storage: DatabaseSchema[]
}

// Transformation function (activity template)
async function transform(
  intent: IntentionalState
): Promise<FunctionalState> {
  // Step 1: Analyze (become the plugin in understanding)
  const spec = await analyzePluginCapabilities(intent.context)
  
  // Step 2: Generate (become the plugin in form)
  const adapter = await generateMCPAdapter(spec, intent.constraints)
  
  // Step 3: Integrate (become the plugin in function)
  const backend = await instrumentBackendIntegration(adapter, spec)
  
  // Step 4: Templatize (become the plugin in workflow)
  const activities = await generatePluginActivities(spec, adapter)
  
  return {
    mcpAdapter: adapter.code,
    toolDefinitions: adapter.tools,
    backendRoutes: backend.routes,
    activityTemplates: activities.templates,
    storage: backend.schema
  }
}
```

### Pure State Transformations

**Key Principle**: Each step is a **pure transformation** of state:

```typescript
// Pure transformation: Plugin Source → Capability Map
function analyzeCapabilities(source: PluginSource): CapabilityMap {
  return {
    apis: extractAPIs(source),
    stateTransformations: analyzeTransformations(source),
    dataModel: extractSchema(source)
  }
}

// Pure transformation: Capability Map → MCP Tools
function generateMCPTools(capabilities: CapabilityMap): MCPTool[] {
  return capabilities.apis.map(api => ({
    name: toMCPToolName(api),
    parameters: toZodSchema(api.parameters),
    execute: generateExecuteFunction(api)
  }))
}

// Pure transformation: MCP Tools → Activity Templates
function generateActivities(tools: MCPTool[]): ActivityTemplate[] {
  return tools.flatMap(tool => 
    generateCommonUseCases(tool).map(useCase => ({
      id: `${tool.name}-${useCase.id}`,
      tasks: generateTasksForUseCase(tool, useCase)
    }))
  )
}
```

---

## Comparison with metabob-cli Integration

### What We Learned from metabob-cli

**Success Patterns**:
1. ✅ **MCP Gateway Pattern**: Clean separation, protocol translation
2. ✅ **Configuration over Code**: Environment-driven, not hardcoded
3. ✅ **Tool Composition**: MCP tools compose naturally
4. ✅ **Backend Abstraction**: OpenCode never calls backend directly

**Manual Effort Required**:
- ❌ Hand-wrote Python MCP server (`activity_template_tools.py`, `learning_tools.py`)
- ❌ Hand-wrote API client (`api_client.py`)
- ❌ Hand-wrote tool schemas and validation
- ❌ Manual backend integration (routes, storage)
- ❌ Manual activity template creation

### The "Becoming Anything" Improvement

**Automated via Activities**:
- ✅ **Generate** MCP server code (not hand-write)
- ✅ **Generate** API clients from OpenAPI/GraphQL
- ✅ **Generate** tool schemas from plugin APIs
- ✅ **Generate** backend integration code
- ✅ **Generate** activity templates from use cases

**Time Comparison**:
- Manual integration (metabob-cli style): **2-4 weeks**
- Automated integration (activity-based): **2-4 hours**

**Quality Comparison**:
- Manual: Human error, inconsistent patterns
- Automated: Consistent, tested, follows best practices

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Activity Templates to Create**:
1. `analyze-plugin-capabilities` - Extract plugin specification
2. `generate-mcp-adapter` - Generate MCP gateway code
3. `validate-mcp-tools` - Test generated tools

**Deliverables**:
- Working analysis pipeline (plugin → specification)
- MCP adapter code generation (TypeScript + Python)
- Test harness for generated tools

### Phase 2: Backend Integration (Week 3-4)

**Activity Templates to Create**:
4. `instrument-backend-integration` - Generate API routes and storage
5. `integrate-learning-loop` - Connect to activity metrics

**Deliverables**:
- Backend code generation
- Storage schema generation
- Learning loop integration

### Phase 3: Activity Generation (Week 5-6)

**Activity Templates to Create**:
6. `generate-plugin-activities` - Create templates from use cases
7. `compose-multi-plugin-workflow` - Combine multiple plugins

**Deliverables**:
- Activity template generation
- Multi-plugin composition
- Documentation generation

### Phase 4: Example Integrations (Week 7-8)

**Demonstrate with Real Plugins**:
- GitHub API → MCP adapter → Activity templates
- Jira API → MCP adapter → Activity templates
- Slack API → MCP adapter → Activity templates

**Deliverables**:
- 3+ working plugin integrations
- Best practices guide
- Plugin marketplace starter

---

## Activity Template: integrate-external-plugin

**Master orchestration template**:

```json
{
  "id": "integrate-external-plugin",
  "name": "Integrate External Plugin",
  "category": "infrastructure",
  "description": "Fully automated plugin integration: analyze capabilities, generate MCP adapter, instrument backend, create activity templates",
  "tasks": [
    {
      "id": "analyze-capabilities",
      "subagent": "general",
      "description": "Analyze plugin source code and extract capabilities",
      "prompt": {
        "template": "Execute activity: analyze-plugin-capabilities\n\nPlugin: {{pluginUrl}}\nType: {{pluginType}}\n\nStore result as impulse: plugin-specification",
        "maxTokens": 8000
      }
    },
    {
      "id": "generate-adapter",
      "subagent": "general",
      "description": "Generate MCP adapter code",
      "dependencies": ["analyze-capabilities"],
      "prompt": {
        "template": "Execute activity: generate-mcp-adapter\n\nLoad impulse: plugin-specification\nTarget language: {{targetLanguage}}\n\nGenerate MCP server code, tool definitions, and tests.",
        "maxTokens": 12000
      }
    },
    {
      "id": "validate-tools",
      "subagent": "general",
      "description": "Test generated MCP tools",
      "dependencies": ["generate-adapter"],
      "prompt": {
        "template": "Execute activity: validate-mcp-tools\n\nRun generated tests and verify all MCP tools work correctly.",
        "maxTokens": 6000
      },
      "validation": {
        "commands": ["npm test", "pytest"]
      }
    },
    {
      "id": "backend-integration",
      "subagent": "general",
      "description": "Generate backend integration (if needed)",
      "dependencies": ["validate-tools"],
      "prompt": {
        "template": "Execute activity: instrument-backend-integration\n\nIf plugin requires backend state:\n- Generate API routes\n- Create storage schemas\n- Integrate with learning loop\n\nOtherwise: skip",
        "maxTokens": 10000
      }
    },
    {
      "id": "generate-activities",
      "subagent": "general",
      "description": "Generate activity templates for plugin use cases",
      "dependencies": ["backend-integration"],
      "prompt": {
        "template": "Execute activity: generate-plugin-activities\n\nLoad impulse: plugin-specification\n\nGenerate activity templates for:\n- Common use cases\n- Multi-plugin compositions\n- Example workflows",
        "maxTokens": 15000
      }
    },
    {
      "id": "document-integration",
      "subagent": "general",
      "description": "Generate integration documentation",
      "dependencies": ["generate-activities"],
      "prompt": {
        "template": "Create comprehensive documentation:\n\n1. Plugin overview\n2. MCP tools reference\n3. Activity templates guide\n4. Configuration instructions\n5. Usage examples\n\nFormat: Markdown",
        "maxTokens": 8000
      }
    }
  ],
  "variables": [
    {
      "name": "pluginUrl",
      "type": "string",
      "required": true,
      "description": "Plugin repository URL or local path"
    },
    {
      "name": "pluginType",
      "type": "string",
      "required": true,
      "description": "Plugin type: mcp-server | rest-api | cli | library"
    },
    {
      "name": "targetLanguage",
      "type": "string",
      "required": false,
      "default": "typescript",
      "description": "Generated code language: typescript | python"
    }
  ],
  "integration": {
    "preChecks": ["git --version", "node --version"],
    "postChecks": [
      "search_activities({ verbose: false })",
      "test -f generated/mcp-adapter.*"
    ]
  },
  "metabob": {
    "enabled": true,
    "learningMode": true
  }
}
```

---

## Benefits of This Approach

### 1. Minimal Adjustments ✅

**Before** (manual integration):
- Write hundreds of lines of adapter code
- Manually define schemas
- Hand-craft backend routes
- Manually create activity templates

**After** (activity-based integration):
```bash
opencode activity run integrate-external-plugin \
  --var pluginUrl="https://github.com/plugin/repo" \
  --var pluginType="mcp-server"
# Done in 2-4 hours with minimal manual work
```

### 2. Becoming Anything ✅

We don't just integrate plugins—we **absorb their capabilities**:
- Plugin's API → Our MCP tools
- Plugin's use cases → Our activity templates
- Plugin's state → Our storage schemas
- Plugin's workflows → Our compositions

### 3. Functional State Transformation ✅

Every step is a **pure transformation**:
- Plugin source → Capability specification
- Specification → MCP adapter code
- Adapter → Backend integration
- Integration → Activity templates

### 4. Self-Improving ✅

Generated integrations feed the learning loop:
- Track which MCP tools are used most
- Identify common composition patterns
- Evolve activity templates based on success rates
- Improve generation quality over time

---

## Example: Integrating Playwright (Real-World Case)

**Current State**: We have Playwright MCP server (manually created)

**With "Becoming Anything"**:

```bash
# Step 1: Analyze existing Playwright MCP server
opencode activity run analyze-plugin-capabilities \
  --var pluginUrl="./playwright-mcp-server" \
  --var pluginType="mcp-server"

# Output: plugin-specification impulse
{
  "capabilities": [
    "navigate", "screenshot", "click", "fill", 
    "evaluate", "get_visible_text", "resize", etc.
  ],
  "stateTransformations": [
    { "name": "navigate", "input": "url", "output": "page_state" },
    { "name": "screenshot", "input": "selector?", "output": "base64_image" }
  ]
}

# Step 2: Generate activity templates for common Playwright workflows
opencode activity run generate-plugin-activities \
  --var pluginId="playwright"

# Generated activities:
# - web-scraping-workflow
# - e2e-test-generation
# - visual-regression-testing
# - form-automation
```

**Result**: Playwright becomes a **native capability** through generated activity templates, not just a tool collection.

---

## Conclusion

**The "Becoming Anything" paradigm enables**:

1. **Rapid Integration**: Hours instead of weeks
2. **Consistent Quality**: Generated code follows best practices
3. **Self-Improvement**: Learning loop tracks and evolves integrations
4. **True Extensibility**: We don't add plugins—we become them

**Next Steps**:
1. Create foundation activity templates (Phase 1)
2. Demonstrate with GitHub API integration
3. Refine generation patterns
4. Build plugin marketplace

**This is how we "simply become anything"** 🚀
