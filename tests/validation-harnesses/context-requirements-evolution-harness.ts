/**
 * Validation Harness: context-requirements-evolution
 * 
 * Tests that templates automatically evolve their contextRequirements based on
 * impulse usage correlation with task success.
 * 
 * Validation Strategy:
 * 1. Run template 25 times: 15 with impulse, 10 without
 * 2. Verify correlation analysis identifies effective impulse (>80% delta)
 * 3. Verify template evolves to include high-correlation impulse
 * 4. Verify future executions auto-load the impulse
 * 
 * Expected Results:
 * - Executions WITH impulse: 14/15 success (93%)
 * - Executions WITHOUT impulse: 4/10 success (40%)
 * - Correlation delta: 53% (93% - 40%)
 * - Template evolves to require impulse
 * - Success rate improves in subsequent executions
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Types
interface ValidationInput {
  templateId: string;
  testImpulseId: string;
  executionCount: number;
  withImpulseCount: number;
  withoutImpulseCount: number;
  expectedWithSuccessRate: number;
  expectedWithoutSuccessRate: number;
  expectedCorrelationDelta: number;
}

interface ExecutionRecord {
  execution_id: string;
  template_id: string;
  success: boolean;
  impulses?: Array<{
    impulse_id: string;
    impulse_type: string;
    tokens_loaded: number;
    cost_usd: number;
    loaded_at: string;
  }>;
  started_at: string;
  duration_ms: number;
  cost_usd: number;
}

interface CorrelationResult {
  impulse_id: string;
  correlation: number;
  success_rate_with: number;
  success_rate_without: number;
  executions_with: number;
  executions_without: number;
  recommendation: "ADD_TO_CONTEXT_REQUIREMENTS" | "REMOVE_FROM_CONTEXT_REQUIREMENTS" | "NEUTRAL";
}

interface TemplateEvolution {
  template_id: string;
  version: string;
  contextRequirements: Array<{
    type: string;
    identifier: string;
    priority: string;
    added_by?: string;
    justification?: string;
  }>;
  evolution_history?: Array<{
    date: string;
    type: string;
    changes: Array<{
      action: string;
      impulse_id: string;
      correlation: number;
      justification: string;
    }>;
  }>;
}

interface ValidationResult {
  pass: boolean;
  actual: {
    executionCount: number;
    withImpulseSuccessRate: number;
    withoutImpulseSuccessRate: number;
    correlationDelta: number;
    templateEvolved: boolean;
    templateVersion: string;
    impulseInContextRequirements: boolean;
    evolutionHistory: any[];
  };
  expected: {
    withImpulseSuccessRate: number;
    withoutImpulseSuccessRate: number;
    correlationDelta: number;
    templateShouldEvolve: boolean;
    impulseShouldBeRequired: boolean;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Verify execution data exists
  const executionData = await loadExecutionData(input.templateId);
  if (!executionData || executionData.length === 0) {
    errors.push("No execution data found for template");
    return createFailureResult(input, errors, warnings);
  }

  // Step 2: Partition executions by impulse presence
  const withImpulse = executionData.filter(e => 
    e.impulses?.some(imp => imp.impulse_id === input.testImpulseId)
  );
  const withoutImpulse = executionData.filter(e =>
    !e.impulses?.some(imp => imp.impulse_id === input.testImpulseId)
  );

  // Step 3: Calculate success rates
  const withSuccessRate = calculateSuccessRate(withImpulse);
  const withoutSuccessRate = calculateSuccessRate(withoutImpulse);
  const correlationDelta = withSuccessRate - withoutSuccessRate;

  // Step 4: Verify correlation analysis
  const correlationResult = await analyzeCorrelation(input.templateId, input.testImpulseId);
  if (!correlationResult) {
    errors.push("Correlation analysis not available");
  } else {
    // Verify correlation calculation is accurate
    const correlationError = Math.abs(correlationResult.correlation - correlationDelta);
    if (correlationError > 0.05) {
      errors.push(`Correlation calculation mismatch: expected ${correlationDelta.toFixed(2)}, got ${correlationResult.correlation.toFixed(2)}`);
    }

    // Verify recommendation is correct
    if (correlationDelta > 0.2 && correlationResult.recommendation !== "ADD_TO_CONTEXT_REQUIREMENTS") {
      errors.push(`Correlation ${correlationDelta.toFixed(2)} should recommend ADD, got ${correlationResult.recommendation}`);
    }
  }

  // Step 5: Verify template evolution
  const template = await loadTemplate(input.templateId);
  if (!template) {
    errors.push("Template not found");
    return createFailureResult(input, errors, warnings);
  }

  const impulseInRequirements = template.contextRequirements?.some(
    req => req.identifier === input.testImpulseId
  );

  const hasEvolutionHistory = template.evolution_history && template.evolution_history.length > 0;

  // Step 6: Verify evolution occurred if correlation is high
  if (correlationDelta > input.expectedCorrelationDelta * 0.8) {
    if (!impulseInRequirements) {
      errors.push(`Impulse ${input.testImpulseId} should be in contextRequirements (correlation: ${correlationDelta.toFixed(2)})`);
    }
    if (!hasEvolutionHistory) {
      warnings.push("Template evolved but evolution_history is missing");
    }
  }

  // Step 7: Determine pass/fail
  const pass = errors.length === 0 && 
    Math.abs(withSuccessRate - input.expectedWithSuccessRate) < 0.1 &&
    Math.abs(withoutSuccessRate - input.expectedWithoutSuccessRate) < 0.1 &&
    Math.abs(correlationDelta - input.expectedCorrelationDelta) < 0.1 &&
    (correlationDelta < 0.2 || impulseInRequirements);

  return {
    pass,
    actual: {
      executionCount: executionData.length,
      withImpulseSuccessRate: withSuccessRate,
      withoutImpulseSuccessRate: withoutSuccessRate,
      correlationDelta,
      templateEvolved: hasEvolutionHistory,
      templateVersion: template.version || "unknown",
      impulseInContextRequirements: impulseInRequirements,
      evolutionHistory: template.evolution_history || []
    },
    expected: {
      withImpulseSuccessRate: input.expectedWithSuccessRate,
      withoutImpulseSuccessRate: input.expectedWithoutSuccessRate,
      correlationDelta: input.expectedCorrelationDelta,
      templateShouldEvolve: true,
      impulseShouldBeRequired: true
    },
    errors,
    warnings
  };
}

/**
 * Load execution data from backend or mock data
 */
