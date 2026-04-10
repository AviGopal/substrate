/**
 * Authorization
 *
 * Simple role-based access control for internal dashboard.
 * Roles determined by email address matching admin list.
 */

export type Role = 'admin' | 'viewer';

/**
 * Get user role based on email
 *
 * Checks if user email is in the ADMIN_EMAILS environment variable.
 * Falls back to 'viewer' role if not in admin list.
 */
export function getUserRole(email: string): Role {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const normalizedEmail = email.toLowerCase().trim();

  return adminEmails.includes(normalizedEmail) ? 'admin' : 'viewer';
}

/**
 * Check if user has admin role
 */
export function isAdmin(email: string): boolean {
  return getUserRole(email) === 'admin';
}

/**
 * Require admin role for operation
 *
 * Throws error if user does not have admin role.
 * Use for operations that modify system state.
 */
export function requireAdmin(user: string, action: string): void {
  const role = getUserRole(user);

  if (role !== 'admin') {
    throw new Error(
      `Unauthorized: ${action} requires admin role (user: ${user}, role: ${role})`
    );
  }
}

/**
 * Check if action requires admin privileges
 *
 * Operations that modify state require admin:
 * - DELETE queries
 * - UPDATE queries
 * - CREATE queries (except SELECT-based views)
 * - System configuration changes
 */
export function isAdminAction(query: string): boolean {
  const normalizedQuery = query.trim().toUpperCase();

  const adminPatterns = [
    /^DELETE\s/,
    /^UPDATE\s/,
    /^CREATE\s(?!.*AS\s+SELECT)/i, // CREATE ... AS SELECT is read-only
    /^DROP\s/,
    /^TRUNCATE\s/,
    /^ALTER\s/,
    /^GRANT\s/,
    /^REVOKE\s/,
  ];

  return adminPatterns.some(pattern => pattern.test(normalizedQuery));
}

/**
 * Authorize query execution
 *
 * Returns true if user can execute the query.
 * Throws error with details if authorization fails.
 */
export function authorizeQuery(user: string, query: string): boolean {
  if (isAdminAction(query)) {
    requireAdmin(user, 'execute admin query');
  }

  return true;
}
