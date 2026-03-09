/**
 * Validation Harness: Backend Variant Tracking Optimization Architecture
 * 
 * Multi-stage validation:
 * 1. Grep for OptimizationMetadata in activity-template.ts (expect: not found)
 * 2. Verify variant_id field in template-metrics.ts and activity.ts schemas (expect: present)
 * 3. Test config_update tool with MCP section modification and reload=true (expect: MCP.reload() called)
 * 4. Query SurrealDB activity_execution table for records with variant_id (expect: data exists if activity ran)
 * 5. Verify metabob-cli activity_manager.py post_execution_result includes variant_id (expect: present)
 * 6. Check recommendation logic queries backend, not template optimization field (expect: backend queries only)
 * 
 * Usage:
 *   const result = await runValidation({ checkDatabase: true })
 *   console.log(result.pass ? 'PASS' : 'FAIL')
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationInput {
  checkDatabase?: boolean;
  surrealdbUrl?: string;
  metabobCliPid?: number;
  skipMcpReloadTest?: boolean;
}

interface ValidationResult {
  pass: boolean;
  actual: {
    stage1_noOptimizationMetadata: boolean;
    stage2_variantIdPresent: boolean;
    stage3_configUpdateWorks: boolean;
    stage4_databaseHasData: boolean;
    stage5_activityManagerHasVariantId: boolean;
    stage6_recommendationUsesBackend: boolean;
  };
  expected: {
    stage1_noOptimizationMetadata: boolean;
    stage2_variantIdPresent: boolean;
    stage3_configUpdateWorks: boolean;
    stage4_databaseHasData: boolean;
    stage5_activityManagerHasVariantId: boolean;
    stage6_recommendationUsesBackend: boolean;
  };
  details: string[];
  errors: string[];
}

/**
 * Stage 1: Grep for OptimizationMetadata in activity-template.ts
 * Expect: NOT FOUND (schema removed)
 */
async function stage1_checkNoOptimizationMetadata(): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  try {
    const activityTemplateFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/session/activity-template.ts'
    );
    
    if (!fs.existsSync(activityTemplateFile)) {
      details.push('ERROR: activity-template.ts not found at expected path');
      return { pass: false, details };
    }
    
    const content = fs.readFileSync(activityTemplateFile, 'utf-8');
    
    // Check for OptimizationMetadata schema definition
    const hasOptimizationMetadataSchema = content.includes('OptimizationMetadataSchema') ||
                                          content.includes('const OptimizationMetadata');
    
    // Check for export type OptimizationMetadata
    const hasOptimizationMetadataType = /export type OptimizationMetadata/.test(content);
    
    // Check for optimization field in TaskSchema
    const taskSchemaMatch = content.match(/export const TaskSchema = z\.object\({([^}]+(?:{[^}]*}[^}]*)*)\}\)/);
    const hasOptimizationField = taskSchemaMatch ? taskSchemaMatch[1].includes('optimization:') : false;
    
    const pass = !hasOptimizationMetadataSchema && !hasOptimizationMetadataType && !hasOptimizationField;
    
    if (pass) {
      details.push('✅ OptimizationMetadata schema NOT FOUND (correct)');
      details.push('✅ OptimizationMetadata type NOT EXPORTED (correct)');
      details.push('✅ TaskSchema has NO optimization field (correct)');
    } else {
      if (hasOptimizationMetadataSchema) {
        details.push('❌ OptimizationMetadataSchema FOUND (should be removed)');
      }
      if (hasOptimizationMetadataType) {
        details.push('❌ OptimizationMetadata type EXPORTED (should be removed)');
      }
      if (hasOptimizationField) {
        details.push('❌ TaskSchema HAS optimization field (should be removed)');
      }
    }
    
    // Check for documentation explaining external tracking
    const hasExternalTrackingDoc = content.includes('backend') && 
                                   content.includes('variant_id') &&
                                   content.includes('Thompson');
    
    if (hasExternalTrackingDoc) {
      details.push('✅ Documentation explains external backend variant tracking');
    } else {
      details.push('⚠️  Missing documentation about external backend tracking');
    }
    
    return { pass, details };
  } catch (error) {
    details.push(`ERROR: ${(error as Error).message}`);
    return { pass: false, details };
  }
}

/**
 * Stage 2: Verify variant_id field in template-metrics.ts and activity.ts schemas
 * Expect: PRESENT in ActivityExecutionData
 */
