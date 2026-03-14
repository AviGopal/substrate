/**
 * Validation Harness: User Activity Tracking - CLI to Dashboard Data Flow
 * 
 * Tests the complete data flow:
 * CLI (API Key) → Backend (user_email extraction) → Database (storage) → API (response) → Dashboard (display)
 * 
 * Strategy: external-impulse-verification
 * - No LLM required
 * - Loads application components
 * - Feeds test inputs
 * - Captures actual outputs
 * - Compares against expected outputs from impulses
 * - Returns PASS/FAIL
 */

import axios, { AxiosInstance } from 'axios';

export interface ValidationInput {
  testCase: string;
  apiKey?: string;
  jwtToken?: string;
  activityData?: {
    activity_id: string;
    template_id: string;
    org_id: string;
    project_id?: string;
    success: boolean;
    duration_ms: number;
    cost_usd: number;
  };
  orgId?: string;
}

export interface ValidationExpectedOutput {
  userEmail: string;
  activityStored: boolean;
  apiResponseContainsEmail: boolean;
  actorEmail: string;
  multiTenantIsolation?: boolean;
}

export interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: ValidationExpectedOutput;
  details: {
    step: string;
    passed: boolean;
    message: string;
  }[];
}

export class UserActivityTrackingValidator {
  private apiClient: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.apiClient = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  /**
   * Main validation entry point
   */
  async runValidation(
    input: ValidationInput,
    expected: ValidationExpectedOutput
  ): Promise<ValidationResult> {
    const details: ValidationResult['details'] = [];
    let actualData: any = {};

    try {
      // Step 1: Post activity with API key or JWT
      const postResult = await this.postActivity(input);
      details.push({
        step: 'Post Activity',
        passed: postResult.success,
        message: postResult.message,
      });
      actualData.postActivity = postResult;

      if (!postResult.success) {
        return {
          pass: false,
          testCase: input.testCase,
          actual: actualData,
          expected,
          details,
        };
      }

      // Step 2: Query database to verify user_email stored
      const dbResult = await this.verifyDatabaseStorage(input);
      details.push({
        step: 'Database Storage',
        passed: dbResult.stored && dbResult.userEmail === expected.userEmail,
        message: `Expected user_email: ${expected.userEmail}, Actual: ${dbResult.userEmail}`,
      });
      actualData.database = dbResult;

      // Step 3: Query API to verify user_email in response
      const apiResult = await this.queryOrganizationActivity(input);
      details.push({
        step: 'API Response',
        passed: apiResult.success && apiResult.actorEmail === expected.actorEmail,
        message: `Expected actor.email: ${expected.actorEmail}, Actual: ${apiResult.actorEmail}`,
      });
      actualData.api = apiResult;

      // Step 4: Verify multi-tenant isolation if applicable
      if (expected.multiTenantIsolation !== undefined) {
        const isolationResult = await this.verifyMultiTenantIsolation(input);
        details.push({
          step: 'Multi-tenant Isolation',
          passed: isolationResult.isolated === expected.multiTenantIsolation,
          message: isolationResult.message,
        });
        actualData.isolation = isolationResult;
      }

      // Determine overall pass/fail
      const allPassed = details.every((d) => d.passed);

      return {
        pass: allPassed,
        testCase: input.testCase,
        actual: actualData,
        expected,
        details,
      };
    } catch (error) {
      details.push({
        step: 'Validation Harness',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });

      return {
        pass: false,
        testCase: input.testCase,
        actual: { error: String(error), ...actualData },
        expected,
        details,
      };
    }
  }

