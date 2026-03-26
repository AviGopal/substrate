# Library Learning System

## Overview

The Library Learning System enables DevBob to understand external "vessels" (libraries, tools, frameworks, cloud providers) and convert their patterns into executable activities. This meta-learning capability allows DevBob to learn from deployment tools, cloud providers, and other infrastructure while building a library of reusable activities.

## Concept: Vessels

A **vessel** is any external codebase, library, tool, or system that we want to understand and integrate with:

- **Deployment Tools**: Helm, Terraform, Kubernetes, Docker Compose
- **Cloud Providers**: AWS SDKs, GCP libraries, Azure tools
- **Frameworks**: Express, Django, Rails, Spring Boot
- **CLI Tools**: kubectl, aws-cli, gh, gcloud
- **Build Systems**: Webpack, Gradle, Maven, Make

By analyzing vessels, we extract their patterns and convert them into activities that perform functional state transitions.

## Architecture

```
┌─────────────────────┐
│  External Vessel    │
│ (Library/Tool/SDK)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  analyze-library-   │
│    structure        │ ← Phase 1: Understanding
│                     │
│  • Directory map    │
│  • API surface      │
│  • Patterns         │
│  • Workflows        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  generate-library-  │
│    activities       │ ← Phase 2: Conversion
│                     │
│  • Design specs     │
│  • Generate JSON    │
│  • Register         │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Executable         │
│  Activities         │ ← Phase 3: Usage
│                     │
│  • Parameterized    │
│  • Composable       │
│  • Validated        │
└─────────────────────┘
```

## Components

### 1. analyze-library-structure

**Purpose**: Systematically analyze an external vessel to understand its structure, patterns, and capabilities.

**Inputs**:
- `library_path`: Path to the library/codebase
- `library_name`: Name of the library (e.g., "helm", "terraform")
- `library_type`: Type classification (deployment-tool, cloud-provider, etc.)
- `analysis_depth`: How deep to analyze (shallow/medium/deep)

**Outputs**:
- `analysis/[library]-structure.md`: Directory structure and organization
- `analysis/[library]-api.md`: API surface and interfaces
- `analysis/[library]-patterns.md`: Identified patterns and workflows
- `analysis/[library]-SUMMARY.md`: Comprehensive summary

**Process**:
1. **Discover Structure**: Map directory tree, find entry points, identify components
2. **Analyze API**: Understand CLI commands, programmatic APIs, integration points
3. **Extract Patterns**: Identify workflows, state transitions, reusable patterns
4. **Create Summary**: Consolidate findings into actionable roadmap

**Example Usage**:
```bash
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/home/avi/documents/work/exp-repo/metabob-devbob/repos/platform",
    library_name: "helm",
    library_type: "deployment-tool",
    analysis_depth: "medium"
  },
  reason: "Understand Helm deployment patterns to create activities for managing Helm releases"
})
```

### 2. generate-library-activities

**Purpose**: Convert library patterns and workflows into executable activity templates.

**Inputs**:
- `library_name`: Name of the analyzed library
- `activity_count`: Number of activities to generate (1-5 recommended)
- `registration_path`: Where to save/register the activities
- `register_with_metabob`: Whether to register with Metabob backend

**Outputs**:
- `activities/[library]-activity-specs.md`: Detailed specifications for each activity
- `activities/[library]-[action].json`: Activity template JSON files
- `activities/[library]-INDEX.md`: Index of generated activities
- `activities/[library]-USAGE.md`: Usage documentation
- `activities/[library]-VALIDATION.md`: Validation report

**Process**:
1. **Design Templates**: Read analysis, select workflows, design specifications
2. **Generate JSON**: Convert specs to properly formatted activity JSON
3. **Validate & Register**: Validate JSON, register templates, create documentation

**Example Usage**:
```bash
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm",
    activity_count: 3,
    registration_path: "templates/library-learning",
    register_with_metabob: true
  },
  reason: "Generate activities for Helm operations: install chart, upgrade release, rollback"
})
```

## Workflow

### Complete Library Learning Flow

