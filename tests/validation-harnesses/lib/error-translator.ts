/**
 * Error translation utilities for minibob validation harnesses
 * 
 * Purpose: Transform generic errors into actionable messages with fix suggestions
 * Used by: All validation harnesses for better user experience
 */

export interface ActionableError {
  message: string;
  suggestedFix: string;
  documentationLink?: string;
  category: 'dependency' | 'infrastructure' | 'configuration' | 'network' | 'unknown';
}

/**
 * Translate generic error to actionable error with fix suggestions
 */
export function translateError(error: Error | string): ActionableError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  // kubectl errors
  if (lowerMessage.includes('kubectl') && lowerMessage.includes('not found')) {
    return {
      message: 'kubectl not found in PATH',
      suggestedFix: 'Install kubectl from https://kubernetes.io/docs/tasks/tools/',
      documentationLink: 'https://kubernetes.io/docs/tasks/tools/',
      category: 'dependency'
    };
  }

  if (lowerMessage.includes('unable to connect') || lowerMessage.includes('connection refused')) {
    return {
      message: 'Unable to connect to Kubernetes cluster',
      suggestedFix: 'Verify cluster is running with: kubectl cluster-info',
      documentationLink: 'https://kubernetes.io/docs/setup/',
      category: 'infrastructure'
    };
  }

  // helmfile errors
  if (lowerMessage.includes('helmfile') && lowerMessage.includes('not found')) {
    return {
      message: 'helmfile not found in PATH',
      suggestedFix: 'Install helmfile from https://helmfile.readthedocs.io/en/latest/#installation',
      documentationLink: 'https://helmfile.readthedocs.io/en/latest/#installation',
      category: 'dependency'
    };
  }

  // bun errors
  if (lowerMessage.includes('bun') && lowerMessage.includes('not found')) {
    return {
      message: 'bun not found in PATH',
      suggestedFix: 'Install bun from https://bun.sh/docs/installation',
      documentationLink: 'https://bun.sh/docs/installation',
      category: 'dependency'
    };
  }

  // docker errors
  if (lowerMessage.includes('docker') && lowerMessage.includes('not found')) {
    return {
      message: 'docker not found in PATH',
      suggestedFix: 'Install docker from https://docs.docker.com/get-docker/',
      documentationLink: 'https://docs.docker.com/get-docker/',
      category: 'dependency'
    };
  }

  if (lowerMessage.includes('cannot connect to the docker daemon')) {
    return {
      message: 'Docker daemon not running',
      suggestedFix: 'Start docker service or Docker Desktop',
      documentationLink: 'https://docs.docker.com/config/daemon/',
      category: 'infrastructure'
    };
  }

  // Namespace errors
  if (lowerMessage.includes('namespace') && lowerMessage.includes('not found')) {
    const namespaceMatch = errorMessage.match(/namespace[s]?\s+["']?([a-z0-9-]+)["']?/i);
    const namespace = namespaceMatch ? namespaceMatch[1] : 'testing-minibob';
    return {
      message: `Namespace '${namespace}' not found`,
      suggestedFix: `Create namespace: kubectl create namespace ${namespace}`,
      documentationLink: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/',
      category: 'infrastructure'
    };
  }

  // Pod errors
  if (lowerMessage.includes('no resources found') || lowerMessage.includes('no pods found')) {
    return {
      message: 'No pods found in namespace',
      suggestedFix: 'Deploy minibob: cd helm && helmfile -e testing sync -l namespace=testing-minibob',
      documentationLink: 'https://kubernetes.io/docs/concepts/workloads/pods/',
      category: 'infrastructure'
    };
  }

  // Deployment errors
  if (lowerMessage.includes('deployment') && lowerMessage.includes('not found')) {
    const deploymentMatch = errorMessage.match(/deployment[s]?\s+["']?([a-z0-9-]+)["']?/i);
    const deployment = deploymentMatch ? deploymentMatch[1] : 'metabob-rpc-api';
    return {
      message: `Deployment '${deployment}' not found`,
      suggestedFix: `Deploy backend: cd helm && helmfile -e testing sync -l app=${deployment}`,
      category: 'infrastructure'
    };
  }

  // Port-forward errors
  if (lowerMessage.includes('port-forward') || lowerMessage.includes('unable to forward')) {
    return {
      message: 'Port-forward failed',
      suggestedFix: 'Verify pod is running: kubectl get pods -n testing-minibob',
      documentationLink: 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/',
      category: 'network'
    };
  }

  // File/path errors
  if (lowerMessage.includes('enoent') || lowerMessage.includes('no such file or directory')) {
    const pathMatch = errorMessage.match(/['"]([^'"]+)['"]/);
    const path = pathMatch ? pathMatch[1] : 'path';
    return {
      message: `Path not found: ${path}`,
      suggestedFix: `Verify path exists or create it: mkdir -p ${path}`,
      category: 'configuration'
    };
  }

  // Permission errors
  if (lowerMessage.includes('eacces') || lowerMessage.includes('permission denied')) {
    const pathMatch = errorMessage.match(/['"]([^'"]+)['"]/);
    const path = pathMatch ? pathMatch[1] : 'file';
    return {
      message: `Permission denied: ${path}`,
      suggestedFix: `Make script executable: chmod +x ${path}`,
      category: 'configuration'
    };
  }

  // Network errors
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('fetch failed')) {
    return {
      message: 'Connection refused - service may not be running',
      suggestedFix: 'Verify pods are running and port-forward is active',
      category: 'network'
    };
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
    return {
      message: 'Request timeout',
      suggestedFix: 'Check network connectivity and service health',
      category: 'network'
    };
  }

  // Backend API errors
  if (lowerMessage.includes('backend') && (lowerMessage.includes('unreachable') || lowerMessage.includes('unavailable'))) {
    return {
      message: 'Backend API unreachable',
      suggestedFix: 'Deploy backend: cd helm && helmfile -e testing sync -l app=metabob-rpc-api',
      category: 'infrastructure'
    };
  }

  // Test failure errors
  if (lowerMessage.includes('test failed') || lowerMessage.includes('assertion failed')) {
    return {
      message: 'Test assertion failed',
      suggestedFix: 'Check test output for details and verify expected behavior',
      category: 'configuration'
    };
  }

  // Generic fallback
  return {
    message: errorMessage.length > 200 ? errorMessage.substring(0, 200) + '...' : errorMessage,
    suggestedFix: 'Check error details and verify prerequisites are met',
    category: 'unknown'
  };
}

/**
 * Wrap error with actionable context
 */
export function wrapError(error: Error | string, context?: string): ActionableError {
  const actionable = translateError(error);
  if (context) {
    actionable.message = `${context}: ${actionable.message}`;
  }
  return actionable;
}

/**
 * Format actionable error for display
 */
export function formatError(error: ActionableError, includeLink = true): string {
  let output = `❌ ${error.message}\n`;
  output += `   Fix: ${error.suggestedFix}\n`;
  if (includeLink && error.documentationLink) {
    output += `   Docs: ${error.documentationLink}\n`;
  }
  return output;
}

/**
 * Try-catch wrapper that returns actionable errors
 */
export async function tryWithActionableError<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ success: true; result: T } | { success: false; error: ActionableError }> {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    const actionableError = wrapError(error as Error, context);
    return { success: false, error: actionableError };
  }
}
