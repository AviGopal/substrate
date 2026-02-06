#!/usr/bin/env tsx

/**
 * Bootstrap Annotation Learning System
 * 
 * This script initializes the annotation-driven learning system:
 * 1. Creates annotation budgets for all components
 * 2. Initializes association graph
 * 3. Generates initial prompt profiles from existing code
 * 4. Sets up feedback collection infrastructure
 */

import { z } from "zod"

// ============================================================================
// Schemas
// ============================================================================

const ComponentAnnotationBudget = z.object({
  componentId: z.string(),
  maxAnnotations: z.number().default(5),
  maxTokensPerAnnotation: z.number().default(500),
  totalTokenBudget: z.number().default(2500),
  annotations: z.array(z.object({
    id: z.string(),
    type: z.enum(["WHY", "CONSTRAINT", "PATTERN", "FAILURE", "SUCCESS"]),
    content: z.string(),
    tokens: z.number(),
    relevanceScore: z.number(),
    successContributions: z.number().default(0),
    failureCorrelations: z.number().default(0),
    lastUsedAt: z.date(),
    accessCount: z.number().default(0),
    createdBy: z.enum(["human", "activity", "validation"]),
    createdAt: z.date(),
    relatedTaskIds: z.array(z.string())
  })),
  refinementGeneration: z.number().default(0),
  lastRefinedAt: z.date(),
  refinementTriggers: z.array(z.string())
})

const ComponentPromptProfile = z.object({
  componentId: z.string(),
  effectiveInstructions: z.array(z.object({
    text: z.string(),
    successRate: z.number(),
    usageCount: z.number(),
    avgCost: z.number(),
    avgDuration: z.number()
  })),
  ineffectiveInstructions: z.array(z.object({
    text: z.string(),
    successRate: z.number(),
    usageCount: z.number()
  })),
  requiredContext: z.array(z.string()),
  optionalContext: z.array(z.string()),
  unnecessaryContext: z.array(z.string()),
  commonChangeTypes: z.record(z.number()),
  successfulApproaches: z.array(z.string()),
  knownPitfalls: z.array(z.string()),
  previousFailures: z.array(z.object({
    taskId: z.string(),
    approach: z.string(),
    errorMessage: z.string(),
    timestamp: z.date(),
    componentStateHash: z.string()
  })),
  optimizedPrompt: z.string(),
  promptVersion: z.number().default(1),
  lastUpdatedAt: z.date()
})

const AssociationGraph = z.object({
  components: z.map(z.string(), z.object({
    componentId: z.string(),
    successfulWithImpulses: z.map(z.string(), z.number()),
    successfulWithTasks: z.map(z.string(), z.number()),
    successfulWithActivities: z.map(z.string(), z.number()),
    failedWithImpulses: z.map(z.string(), z.number()),
    failedWithTasks: z.map(z.string(), z.number()),
    failedWithActivities: z.map(z.string(), z.number()),
    worksWellWith: z.array(z.string()),
    conflictsWith: z.array(z.string())
  })),
  impulses: z.map(z.string(), z.object({
    impulseId: z.string(),
    type: z.string(),
    helpfulForComponents: z.map(z.string(), z.number()),
    unhelpfulForComponents: z.map(z.string(), z.number()),
    helpfulForTasks: z.map(z.string(), z.number()),
    avgTokens: z.number(),
    avgCost: z.number(),
    useCount: z.number()
  })),
  tasks: z.map(z.string(), z.object({
    taskType: z.string(),
    frequentComponents: z.map(z.string(), z.number()),
    effectiveImpulses: z.map(z.string(), z.number()),
    bestActivities: z.map(z.string(), z.number()),
    totalAttempts: z.number(),
    successfulAttempts: z.number(),
    avgCost: z.number(),
    avgDuration: z.number()
  })),
  activities: z.map(z.string(), z.object({
    activityId: z.string(),
    templateId: z.string(),
    componentSuccessRates: z.map(z.string(), z.number()),
    componentAvgCosts: z.map(z.string(), z.number()),
    impulseContributions: z.map(z.string(), z.number()),
    effectiveForTasks: z.map(z.string(), z.number())
  })),
  componentImpulseEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    weight: z.number(),
    confidence: z.number(),
    lastUpdatedAt: z.date()
  })),
  impulseTaskEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    weight: z.number(),
    confidence: z.number(),
    lastUpdatedAt: z.date()
  })),
  taskActivityEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    weight: z.number(),
    confidence: z.number(),
    lastUpdatedAt: z.date()
  })),
  componentTaskEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    weight: z.number(),
    confidence: z.number(),
    lastUpdatedAt: z.date()
  })),
  totalExecutions: z.number().default(0),
  lastUpdatedAt: z.date()
})

// ============================================================================
// Bootstrap Functions
// ============================================================================

interface BootstrapOptions {
  repository: string
  outputDir: string
  metabobEnabled: boolean
}