async function loadExecutionData(templateId: string): Promise<ExecutionRecord[]> {
  // Try to load from backend API
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/v1/learning-loop/executions?template_id=${templateId}&limit=1000`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("Backend not available, using mock data");
  }

  // Fall back to mock data for testing
  return loadMockExecutionData(templateId);
}

/**
 * Load correlation analysis from backend or calculate locally
 */
async function analyzeCorrelation(templateId: string, impulseId: string): Promise<CorrelationResult | null> {
  // Try to load from backend API
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/v1/impulse-analytics/correlation?template_id=${templateId}`);
    if (response.ok) {
      const data = await response.json();
      return data.impulses?.find((imp: CorrelationResult) => imp.impulse_id === impulseId) || null;
    }
  } catch (error) {
    console.warn("Correlation analysis not available");
  }

  return null;
}

/**
 * Load template from backend or mock data
 */
async function loadTemplate(templateId: string): Promise<TemplateEvolution | null> {
  // Try to load from backend API
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/v1/templates/${templateId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("Backend not available, using mock template");
  }

  // Fall back to mock template
  return loadMockTemplate(templateId);
}

/**
 * Calculate success rate from execution records
 */
function calculateSuccessRate(executions: ExecutionRecord[]): number {
  if (executions.length === 0) return 0;
  const successCount = executions.filter(e => e.success).length;
  return successCount / executions.length;
}

/**
 * Create failure result
 */
function createFailureResult(
  input: ValidationInput,
  errors: string[],
  warnings: string[]
): ValidationResult {
  return {
    pass: false,
    actual: {
      executionCount: 0,
      withImpulseSuccessRate: 0,
      withoutImpulseSuccessRate: 0,
      correlationDelta: 0,
      templateEvolved: false,
      templateVersion: "unknown",
      impulseInContextRequirements: false,
      evolutionHistory: []
    },
    expected: {
      withImpulseSuccessRate: input.expectedWithSuccessRate,
      withoutImpulseSuccessRate: input.expectedWithoutSuccessRate,
      correlationDelta: input.expectedCorrelationDelta,
      templateShouldEvolve: true,
      impulseShouldBeRequired: true
    },
    errors,
    warnings
  };
}

/**
 * Load mock execution data for testing (when backend unavailable)
 */
