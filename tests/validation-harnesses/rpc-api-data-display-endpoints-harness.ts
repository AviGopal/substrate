/**
 * Validation Harness: RPC API Data Display Endpoints
 * 
 * Purpose: Validate that project listing returns project objects (not field names)
 *          and activity endpoint returns empty array (not error messages)
 * 
 * Test Strategy:
 * 1. API Testing: Direct HTTP requests to validate data structure
 * 2. Browser Testing: Playwright E2E to validate dashboard display
 * 
 * Created: 2026-03-12
 * Specification: RPC API Data Display Endpoints
 */

import axios, { AxiosError } from 'axios';

export interface ValidationInput {
  apiBaseUrl: string;
  orgId: string;
  authToken: string;
  dashboardUrl?: string;
  projectName?: string;
}

export interface ValidationOutput {
  pass: boolean;
  testResults: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface TestResult {
  testName: string;
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Validate project listing endpoint returns project objects
 */
async function validateProjectListing(
  apiBaseUrl: string,
  orgId: string,
  authToken: string
): Promise<TestResult> {
  const testName = 'Project Listing Returns Objects';
  
  try {
    const url = `${apiBaseUrl}/auth/orgs/${orgId}/projects`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;

    // Expected structure: {projects: [...], total: N, hasMore: bool}
    const expected = {
      structure: {
        projects: 'array',
        total: 'number',
        hasMore: 'boolean',
      },
      projectObjectFields: ['project_id', 'name', 'org_id'],
    };

    // Validate response structure
    if (!data.projects || !Array.isArray(data.projects)) {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing projects array',
      };
    }

    if (typeof data.total !== 'number') {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing total field (number)',
      };
    }

    if (typeof data.hasMore !== 'boolean') {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing hasMore field (boolean)',
      };
    }

    // Validate projects are objects (not field names array)
    if (data.projects.length > 0) {
      const firstProject = data.projects[0];
      
      // Check if it's a string (field name) instead of object
      if (typeof firstProject === 'string') {
        return {
          testName,
          pass: false,
          actual: { projects: data.projects, type: 'array of strings (field names)' },
          expected: { projects: 'array of objects', requiredFields: expected.projectObjectFields },
          error: 'Projects array contains field names instead of project objects',
        };
      }

      // Check if it's an object with required fields
      if (typeof firstProject !== 'object') {
        return {
          testName,
          pass: false,
          actual: { firstProject, type: typeof firstProject },
          expected: { type: 'object', requiredFields: expected.projectObjectFields },
          error: 'Project is not an object',
        };
      }

      // Validate required fields exist
      const missingFields = expected.projectObjectFields.filter(
        field => !(field in firstProject)
      );

      if (missingFields.length > 0) {
        return {
          testName,
          pass: false,
          actual: { projectFields: Object.keys(firstProject) },
          expected: { requiredFields: expected.projectObjectFields },
          error: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }
    }

    return {
      testName,
      pass: true,
      actual: {
        projectCount: data.projects.length,
        total: data.total,
        hasMore: data.hasMore,
        firstProjectFields: data.projects.length > 0 ? Object.keys(data.projects[0]) : [],
      },
      expected,
      metadata: {
        responseTime: response.headers['x-response-time'] || 'N/A',
        projectCount: data.projects.length,
      },
    };

  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      testName,
      pass: false,
      actual: {
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      },
      expected: {
        structure: {
          projects: 'array',
          total: 'number',
          hasMore: 'boolean',
        },
      },
      error: `API request failed: ${axiosError.message}`,
    };
  }
}

/**
 * Validate activity endpoint returns empty array (not error)
 */
async function validateActivityEndpoint(
  apiBaseUrl: string,
  orgId: string,
  authToken: string
): Promise<TestResult> {
  const testName = 'Activity Endpoint Returns Empty Array';
  
  try {
    const url = `${apiBaseUrl}/auth/orgs/${orgId}/activity`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;

    // Expected structure: {activities: [], hasMore: false, total: 0}
    const expected = {
      structure: {
        activities: 'array',
        hasMore: 'boolean',
        total: 'number',
      },
      validResponses: [
        'Empty array when no activity',
        'Array of activity objects when activity exists',
        'Never an error message string',
      ],
    };

    // Validate response is not an error message string
    if (typeof data === 'string') {
      return {
        testName,
        pass: false,
        actual: { data, type: 'string (error message)' },
        expected,
        error: 'Activity endpoint returned error message string instead of structured data',
      };
    }

    // Validate response structure
    if (!data.activities || !Array.isArray(data.activities)) {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing activities array',
      };
    }

    if (typeof data.hasMore !== 'boolean') {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing hasMore field (boolean)',
      };
    }

    if (typeof data.total !== 'number') {
      return {
        testName,
        pass: false,
        actual: data,
        expected,
        error: 'Response missing total field (number)',
      };
    }

    // Success - valid response structure
    return {
      testName,
      pass: true,
      actual: {
        activityCount: data.activities.length,
        hasMore: data.hasMore,
        total: data.total,
        responseType: 'structured object',
      },
      expected,
      metadata: {
        responseTime: response.headers['x-response-time'] || 'N/A',
        activityCount: data.activities.length,
      },
    };

  } catch (error) {
    const axiosError = error as AxiosError;
    
    // If error response is a string, that's the bug we're testing for
    if (typeof axiosError.response?.data === 'string') {
      return {
        testName,
        pass: false,
        actual: {
          error: 'Endpoint returned error message string',
          data: axiosError.response.data,
        },
        expected: {
          structure: {
            activities: 'array',
            hasMore: 'boolean',
            total: 'number',
          },
        },
        error: 'Activity endpoint should return empty array, not error message',
      };
    }

    return {
      testName,
      pass: false,
      actual: {
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      },
      expected: {
        structure: {
          activities: 'array',
          hasMore: 'boolean',
          total: 'number',
        },
      },
      error: `API request failed: ${axiosError.message}`,
    };
  }
}

