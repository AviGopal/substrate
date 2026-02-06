-- =============================================================================
-- DevBob Integration Testing Database Initialization
-- =============================================================================
-- Creates schemas and tables for comprehensive cross-container integration tests
-- =============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- Core Schemas
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS devbob;
CREATE SCHEMA IF NOT EXISTS integration_tests;
CREATE SCHEMA IF NOT EXISTS metrics;
CREATE SCHEMA IF NOT EXISTS activity_tracking;

-- =============================================================================
-- DevBob Core Tables
-- =============================================================================

-- Containers and agents
CREATE TABLE IF NOT EXISTS devbob.containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'agent', 'service', 'database'
    status VARCHAR(20) NOT NULL DEFAULT 'starting',
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent sessions and activities
CREATE TABLE IF NOT EXISTS devbob.agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES devbob.containers(id),
    session_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Cross-container communications
CREATE TABLE IF NOT EXISTS devbob.communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_container_id UUID REFERENCES devbob.containers(id),
    to_container_id UUID REFERENCES devbob.containers(id),
    message_type VARCHAR(50) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- Integration Test Tables
-- =============================================================================

-- Test suites and execution
CREATE TABLE IF NOT EXISTS integration_tests.test_suites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'impulse_optimization', 'context_selection', etc.
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_tests.test_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suite_id UUID REFERENCES integration_tests.test_suites(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    results JSONB,
    logs TEXT,
    error_details TEXT
);

-- Test scenarios and results
CREATE TABLE IF NOT EXISTS integration_tests.test_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suite_id UUID REFERENCES integration_tests.test_suites(id),
    name VARCHAR(200) NOT NULL,
    test_type VARCHAR(50) NOT NULL,
    expected_behavior JSONB,
    timeout_seconds INTEGER DEFAULT 300
);

CREATE TABLE IF NOT EXISTS integration_tests.scenario_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES integration_tests.test_executions(id),
    scenario_id UUID REFERENCES integration_tests.test_scenarios(id),
    status VARCHAR(20) NOT NULL,
    actual_result JSONB,
    execution_time_ms INTEGER,
    assertions_passed INTEGER DEFAULT 0,
    assertions_failed INTEGER DEFAULT 0,
    error_message TEXT
);

-- =============================================================================
-- Metrics and Performance Tables
-- =============================================================================

