# Library Learning System - Quick Start

## What Is This?

A **meta-learning system** that teaches DevBob to understand external "vessels" (libraries, tools, frameworks) and automatically convert their patterns into executable activities.

Think of it as: **"Learn once, automate forever"**

## The Problem

You have deployment tools (Helm, Terraform), cloud providers (AWS, GCP), frameworks (Express, Django), and CLI tools (kubectl, aws-cli) that you use repeatedly. Each has its own patterns, workflows, and conventions. Manually creating activities for each operation is time-consuming.

## The Solution

**Analyze → Generate → Use**

1. **Analyze**: Point the system at a library/tool and it extracts patterns
2. **Generate**: Automatically convert patterns into activity templates
3. **Use**: Execute parameterized, validated activities for any operation

## Two Activities, Infinite Possibilities

### 1. analyze-library-structure

**What it does**: Analyzes any library/tool to understand its structure, APIs, and patterns

**Input**: Path to library + library name
**Output**: Complete analysis with activity conversion roadmap

**Example**:
```bash
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "/path/to/helm",
    library_name: "helm",
    library_type: "deployment-tool"
  },
  reason: "Learn Helm patterns"
})
```

### 2. generate-library-activities

**What it does**: Converts analyzed patterns into executable activity templates

**Input**: Library name + activity count
**Output**: Validated, registered activity templates ready to use

**Example**:
```bash
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm",
    activity_count: 3
  },
  reason: "Create helm-install, helm-upgrade, helm-rollback activities"
})
```

## Complete Example: Learning Helm

```bash
# Step 1: Analyze Helm (15-30 minutes)
activity({
  templateId: "analyze-library-structure",
  variables: {
    library_path: "./repos/platform",
    library_name: "helm-platform",
    library_type: "deployment-tool"
  },
  reason: "Extract Helm deployment patterns"
})

# Output: analysis/helm-platform-SUMMARY.md with activity roadmap

# Step 2: Generate Activities (10-20 minutes)
activity({
  templateId: "generate-library-activities",
  variables: {
    library_name: "helm-platform",
    activity_count: 3
  },
  reason: "Create deployment automation activities"
})

# Output: 3 validated activity templates registered and ready

# Step 3: Use Forever
activity({
  templateId: "helm-platform-deploy-environment",
  variables: { environment: "production" },
  reason: "Deploy to production"
})
```

**Time Investment**: 1 hour to analyze and generate
**Time Saved**: Every deployment operation afterward is automated

## What Gets Generated?

Each activity template includes:

✅ **Clear state transitions** (before → after)
✅ **Parameterized variables** (flexible configuration)
✅ **Validation rules** (verify success)
✅ **Error handling** (detect and recover)
✅ **Task breakdown** (logical steps)
✅ **Documentation** (usage examples)

## Supported Vessels

- **Deployment Tools**: Helm, Terraform, Kubernetes, Docker Compose, Ansible
- **Cloud Providers**: AWS SDK, GCP SDK, Azure SDK
- **Frameworks**: Express, Django, Rails, Spring Boot
- **CLI Tools**: kubectl, aws-cli, gh, gcloud
- **Build Tools**: Webpack, Vite, Gradle, Maven

**Really, any library with clear patterns and documentation**

## Analysis Depth

- **Shallow (5-10 min)**: Quick overview, major components
- **Medium (15-30 min)**: Full analysis, recommended for most
- **Deep (30-60 min)**: Comprehensive, for critical infrastructure

## Activity Count

Start with **2-3 activities** for highest-value workflows:
- Most frequently used operations
- Clear state transitions
- Well-documented patterns

You can always generate more later based on usage.

## Workflow Composition

Generated activities are composable:

```bash
// Deploy pipeline
await activity({ templateId: "helm-validate-config", ... });
await activity({ templateId: "helm-deploy-staging", ... });
await activity({ templateId: "helm-test-release", ... });
await activity({ templateId: "helm-deploy-production", ... });
```

## Multi-Instance Ready

The system works with multi-instance coordination:
- **Shared analysis cache** in Redis
- **Parallel activity generation** across instances
- **Activity registry sync** via Metabob backend
- **Distributed learning** for large codebases

## Quick Start Locations

- **Templates**: `/templates/library-learning/`
- **Documentation**: `/docs/LIBRARY_LEARNING_SYSTEM.md`
- **Examples**: `/examples/library-learning/`

## Next Steps

1. **Try it**: Analyze `repos/platform` for Helm patterns
2. **Generate**: Create 3 Helm deployment activities
3. **Use**: Automate your next deployment
4. **Expand**: Analyze Terraform, AWS SDK, or any tool you use

## The Big Picture

This isn't just about automation. It's about **accumulating institutional knowledge**:

- Every library analyzed becomes a **permanent knowledge asset**
- Every pattern extracted becomes a **reusable template**
- Every activity generated becomes **team infrastructure**
- Every execution **refines the system** via learning

You're not just automating tasks - you're building a **library of operational knowledge** that grows with every vessel analyzed.

---

**Ready to start?** Run the first example in `/examples/library-learning/README.md`

**Questions?** Read the full guide in `/docs/LIBRARY_LEARNING_SYSTEM.md`

**Stuck?** Check troubleshooting in examples or documentation