```bash
# Phase 1: Analyze the library
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/path/to/library",
    library_name: "terraform",
    library_type: "deployment-tool",
    analysis_depth: "medium"
  },
  reason: "Learn Terraform patterns for infrastructure provisioning"
})

# Phase 2: Generate activities from patterns
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "terraform",
    activity_count: 3,
    registration_path: "templates/library-learning",
    register_with_metabob: true
  },
  reason: "Create activities for Terraform init, plan, apply workflows"
})

# Phase 3: Use generated activities
activity({
  templateId: "terraform-apply-infrastructure",
  variables: {
    workspace: "production",
    auto_approve: false,
    target: "aws_instance.app"
  },
  reason: "Deploy infrastructure changes to production"
})
```

## Use Cases

### 1. Deployment Tool Integration

**Scenario**: You need to automate Helm chart deployments across multiple environments.

**Approach**:
1. Analyze Helm CLI and chart structure
2. Generate activities: `helm-install-chart`, `helm-upgrade-release`, `helm-rollback`
3. Compose activities for full deployment workflows

**Benefit**: Reusable, validated deployment activities with proper error handling

### 2. Cloud Provider Patterns

**Scenario**: You want to extract AWS SDK patterns for resource management.

**Approach**:
1. Analyze AWS SDK (boto3, aws-sdk-js)
2. Identify common patterns: create, update, delete, list resources
3. Generate activities for each AWS service (EC2, S3, RDS, etc.)

**Benefit**: Consistent cloud operations with validation and state tracking

### 3. Framework Understanding

**Scenario**: You need to understand how a web framework structures applications.

**Approach**:
1. Analyze framework structure (Express, Django, etc.)
2. Extract patterns: routing, middleware, authentication, database
3. Generate activities for adding features following framework conventions

**Benefit**: Framework-aware feature additions that follow best practices

### 4. Build Tool Integration

**Scenario**: You want to automate build and deployment pipelines.

**Approach**:
1. Analyze build tools (Webpack, Gradle, Make)
2. Extract build workflows and optimization patterns
3. Generate activities for build, test, deploy sequences

**Benefit**: Optimized build pipelines with proper dependency management

## Multi-Instance Coordination

The library learning system is designed to work with multi-instance coordination:

- **Shared Analysis Cache**: Multiple instances can share library analysis results via Redis
- **Parallel Activity Generation**: Different instances can generate different activities simultaneously
- **Distributed Library Learning**: Large codebases can be analyzed in parallel
- **Activity Registry Sync**: Generated activities are shared across all instances

See [MULTI_INSTANCE_COORDINATION_REVIEW.md](./MULTI_INSTANCE_COORDINATION_REVIEW.md) for details.

## Best Practices

### Analysis Phase

✅ **DO**:
- Start with shallow analysis to get quick overview
- Use medium depth for most libraries
- Deep analysis only for critical/complex systems
- Focus on well-documented, stable libraries first

❌ **DON'T**:
- Analyze massive monorepos without scoping
- Skip documentation review
- Ignore examples and tests (they show usage patterns)
- Analyze deprecated or unmaintained libraries

### Activity Generation Phase

✅ **DO**:
- Start with 2-3 high-value activities
- Focus on clear state transitions
- Include comprehensive validation
- Provide detailed error handling
- Make activities composable

❌ **DON'T**:
- Generate too many similar activities
- Create activities for trivial operations
- Skip validation and error handling
- Make activities too rigid (parameterize!)
- Ignore dependencies between activities

### Usage Phase

✅ **DO**:
- Test generated activities thoroughly
- Compose activities for complex workflows
- Share successful activities with team
- Iterate based on usage feedback
- Document common patterns

❌ **DON'T**:
- Use untested activities in production
- Bypass activity validation
- Ignore activity failures
- Duplicate functionality across activities
- Forget to annotate key design decisions

## Extension Points

### Custom Analysis Strategies

You can extend the analysis phase with custom strategies:

```bash
# Add custom analysis step
{
  "task_id": "analyze-security-patterns",
  "description": "Analyze security and authentication patterns",
  "dependencies": ["analyze-api-surface"],
  # ... custom analysis logic
}
```

### Custom Activity Categories

Generate activities in different categories:

```javascript
{
  category: "security",  // For security-focused activities
  category: "monitoring", // For observability activities
  category: "testing",    // For test generation activities
}
```

### Integration with Metabob

The system integrates with Metabob's code quality analysis:

