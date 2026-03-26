## ADDED Requirements

### Requirement: Deploy-from-scratch activity
The system SHALL provide a MiniBob activity template `deploy-stack-from-scratch.json` that deploys the complete metabob stack (SurrealDB, Valkey, metabob-activity-api, metabob-analysis-api, metabob-cloud-dashboard) with initialized schemas.

#### Scenario: Deploy full stack on empty cluster
- **WHEN** deploy-stack-from-scratch activity executes on Kubernetes cluster without existing metabob deployment
- **THEN** all services are deployed, SurrealDB schemas are initialized, and health checks pass

#### Scenario: Initialize core schemas during deployment
- **WHEN** deploy activity reaches schema initialization task
- **THEN** core migrations (001-004) are applied to SurrealDB before service pods start

#### Scenario: Initialize activity schemas during deployment
- **WHEN** activity-api pod starts for first time
- **THEN** activity migrations (010-012) are applied

#### Scenario: Initialize analysis schemas during deployment
- **WHEN** analysis-api pod starts for first time
- **THEN** analysis migrations (020-022) are applied

#### Scenario: Create default organization
- **WHEN** stack deployment completes
- **THEN** a default organization (metabob_internal) is created for system activities

#### Scenario: Validate deployment health
- **WHEN** all services are deployed
- **THEN** health check endpoints return 200 OK for all services

#### Scenario: Record deployment execution trace
- **WHEN** deploy-stack-from-scratch activity completes
- **THEN** an execution trace is stored with success status, duration, and any errors

### Requirement: Rollback activity
The system SHALL provide a MiniBob activity template `rollback-stack.json` that reverts the stack to a previous version or state.

#### Scenario: Rollback to previous Helm release
- **WHEN** rollback activity executes with target_version parameter
- **THEN** Helm rollback command restores services to specified release version

#### Scenario: Rollback SurrealDB migrations
- **WHEN** rollback includes schema_version parameter
- **THEN** migration rollback script reverts schemas to specified version

#### Scenario: Validate rollback success
- **WHEN** rollback completes
- **THEN** health checks pass and schema_version table shows target version

#### Scenario: Record rollback reason
- **WHEN** rollback activity is triggered
- **THEN** reason and trigger_user are recorded in activity execution trace

#### Scenario: Rollback fails gracefully
- **WHEN** rollback encounters error (e.g., missing backup)
- **THEN** execution trace records failure with error_message and system remains in current state

### Requirement: Upgrade activity
The system SHALL provide a MiniBob activity template `upgrade-stack.json` that upgrades the stack to a new version with schema migrations.

#### Scenario: Upgrade with schema changes
- **WHEN** upgrade activity executes with new_version parameter
- **THEN** pending migrations are applied before service pods are updated

#### Scenario: Blue-green deployment for zero downtime
- **WHEN** upgrade includes blue_green=true parameter
- **THEN** new service versions are deployed alongside old, traffic switched after health checks

#### Scenario: Automatic rollback on failure
- **WHEN** upgrade health checks fail after deployment
- **THEN** automatic rollback is triggered and previous version is restored

#### Scenario: Backup before upgrade
- **WHEN** upgrade activity starts
- **THEN** SurrealDB export is created before any changes

#### Scenario: Validate schema compatibility
- **WHEN** upgrade includes new migrations
- **THEN** migration runner validates pending migrations before applying

#### Scenario: Record upgrade metrics
- **WHEN** upgrade completes successfully
- **THEN** execution trace includes upgrade duration, services affected, and migration count

### Requirement: Activity validation rules
The system SHALL define validation rules for deployment activities to ensure preconditions and postconditions are met.

#### Scenario: Pre-deployment validation checks cluster resources
- **WHEN** deploy activity starts
- **THEN** validation confirms sufficient CPU, memory, and storage available

#### Scenario: Pre-deployment validation checks required secrets
- **WHEN** deploy activity starts
- **THEN** validation confirms ANTHROPIC_API_KEY, SURREALDB_PASSWORD, and other secrets exist

#### Scenario: Post-deployment validation checks service health
- **WHEN** deploy activity completes tasks
- **THEN** validation queries health endpoints and confirms 200 OK responses

#### Scenario: Post-deployment validation checks schema version
- **WHEN** deploy activity completes schema initialization
- **THEN** validation queries schema_version table and confirms expected versions

#### Scenario: Post-deployment validation checks inter-service connectivity
- **WHEN** deploy activity completes service deployment
- **THEN** validation confirms activity-api can connect to SurrealDB and analysis-api

### Requirement: Activity execution measured with Thompson Sampling
The system SHALL record deployment activity executions with success/failure metrics to enable Thompson Sampling optimization.

#### Scenario: Successful deployment updates alpha
- **WHEN** deploy-stack-from-scratch completes successfully
- **THEN** activity_registry.alpha is incremented and success rate increases

#### Scenario: Failed deployment updates beta
- **WHEN** deploy-stack-from-scratch fails
- **THEN** activity_registry.beta is incremented and failure is recorded

#### Scenario: Deployment variant selection
- **WHEN** multiple deploy strategies exist (e.g., with/without blue-green)
- **THEN** Thompson Sampling selects variant with highest probability of success

#### Scenario: Deployment cost tracking
- **WHEN** deployment activity executes
- **THEN** duration_ms, cost_usd, and tokens consumed are recorded in execution trace

### Requirement: Activity impulses inject deployment configuration
The system SHALL use impulse system to inject environment-specific configuration into deployment activities.

#### Scenario: Inject cluster configuration impulse
- **WHEN** deploy activity executes
- **THEN** impulse with type='memo' contains cluster_name, namespace, and resource limits

#### Scenario: Inject Helm values impulse
- **WHEN** deploy activity reaches Helm installation task
- **THEN** impulse with type='file' points to environment-specific values.yaml

#### Scenario: Inject secrets impulse
- **WHEN** deploy activity needs credentials
- **THEN** impulse with type='activityMetrics' provides API keys from environment variables (not stored in template)

#### Scenario: Budget-aware impulse loading
- **WHEN** impulses exceed token budget
- **THEN** memory agent unloads low-priority impulses and activity adapts

### Requirement: Activity retry strategy for transient failures
The system SHALL define retry logic for deployment tasks that may fail due to transient issues.

#### Scenario: Retry failed pod deployment
- **WHEN** pod fails to start due to ImagePullBackOff
- **THEN** deployment task retries with exponential backoff (max 3 attempts)

#### Scenario: Retry failed health check
- **WHEN** health check returns 503 Service Unavailable
- **THEN** validation retries after delay (5s, 10s, 20s)

#### Scenario: Skip retry for permanent failures
- **WHEN** schema migration fails with syntax error
- **THEN** no retry is attempted and activity fails immediately

#### Scenario: Record retry count in execution trace
- **WHEN** task succeeds after retry
- **THEN** execution trace includes retry_count field showing number of attempts
