/**
 * Trace Analyzer - Validates execution traces against documented sequences
 */

export interface ExecutionTrace {
  executionId: string;
  templateId: string;
  tasks: Array<{
    id: string;
    status: string;
    metadata?: any;
  }>;
  metadata?: {
    thompsonSampling?: any;
    impulseResolution?: any;
    compositionEdges?: Array<{ parent: string; child: string }>;
    [key: string]: any;
  };
}

export interface RecommendationFlowAssertion {
  tiersChecked: string[];
  boostsApplied: string[];
  selectedTemplate: string;
}

export interface ImpulseResolutionAssertion {
  filtered: string[];
  loaded: string[];
  skipped: string[];
  budget?: {
    originalTokens: number;
    truncatedTo?: number;
  };
}

export class TraceAnalyzer {
  constructor(private trace: ExecutionTrace) {}

  /**
   * Verify Thompson Sampling recommendation flow
   * Based on: 01-activity-selection.md
   */
  assertRecommendationFlow(expected: RecommendationFlowAssertion): boolean {
    const metadata = this.trace.metadata?.thompsonSampling;
    if (!metadata) {
      throw new Error("No Thompson Sampling metadata in trace");
    }

    // Check tiers
    const tiersMatched = expected.tiersChecked.every((tier) =>
      metadata.tiersChecked?.includes(tier)
    );
    if (!tiersMatched) {
      throw new Error(
        `Tiers mismatch. Expected: ${expected.tiersChecked.join(", ")}, Got: ${metadata.tiersChecked?.join(", ")}`
      );
    }

    // Check boosts
    const boostsMatched = expected.boostsApplied.every((boost) =>
      metadata.boostsApplied?.includes(boost)
    );
    if (!boostsMatched) {
      throw new Error(
        `Boosts mismatch. Expected: ${expected.boostsApplied.join(", ")}, Got: ${metadata.boostsApplied?.join(", ")}`
      );
    }

    // Check selected template
    if (this.trace.templateId !== expected.selectedTemplate) {
      throw new Error(
        `Template mismatch. Expected: ${expected.selectedTemplate}, Got: ${this.trace.templateId}`
      );
    }

    return true;
  }

  /**
   * Verify impulse resolution flow
   * Based on: 02-impulse-resolution.md
   */
  assertImpulseResolution(expected: ImpulseResolutionAssertion): boolean {
    const metadata = this.trace.metadata?.impulseResolution;
    if (!metadata) {
      throw new Error("No impulse resolution metadata in trace");
    }

    // Check filtered impulses
    if (!this.arraysEqual(metadata.filtered, expected.filtered)) {
      throw new Error(
        `Filtered impulses mismatch. Expected: ${expected.filtered.join(", ")}, Got: ${metadata.filtered?.join(", ")}`
      );
    }

    // Check loaded impulses
    if (!this.arraysEqual(metadata.loaded, expected.loaded)) {
      throw new Error(
        `Loaded impulses mismatch. Expected: ${expected.loaded.join(", ")}, Got: ${metadata.loaded?.join(", ")}`
      );
    }

    // Check skipped impulses
    if (!this.arraysEqual(metadata.skipped, expected.skipped)) {
      throw new Error(
        `Skipped impulses mismatch. Expected: ${expected.skipped.join(", ")}, Got: ${metadata.skipped?.join(", ")}`
      );
    }

    // Check budget enforcement
    if (expected.budget) {
      if (metadata.budget?.originalTokens !== expected.budget.originalTokens) {
        throw new Error(
          `Budget originalTokens mismatch. Expected: ${expected.budget.originalTokens}, Got: ${metadata.budget?.originalTokens}`
        );
      }

      if (expected.budget.truncatedTo && metadata.budget?.truncatedTo !== expected.budget.truncatedTo) {
        throw new Error(
          `Budget truncatedTo mismatch. Expected: ${expected.budget.truncatedTo}, Got: ${metadata.budget?.truncatedTo}`
        );
      }
    }

    return true;
  }

  /**
   * Verify composition edges
   * Based on: 01-activity-selection.md (composition-based architecture)
   */
  assertCompositionEdges(expected: Array<{ parent: string; child: string }>): boolean {
    const edges = this.trace.metadata?.compositionEdges || [];

    for (const expectedEdge of expected) {
      const found = edges.find(
        (e: any) => e.parent === expectedEdge.parent && e.child === expectedEdge.child
      );

      if (!found) {
        throw new Error(
          `Composition edge not found: ${expectedEdge.parent} → ${expectedEdge.child}`
        );
      }
    }

    return true;
  }