- **Pattern Quality**: Metabob analyzes extracted patterns for issues
- **Activity Validation**: Generated activities checked for quality
- **Usage Tracking**: Activity success rates tracked via Metabob backend
- **Continuous Learning**: System learns which patterns produce best activities

## Future Enhancements

### Planned Features

1. **Incremental Learning**: Update analysis as libraries evolve
2. **Pattern Diffing**: Compare patterns across library versions
3. **Cross-Library Patterns**: Identify patterns common across multiple libraries
4. **Auto-Composition**: Automatically suggest activity compositions
5. **Quality Scoring**: Rank patterns by reusability and reliability
6. **Interactive Exploration**: UI for exploring library analysis
7. **Multi-Vessel Coordination**: Coordinate learning across multiple vessels
8. **Pattern Marketplace**: Share patterns and activities across teams

### Research Directions

- **LLM-Based Pattern Mining**: Use larger models to extract subtle patterns
- **Semantic Code Search**: Find similar patterns across different codebases
- **Transfer Learning**: Apply patterns from one domain to another
- **Active Learning**: Prioritize analysis based on usage frequency

## Examples

### Example 1: Helm Learning

```bash
# Analyze Helm
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/usr/local/bin/helm",  # Or helm chart repo
    library_name: "helm",
    library_type: "deployment-tool"
  },
  reason: "Learn Helm chart management patterns"
})

# Generate activities
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm",
    activity_count: 4
  },
  reason: "Create activities for: install, upgrade, rollback, test"
})

# Use generated activity
activity({
  templateId: "helm-install-chart",
  variables: {
    chart: "./my-app",
    release: "my-app-prod",
    namespace: "production",
    values_file: "values-prod.yaml"
  },
  reason: "Deploy my-app to production"
})
```

### Example 2: Terraform Learning

```bash
# Analyze Terraform
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/workspace/terraform-configs",
    library_name: "terraform",
    library_type: "deployment-tool"
  },
  reason: "Extract Terraform workflow patterns"
})

# Generate activities
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "terraform",
    activity_count: 5
  },
  reason: "Create activities for: init, plan, apply, destroy, import"
})

# Use in workflow
activity({ templateId: "terraform-plan", variables: {...} })
# Review plan
activity({ templateId: "terraform-apply", variables: {...} })
```

### Example 3: AWS SDK Learning

```bash
# Analyze AWS SDK
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/usr/local/lib/python3.9/site-packages/boto3",
    library_name: "boto3",
    library_type: "cloud-provider"
  },
  reason: "Learn AWS resource management patterns"
})

# Generate activities for EC2
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "boto3-ec2",
    activity_count: 3
  },
  reason: "Create EC2 management activities"
})
```

## Troubleshooting

### Analysis Fails

**Problem**: Analysis activity fails to complete

**Solutions**:
- Check library path is correct and accessible
- Ensure library has standard structure (src/, docs/, etc.)
- Try shallow analysis first
- Check disk space for analysis outputs

### Generated Activities Don't Work

**Problem**: Generated activities fail when executed

**Solutions**:
- Review validation report (activities/[lib]-VALIDATION.md)
- Check variable types and requirements
- Ensure library dependencies are installed
- Test activities with simple examples first
- Review task dependencies for circular references

### Activity Registration Fails

**Problem**: Cannot register generated activities

**Solutions**:
- Validate JSON syntax with `jq`
- Check activity_id is unique
- Ensure registration path exists and is writable
- Verify Metabob backend connection if using remote registration

## Related Documentation

- [DevBob Vessel Architecture](./DEVBOB_VESSEL_ARCHITECTURE.md) - Vessel concept and multi-agent coordination
- [Multi-Instance Coordination](./MULTI_INSTANCE_COORDINATION_REVIEW.md) - Coordinating multiple DevBob instances
- Activity Template Schema - JSON schema for activity templates
- Activity System Guide - How to create and use activities

## Contributing

### Adding New Analysis Strategies

To add custom analysis for specific library types:

1. Create new task in `analyze-library-structure.json`
2. Add library-type-specific logic
3. Update summary generation to include new analysis
4. Test with representative libraries

### Improving Activity Generation

To improve activity generation quality:

1. Analyze successful activities for patterns
2. Extract common prompt structures
3. Update generation templates
4. Add quality checks
5. Test with diverse libraries

---

**Status**: Active Development
**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Maintainer**: DevBob Meta-Learning Team