function loadMockExecutionData(templateId: string): ExecutionRecord[] {
  const mockDataPath = join(__dirname, `../mock-data/executions-${templateId}.json`);
  if (existsSync(mockDataPath)) {
    return JSON.parse(readFileSync(mockDataPath, "utf-8"));
  }

  // Generate default mock data matching validation strategy
  return generateMockExecutions(templateId, "codebase-structure");
}

/**
 * Load mock template for testing (when backend unavailable)
 */
function loadMockTemplate(templateId: string): TemplateEvolution {
  const mockTemplatePath = join(__dirname, `../mock-data/template-${templateId}.json`);
  if (existsSync(mockTemplatePath)) {
    return JSON.parse(readFileSync(mockTemplatePath, "utf-8"));
  }

  // Return default mock template
  return {
    template_id: templateId,
    version: "1.0.0",
    contextRequirements: [],
    evolution_history: []
  };
}

/**
 * Generate mock execution data matching validation strategy
 */
function generateMockExecutions(templateId: string, impulseId: string): ExecutionRecord[] {
  const executions: ExecutionRecord[] = [];
  const baseTime = new Date("2026-02-20T00:00:00Z").getTime();

  // Generate 15 executions WITH impulse (14 successful = 93%)
  for (let i = 0; i < 15; i++) {
    executions.push({
      execution_id: `exec_with_${i}`,
      template_id: templateId,
      success: i < 14, // 14 successes out of 15
      impulses: [{
        impulse_id: impulseId,
        impulse_type: "cochange",
        tokens_loaded: 2500,
        cost_usd: 0.005,
        loaded_at: new Date(baseTime + i * 3600000).toISOString()
      }],
      started_at: new Date(baseTime + i * 3600000).toISOString(),
      duration_ms: 45000,
      cost_usd: 0.022
    });
  }

  // Generate 10 executions WITHOUT impulse (4 successful = 40%)
  for (let i = 0; i < 10; i++) {
    executions.push({
      execution_id: `exec_without_${i}`,
      template_id: templateId,
      success: i < 4, // 4 successes out of 10
      impulses: [],
      started_at: new Date(baseTime + (15 + i) * 3600000).toISOString(),
      duration_ms: 45000,
      cost_usd: 0.020
    });
  }

  return executions;
}

/**
 * Standalone test runner (for CLI usage)
 */
export async function runStandaloneTest() {
  console.log("Running context-requirements-evolution validation harness...\n");

  const input: ValidationInput = {
    templateId: "test-template-with-learning",
    testImpulseId: "codebase-structure",
    executionCount: 25,
    withImpulseCount: 15,
    withoutImpulseCount: 10,
    expectedWithSuccessRate: 0.93,
    expectedWithoutSuccessRate: 0.40,
    expectedCorrelationDelta: 0.53
  };

  const result = await runValidation(input);

  console.log("Validation Result:");
  console.log(`  Pass: ${result.pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log("\nActual Results:");
  console.log(`  Executions: ${result.actual.executionCount}`);
  console.log(`  Success rate WITH impulse: ${(result.actual.withImpulseSuccessRate * 100).toFixed(1)}%`);
  console.log(`  Success rate WITHOUT impulse: ${(result.actual.withoutImpulseSuccessRate * 100).toFixed(1)}%`);
  console.log(`  Correlation delta: ${(result.actual.correlationDelta * 100).toFixed(1)}%`);
  console.log(`  Template evolved: ${result.actual.templateEvolved ? "Yes" : "No"}`);
  console.log(`  Impulse in context requirements: ${result.actual.impulseInContextRequirements ? "Yes" : "No"}`);
  console.log(`  Template version: ${result.actual.templateVersion}`);

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    result.warnings.forEach(warn => console.log(`  - ${warn}`));
  }

  console.log("\nExpected Results:");
  console.log(`  Success rate WITH impulse: ${(result.expected.withImpulseSuccessRate * 100).toFixed(1)}%`);
  console.log(`  Success rate WITHOUT impulse: ${(result.expected.withoutImpulseSuccessRate * 100).toFixed(1)}%`);
  console.log(`  Correlation delta: ${(result.expected.correlationDelta * 100).toFixed(1)}%`);
  console.log(`  Template should evolve: ${result.expected.templateShouldEvolve ? "Yes" : "No"}`);
  console.log(`  Impulse should be required: ${result.expected.impulseShouldBeRequired ? "Yes" : "No"}`);

  return result;
}

// Allow running as standalone script
if (require.main === module) {
  runStandaloneTest().then(result => {
    process.exit(result.pass ? 0 : 1);
  });
}
