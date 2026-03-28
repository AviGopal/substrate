## ADDED Requirements

### Requirement: System-scope authentication for internal dashboard
The system SHALL provide a dedicated authentication scope for the internal dashboard that grants cross-org read access while maintaining audit trails.

#### Scenario: Internal dashboard authenticates with system credentials
- **WHEN** the internal dashboard starts
- **THEN** it authenticates using `internal_dashboard_credentials` with instance_id and secret
- **AND** receives a JWT with `scope: 'system'` and `role: 'observer'`
- **AND** the token is valid for 1 hour with session lasting 24 hours

#### Scenario: System scope grants cross-org read access
- **WHEN** a query is executed with `$auth.scope = 'system'`
- **THEN** SELECT queries on all tables return data from ALL organizations
- **AND** the query is logged in audit_logs with `actor_type: 'system'`

#### Scenario: System scope denies write operations by default
- **WHEN** a system-scope token attempts INSERT, UPDATE, or DELETE
- **THEN** the operation is denied with error "System scope is read-only"
- **EXCEPT** for explicitly allowed operations (circuit_breaker state)

#### Scenario: Circuit breaker control requires explicit capability
- **WHEN** a system-scope token has `capabilities: ['write:circuit_breaker']`
- **THEN** the token can call `set_circuit_breaker` to pause/resume boredom system
- **AND** the action is logged with reason and actor

### Requirement: Credential storage and rotation
The system SHALL securely store internal dashboard credentials with support for rotation.

#### Scenario: Credentials stored with argon2 hashing
- **WHEN** internal dashboard credentials are created
- **THEN** the secret is hashed using argon2 before storage
- **AND** the plaintext secret is stored in Kubernetes secret only

#### Scenario: Credential rotation without downtime
- **WHEN** credentials need to be rotated
- **THEN** a new credential record is created with new secret
- **AND** the old credential remains valid for grace period (1 hour)
- **AND** after grace period, old credential is deactivated

#### Scenario: Credentials scoped to dashboard instance
- **WHEN** multiple internal dashboard instances exist (dev, staging, prod)
- **THEN** each has separate credentials in `internal_dashboard_credentials`
- **AND** audit logs distinguish between instances via `actor_id`

### Requirement: Audit logging for system-scope operations
The system SHALL log all system-scope operations for security auditing.

#### Scenario: Query execution logged
- **WHEN** internal dashboard executes a query via system scope
- **THEN** audit_logs records: action='system_query', actor_type='system', actor_id='internal-dashboard-<env>', query_type, tables_accessed, timestamp

#### Scenario: Circuit breaker action logged
- **WHEN** internal dashboard pauses or resumes the circuit breaker
- **THEN** audit_logs records: action='circuit_breaker_<action>', actor_type='system', reason, previous_state, new_state, timestamp

#### Scenario: Authentication events logged
- **WHEN** internal dashboard authenticates or fails to authenticate
- **THEN** audit_logs records: action='system_auth_<success|failure>', actor_id, ip_address, timestamp

### Requirement: PERMISSIONS clauses support system scope
All SurrealDB tables SHALL have PERMISSIONS that allow system-scope read access.

#### Scenario: Organizations table allows system read
- **GIVEN** PERMISSIONS on `organizations` table
- **WHEN** query has `$auth.scope = 'system'`
- **THEN** SELECT returns all organizations regardless of org_id

#### Scenario: Activity executions allows system read
- **GIVEN** PERMISSIONS on `activity_executions` table
- **WHEN** query has `$auth.scope = 'system'`
- **THEN** SELECT returns executions from all organizations

#### Scenario: User data allows system read
- **GIVEN** PERMISSIONS on `users` table
- **WHEN** query has `$auth.scope = 'system'`
- **THEN** SELECT returns users from all organizations
- **AND** sensitive fields (password_hash) are excluded from results

#### Scenario: MiniBob instances allows system read
- **GIVEN** PERMISSIONS on `minibob_instance` table
- **WHEN** query has `$auth.scope = 'system'`
- **THEN** SELECT returns instances from all organizations
- **AND** api_key_hash is excluded from results

---

## Schema Changes

### internal_dashboard_credentials table
```surql
DEFINE TABLE internal_dashboard_credentials SCHEMAFULL;

DEFINE FIELD id ON internal_dashboard_credentials TYPE string;
DEFINE FIELD environment ON internal_dashboard_credentials TYPE string;  -- 'local', 'staging', 'prod'
DEFINE FIELD secret_hash ON internal_dashboard_credentials TYPE string;
DEFINE FIELD capabilities ON internal_dashboard_credentials TYPE array<string>;
DEFINE FIELD is_active ON internal_dashboard_credentials TYPE bool DEFAULT true;
DEFINE FIELD created_at ON internal_dashboard_credentials TYPE datetime DEFAULT time::now();
DEFINE FIELD expires_at ON internal_dashboard_credentials TYPE option<datetime>;
DEFINE FIELD last_used_at ON internal_dashboard_credentials TYPE option<datetime>;

DEFINE INDEX idx_credentials_id ON internal_dashboard_credentials FIELDS id UNIQUE;
```

### SYSTEM access definition
```surql
DEFINE ACCESS internal_system ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT * FROM internal_dashboard_credentials
    WHERE id = $credential_id
    AND is_active = true
    AND (expires_at IS NONE OR expires_at > time::now())
    AND crypto::argon2::compare(secret_hash, $secret)
  )
  WITH JWT ALGORITHM HS512 KEY $secret_key
  AUTHENTICATE {
    IF $auth.scope = 'system' {
      RETURN {
        scope: 'system',
        role: 'observer',
        actor_id: $auth.id,
        capabilities: $auth.capabilities
      }
    }
  }
  DURATION FOR TOKEN 1h, FOR SESSION 24h;
```

### Modified PERMISSIONS pattern
```surql
-- Apply to all tables that need system-scope access
DEFINE TABLE activity_executions PERMISSIONS
  FOR select WHERE
    org_id = $auth.org_id
    OR $auth.scope = 'system'
  FOR create WHERE
    org_id = $auth.org_id
  FOR update, delete WHERE
    org_id = $auth.org_id
    AND $auth.role = 'admin';
```

---

## Kubernetes Secret Structure

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: internal-dashboard-credentials
  namespace: activity-system
type: Opaque
stringData:
  credential-id: "internal-dashboard-local"
  secret: "<random-32-char-secret>"
```

## Environment Variables

```yaml
# In internal-dashboard deployment
env:
  - name: INTERNAL_DASHBOARD_CREDENTIAL_ID
    valueFrom:
      secretKeyRef:
        name: internal-dashboard-credentials
        key: credential-id
  - name: INTERNAL_DASHBOARD_SECRET
    valueFrom:
      secretKeyRef:
        name: internal-dashboard-credentials
        key: secret
```
