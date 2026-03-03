#!/usr/bin/env ts-node

import { writeFileSync } from 'fs';
import { join } from 'path';

// Test case definitions
const testCases = [
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-1',
    name: 'Create Template - POST /v2/activities/templates',
    input: {
      method: 'POST',
      endpoint: '/v2/activities/templates',
      data: {
        name: 'validation-test-template',
        description: 'Test template for validation',
        category: 'feature',
        tasks: [
          {
            id: 'task-1',
            description: 'Test task',
            prompt: { template: 'Test prompt' },
            subagent: 'general'
          }
        ],
        org_id: 'test-org',
        project_id: 'test-project',
        scope: 'project'
      }
    },
    expectedOutput: {
      statusCode: 201,
      responseSchema: {
        variant_id: 'string',
        name: 'string',
        category: 'string',
        tasks: 'array'
      },
      validations: [
        'Response is valid JSON',
        'variant_id is present and not null',
        'No RecordID serialization errors'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-2',
    name: 'Get Template by ID - GET /v2/activities/templates/{id}',
    input: {
      method: 'GET',
      endpoint: '/v2/activities/templates/{id}',
      description: 'Critical test for RecordID serialization fix'
    },
    expectedOutput: {
      statusCode: 200,
      responseSchema: {
        variant_id: 'string',
        name: 'string',
        category: 'string',
        tasks: 'array'
      },
      validations: [
        'Response is valid JSON',
        'variant_id matches requested ID',
        'No RecordID objects in response (must be strings)',
        'No TypeError or serialization errors',
        'All ID fields are strings, not objects'
      ],
      criticalValidation: 'This test validates the RecordID serialization fix is working'
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-3',
    name: 'List Templates - GET /v2/activities/templates',
    input: {
      method: 'GET',
      endpoint: '/v2/activities/templates',
      queryParams: {
        org_id: 'test-org',
        project_id: 'test-project'
      }
    },
    expectedOutput: {
      statusCode: 200,
      responseSchema: {
        templates: 'array'
      },
      validations: [
        'Response is valid JSON',
        'templates is an array',
        'Each template has variant_id as string',
        'No RecordID serialization errors in any template'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-4',
    name: 'Update Template Metrics - POST /v2/activities/templates/{id}/metrics',
    input: {
      method: 'POST',
      endpoint: '/v2/activities/templates/{id}/metrics',
      data: {
        success: true,
        duration: 45000,
        cost: 0.0234,
        tokens: {
          input: 1000,
          output: 500,
          cache: 200
        }
      }
    },
    expectedOutput: {
      statusCode: 200,
      validations: [
        'Metrics updated successfully',
        'SurrealDB merge operation preserves variant_id'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-5',
    name: 'Get Template Metrics - GET /api/v1/learning-loop/templates/{id}/metrics',
    input: {
      method: 'GET',
      endpoint: '/api/v1/learning-loop/templates/{id}/metrics'
    },
    expectedOutput: {
      statusCode: 200,
      responseSchema: {
        success_rate: 'number',
        avg_duration: 'number',
        avg_cost: 'number',
        total_executions: 'number'
      },
      validations: [
        'Response is valid JSON',
        'No RecordID serialization errors',
        'Metrics data properly aggregated'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-6',
    name: 'Record Execution - POST /api/v1/learning-loop/executions',
    input: {
      method: 'POST',
      endpoint: '/api/v1/learning-loop/executions',
      data: {
        template_id: '{template_id}',
        variant_id: '{variant_id}',
        success: true,
        duration: 30000,
        cost: 0.015,
        tokens: {
          input: 800,
          output: 400,
          cache: 150
        }
      }
    },
    expectedOutput: {
      statusCode: 201,
      validations: [
        'Execution record created in SurrealDB',
        'Metrics updated after execution',
        'Response is valid JSON'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-7',
    name: 'Get Boredom Activities - GET /api/v1/learning-loop/boredom-activities',
    input: {
      method: 'GET',
      endpoint: '/api/v1/learning-loop/boredom-activities',
      queryParams: {
        org_id: 'test-org'
      }
    },
    expectedOutput: {
      statusCode: 200,
      responseSchema: {
        activities: 'array'
      },
      validations: [
        'Response is valid JSON',
        'No RecordID errors in activity list'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-8',
    name: 'Create Activity Storage - POST /v2/activities/storage',
    input: {
      method: 'POST',
      endpoint: '/v2/activities/storage',
      data: {
        activity_id: 'test-activity-{timestamp}',
        template_id: 'test-template',
        status: 'running',
        org_id: 'test-org',
        project_id: 'test-project'
      }
    },
    expectedOutput: {
      statusCode: 201,
      responseSchema: {
        activity_id: 'string',
        status: 'string'
      },
      validations: [
        'Activity created in SurrealDB',
        'activity_id returned as string',
        'Response is valid JSON'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-9',
    name: 'Get Activity Storage - GET /v2/activities/storage/{id}',
    input: {
      method: 'GET',
      endpoint: '/v2/activities/storage/{id}'
    },
    expectedOutput: {
      statusCode: 200,
      responseSchema: {
        activity_id: 'string',
        status: 'string'
      },
      validations: [
        'Response is valid JSON',
        'activity_id is string',
        'No RecordID serialization errors'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-10',
    name: 'Record Task Start - POST /v2/activities/tasks',
    input: {
      method: 'POST',
      endpoint: '/v2/activities/tasks',
      data: {
        activity_id: '{activity_id}',
        task_id: 'task-1',
        status: 'running',
        started_at: '{timestamp}'
      }
    },
    expectedOutput: {
      statusCode: 201,
      responseSchema: {
        id: 'string',
        task_id: 'string',
        status: 'string'
      },
      validations: [
        'Task execution created',
        'ID returned as string',
        'Response is valid JSON'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-11',
    name: 'Update Task Execution - PATCH /v2/activities/tasks/{id}',
    input: {
      method: 'PATCH',
      endpoint: '/v2/activities/tasks/{id}',
      data: {
        status: 'completed',
        completed_at: '{timestamp}',
        success: true
      }
    },
    expectedOutput: {
      statusCode: 200,
      validations: [
        'Task execution updated',
        'Status persisted to SurrealDB'
      ]
    }
  },
  {
    id: 'validation-rpc-api-endpoint-database-integration-case-12',
    name: 'E2E Workflow - Create → Execute → Retrieve',
    input: {
      workflow: [
        { step: 1, action: 'Create template', endpoint: '/v2/activities/templates' },
        { step: 2, action: 'Record execution', endpoint: '/api/v1/learning-loop/executions' },
        { step: 3, action: 'Retrieve template', endpoint: '/v2/activities/templates/{id}' },
        { step: 4, action: 'Get metrics', endpoint: '/api/v1/learning-loop/templates/{id}/metrics' }
      ]
    },
    expectedOutput: {
      validations: [
        'All steps complete successfully',
        'Data persists across operations',
        'No RecordID errors at any stage',
        'Metrics reflect execution',
        'Complete workflow demonstrates database integration'
      ],
      criticalValidation: 'This E2E test validates the entire data flow from creation to retrieval'
    }
  }
];

// Create impulses for each test case
testCases.forEach(testCase => {
  const impulseData = {
    id: testCase.id,
    type: 'memo',
    pointer: {
      type: 'memo',
      content: JSON.stringify(testCase, null, 2),
      source: 'validation-harness'
    },
    priority: testCase.id.includes('case-2') ? 'critical' : 'high',
    budget: 1000,
    metadata: {
      specification: 'rpc-api-endpoint-database-integration',
      category: 'validation-test-case',
      testName: testCase.name,
      endpoint: testCase.input.endpoint || testCase.input.workflow?.[0]?.endpoint,
      method: testCase.input.method || 'WORKFLOW',
      expectedStatus: testCase.expectedOutput.statusCode || 'variable',
      criticalTest: testCase.id.includes('case-2') || testCase.id.includes('case-12')
    },
    createdAt: new Date().toISOString()
  };

  const impulseFile = join('impulses', `${testCase.id}.json`);
  writeFileSync(impulseFile, JSON.stringify(impulseData, null, 2));
  console.log(`✅ Created: ${impulseFile}`);
});

console.log(`\n✅ Created ${testCases.length} validation test case impulses`);
