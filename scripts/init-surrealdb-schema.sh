#!/bin/sh
set -e

echo "==================================================================="
echo "SurrealDB Schema Initialization"
echo "==================================================================="
echo ""

# Step 1: Define namespace
echo "Step 1: Creating namespace 'activity-system'..."
curl -f -X POST "http://surrealdb.activity-system.svc.cluster.local:8000/sql" \
  -u "root:${SURREAL_PASSWORD}" \
  -H "Accept: application/json" \
  -H "NS: " \
  -H "DB: " \
  -d "DEFINE NAMESPACE \`activity-system\`;"

echo "✓ Namespace created"
echo ""

# Step 2: Define database
echo "Step 2: Creating database 'learning_loop'..."
curl -f -X POST "http://surrealdb.activity-system.svc.cluster.local:8000/sql" \
  -u "root:${SURREAL_PASSWORD}" \
  -H "Accept: application/json" \
  -H "NS: activity-system" \
  -H "DB: " \
  -d "DEFINE DATABASE learning_loop;"

echo "✓ Database created"
echo ""

# Step 3: Create schema
echo "Step 3: Creating schema..."
curl -f -X POST "http://surrealdb.activity-system.svc.cluster.local:8000/sql" \
  -u "root:${SURREAL_PASSWORD}" \
  -H "Accept: application/json" \
  -H "NS: activity-system" \
  -H "DB: learning_loop" \
  -d "$(cat <<'EOF'
DEFINE TABLE activity_template SCHEMAFULL;
DEFINE FIELD variant_id ON TABLE activity_template TYPE string;
DEFINE FIELD activity_id ON TABLE activity_template TYPE string;
DEFINE FIELD variant_name ON TABLE activity_template TYPE string;
DEFINE FIELD description ON TABLE activity_template TYPE string;
DEFINE FIELD category ON TABLE activity_template TYPE string;
DEFINE FIELD task_steps ON TABLE activity_template TYPE option<array>;
DEFINE FIELD scope ON TABLE activity_template TYPE option<string>;
DEFINE FIELD org_id ON TABLE activity_template TYPE option<string>;
DEFINE FIELD project_id ON TABLE activity_template TYPE option<string>;
DEFINE FIELD genealogy ON TABLE activity_template TYPE option<object>;
DEFINE FIELD created_at ON TABLE activity_template TYPE datetime;
DEFINE FIELD updated_at ON TABLE activity_template TYPE datetime;

DEFINE INDEX idx_variant_id ON TABLE activity_template COLUMNS variant_id UNIQUE;
DEFINE INDEX idx_activity_id ON TABLE activity_template COLUMNS activity_id;
DEFINE INDEX idx_category ON TABLE activity_template COLUMNS category;

DEFINE TABLE variant_performance_metrics SCHEMAFULL;
DEFINE FIELD variant_id ON TABLE variant_performance_metrics TYPE string;
DEFINE FIELD activity_id ON TABLE variant_performance_metrics TYPE string;
DEFINE FIELD total_executions ON TABLE variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD successful_executions ON TABLE variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD failed_executions ON TABLE variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON TABLE variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD avg_duration_ms ON TABLE variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD avg_cost_usd ON TABLE variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD thompson_alpha ON TABLE variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD thompson_beta ON TABLE variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD created_at ON TABLE variant_performance_metrics TYPE datetime;
DEFINE FIELD updated_at ON TABLE variant_performance_metrics TYPE datetime;

DEFINE INDEX idx_vpm_variant_id ON TABLE variant_performance_metrics COLUMNS variant_id UNIQUE;

DEFINE TABLE execution_history SCHEMAFULL;
DEFINE FIELD execution_id ON TABLE execution_history TYPE string;
DEFINE FIELD variant_id ON TABLE execution_history TYPE string;
DEFINE FIELD success ON TABLE execution_history TYPE bool;
DEFINE FIELD duration_ms ON TABLE execution_history TYPE float;
DEFINE FIELD cost ON TABLE execution_history TYPE float;
DEFINE FIELD executed_at ON TABLE execution_history TYPE datetime;

DEFINE INDEX idx_exec_id ON TABLE execution_history COLUMNS execution_id UNIQUE;

DEFINE TABLE sessions SCHEMAFULL;
DEFINE FIELD session_id ON TABLE sessions TYPE string;
DEFINE FIELD org_id ON TABLE sessions TYPE option<string>;
DEFINE FIELD project_id ON TABLE sessions TYPE option<string>;
DEFINE FIELD created_at ON TABLE sessions TYPE datetime;

DEFINE INDEX idx_session_id ON TABLE sessions COLUMNS session_id UNIQUE;

DEFINE TABLE impulses SCHEMAFULL;
DEFINE FIELD impulse_id ON TABLE impulses TYPE string;
DEFINE FIELD project_id ON TABLE impulses TYPE string;
DEFINE FIELD impulse_data ON TABLE impulses TYPE object;
DEFINE FIELD created_at ON TABLE impulses TYPE datetime;

DEFINE INDEX idx_impulse_id ON TABLE impulses COLUMNS impulse_id UNIQUE;
EOF
)"

echo "✓ Schema created"
echo ""
echo "==================================================================="
echo "Initialization Complete!"
echo "==================================================================="