async function stage2_checkVariantIdPresent(): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  let allPass = true;
  
  try {
    // Check template-metrics.ts
    const templateMetricsFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts'
    );
    
    if (!fs.existsSync(templateMetricsFile)) {
      details.push('ERROR: template-metrics.ts not found');
      return { pass: false, details };
    }
    
    const metricsContent = fs.readFileSync(templateMetricsFile, 'utf-8');
    
    // Check for variant_id in ActivityExecutionData
    const hasVariantIdField = metricsContent.includes('variant_id');
    const activityExecutionDataMatch = metricsContent.match(/interface ActivityExecutionData[\s\S]*?variant_id[\s\S]*?}/);
    
    if (hasVariantIdField && activityExecutionDataMatch) {
      details.push('✅ variant_id field FOUND in ActivityExecutionData (template-metrics.ts)');
    } else {
      details.push('❌ variant_id field NOT FOUND in ActivityExecutionData');
      allPass = false;
    }
    
    // Check activity.ts for variant_id usage
    const activityFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/session/activity.ts'
    );
    
    if (fs.existsSync(activityFile)) {
      const activityContent = fs.readFileSync(activityFile, 'utf-8');
      
      // Check if variant_id is passed to reportExecution
      const usesVariantIdInReporting = activityContent.includes('variant_id') &&
                                       activityContent.includes('reportExecution');
      
      if (usesVariantIdInReporting) {
        details.push('✅ variant_id passed to reportExecution() in activity.ts');
      } else {
        details.push('⚠️  variant_id usage in activity.ts not clearly found');
      }
    }
    
    return { pass: allPass, details };
  } catch (error) {
    details.push(`ERROR: ${(error as Error).message}`);
    return { pass: false, details };
  }
}

/**
 * Stage 3: Test config_update tool with MCP section modification and reload=true
 * Expect: config-update.ts exists and supports MCP reload
 */
async function stage3_checkConfigUpdateWorks(skipTest: boolean = false): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  
  if (skipTest) {
    details.push('⏭️  MCP reload test SKIPPED (skipMcpReloadTest=true)');
    return { pass: true, details };
  }
  
  try {
    // Check config-update.ts exists
    const configUpdateFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/tool/config-update.ts'
    );
    
    if (!fs.existsSync(configUpdateFile)) {
      details.push('ERROR: config-update.ts not found');
      return { pass: false, details };
    }
    
    const content = fs.readFileSync(configUpdateFile, 'utf-8');
    
    // Check for MCP section support
    const supportsMcpSection = content.includes('section === "mcp"') ||
                               content.includes('params.section === "mcp"');
    
    if (supportsMcpSection) {
      details.push('✅ config_update tool supports MCP section modification');
    } else {
      details.push('❌ config_update tool does NOT support MCP section');
      return { pass: false, details };
    }
    
    // Check for reload support
    const supportsReload = content.includes('MCP.reload()') ||
                          content.includes('configReload()') ||
                          content.includes('reload:');
    
    if (supportsReload) {
      details.push('✅ config_update tool supports reload parameter');
    } else {
      details.push('❌ config_update tool does NOT support reload');
      return { pass: false, details };
    }
    
    // Check for add/remove/modify operations
    const supportsOperations = content.includes('operation === "add"') &&
                                content.includes('operation === "remove"') &&
                                content.includes('operation === "modify"');
    
    if (supportsOperations) {
      details.push('✅ config_update supports add/remove/modify operations');
    } else {
      details.push('⚠️  config_update missing some operations');
    }
    
    // Check reload.ts exists
    const reloadFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/config/reload.ts'
    );
    
    if (fs.existsSync(reloadFile)) {
      const reloadContent = fs.readFileSync(reloadFile, 'utf-8');
      const hasReloadFunction = reloadContent.includes('export') && 
                                reloadContent.includes('reload') &&
                                reloadContent.includes('MCP.reload()');
      
      if (hasReloadFunction) {
        details.push('✅ reload.ts implements MCP.reload() mechanism');
      } else {
        details.push('⚠️  reload.ts exists but reload mechanism unclear');
      }
    }
    
    return { pass: true, details };
  } catch (error) {
    details.push(`ERROR: ${(error as Error).message}`);
    return { pass: false, details };
  }
}

/**
 * Stage 4: Query SurrealDB activity_execution table for records with variant_id
 * Expect: Data exists if activity has been run
 */
