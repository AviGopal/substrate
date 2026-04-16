/**
 * Audit Logger
 *
 * Structured logging for all administrative operations.
 * Logs are written to stdout in JSON format for aggregation.
 * Optionally pushes to activity-api for centralized storage.
 */

export interface AuditEvent {
  timestamp: string;
  user: string; // From Zero Trust headers (email)
  action: string; // e.g., "query_execute", "component_create", "system_health_check"
  resource: string; // Resource being accessed
  success: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Log audit event to stdout (structured JSON)
 *
 * This is the primary audit mechanism - logs are captured
 * by container runtime and forwarded to log aggregation.
 */
export function logAudit(event: AuditEvent): void {
  const auditLog = {
    type: 'audit',
    service: 'metabob-internal-dashboard',
    ...event
  };

  console.log(JSON.stringify(auditLog));
}

/**
 * Send audit log to activity-api (optional)
 *
 * Provides centralized audit storage queryable via SurrealDB.
 * Non-blocking - failures are logged but don't affect operations.
 */
export async function sendAuditToActivityApi(
  event: AuditEvent,
  activityApiUrl: string
): Promise<void> {
  try {
    const response = await fetch(`${activityApiUrl}/v2/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error('Failed to send audit log to activity-api:', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    console.error('Audit log delivery to activity-api failed:', error);
  }
}

/**
 * Create and log an audit event
 *
 * Convenience function that logs to stdout and optionally
 * sends to activity-api if URL is configured.
 */
export function audit(
  user: string,
  action: string,
  resource: string,
  success: boolean,
  metadata?: Record<string, unknown>,
  error?: string,
  activityApiUrl?: string
): void {
  const event: AuditEvent = {
    timestamp: new Date().toISOString(),
    user,
    action,
    resource,
    success,
    metadata,
    error,
  };

  logAudit(event);

  // Optional: Send to activity-api for centralized storage
  if (activityApiUrl) {
    sendAuditToActivityApi(event, activityApiUrl).catch(err => {
      console.error('Failed to send audit to activity-api:', err);
    });
  }
}