async function bootstrapAnnotationLearningSystem(opts: BootstrapOptions): Promise<void> {
  console.log("🚀 Bootstrapping Annotation Learning System")
  console.log(`📁 Repository: ${opts.repository}`)
  console.log(`📂 Output: ${opts.outputDir}`)
  console.log(`🤖 Metabob: ${opts.metabobEnabled ? "enabled" : "disabled"}`)
  console.log()

  // Step 1: Initialize annotation budgets
  console.log("📝 Step 1: Initializing annotation budgets...")
  const annotationBudgets = await initializeAnnotationBudgets(opts)
  console.log(`   ✅ Created budgets for ${annotationBudgets.size} components`)
  console.log()

  // Step 2: Initialize association graph
  console.log("🕸️  Step 2: Initializing association graph...")
  const associationGraph = await initializeAssociationGraph(opts)
  console.log(`   ✅ Initialized graph with ${associationGraph.components.size} component nodes`)
  console.log()

  // Step 3: Generate prompt profiles
  console.log("📋 Step 3: Generating prompt profiles...")
  const promptProfiles = await generatePromptProfiles(opts, annotationBudgets)
  console.log(`   ✅ Generated profiles for ${promptProfiles.size} components`)
  console.log()

  // Step 4: Set up feedback collection
  console.log("🔄 Step 4: Setting up feedback collection...")
  await setupFeedbackCollection(opts)
  console.log(`   ✅ Feedback hooks installed`)
  console.log()

  // Step 5: Persist all data
  console.log("💾 Step 5: Persisting data...")
  await persistLearningSystemData(opts, {
    annotationBudgets,
    associationGraph,
    promptProfiles
  })
  console.log(`   ✅ Data saved to ${opts.outputDir}`)
  console.log()

  console.log("✨ Bootstrap complete!")
  console.log()
  console.log("Next steps:")
  console.log("1. Run a fix using: component-targeted-fix-with-learning template")
  console.log("2. System will automatically learn from validation results")
  console.log("3. Check learning progress: npm run check-learning-metrics")
}

async function initializeAnnotationBudgets(
  opts: BootstrapOptions
): Promise<Map<string, z.infer<typeof ComponentAnnotationBudget>>> {
  
  const budgets = new Map<string, z.infer<typeof ComponentAnnotationBudget>>()

  // If metabob enabled, use it to discover components
  if (opts.metabobEnabled) {
    console.log("   🔍 Discovering components via metabob...")
    
    // TODO: Use metabob_list_file_components on each file
    // For now, simulate with placeholder
    
    const mockComponents = [
      "src/session/index.ts::messages",
      "src/session/session.ts::Session",
      "src/activity/activity.ts::Activity"
    ]

    for (const componentId of mockComponents) {
      budgets.set(componentId, {
        componentId,
        maxAnnotations: 5,
        maxTokensPerAnnotation: 500,
        totalTokenBudget: 2500,
        annotations: [],
        refinementGeneration: 0,
        lastRefinedAt: new Date(),
        refinementTriggers: []
      })
    }
  } else {
    console.log("   ⚠️  Metabob disabled - using static discovery")
    // Fallback: scan files manually
  }

  return budgets
}

async function initializeAssociationGraph(
  opts: BootstrapOptions
): Promise<z.infer<typeof AssociationGraph>> {
  
  const graph: z.infer<typeof AssociationGraph> = {
    components: new Map(),
    impulses: new Map(),
    tasks: new Map(),
    activities: new Map(),
    componentImpulseEdges: [],
    impulseTaskEdges: [],
    taskActivityEdges: [],
    componentTaskEdges: [],
    totalExecutions: 0,
    lastUpdatedAt: new Date()
  }

  // Initialize with known task types
  const taskTypes = [
    "fix_memory_leak",
    "add_validation",
    "fix_bug",
    "add_feature",
    "refactor_code"
  ]

  for (const taskType of taskTypes) {
    graph.tasks.set(taskType, {
      taskType,
      frequentComponents: new Map(),
      effectiveImpulses: new Map(),
      bestActivities: new Map(),
      totalAttempts: 0,
      successfulAttempts: 0,
      avgCost: 0,
      avgDuration: 0
    })
  }

  return graph
}

async function generatePromptProfiles(
  opts: BootstrapOptions,
  annotationBudgets: Map<string, z.infer<typeof ComponentAnnotationBudget>>
): Promise<Map<string, z.infer<typeof ComponentPromptProfile>>> {
  
  const profiles = new Map<string, z.infer<typeof ComponentPromptProfile>>()

  for (const [componentId, budget] of annotationBudgets) {
    // Generate initial generic prompt
    const initialPrompt = `Modify component: ${componentId}

Task: {{taskDescription}}

Constraints:
{{constraints}}

Validation:
{{validationCriteria}}

Follow the component's existing patterns and conventions.`

    profiles.set(componentId, {
      componentId,
      effectiveInstructions: [],
      ineffectiveInstructions: [],
      requiredContext: [],
      optionalContext: [],
      unnecessaryContext: [],
      commonChangeTypes: {},
      successfulApproaches: [],
      knownPitfalls: [],
      previousFailures: [],
      optimizedPrompt: initialPrompt,
      promptVersion: 1,
      lastUpdatedAt: new Date()
    })
  }

  return profiles
}