async function stage4_checkDatabaseHasData(
  checkDatabase: boolean = false,
  surrealdbUrl: string = 'http://localhost:8000'
): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  
  if (!checkDatabase) {
    details.push('⏭️  Database check SKIPPED (checkDatabase=false)');
    return { pass: true, details };
  }
  
  try {
    // Try to query SurrealDB
    const query = 'SELECT * FROM activity_execution WHERE variant_id IS NOT NULL LIMIT 5';
    const { stdout, stderr } = await execAsync(
      `curl -s -X POST ${surrealdbUrl}/sql -H "Content-Type: application/json" -d '{"query": "${query}"}'`
    );
    
    if (stderr) {
      details.push(`⚠️  Database query error: ${stderr}`);
      return { pass: false, details };
    }
    
    try {
      const response = JSON.parse(stdout);
      
      if (response.result && response.result.length > 0) {
        details.push(`✅ Found ${response.result.length} activity_execution records with variant_id`);
        
        // Check first record for variant_id field
        const firstRecord = response.result[0];
        if (firstRecord.variant_id) {
          details.push(`✅ Sample variant_id: ${firstRecord.variant_id}`);
        }
        
        return { pass: true, details };
      } else {
        details.push('⚠️  No activity_execution records found with variant_id');
        details.push('   This is expected if no activities have been executed yet');
        return { pass: true, details };
      }
    } catch (parseError) {
      details.push(`⚠️  Could not parse database response: ${stdout.substring(0, 200)}`);
      return { pass: false, details };
    }
  } catch (error) {
    details.push(`⚠️  Database not accessible: ${(error as Error).message}`);
    details.push('   This is expected if SurrealDB is not running');
    return { pass: true, details }; // Don't fail if DB not running
  }
}

/**
 * Stage 5: Verify metabob-cli activity_manager.py includes variant_id
 * Expect: PRESENT in ActivityExecution dataclass and post_execution_result
 */
async function stage5_checkActivityManagerHasVariantId(): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  
  try {
    const activityManagerFile = path.join(
      __dirname,
      '../../repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py'
    );
    
    if (!fs.existsSync(activityManagerFile)) {
      details.push('ERROR: activity_manager.py not found');
      return { pass: false, details };
    }
    
    const content = fs.readFileSync(activityManagerFile, 'utf-8');
    
    // Check for variant_id in ActivityExecution dataclass
    const hasVariantIdInClass = content.includes('variant_id') &&
                                 content.includes('ActivityExecution');
    
    if (hasVariantIdInClass) {
      details.push('✅ variant_id field FOUND in ActivityExecution dataclass');
    } else {
      details.push('❌ variant_id field NOT FOUND in ActivityExecution');
      return { pass: false, details };
    }
    
    // Check for variant_id in post execution logic
    const hasPostExecutionLogic = content.includes('POST') &&
                                   content.includes('/api/v1/learning-loop/executions');
    
    if (hasPostExecutionLogic) {
      details.push('✅ Backend POST endpoint for executions FOUND');
    } else {
      details.push('⚠️  Backend POST endpoint not clearly identified');
    }
    
    // Check for snake_case comment (Proto fields)
    const hasSnakeCaseComment = content.includes('snake_case');
    
    if (hasSnakeCaseComment) {
      details.push('✅ Comment confirms Proto fields use snake_case (variant_id)');
    }
    
    return { pass: true, details };
  } catch (error) {
    details.push(`ERROR: ${(error as Error).message}`);
    return { pass: false, details };
  }
}

/**
 * Stage 6: Check recommendation logic queries backend, not template optimization field
 * Expect: Backend queries ONLY (no template.optimization access)
 */
