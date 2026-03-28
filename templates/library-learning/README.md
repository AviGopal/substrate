# Library Learning Activities

This directory contains activity templates for the **Library Learning System** - a meta-learning framework that enables DevBob to understand external "vessels" (libraries, tools, frameworks) and convert their patterns into executable activities.

## Available Activities

### 1. analyze-library-structure

**Purpose**: Systematically analyze an external library/codebase to understand its structure, patterns, APIs, and integration points.

**Category**: infrastructure

**Use Cases**:
- Understanding deployment tools (Helm, Terraform, Kubernetes)
- Analyzing cloud provider SDKs (AWS, GCP, Azure)
- Learning framework patterns (Express, Django, Rails)
- Extracting CLI tool workflows (kubectl, gh, aws-cli)

**Outputs**:
- Directory structure and organization map
- API surface documentation (CLI and programmatic)
- Identified patterns and workflows
- Comprehensive summary with activity conversion roadmap

**Example**:
```bash
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/path/to/helm",
    library_name: "helm",
    library_type: "deployment-tool",
    analysis_depth: "medium"
  },
  reason: "Learn Helm deployment patterns to create reusable activities"
})
```

**Variables**:
- `library_path` (required): Path to the library/codebase
- `library_name` (required): Name of the library
- `library_type` (optional): Type classification (deployment-tool, cloud-provider, framework, cli-tool)
- `analysis_depth` (optional): Analysis depth (shallow, medium, deep) - default: medium
- `tree_depth` (optional): Depth for directory tree output - default: 3

---

### 2. generate-library-activities

**Purpose**: Convert library patterns and workflows into executable activity templates. Takes analysis from `analyze-library-structure` and generates parameterized, validated activity JSON templates.

**Category**: infrastructure

**Use Cases**:
- Converting Helm chart workflows into activities
- Creating Terraform infrastructure activities
- Generating AWS resource management activities
- Building framework-specific feature activities

**Outputs**:
- Activity specifications (detailed design)
- Activity JSON templates (executable)
- Activity index (catalog)
- Usage documentation
- Validation report

**Example**:
```bash
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm",
    activity_count: 3,
    registration_path: "templates/library-learning",
    register_with_metabob: true
  },
  reason: "Generate activities for Helm install, upgrade, and rollback workflows"
})
```

**Variables**:
- `library_name` (required): Name of the analyzed library
- `activity_count` (optional): Number of activities to generate (1-5 recommended) - default: 3
- `registration_path` (optional): Where to register templates - default: "templates/library-learning"
- `register_with_metabob` (optional): Register with Metabob backend - default: true
- `category` (optional): Activity category for search - default: "infrastructure"

---

## Complete Workflow

```bash
# Step 1: Analyze the library
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/usr/local/bin/helm",
    library_name: "helm",
    library_type: "deployment-tool",
    analysis_depth: "medium"
  },
  reason: "Understand Helm's structure and extract deployment patterns"
})

# Step 2: Generate activities from patterns
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm",
    activity_count: 4,
    registration_path: "templates/helm",
    register_with_metabob: true
  },
  reason: "Create activities for helm-install, helm-upgrade, helm-rollback, helm-test"
})

# Step 3: Use generated activities
activity({
  templateId: "helm-install-chart",
  variables: {
    chart: "./my-chart",
    release: "my-app",
    namespace: "production"
  },
  reason: "Deploy my-app to production using generated Helm activity"
})
```

## Analysis Output Structure

After running `analyze-library-structure`, you'll get:

```
analysis/
├── [library]-structure.md      # Directory map, entry points, organization
├── [library]-api.md             # CLI commands, APIs, integration points
├── [library]-patterns.md        # Workflows, patterns, state transitions
└── [library]-SUMMARY.md         # Comprehensive summary and roadmap
```

## Generated Activity Structure

After running `generate-library-activities`, you'll get:

```
activities/
├── [library]-activity-specs.md      # Detailed specifications
├── [library]-[action1].json         # Activity template 1
├── [library]-[action2].json         # Activity template 2
├── [library]-[action3].json         # Activity template 3
├── [library]-INDEX.md               # Activity catalog
├── [library]-USAGE.md               # Usage examples
└── [library]-VALIDATION.md          # Validation report
```

## Supported Library Types

The system is designed to work with various library types:

### Deployment Tools
- **Helm**: Chart management, releases, rollbacks
- **Terraform**: Infrastructure provisioning workflows
- **Kubernetes**: Resource management via kubectl
- **Docker Compose**: Multi-container orchestration
- **Ansible**: Configuration management playbooks

### Cloud Providers
- **AWS SDK (boto3)**: EC2, S3, RDS, Lambda operations
- **GCP SDK**: Compute, Storage, Functions
- **Azure SDK**: VMs, Storage, App Services

### Frameworks
- **Web Frameworks**: Express, Django, Rails, Spring Boot
- **Testing Frameworks**: Jest, Pytest, RSpec
- **Build Tools**: Webpack, Vite, Rollup

### CLI Tools
- **kubectl**: Kubernetes cluster management
- **aws-cli**: AWS resource operations
- **gh**: GitHub operations
- **gcloud**: GCP operations

## Best Practices

### Analysis Phase

✅ **Start with medium depth** - Balances thoroughness with speed
✅ **Focus on well-documented libraries** - Better pattern extraction
✅ **Review examples and tests** - Show real usage patterns
✅ **Use shallow analysis for quick exploration** - Fast overview

❌ **Don't analyze massive monorepos without scoping**
❌ **Don't skip reading the documentation**
❌ **Don't analyze deprecated libraries**

### Generation Phase

✅ **Start with 2-3 high-value activities** - Quality over quantity
✅ **Ensure clear state transitions** - Activities should transform state
✅ **Include comprehensive validation** - Catch errors early
✅ **Make activities composable** - Enable workflow building

❌ **Don't generate too many similar activities**
❌ **Don't skip validation and error handling**
❌ **Don't make activities too rigid** - Parameterize!

## Integration with Multi-Instance Coordination

The library learning system is designed to work with multi-instance coordination:

- **Shared Analysis Cache**: Analysis results cached in Redis for all instances
- **Parallel Generation**: Different instances generate different activities simultaneously
- **Activity Registry**: Generated activities shared across instances via Metabob backend
- **Distributed Learning**: Large codebases analyzed in parallel by multiple instances

See [docs/MULTI_INSTANCE_COORDINATION_REVIEW.md](../../docs/MULTI_INSTANCE_COORDINATION_REVIEW.md) for details.

## Documentation

- [Library Learning System Guide](../../docs/LIBRARY_LEARNING_SYSTEM.md) - Comprehensive guide
- [DevBob Vessel Architecture](../../docs/DEVBOB_VESSEL_ARCHITECTURE.md) - Vessel concept
- Activity Template Schema - JSON schema reference

## Examples

See [docs/LIBRARY_LEARNING_SYSTEM.md](../../docs/LIBRARY_LEARNING_SYSTEM.md) for detailed examples of:
- Helm learning workflow
- Terraform pattern extraction
- AWS SDK activity generation
- Framework understanding

## Status

**Version**: 1.0.0
**Status**: Ready for use
**Activities**: 2
**Last Updated**: 2026-02-24

## Contributing

To add new library types or improve analysis:

1. Extend task prompts in activity JSON
2. Add library-type-specific analysis strategies
3. Improve pattern extraction algorithms
4. Enhance activity generation templates
5. Test with diverse libraries

---

**Next Steps**: Run `analyze-library-structure` on your first vessel!