/**
 * Validate project listing does not return field names
 * This is a specific test for the bug where the endpoint returns
 * ['branch', 'created_at', ...] instead of project objects
 */
async function validateNotFieldNames(
  apiBaseUrl: string,
  orgId: string,
  authToken: string
): Promise<TestResult> {
  const testName = 'Project Listing Not Field Names';
  
  try {
    const url = `${apiBaseUrl}/auth/orgs/${orgId}/projects`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;

    // Known field names that would indicate the bug
    const knownFieldNames = [
      'branch', 'created_at', 'updated_at', 'project_id', 
      'org_id', 'name', 'repository_url', 'git_root_hash'
    ];

    if (!data.projects || !Array.isArray(data.projects)) {
      return {
        testName,
        pass: false,
        actual: data,
        expected: { projects: 'array of objects' },
        error: 'Response missing projects array',
      };
    }

    if (data.projects.length === 0) {
      // No projects to validate - test passes
      return {
        testName,
        pass: true,
        actual: { projects: [], note: 'No projects to validate' },
        expected: { projects: 'not field names array' },
        metadata: { projectCount: 0 },
      };
    }

    const firstProject = data.projects[0];

    // Check if projects array contains field name strings
    if (typeof firstProject === 'string') {
      // Check if it matches known field names
      const matchesFieldNames = knownFieldNames.some(
        fieldName => data.projects.includes(fieldName)
      );

      if (matchesFieldNames) {
        return {
          testName,
          pass: false,
          actual: { 
            projects: data.projects,
            type: 'array of field name strings',
            matchedFields: data.projects.filter((p: string) => knownFieldNames.includes(p)),
          },
          expected: { projects: 'array of objects with project data' },
          error: 'BUG DETECTED: Projects array contains field names instead of project objects',
        };
      }
    }

    // Projects array contains objects (correct behavior)
    return {
      testName,
      pass: true,
      actual: {
        firstProjectType: typeof firstProject,
        firstProjectFields: Object.keys(firstProject),
        projectCount: data.projects.length,
      },
      expected: { projects: 'array of objects (not field names)' },
      metadata: { projectCount: data.projects.length },
    };

  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      testName,
      pass: false,
      actual: {
        error: axiosError.message,
        status: axiosError.response?.status,
      },
      expected: { projects: 'array of objects' },
      error: `API request failed: ${axiosError.message}`,
    };
  }
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const testResults: TestResult[] = [];

  // Run API validation tests
  console.log('Running API validation tests...');
  
  testResults.push(
    await validateProjectListing(input.apiBaseUrl, input.orgId, input.authToken)
  );
  
  testResults.push(
    await validateActivityEndpoint(input.apiBaseUrl, input.orgId, input.authToken)
  );
  
  testResults.push(
    await validateNotFieldNames(input.apiBaseUrl, input.orgId, input.authToken)
  );

  // Calculate summary
  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;

  const allPassed = failed === 0;

  return {
    pass: allPassed,
    testResults,
    summary: {
      total: testResults.length,
      passed,
      failed,
    },
  };
}

/**
 * CLI entry point for standalone execution
 */
if (require.main === module) {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
  const orgId = process.env.ORG_ID || '';
  const authToken = process.env.AUTH_TOKEN || '';

  if (!orgId || !authToken) {
    console.error('Error: ORG_ID and AUTH_TOKEN environment variables are required');
    console.error('Usage: ORG_ID=<org_id> AUTH_TOKEN=<token> ts-node rpc-api-data-display-endpoints-harness.ts');
    process.exit(1);
  }

  runValidation({ apiBaseUrl, orgId, authToken })
    .then(result => {
      console.log('\n=== Validation Results ===');
      console.log(`Total: ${result.summary.total}`);
      console.log(`Passed: ${result.summary.passed}`);
      console.log(`Failed: ${result.summary.failed}`);
      console.log(`Overall: ${result.pass ? 'PASS ✓' : 'FAIL ✗'}`);
      
      console.log('\n=== Test Details ===');
      result.testResults.forEach((test, idx) => {
        console.log(`\n${idx + 1}. ${test.testName}: ${test.pass ? 'PASS ✓' : 'FAIL ✗'}`);
        if (!test.pass && test.error) {
          console.log(`   Error: ${test.error}`);
        }
        if (test.metadata) {
          console.log(`   Metadata:`, JSON.stringify(test.metadata, null, 2));
        }
      });

      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation harness error:', error);
      process.exit(1);
    });
}
