#!/usr/bin/env node
/**
 * Validation Harness: Vessel Self-Configuration System
 * 
 * Tests the complete vessel self-configuration flow:
 * 1. Component existence checks
 * 2. Entrypoint script logic validation
 * 3. Activity template structure validation
 * 4. ConfigManager API validation
 * 5. Integration flow validation
 * 
 * Usage:
 *   ts-node vessel-self-configuration-harness.ts
 * 
 * Returns: JSON with pass/fail results
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  pass: boolean;
  testName: string;
  actual: any;
  expected: any;
  error?: string;
}

interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

class VesselSelfConfigurationHarness {
  private projectRoot: string;
  private results: ValidationResult[] = [];

  constructor() {
    // Assume we're running from tests/validation-harnesses/
    this.projectRoot = path.resolve(__dirname, '../..');
  }

  /**
   * Test Case 1: Verify entrypoint script exists and has correct structure
   */
  testEntrypointExists(): ValidationResult {
    const testName = 'Entrypoint Script Exists';
    const entrypointPath = path.join(this.projectRoot, 'docker/entrypoint-self-config.sh');
    
    try {
      const exists = fs.existsSync(entrypointPath);
      
      if (exists) {
        // Verify it's executable
        const stats = fs.statSync(entrypointPath);
        const isExecutable = (stats.mode & 0o111) !== 0;
        
        // Read content and check for key functions
        const content = fs.readFileSync(entrypointPath, 'utf-8');
        const hasEnvironmentDetection = content.includes('detect_environment') || content.includes('ENVIRONMENT=');
        const hasBackendValidation = content.includes('BACKEND_URL') && content.includes('health');
        const hasApiKeyCheck = content.includes('ANTHROPIC_API_KEY');
        const hasActivityExecution = content.includes('configure-vessel-for-environment');
        const hasAcpStart = content.includes('opencode acp') || content.includes('opencode-acp');
        
        const actual = {
          exists: true,
          executable: isExecutable,
          hasEnvironmentDetection,
          hasBackendValidation,
          hasApiKeyCheck,
          hasActivityExecution,
          hasAcpStart
        };
        
        const allChecks = hasEnvironmentDetection && hasBackendValidation && 
                         hasApiKeyCheck && hasActivityExecution && hasAcpStart;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            executable: true,
            hasEnvironmentDetection: true,
            hasBackendValidation: true,
            hasApiKeyCheck: true,
            hasActivityExecution: true,
            hasAcpStart: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 2: Verify configure-vessel-for-environment activity template exists
   */
  testActivityTemplateExists(): ValidationResult {
    const testName = 'Activity Template Exists';
    const templatePath = path.join(this.projectRoot, '.metabob/activities/configure-vessel-for-environment.json');
    
    try {
      const exists = fs.existsSync(templatePath);
      
      if (exists) {
        const content = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        
        const actual = {
          exists: true,
          hasName: !!content.name,
          hasTasks: Array.isArray(content.tasks),
          taskCount: content.tasks?.length || 0,
          hasDetectTask: content.tasks?.some((t: any) => t.id?.includes('detect')),
          hasLoadBackupTask: content.tasks?.some((t: any) => t.id?.includes('load') || t.id?.includes('backup')),
          hasCalculateTask: content.tasks?.some((t: any) => t.id?.includes('calculate') || t.id?.includes('settings')),
          hasApplyTask: content.tasks?.some((t: any) => t.id?.includes('apply') || t.id?.includes('validate')),
          hasReportTask: content.tasks?.some((t: any) => t.id?.includes('report') || t.id?.includes('generate'))
        };
        
        const allChecks = actual.hasName && actual.taskCount === 5 && 
                         actual.hasDetectTask && actual.hasLoadBackupTask && 
                         actual.hasCalculateTask && actual.hasApplyTask && 
                         actual.hasReportTask;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            hasName: true,
            hasTasks: true,
            taskCount: 5,
            hasDetectTask: true,
            hasLoadBackupTask: true,
            hasCalculateTask: true,
            hasApplyTask: true,
            hasReportTask: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 3: Verify ConfigManager exists and has required functions
   */
  testConfigManagerExists(): ValidationResult {
    const testName = 'ConfigManager API Exists';
    const configManagerPath = path.join(
      this.projectRoot,
      'repos/metabob-opencode/packages/opencode/src/config/self-modify.ts'
    );
    
    try {
      const exists = fs.existsSync(configManagerPath);
      
      if (exists) {
        const content = fs.readFileSync(configManagerPath, 'utf-8');
        
        const actual = {
          exists: true,
          hasGetCurrentConfig: content.includes('getCurrentConfig'),
          hasUpdateConfig: content.includes('updateConfig'),
          hasAddMCPServer: content.includes('addMCPServer'),
          hasUpdateBackendUrl: content.includes('updateBackendUrl'),
          hasSetFeatureFlag: content.includes('setFeatureFlag'),
          hasRollback: content.includes('rollback'),
          hasBackupLogic: content.includes('backup') || content.includes('Backup'),
          hasValidation: content.includes('validate') || content.includes('Validation'),
          hasAtomicWrite: content.includes('atomic') || content.includes('.tmp'),
          hasAuditLog: content.includes('audit') || content.includes('log')
        };
        
        const allChecks = actual.hasGetCurrentConfig && actual.hasUpdateConfig && 
                         actual.hasAddMCPServer && actual.hasUpdateBackendUrl && 
                         actual.hasSetFeatureFlag && actual.hasRollback &&
                         actual.hasBackupLogic && actual.hasValidation;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            hasGetCurrentConfig: true,
            hasUpdateConfig: true,
            hasAddMCPServer: true,
            hasUpdateBackendUrl: true,
            hasSetFeatureFlag: true,
            hasRollback: true,
            hasBackupLogic: true,
            hasValidation: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 4: Verify VesselUpdateManager exists and has required functions
   */
  testVesselUpdateManagerExists(): ValidationResult {
    const testName = 'VesselUpdateManager API Exists';
    const updateManagerPath = path.join(
      this.projectRoot,
      'repos/metabob-opencode/packages/opencode/src/vessel/update.ts'
    );
    
    try {
      const exists = fs.existsSync(updateManagerPath);
      
      if (exists) {
        const content = fs.readFileSync(updateManagerPath, 'utf-8');
        
        const actual = {
          exists: true,
          hasGetCurrentVersions: content.includes('getCurrentVersions'),
          hasCheckUpdates: content.includes('checkUpdates'),
          hasUpdateVessel: content.includes('updateVessel'),
          hasRollback: content.includes('rollback'),
          hasReloadVessel: content.includes('reloadVessel') || content.includes('reload'),
          hasChecksumVerification: content.includes('checksum') || content.includes('hash'),
          hasRetryLogic: content.includes('retry') || content.includes('attempts'),
          hasBackup: content.includes('backup') || content.includes('.prev')
        };
        
        const allChecks = actual.hasGetCurrentVersions && actual.hasCheckUpdates && 
                         actual.hasUpdateVessel && actual.hasRollback &&
                         actual.hasChecksumVerification && actual.hasRetryLogic;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            hasGetCurrentVersions: true,
            hasCheckUpdates: true,
            hasUpdateVessel: true,
            hasRollback: true,
            hasChecksumVerification: true,
            hasRetryLogic: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 5: Verify BootstrapManager exists and complements self-config
   */
  testBootstrapManagerExists(): ValidationResult {
    const testName = 'BootstrapManager Exists';
    const bootstrapPath = path.join(
      this.projectRoot,
      'repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts'
    );
    
    try {
      const exists = fs.existsSync(bootstrapPath);
      
      if (exists) {
        const content = fs.readFileSync(bootstrapPath, 'utf-8');
        
        const actual = {
          exists: true,
          hasBootstrap: content.includes('bootstrap'),
          hasDetectEnvironment: content.includes('detectEnvironment'),
          hasRegisterVessel: content.includes('registerVessel'),
          hasFetchConfig: content.includes('fetchConfig'),
          hasIsBootstrapped: content.includes('isBootstrapped') || content.includes('.bootstrapped'),
          hasRetryLogic: content.includes('retry') || content.includes('attempts')
        };
        
        const allChecks = actual.hasBootstrap && actual.hasDetectEnvironment && 
                         actual.hasRegisterVessel && actual.hasFetchConfig;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            hasBootstrap: true,
            hasDetectEnvironment: true,
            hasRegisterVessel: true,
            hasFetchConfig: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 6: Verify Dockerfile wires entrypoint correctly
   */
  testDockerfileConfiguration(): ValidationResult {
    const testName = 'Dockerfile Configuration';
    const dockerfilePath = path.join(this.projectRoot, 'docker/Dockerfile.devbob');
    
    try {
      const exists = fs.existsSync(dockerfilePath);
      
      if (exists) {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        
        const actual = {
          exists: true,
          hasMultiStage: content.includes('FROM') && content.split('FROM').length > 2,
          copiesEntrypoint: content.includes('entrypoint-self-config.sh') || content.includes('entrypoint.sh'),
          setsEntrypoint: content.includes('ENTRYPOINT') && content.includes('entrypoint'),
          hasCMD: content.includes('CMD') && (content.includes('acp') || content.includes('opencode'))
        };
        
        const allChecks = actual.copiesEntrypoint && actual.setsEntrypoint && actual.hasCMD;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            copiesEntrypoint: true,
            setsEntrypoint: true,
            hasCMD: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 7: Verify CLI debug config command exists
   */
  testCliDebugCommand(): ValidationResult {
    const testName = 'CLI Debug Config Command';
    const cliPath = path.join(
      this.projectRoot,
      'repos/metabob-opencode/packages/opencode/src/cli/cmd/debug/config.ts'
    );
    
    try {
      const exists = fs.existsSync(cliPath);
      
      if (exists) {
        const content = fs.readFileSync(cliPath, 'utf-8');
        
        const actual = {
          exists: true,
          hasConfigCommand: content.includes('config') || content.includes('Config'),
          readsConfig: content.includes('Config.get') || content.includes('Config.state'),
          outputsJSON: content.includes('JSON.stringify') || content.includes('json')
        };
        
        const allChecks = actual.hasConfigCommand && actual.readsConfig;
        
        return {
          pass: allChecks,
          testName,
          actual,
          expected: {
            exists: true,
            hasConfigCommand: true,
            readsConfig: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 8: Verify activity template has proper variable definitions
   */
  testActivityTemplateVariables(): ValidationResult {
    const testName = 'Activity Template Variables';
    const templatePath = path.join(this.projectRoot, '.metabob/activities/configure-vessel-for-environment.json');
    
    try {
      const exists = fs.existsSync(templatePath);
      
      if (exists) {
        const content = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        
        // Extract all variables from all task prompts
        const allVariables = new Set<string>();
        content.tasks?.forEach((task: any) => {
          const promptTemplate = task.prompt?.template || '';
          const matches = promptTemplate.matchAll(/\{\{(\w+)\}\}/g);
          for (const match of matches) {
            allVariables.add(match[1]);
          }
        });
        
        const actual = {
          exists: true,
          hasVariables: allVariables.size > 0,
          variablesList: Array.from(allVariables),
          hasForceEnvironment: allVariables.has('force_environment'),
          hasConfigPath: allVariables.has('config_path'),
          hasMetabobBaseUrl: allVariables.has('metabob_base_url'),
          hasTokenBudgetMultiplier: allVariables.has('token_budget_multiplier')
        };
        
        return {
          pass: actual.hasVariables,
          testName,
          actual,
          expected: {
            exists: true,
            hasVariables: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 9: Verify activity template has proper task dependencies
   */
  testActivityTaskDependencies(): ValidationResult {
    const testName = 'Activity Task Dependencies';
    const templatePath = path.join(this.projectRoot, '.metabob/activities/configure-vessel-for-environment.json');
    
    try {
      const exists = fs.existsSync(templatePath);
      
      if (exists) {
        const content = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        
        const tasks = content.tasks || [];
        const hasDependencies = tasks.some((task: any) => 
          Array.isArray(task.dependencies) && task.dependencies.length > 0
        );
        
        // Check that later tasks depend on earlier tasks
        const taskIds = tasks.map((t: any) => t.id);
        const dependenciesValid = tasks.every((task: any, idx: number) => {
          if (!task.dependencies || task.dependencies.length === 0) return true;
          return task.dependencies.every((dep: string) => {
            const depIdx = taskIds.indexOf(dep);
            return depIdx >= 0 && depIdx < idx; // Dependency must come before
          });
        });
        
        const actual = {
          exists: true,
          taskCount: tasks.length,
          taskIds,
          hasDependencies,
          dependenciesValid
        };
        
        return {
          pass: actual.taskCount === 5 && actual.dependenciesValid,
          testName,
          actual,
          expected: {
            exists: true,
            taskCount: 5,
            dependenciesValid: true
          }
        };
      }
      
      return {
        pass: false,
        testName,
        actual: { exists: false },
        expected: { exists: true }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { exists: true },
        error: String(error)
      };
    }
  }

  /**
   * Test Case 10: Integration - Verify all components are properly connected
   */
  testComponentIntegration(): ValidationResult {
    const testName = 'Component Integration';
    
    try {
      // Check that entrypoint references activity template
      const entrypointPath = path.join(this.projectRoot, 'docker/entrypoint-self-config.sh');
      const entrypointContent = fs.readFileSync(entrypointPath, 'utf-8');
      const entrypointReferencesActivity = entrypointContent.includes('configure-vessel-for-environment');
      
      // Check that activity template uses ConfigManager
      const templatePath = path.join(this.projectRoot, '.metabob/activities/configure-vessel-for-environment.json');
      const templateContent = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
      const templateUsesConfigManager = templateContent.tasks?.some((task: any) => 
        task.prompt?.template?.includes('ConfigManager') || 
        task.prompt?.template?.includes('updateConfig') ||
        task.prompt?.template?.includes('config')
      );
      
      // Check that Dockerfile uses entrypoint
      const dockerfilePath = path.join(this.projectRoot, 'docker/Dockerfile.devbob');
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
      const dockerfileUsesEntrypoint = dockerfileContent.includes('ENTRYPOINT') && 
                                       dockerfileContent.includes('entrypoint');
      
      const actual = {
        entrypointReferencesActivity,
        templateUsesConfigManager,
        dockerfileUsesEntrypoint,
        allConnected: entrypointReferencesActivity && dockerfileUsesEntrypoint
      };
      
      return {
        pass: actual.allConnected,
        testName,
        actual,
        expected: {
          entrypointReferencesActivity: true,
          dockerfileUsesEntrypoint: true,
          allConnected: true
        }
      };
    } catch (error) {
      return {
        pass: false,
        testName,
        actual: null,
        expected: { allConnected: true },
        error: String(error)
      };
    }
  }

  /**
   * Run all validation tests
   */
  runAllTests(): HarnessResult {
    console.log('Running Vessel Self-Configuration System Validation Harness...\n');
    
    this.results = [
      this.testEntrypointExists(),
      this.testActivityTemplateExists(),
      this.testConfigManagerExists(),
      this.testVesselUpdateManagerExists(),
      this.testBootstrapManagerExists(),
      this.testDockerfileConfiguration(),
      this.testCliDebugCommand(),
      this.testActivityTemplateVariables(),
      this.testActivityTaskDependencies(),
      this.testComponentIntegration()
    ];
    
    const passed = this.results.filter(r => r.pass).length;
    const failed = this.results.filter(r => !r.pass).length;
    const totalTests = this.results.length;
    const overallPass = failed === 0;
    
    const summary = overallPass
      ? `✅ ALL TESTS PASSED (${passed}/${totalTests})`
      : `❌ SOME TESTS FAILED (${passed}/${totalTests} passed, ${failed} failed)`;
    
    return {
      overallPass,
      totalTests,
      passed,
      failed,
      results: this.results,
      summary
    };
  }
}

/**
 * Main entry point
 */
function main() {
  const harness = new VesselSelfConfigurationHarness();
  const result = harness.runAllTests();
  
  // Print results
  console.log('\n=== VALIDATION RESULTS ===\n');
  result.results.forEach((test, idx) => {
    const icon = test.pass ? '✅' : '❌';
    console.log(`${icon} Test ${idx + 1}: ${test.testName}`);
    if (!test.pass) {
      console.log(`   Expected: ${JSON.stringify(test.expected, null, 2)}`);
      console.log(`   Actual:   ${JSON.stringify(test.actual, null, 2)}`);
      if (test.error) {
        console.log(`   Error:    ${test.error}`);
      }
    }
  });
  
  console.log(`\n${result.summary}\n`);
  
  // Write JSON output
  const outputPath = path.join(__dirname, 'vessel-self-configuration-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Results written to: ${outputPath}\n`);
  
  // Exit with appropriate code
  process.exit(result.overallPass ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for testing
export type { ValidationResult, HarnessResult };
export { VesselSelfConfigurationHarness };
