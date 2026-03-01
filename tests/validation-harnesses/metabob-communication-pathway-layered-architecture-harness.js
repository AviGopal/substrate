/**
 * Validation Harness: metabob-communication-pathway-layered-architecture
 * 
 * Validates that the communication pathway follows strict layered architecture:
 * metabob-opencode → metabob-cli → metabob-rpc-api → surrealdb
 * 
 * Each layer should only communicate with its adjacent layer.
 * No layer should bypass the intermediary layers.
 */

import * as fs from "node:fs";
import { execSync } from "node:child_process";

/**
 * Test Case 1: Verify metabob-cli never imports surrealdb
 */
function validateCliNoSurrealdbImport() {
  const cliPath = 'repos/metabob-cli';
  const expected = {
    surrealdbImports: 0,
    message: 'metabob-cli should never import surrealdb directly'
  };

  try {
    const result = execSync(
      `grep -r "import.*surrealdb\\|from.*surrealdb" ${cliPath} --include="*.py" || true`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    const matches = result.trim().split('\n').filter(line => line.length > 0);
    const actual = {
      surrealdbImports: matches.length,
      violations: matches
    };

    const pass = matches.length === 0;

    return {
      pass,
      actual,
      expected,
      details: pass 
        ? 'PASS: metabob-cli does not import surrealdb' 
        : `FAIL: Found ${matches.length} surrealdb imports in metabob-cli`,
      violations: pass ? [] : matches
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected,
      details: `ERROR: Failed to scan metabob-cli: ${error.message}`
    };
  }
}

/**
 * Test Case 2: Verify metabob-opencode never imports surrealdb
 */
function validateOpencodeNoSurrealdbImport() {
  const opencodePath = 'repos/metabob-opencode';
  const expected = {
    surrealdbImports: 0,
    message: 'metabob-opencode should never import surrealdb directly'
  };

  try {
    const result = execSync(
      `grep -r "import.*surrealdb\\|from.*surrealdb" ${opencodePath} --include="*.ts" --include="*.js" || true`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    const matches = result.trim().split('\n').filter(line => line.length > 0);
    const actual = {
      surrealdbImports: matches.length,
      violations: matches
    };

    const pass = matches.length === 0;

    return {
      pass,
      actual,
      expected,
      details: pass 
        ? 'PASS: metabob-opencode does not import surrealdb' 
        : `FAIL: Found ${matches.length} surrealdb imports in metabob-opencode`,
      violations: pass ? [] : matches
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected,
      details: `ERROR: Failed to scan metabob-opencode: ${error.message}`
    };
  }
}

/**
 * Test Case 3: Verify activity_template_tools uses api_client
 */
function validateActivityTemplateToolsUsesApiClient() {
  const toolsPath = 'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py';
  const expected = {
    importsApiClient: true,
    importsActivityTemplates: false,
    usesCallApi: true,
    message: 'activity_template_tools should use api_client.call_api'
  };

  try {
    const content = fs.readFileSync(toolsPath, 'utf-8');

    const importsApiClient = /from \.api_client import call_api/.test(content);
    const importsActivityTemplates = /from \. import activity_templates/.test(content);
    const usesCallApi = /await call_api\(/.test(content);
    const usesActivityTemplatesListTemplates = /activity_templates\.list_templates/.test(content);
    const usesActivityTemplatesGetTemplate = /activity_templates\.get_template/.test(content);
    const usesActivityTemplatesSaveTemplate = /activity_templates\.save_template/.test(content);

    const actual = {
      importsApiClient,
      importsActivityTemplates,
      usesCallApi,
      violations: {
        usesActivityTemplatesListTemplates,
        usesActivityTemplatesGetTemplate,
        usesActivityTemplatesSaveTemplate
      }
    };

    const violations = [];
    if (!importsApiClient) violations.push('Missing import of api_client.call_api');
    if (importsActivityTemplates) violations.push('Still imports activity_templates module');
    if (!usesCallApi) violations.push('Does not use call_api for HTTP requests');
    if (usesActivityTemplatesListTemplates) violations.push('Still uses activity_templates.list_templates()');
    if (usesActivityTemplatesGetTemplate) violations.push('Still uses activity_templates.get_template()');
    if (usesActivityTemplatesSaveTemplate) violations.push('Still uses activity_templates.save_template()');

    const pass = importsApiClient && !importsActivityTemplates && usesCallApi && violations.length === 0;

    return {
      pass,
      actual,
      expected,
      details: pass 
        ? 'PASS: activity_template_tools uses api_client correctly' 
        : `FAIL: Found ${violations.length} violations in activity_template_tools`,
      violations
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected,
      details: `ERROR: Failed to read activity_template_tools.py: ${error.message}`
    };
  }
}

/**
 * Test Case 4: Verify api_client uses configurable URL
 */
function validateApiClientUsesConfigurableUrl() {
  const apiClientPath = 'repos/metabob-cli/src/metabob_cli/mcp/api_client.py';
  const expected = {
    usesEnvironmentVariable: true,
    hasDefaultFallback: true,
    message: 'api_client should use METABOB_RPC_API_URL environment variable'
  };

  try {
    const content = fs.readFileSync(apiClientPath, 'utf-8');

    const usesEnvironmentVariable = /os\.environ\.get\(['"]METABOB_RPC_API_URL['"]/.test(content);
    const hasDefaultFallback = /os\.environ\.get\(['"]METABOB_RPC_API_URL['"],\s*['"]http:\/\/localhost:8080['"]/.test(content);

    const actual = {
      usesEnvironmentVariable,
      hasDefaultFallback
    };

    const violations = [];
    if (!usesEnvironmentVariable) violations.push('Does not read METABOB_RPC_API_URL environment variable');
    if (!hasDefaultFallback) violations.push('Missing localhost:8080 fallback');

    const pass = usesEnvironmentVariable && hasDefaultFallback;

    return {
      pass,
      actual,
      expected,
      details: pass 
        ? 'PASS: api_client uses configurable URL with fallback' 
        : `FAIL: Found ${violations.length} configuration issues`,
      violations
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected,
      details: `ERROR: Failed to read api_client.py: ${error.message}`
    };
  }
}

/**
 * Main validation runner
 */
export function runValidation(testCaseFilter) {
  const testCases = [
    {
      name: 'cli-no-surrealdb-import',
      description: 'Verify metabob-cli never imports surrealdb',
      validator: validateCliNoSurrealdbImport
    },
    {
      name: 'opencode-no-surrealdb-import',
      description: 'Verify metabob-opencode never imports surrealdb',
      validator: validateOpencodeNoSurrealdbImport
    },
    {
      name: 'activity-tools-uses-api-client',
      description: 'Verify activity_template_tools uses api_client',
      validator: validateActivityTemplateToolsUsesApiClient
    },
    {
      name: 'api-client-configurable-url',
      description: 'Verify api_client uses configurable RPC API URL',
      validator: validateApiClientUsesConfigurableUrl
    }
  ];

  const filteredTests = testCaseFilter
    ? testCases.filter(tc => tc.name === testCaseFilter)
    : testCases;

  const results = filteredTests.map(testCase => {
    console.log(`\nRunning: ${testCase.description}`);
    const result = testCase.validator();
    console.log(result.details);
    if (result.violations && result.violations.length > 0) {
      console.log('Violations:');
      result.violations.forEach(v => console.log(`  - ${v}`));
    }
    return { testCase: testCase.name, result };
  });

  const passed = results.filter(r => r.result.pass).length;
  const failed = results.filter(r => !r.result.pass).length;
  const allViolations = results
    .filter(r => r.result.violations && r.result.violations.length > 0)
    .flatMap(r => r.result.violations || []);

  const overallPass = failed === 0;

  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Overall: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

  if (allViolations.length > 0) {
    console.log('\nAll Violations:');
    allViolations.forEach(v => console.log(`  - ${v}`));
  }

  return {
    overallPass,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      violations: allViolations
    }
  };
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const testCaseFilter = process.argv[2];
  const result = runValidation(testCaseFilter);
  process.exit(result.overallPass ? 0 : 1);
}