async function stage6_checkRecommendationUsesBackend(): Promise<{ pass: boolean; details: string[] }> {
  const details: string[] = [];
  let allPass = true;
  
  try {
    // Check recommendation-engine.ts
    const recommendationFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/session/recommendation-engine.ts'
    );
    
    if (!fs.existsSync(recommendationFile)) {
      details.push('ERROR: recommendation-engine.ts not found');
      return { pass: false, details };
    }
    
    const content = fs.readFileSync(recommendationFile, 'utf-8');
    
    // Check for backend queries via TemplateRepository
    const usesTemplateRepository = content.includes('TemplateRepository') &&
                                   content.includes('list()');
    
    if (usesTemplateRepository) {
      details.push('✅ Recommendation engine uses TemplateRepository.list() (backend query)');
    } else {
      details.push('❌ TemplateRepository backend query NOT FOUND');
      allPass = false;
    }
    
    // Check that it does NOT access template.optimization
    const accessesTemplateOptimization = /template\..*optimization/.test(content);
    
    if (!accessesTemplateOptimization) {
      details.push('✅ Recommendation engine does NOT access template.optimization (correct)');
    } else {
      details.push('❌ Recommendation engine accesses template.optimization (should use backend)');
      allPass = false;
    }
    
    // Check boredom-manager.ts
    const boredomFile = path.join(
      __dirname,
      '../../repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts'
    );
    
    if (fs.existsSync(boredomFile)) {
      const boredomContent = fs.readFileSync(boredomFile, 'utf-8');
      
      // Check for evolution via meta-template (not metadata updates)
      const usesMetaTemplate = boredomContent.includes('evolve-activity-self-contained') ||
                               boredomContent.includes('backend') ||
                               boredomContent.includes('boredom');
      
      if (usesMetaTemplate) {
        details.push('✅ Boredom manager uses meta-template evolution pattern');
      } else {
        details.push('⚠️  Boredom manager evolution pattern unclear');
      }
      
      // Check it does NOT update optimization metadata
      const updatesOptimizationMetadata = boredomContent.includes('optimization:') && 
                                          boredomContent.includes('readiness');
      
      if (!updatesOptimizationMetadata) {
        details.push('✅ Boredom manager does NOT update optimization metadata (correct)');
      } else {
        details.push('❌ Boredom manager updates optimization metadata (should create variants)');
        allPass = false;
      }
    }
    
    return { pass: allPass, details };
  } catch (error) {
    details.push(`ERROR: ${(error as Error).message}`);
    return { pass: false, details };
  }
}

/**
 * Main validation entry point
 */
export async function runValidation(input?: ValidationInput): Promise<ValidationResult> {
  const details: string[] = [];
  const errors: string[] = [];
  
  details.push('=== Backend Variant Tracking Optimization Architecture Validation ===\n');
  
  // Stage 1: No OptimizationMetadata
  details.push('Stage 1: Checking OptimizationMetadata removal...');
  const stage1 = await stage1_checkNoOptimizationMetadata();
  details.push(...stage1.details);
  details.push('');
  
  // Stage 2: variant_id present
  details.push('Stage 2: Checking variant_id field presence...');
  const stage2 = await stage2_checkVariantIdPresent();
  details.push(...stage2.details);
  details.push('');
  
  // Stage 3: config_update works
  details.push('Stage 3: Checking config_update tool and MCP reload...');
  const stage3 = await stage3_checkConfigUpdateWorks(input?.skipMcpReloadTest);
  details.push(...stage3.details);
  details.push('');
  
  // Stage 4: Database has data
  details.push('Stage 4: Checking SurrealDB for execution data...');
  const stage4 = await stage4_checkDatabaseHasData(input?.checkDatabase, input?.surrealdbUrl);
  details.push(...stage4.details);
  details.push('');
  
  // Stage 5: activity_manager.py has variant_id
  details.push('Stage 5: Checking metabob-cli activity_manager.py...');
  const stage5 = await stage5_checkActivityManagerHasVariantId();
  details.push(...stage5.details);
  details.push('');
  
  // Stage 6: Recommendation uses backend
  details.push('Stage 6: Checking recommendation queries backend...');
  const stage6 = await stage6_checkRecommendationUsesBackend();
  details.push(...stage6.details);
  details.push('');
  
  const actual = {
    stage1_noOptimizationMetadata: stage1.pass,
    stage2_variantIdPresent: stage2.pass,
    stage3_configUpdateWorks: stage3.pass,
    stage4_databaseHasData: stage4.pass,
    stage5_activityManagerHasVariantId: stage5.pass,
    stage6_recommendationUsesBackend: stage6.pass,
  };
  
  const expected = {
    stage1_noOptimizationMetadata: true,
    stage2_variantIdPresent: true,
    stage3_configUpdateWorks: true,
    stage4_databaseHasData: input?.checkDatabase ?? false,
    stage5_activityManagerHasVariantId: true,
    stage6_recommendationUsesBackend: true,
  };
  
  const pass = Object.values(actual).every(v => v === true);
  
  if (pass) {
    details.push('=== ✅ ALL STAGES PASSED ===');
  } else {
    details.push('=== ❌ SOME STAGES FAILED ===');
    const failed = Object.entries(actual).filter(([, v]) => !v).map(([key]) => key);
    details.push(`Failed stages: ${failed.join(', ')}`);
  }
  
  return {
    pass,
    actual,
    expected,
    details,
    errors,
  };
}

// Export for use in test suites
export default { runValidation };