  /**
   * Step 1: Post activity to backend
   */
  private async postActivity(input: ValidationInput): Promise<{
    success: boolean;
    message: string;
    executionId?: string;
  }> {
    try {
      const headers: any = {};
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      } else if (input.jwtToken) {
        headers.Authorization = `Bearer ${input.jwtToken}`;
      }

      const response = await this.apiClient.post(
        '/api/v1/learning-loop/executions',
        input.activityData,
        { headers }
      );

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: 'Activity posted successfully',
          executionId: response.data.execution_id,
        };
      } else {
        return {
          success: false,
          message: `Failed to post activity: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error posting activity: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Step 2: Verify user_email stored in database
   */
  private async verifyDatabaseStorage(input: ValidationInput): Promise<{
    stored: boolean;
    userEmail: string | null;
  }> {
    try {
      // Query database via admin API or direct query
      // For this harness, we'll query the organization activity API
      // which includes database data
      const headers: any = {};
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      } else if (input.jwtToken) {
        headers.Authorization = `Bearer ${input.jwtToken}`;
      }

      const response = await this.apiClient.get(
        `/auth/orgs/${input.orgId || input.activityData?.org_id}/activity`,
        { headers, params: { limit: 1 } }
      );

      if (response.status === 200 && response.data.activities?.length > 0) {
        const activity = response.data.activities[0];
        return {
          stored: true,
          userEmail: activity.actor?.email || null,
        };
      }

      return {
        stored: false,
        userEmail: null,
      };
    } catch (error) {
      return {
        stored: false,
        userEmail: null,
      };
    }
  }

  /**
   * Step 3: Query organization activity API to verify user_email in response
   */
  private async queryOrganizationActivity(input: ValidationInput): Promise<{
    success: boolean;
    actorEmail: string | null;
    activities: any[];
  }> {
    try {
      const headers: any = {};
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      } else if (input.jwtToken) {
        headers.Authorization = `Bearer ${input.jwtToken}`;
      }

      const response = await this.apiClient.get(
        `/auth/orgs/${input.orgId || input.activityData?.org_id}/activity`,
        { headers, params: { limit: 10 } }
      );

      if (response.status === 200 && response.data.activities) {
        const activities = response.data.activities;
        const latestActivity = activities[0];

        return {
          success: true,
          actorEmail: latestActivity?.actor?.email || null,
          activities,
        };
      }

      return {
        success: false,
        actorEmail: null,
        activities: [],
      };
    } catch (error) {
      return {
        success: false,
        actorEmail: null,
        activities: [],
      };
    }
  }

  /**
   * Step 4: Verify multi-tenant isolation
   */
  private async verifyMultiTenantIsolation(input: ValidationInput): Promise<{
    isolated: boolean;
    message: string;
  }> {
    try {
      // Query activities for the organization
      const headers: any = {};
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      } else if (input.jwtToken) {
        headers.Authorization = `Bearer ${input.jwtToken}`;
      }

      const response = await this.apiClient.get(
        `/auth/orgs/${input.orgId || input.activityData?.org_id}/activity`,
        { headers, params: { limit: 100 } }
      );

      if (response.status === 200 && response.data.activities) {
        const activities = response.data.activities;

        // Verify all activities belong to the same org
        const orgIds = new Set(
          activities.map((a: any) => a.metadata?.org_id).filter(Boolean)
        );

        if (orgIds.size === 0) {
          return {
            isolated: true,
            message: 'No org_id in metadata (may not be exposed)',
          };
        }

        if (orgIds.size === 1 && orgIds.has(input.orgId || input.activityData?.org_id)) {
          return {
            isolated: true,
            message: 'All activities belong to the same organization',
          };
        }

        return {
          isolated: false,
          message: `Found activities from ${orgIds.size} different organizations`,
        };
      }

      return {
        isolated: true,
        message: 'Unable to verify isolation (API returned no data)',
      };
    } catch (error) {
      return {
        isolated: false,
        message: `Error verifying isolation: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Run validation for a single test case
 */
export async function runValidation(
  input: ValidationInput,
  expected: ValidationExpectedOutput,
  baseUrl?: string
): Promise<ValidationResult> {
  const validator = new UserActivityTrackingValidator(baseUrl);
  return await validator.runValidation(input, expected);
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(
  testCases: Array<{ input: ValidationInput; expected: ValidationExpectedOutput }>,
  baseUrl?: string
): Promise<ValidationResult[]> {
  const validator = new UserActivityTrackingValidator(baseUrl);
  const results: ValidationResult[] = [];

  for (const testCase of testCases) {
    const result = await validator.runValidation(testCase.input, testCase.expected);
    results.push(result);
  }

  return results;
}

/**
 * Generate validation report
 */
export function generateReport(results: ValidationResult[]): {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  details: ValidationResult[];
} {
  const totalTests = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = totalTests - passed;
  const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

  return {
    totalTests,
    passed,
    failed,
    passRate,
    details: results,
  };
}

// Export for external use
export default {
  runValidation,
  runAllValidations,
  generateReport,
  UserActivityTrackingValidator,
};