  /**
   * Verify resolver execution
   * Based on: 03-resolver-processing.md
   */
  assertResolverExecution(expected: {
    resolverName: string;
    inputShapes: string[];
    outputShapes: string[];
  }): boolean {
    const task = this.trace.tasks.find(
      (t) => t.metadata?.resolver?.name === expected.resolverName
    );

    if (!task) {
      throw new Error(`Resolver ${expected.resolverName} not found in trace`);
    }

    const resolver = task.metadata.resolver;

    if (!this.arraysEqual(resolver.inputShapes, expected.inputShapes)) {
      throw new Error(
        `Resolver input shapes mismatch. Expected: ${expected.inputShapes.join(", ")}, Got: ${resolver.inputShapes?.join(", ")}`
      );
    }

    if (!this.arraysEqual(resolver.outputShapes, expected.outputShapes)) {
      throw new Error(
        `Resolver output shapes mismatch. Expected: ${expected.outputShapes.join(", ")}, Got: ${resolver.outputShapes?.join(", ")}`
      );
    }

    return true;
  }

  /**
   * Verify ribosome extraction
   * Based on: 04-improvisation-trailblazing.md
   */
  assertRibosomeExtraction(expected: {
    extracted: boolean;
    criteriaChecked: string[];
    templateId?: string;
  }): boolean {
    const metadata = this.trace.metadata?.ribosome;
    if (!metadata) {
      throw new Error("No ribosome metadata in trace");
    }

    if (metadata.extracted !== expected.extracted) {
      throw new Error(
        `Ribosome extraction mismatch. Expected: ${expected.extracted}, Got: ${metadata.extracted}`
      );
    }

    // Check criteria
    const criteriaMatched = expected.criteriaChecked.every((criterion) =>
      metadata.criteriaChecked?.includes(criterion)
    );
    if (!criteriaMatched) {
      throw new Error(
        `Ribosome criteria mismatch. Expected: ${expected.criteriaChecked.join(", ")}, Got: ${metadata.criteriaChecked?.join(", ")}`
      );
    }

    if (expected.extracted && expected.templateId) {
      if (metadata.templateId !== expected.templateId) {
        throw new Error(
          `Extracted template ID mismatch. Expected: ${expected.templateId}, Got: ${metadata.templateId}`
        );
      }
    }

    return true;
  }

  /**
   * Verify hook execution
   * Based on: 05-hooks-behavior-injection.md
   */
  assertHookExecution(expected: {
    trigger: string;
    hooksExecuted: string[];
    impulsesInjected: number;
  }): boolean {
    const metadata = this.trace.metadata?.hooks;
    if (!metadata) {
      throw new Error("No hook metadata in trace");
    }

    const triggerData = metadata[expected.trigger];
    if (!triggerData) {
      throw new Error(`No hook data for trigger: ${expected.trigger}`);
    }

    if (!this.arraysEqual(triggerData.hooksExecuted, expected.hooksExecuted)) {
      throw new Error(
        `Hooks executed mismatch. Expected: ${expected.hooksExecuted.join(", ")}, Got: ${triggerData.hooksExecuted?.join(", ")}`
      );
    }

    if (triggerData.impulsesInjected !== expected.impulsesInjected) {
      throw new Error(
        `Impulses injected mismatch. Expected: ${expected.impulsesInjected}, Got: ${triggerData.impulsesInjected}`
      );
    }

    return true;
  }

  /**
   * Verify complete sequence flow
   */
  assertSequenceFlow(expected: {
    sequence: string;
    expectedPhases: string[];
    allowedOptional?: string[];
  }): boolean {
    const metadata = this.trace.metadata?.sequenceFlow;
    if (!metadata) {
      throw new Error("No sequence flow metadata in trace");
    }

    const phasesExecuted = metadata.phases || [];

    // Check all required phases present
    for (const phase of expected.expectedPhases) {
      if (!phasesExecuted.includes(phase)) {
        // Check if it's an allowed optional phase
        if (!expected.allowedOptional?.includes(phase)) {
          throw new Error(`Required phase not found: ${phase}`);
        }
      }
    }

    // Check for unexpected phases
    for (const phase of phasesExecuted) {
      if (
        !expected.expectedPhases.includes(phase) &&
        !expected.allowedOptional?.includes(phase)
      ) {
        throw new Error(`Unexpected phase found: ${phase}`);
      }
    }

    return true;
  }

  private arraysEqual(a: any[] | undefined, b: any[] | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((val, idx) => val === sortedB[idx]);
  }
}

/**
 * Helper function to create a trace analyzer
 */
export function analyzeTrace(trace: ExecutionTrace): TraceAnalyzer {
  return new TraceAnalyzer(trace);
}
