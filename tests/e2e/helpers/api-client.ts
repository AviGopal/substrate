/**
 * API Client for E2E tests
 *
 * Provides helper functions for calling metabob APIs directly.
 * All functions are black-box - they only use public APIs.
 *
 * Service URLs (development):
 * - activity.metabob.local → metabob-activity-api (auth, templates, traces, impulses)
 * - api.metabob.local → metabob-analysis-api (user auth, analysis routes)
 * - app.metabob.local → metabob-cloud-dashboard
 *
 * NOTE: metabob-mcp uses /v2/auth/apikey from analysis-api (after M2.0.1 fix).
 * MiniBob uses /v2/auth/minibob/signin from activity-api.
 */

// Activity API: MiniBob auth, templates, execution traces, impulses
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';

// Analysis API: User auth, code analysis, projects, orgs
const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || 'http://api.metabob.local';

// Legacy alias (defaults to activity-api for backwards compatibility)
const API_URL = process.env.API_URL || ACTIVITY_API_URL;

export interface AuthResponse {
  token: string;
  org_id: string;
  user_id?: string;
  project_id?: string;
  project_ids?: string[];
  scopes?: string[];
  expires_at?: string;
  expires_in?: number;
}

export interface Template {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: string;
  scope?: string;
  org_id?: string;
  project_id?: string;
  public?: boolean;
  metrics?: {
    total_executions: number;
    success_rate: number;
    thompson_alpha: number;
    thompson_beta: number;
  };
}

export interface ExecutionTrace {
  execution_id: string;
  variant_id: string;
  success: boolean;
  duration_ms: number;
  cost_usd: number;
  org_id: string;
  project_id?: string;
  tokens_input: number;
  tokens_output: number;
  tokens_cache: number;
  error_message?: string;
  error_type?: string;
}

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Authenticate a MiniBob instance and return JWT token
 */
export async function authenticateMiniBob(
  instanceId: string,
  apiKey: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/v2/auth/minibob/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: instanceId,
      api_key: apiKey
    })
  });

  if (!response.ok) {
    throw new Error(`MiniBob auth failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Authenticate with an API key and return JWT token
 */
export async function authenticateWithApiKey(apiKey: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/v2/auth/apikey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });

  if (!response.ok) {
    throw new Error(`API key auth failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Authenticate a user with email/password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(`User auth failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Get templates with optional filters
 */
export async function getTemplates(
  token: string,
  options?: { scope?: string; limit?: number; category?: string }
): Promise<Template[]> {
  const params = new URLSearchParams();
  if (options?.scope) params.set('scope', options.scope);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.category) params.set('category', options.category);

  const url = `${API_URL}/v2/activities/templates${params.toString() ? '?' + params : ''}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Get templates failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.templates || [];
}

/**
 * Create a new template
 */
export async function createTemplate(
  token: string,
  template: Partial<Template> & { name: string; scope: string }
): Promise<{ success: boolean; variant_id: string }> {
  const response = await fetch(`${API_URL}/v2/activities/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      variant_id: template.variant_id || `test-${Date.now()}`,
      activity_id: template.activity_id || `activity-${Date.now()}`,
      variant_name: template.name,
      description: template.description || 'Test template',
      category: template.category || 'tool',
      task_steps: [],
      scope: template.scope,
      public: template.public || false,
      org_id: template.org_id,
      project_id: template.project_id
    })
  });

  if (!response.ok) {
    throw new Error(`Create template failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// ============================================================================
// Execution Trace Functions
// ============================================================================

/**
 * Create an execution trace
 */
export async function createExecutionTrace(
  token: string,
  trace: {
    variant_id: string;
    success: boolean;
    duration_ms: number;
    cost: number;
    tokens: { input: number; output: number; cache: number };
    error_message?: string;
    error_type?: string;
  }
): Promise<{ execution_id: string; metrics?: object }> {
  const response = await fetch(`${API_URL}/v2/activities/execution-traces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(trace)
  });

  if (!response.ok) {
    throw new Error(`Create trace failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Get an execution trace by ID
 */
export async function getExecutionTrace(
  token: string,
  executionId: string
): Promise<ExecutionTrace | null> {
  const response = await fetch(`${API_URL}/v2/activities/execution-traces/${executionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Get trace failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Get execution traces with optional filters
 */
export async function getExecutionTraces(
  token: string,
  options?: { variant_id?: string; limit?: number; offset?: number }
): Promise<ExecutionTrace[]> {
  const params = new URLSearchParams();
  if (options?.variant_id) params.set('variant_id', options.variant_id);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const url = `${API_URL}/v2/activities/execution-traces${params.toString() ? '?' + params : ''}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Get traces failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.traces || [];
}

// ============================================================================
// Impulse Functions
// ============================================================================

/**
 * Create an impulse
 */
export async function createImpulse(
  token: string,
  impulse: {
    impulse_id: string;
    impulse_data: object;
    impulse_type?: string;
  }
): Promise<{ success: boolean; impulse_id: string }> {
  const response = await fetch(`${API_URL}/v2/impulses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(impulse)
  });

  if (!response.ok) {
    throw new Error(`Create impulse failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Resolve an impulse
 */
export async function resolveImpulse(
  token: string,
  options: {
    impulse_id: string;
    pointer: { type: string; [key: string]: unknown };
    budget: number;
  }
): Promise<{ content: string; tokens_used: number } | null> {
  const response = await fetch(`${API_URL}/v2/impulses/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(options)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Resolve impulse failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// ============================================================================
// Project Functions
// ============================================================================

/**
 * Add user to project
 */
export async function addUserToProject(
  token: string,
  userId: string,
  projectId: string,
  role: string = 'developer'
): Promise<void> {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: userId, role })
  });

  if (!response.ok) {
    throw new Error(`Add user to project failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Remove user from project
 */
export async function removeUserFromProject(
  token: string,
  userId: string,
  projectId: string
): Promise<void> {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Remove user from project failed: ${response.status} ${await response.text()}`);
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check API health
 */
export async function checkHealth(): Promise<{
  status: string;
  checks: {
    redis: { status: string; latency_ms?: number };
    surrealdb: { status: string; latency_ms?: number };
  };
}> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an expired JWT for testing
 */
export function createExpiredJWT(claims: { org_id: string }): string {
  // Create a JWT with exp in the past
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    ...claims,
    exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  }));
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout || 30000;
  const interval = options?.interval || 1000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
