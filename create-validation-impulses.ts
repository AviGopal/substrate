#!/usr/bin/env bun
import fs from 'fs';

const testCases = [
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-1',
    name: 'MCP Connection Status',
    input: {
      check: 'test_metabob_mcp tool exists and is defined'
    },
    expectedOutput: {
      toolExists: true,
      toolDefined: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-2',
    name: 'TemplateLoader Source Verification',
    input: {
      file: 'repos/metabob-opencode/packages/opencode/src/session/template-loader.ts',
      check: 'TemplateLoader returns source="metabob" for backend templates'
    },
    expectedOutput: {
      fileExists: true,
      sourceMetabob: true,
      usesTemplateServiceClient: true,
      hasBootstrapFallback: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-3',
    name: 'No Direct File Access',
    input: {
      searchPath: 'repos/metabob-opencode/packages/opencode/src',
      pattern: '.metabob/activities',
      check: 'No active direct file access to .metabob/activities'
    },
    expectedOutput: {
      activeReferences: 0,
      allReferencesCommented: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-4',
    name: 'MetabobCLI No Local Writes',
    input: {
      file: 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts',
      check: 'MetabobCLI has no local template writes (lines 803-813 commented)'
    },
    expectedOutput: {
      fileExists: true,
      noLocalWrites: true,
      hasArchitecturalConstraintComment: true,
      callsMCPTools: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-5',
    name: 'Activity Agent Tool Configuration',
    input: {
      file: 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts',
      check: 'Activity agent has search_activities, no impulse tools'
    },
    expectedOutput: {
      hasSearchActivities: true,
      hasActivity: true,
      noImpulseCreate: true,
      noImpulseLoad: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-6',
    name: 'Memory Agent Tool Configuration',
    input: {
      file: 'repos/metabob-opencode/packages/opencode/src/agent/agent.ts',
      check: 'Memory agent has impulse tools and activity tools'
    },
    expectedOutput: {
      hasActivity: true,
      hasSearchActivities: true,
      hasImpulseCreate: true,
      hasImpulseLoad: true,
      hasImpulseUnload: true
    }
  },
  {
    id: 'validation-activity-template-flow-via-mcp-backend-case-7',
    name: 'TemplateServiceClient Delegation',
    input: {
      file: 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts',
      check: 'TemplateServiceClient delegates to MetabobCLI'
    },
    expectedOutput: {
      fileExists: true,
      callsSearchActivities: true,
      callsGetActivity: true,
      callsRegisterActivityTemplate: true
    }
  }
];

console.log(`Creating ${testCases.length} validation impulses...\n`);

testCases.forEach((testCase, index) => {
  const impulse = {
    id: testCase.id,
    type: 'memo',
    pointer: {
      type: 'memo',
      content: `# Validation Test Case: ${testCase.name}

## Input
\`\`\`json
${JSON.stringify(testCase.input, null, 2)}
\`\`\`

## Expected Output
\`\`\`json
${JSON.stringify(testCase.expectedOutput, null, 2)}
\`\`\`

## Test Description
This test case validates that ${testCase.input.check || 'the component'} meets the specification requirements for Activity Template Flow via MCP Backend.

## Validation Type
Static code analysis - no LLM required
`,
      source: 'validation-harness'
    },
    budget: 500,
    priority: 'high',
    metadata: {
      specification: 'Activity Template Flow via MCP Backend',
      testName: testCase.name,
      testCaseNumber: index + 1,
      totalTestCases: testCases.length
    }
  };

  fs.writeFileSync(
    `./impulses/${impulse.id}.json`,
    JSON.stringify(impulse, null, 2)
  );

  console.log(`✅ Created: ${impulse.id}`);
});

console.log(`\n✅ All ${testCases.length} validation impulses created`);
console.log('📁 Location: ./impulses/validation-activity-template-flow-via-mcp-backend-case-*.json');