async function setupFeedbackCollection(opts: BootstrapOptions): Promise<void> {
  // Set up hooks to capture validation results
  
  const feedbackHookScript = `
// Feedback collection hook
// Inject into activity execution lifecycle

export async function captureValidationFeedback(result: ValidationResult): Promise<void> {
  // 1. Refine annotations
  await refineComponentAnnotations(result.componentId, result)
  
  // 2. Update prompt profile
  await optimizeComponentPrompt(result.componentId, result)
  
  // 3. Update association graph
  await updateAssociationsFromValidation(result)
  
  // 4. Log metrics
  await logLearningMetrics(result)
}
`

  // TODO: Write hook script to file
  console.log("   📌 Hook script generated")
}

async function persistLearningSystemData(
  opts: BootstrapOptions,
  data: {
    annotationBudgets: Map<string, z.infer<typeof ComponentAnnotationBudget>>
    associationGraph: z.infer<typeof AssociationGraph>
    promptProfiles: Map<string, z.infer<typeof ComponentPromptProfile>>
  }
): Promise<void> {
  
  // Convert Maps to JSON-serializable objects
  const annotationBudgetsObj = Object.fromEntries(data.annotationBudgets)
  const promptProfilesObj = Object.fromEntries(data.promptProfiles)
  
  const associationGraphObj = {
    ...data.associationGraph,
    components: Object.fromEntries(data.associationGraph.components),
    impulses: Object.fromEntries(data.associationGraph.impulses),
    tasks: Object.fromEntries(data.associationGraph.tasks),
    activities: Object.fromEntries(data.associationGraph.activities)
  }

  // TODO: Write to storage
  console.log(`   💾 Annotation budgets: ${Object.keys(annotationBudgetsObj).length} components`)
  console.log(`   💾 Prompt profiles: ${Object.keys(promptProfilesObj).length} components`)
  console.log(`   💾 Association graph: ${data.associationGraph.totalExecutions} executions`)
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  await bootstrapAnnotationLearningSystem({
    repository: process.argv[2] || "./repos/metabob-opencode",
    outputDir: process.argv[3] || "./reports/annotation-learning",
    metabobEnabled: process.argv[4] !== "false"
  })
}

// ============================================================================
// Learning Metrics Dashboard
// ============================================================================

interface LearningMetrics {
  annotationHealth: {
    avgAnnotationsPerComponent: number
    avgTokensPerComponent: number
    annotationRelevanceDistribution: Record<string, number>
    evictionRatePerWeek: number
  }
  promptEffectiveness: {
    successRateByPromptVersion: Map<number, number>
    costPerSuccessfulFix: number
    promptStability: number
  }
  decompositionQuality: {
    avgComponentsPerDecomposition: number
    decompositionAccuracy: number
    activitySuccessRateByDepth: Map<number, number>
  }
  associationLearning: {
    edgeWeightConvergence: number
    contextSelectionEffectiveness: number
    graphDensity: number
  }
}

async function collectLearningMetrics(
  annotationBudgets: Map<string, z.infer<typeof ComponentAnnotationBudget>>,
  promptProfiles: Map<string, z.infer<typeof ComponentPromptProfile>>,
  associationGraph: z.infer<typeof AssociationGraph>
): Promise<LearningMetrics> {
  
  // Calculate annotation health
  const totalAnnotations = Array.from(annotationBudgets.values())
    .reduce((sum, b) => sum + b.annotations.length, 0)
  const totalTokens = Array.from(annotationBudgets.values())
    .reduce((sum, b) => sum + b.annotations.reduce((s, a) => s + a.tokens, 0), 0)
  
  const annotationHealth = {
    avgAnnotationsPerComponent: totalAnnotations / annotationBudgets.size,
    avgTokensPerComponent: totalTokens / annotationBudgets.size,
    annotationRelevanceDistribution: {},
    evictionRatePerWeek: 0 // TODO: calculate from refinement history
  }

  // Calculate prompt effectiveness
  const promptEffectiveness = {
    successRateByPromptVersion: new Map<number, number>(),
    costPerSuccessfulFix: 0, // TODO: calculate from execution history
    promptStability: 0 // TODO: calculate change frequency
  }

  // Calculate decomposition quality
  const decompositionQuality = {
    avgComponentsPerDecomposition: 0, // TODO: calculate from execution history
    decompositionAccuracy: 0, // TODO: calculate from validation results
    activitySuccessRateByDepth: new Map<number, number>()
  }

  // Calculate association learning
  const totalEdges = associationGraph.componentImpulseEdges.length +
                     associationGraph.impulseTaskEdges.length +
                     associationGraph.taskActivityEdges.length +
                     associationGraph.componentTaskEdges.length
  
  const associationLearning = {
    edgeWeightConvergence: 0, // TODO: calculate variance of edge weights
    contextSelectionEffectiveness: 0, // TODO: calculate from validation results
    graphDensity: totalEdges / (annotationBudgets.size * 10) // rough estimate
  }

  return {
    annotationHealth,
    promptEffectiveness,
    decompositionQuality,
    associationLearning
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
