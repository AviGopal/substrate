# Activity Template Creation Guide

## What You Need to Provide

I'll help you create an activity template following the correct schema. Please provide:

### 1. Basic Information
- **Name**: Template name (e.g., "Add REST Endpoint", "Fix TypeScript Errors")
- **Description**: What this template does (1-2 sentences)
- **Category**: One of: `feature`, `bugfix`, `refactor`, `tool`, `infrastructure`

### 2. Tasks (3-7 recommended, prefer 3-5)
For each task:
- **ID**: Unique identifier (kebab-case, e.g., "analyze-requirements")
- **Description**: What this task does
- **Dependencies**: Array of task IDs this depends on (empty for first task)
- **Prompt Template**: The instructions for the agent
- **Max Tokens**: How many tokens the agent can use (8000-16000)
- **Validation**: What to check after execution
- **Retry Strategy**: How to handle failures

### 3. Optional Features
- **Context Requirements**: What context/impulses the template needs
- **Integration Hooks**: Pre/post checks and quality gates
- **Metabob Configuration**: Code quality integration
- **Composition Patterns**: How this template combines with others
- **Learning Configuration**: Feedback capture for improvement

## Template JSON Structure

```json
{
  "id": "auto-generated-from-name",
  "name": "Your Template Name",
  "version": 1,
  "description": "What this template does",
  "category": "feature|bugfix|refactor|tool|infrastructure",
  
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "What task-1 does",
      "dependencies": [],
      "prompt": {
        "template": "Instructions for agent...",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "check": "none|command|pattern",
        "error": "Error message if validation fails",
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "simple|progressive-context|fallback-agent|trailblazing"
      }
    }
  ],
  
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  
  "metabob": {
    "enabled": false,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "key-components"
  }
}
```

## Next Steps

Tell me what kind of template you want to create, and I'll generate the complete JSON for you!