-- System metrics
CREATE TABLE IF NOT EXISTS metrics.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES devbob.containers(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value NUMERIC,
    unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance benchmarks
CREATE TABLE IF NOT EXISTS metrics.performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name VARCHAR(200) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    duration_ms INTEGER NOT NULL,
    memory_usage_mb NUMERIC,
    cpu_usage_percent NUMERIC,
    success BOOLEAN NOT NULL,
    metadata JSONB,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Activity Tracking Tables
-- =============================================================================

-- Impulse operations
CREATE TABLE IF NOT EXISTS activity_tracking.impulse_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES devbob.containers(id),
    operation_type VARCHAR(50) NOT NULL, -- 'create', 'load', 'compress', 'evict'
    impulse_id VARCHAR(100) NOT NULL,
    impulse_type VARCHAR(50),
    size_bytes INTEGER,
    processing_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_details TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context selection events
CREATE TABLE IF NOT EXISTS activity_tracking.context_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES devbob.containers(id),
    selection_criteria JSONB,
    selected_contexts JSONB,
    selection_time_ms INTEGER,
    quality_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity executions
CREATE TABLE IF NOT EXISTS activity_tracking.activity_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES devbob.containers(id),
    activity_id VARCHAR(100) NOT NULL,
    activity_type VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_duration_ms INTEGER,
    resource_usage JSONB,
    results JSONB
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_containers_name ON devbob.containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_type ON devbob.containers(type);
CREATE INDEX IF NOT EXISTS idx_containers_status ON devbob.containers(status);

CREATE INDEX IF NOT EXISTS idx_communications_from_container ON devbob.communications(from_container_id);
CREATE INDEX IF NOT EXISTS idx_communications_to_container ON devbob.communications(to_container_id);
CREATE INDEX IF NOT EXISTS idx_communications_created_at ON devbob.communications(created_at);

CREATE INDEX IF NOT EXISTS idx_test_executions_suite ON integration_tests.test_executions(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_status ON integration_tests.test_executions(status);

CREATE INDEX IF NOT EXISTS idx_scenario_results_execution ON integration_tests.scenario_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_scenario_results_scenario ON integration_tests.scenario_results(scenario_id);

CREATE INDEX IF NOT EXISTS idx_system_metrics_container ON metrics.system_metrics(container_id);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON metrics.system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_name ON metrics.system_metrics(metric_type, metric_name);

CREATE INDEX IF NOT EXISTS idx_impulse_ops_container ON activity_tracking.impulse_operations(container_id);
CREATE INDEX IF NOT EXISTS idx_impulse_ops_type ON activity_tracking.impulse_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_impulse_ops_created_at ON activity_tracking.impulse_operations(created_at);

-- =============================================================================
-- Initial Data
-- =============================================================================

-- Insert container definitions
INSERT INTO devbob.containers (name, type, status, config) VALUES
    ('devbob-postgres', 'database', 'healthy', '{"port": 5432, "database": "devbob"}'),
    ('devbob-redis', 'cache', 'healthy', '{"port": 6379, "max_memory": "2gb"}'),
    ('api-server-integration', 'service', 'starting', '{"port": 80, "type": "metabob-rpc-api"}'),
    ('metabob-worker-integration', 'worker', 'starting', '{"type": "celery", "concurrency": 2}'),
    ('devbob-opencode-integration', 'agent', 'starting', '{"acp_port": 3004, "codebase": "opencode"}'),
    ('devbob-cli-integration', 'agent', 'starting', '{"acp_port": 3003, "codebase": "cli"}'),
    ('devbob-rpc-api-integration', 'agent', 'starting', '{"acp_port": 3001, "codebase": "rpc-api"}'),
    ('devbob-test-orchestrator', 'orchestrator', 'starting', '{"role": "test_coordinator"}')
ON CONFLICT (name) DO NOTHING;

-- Insert test suites
INSERT INTO integration_tests.test_suites (name, description, category, config) VALUES
    ('Impulse Optimization Integration', 'End-to-end testing of impulse optimization across containers', 'impulse_optimization', 
     '{"timeout": 600, "containers": ["devbob-opencode-integration", "devbob-cli-integration"]}'),
    ('Context Selection Cross-Container', 'Testing context selection workflows between agents', 'context_selection',
     '{"timeout": 300, "containers": ["devbob-opencode-integration", "devbob-rpc-api-integration"]}'),
    ('Activity System Integration', 'Comprehensive activity system testing', 'activity_integration',
     '{"timeout": 900, "containers": ["devbob-opencode-integration", "devbob-cli-integration", "devbob-rpc-api-integration"]}'),
    ('Cross-Container Communication', 'Testing agent coordination and message passing', 'communication',
     '{"timeout": 300, "containers": ["all"]}'),
    ('Performance and Scalability', 'Load testing and performance benchmarks', 'performance',
     '{"timeout": 1200, "load_levels": [1, 5, 10, 20]}}')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Functions and Triggers
-- =============================================================================

-- Function to update container status
CREATE OR REPLACE FUNCTION update_container_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for container updates
DROP TRIGGER IF EXISTS trigger_update_container_status ON devbob.containers;
CREATE TRIGGER trigger_update_container_status
    BEFORE UPDATE ON devbob.containers
    FOR EACH ROW
    EXECUTE FUNCTION update_container_status();

-- Function to automatically end agent sessions
CREATE OR REPLACE FUNCTION end_agent_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'stopped' AND OLD.status != 'stopped' THEN
        UPDATE devbob.agent_sessions 
        SET ended_at = NOW(), status = 'ended'
        WHERE container_id = NEW.id AND ended_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic session ending
DROP TRIGGER IF EXISTS trigger_end_agent_session ON devbob.containers;
CREATE TRIGGER trigger_end_agent_session
    AFTER UPDATE ON devbob.containers
    FOR EACH ROW
    EXECUTE FUNCTION end_agent_session();

COMMIT;
EOF"
