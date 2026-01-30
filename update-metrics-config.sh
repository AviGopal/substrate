#!/bin/bash

# Script to update DevBob Docker Compose configuration with comprehensive metrics

FILE="docker-compose.devbob-dev.yaml"

echo "Updating DevBob configuration for comprehensive metrics collection..."

# Add metrics configuration after each METABOB_LEARNING_ENABLED line
sed -i '/METABOB_LEARNING_ENABLED: "true"/,/WAIT_FOR_BACKEND: "false"/ {
    /METABOB_LEARNING_ENABLED: "true"/ {
        a\      METABOB_TRACK_SELF_DEVELOPMENT: ${METABOB_TRACK_SELF_DEVELOPMENT:-true}
        a\      
        a\      # Comprehensive metrics collection
        a\      METABOB_ENABLED: ${METABOB_ENABLED:-true}
        a\      METABOB_AUTO_INJECT: ${METABOB_AUTO_INJECT:-true}
        a\      METABOB_ACTIVITY_LEARNING_ENABLED: ${METABOB_ACTIVITY_LEARNING_ENABLED:-true}
        a\      METABOB_IMPULSE_MAPPING_ENABLED: ${METABOB_IMPULSE_MAPPING_ENABLED:-true}
        a\      METABOB_CROSS_REPO_LEARNING: ${METABOB_CROSS_REPO_LEARNING:-true}
        a\      
        a\      # Development workflow tracking
        a\      TRACK_REFACTORING_PATTERNS: ${TRACK_REFACTORING_PATTERNS:-true}
        a\      TRACK_DEBUGGING_SESSIONS: ${TRACK_DEBUGGING_SESSIONS:-true}
        a\      TRACK_FEATURE_DEVELOPMENT: ${TRACK_FEATURE_DEVELOPMENT:-true}
        a\      MEASURE_CODE_QUALITY_CHANGES: ${MEASURE_CODE_QUALITY_CHANGES:-true}
        a\      
        a\      # Execution tracing
        a\      ENABLE_EXECUTION_TRACING: ${ENABLE_EXECUTION_TRACING:-true}
        a\      TRACE_AGENT_DECISIONS: ${TRACE_AGENT_DECISIONS:-true}
        a\      TRACE_TOOL_USAGE: ${TRACE_TOOL_USAGE:-true}
        a\      TRACE_CROSS_CONTAINER_COMMUNICATION: ${TRACE_CROSS_CONTAINER_COMMUNICATION:-true}
        a\      
        c\      METABOB_LEARNING_ENABLED: ${METABOB_LEARNING_ENABLED:-true}
    }
}' "$FILE"

echo "✓ Updated Docker Compose configuration with metrics collection"

# Create a monitoring configuration file
cat > devbob-metrics-config.json << 'EOF'
{
  "metrics": {
    "development": {
      "enabled": true,
      "collectors": [
        "activity_execution",
        "impulse_usage",
        "cross_container_communication",
        "code_quality_changes",
        "refactoring_patterns",
        "debugging_sessions",
        "execution_tracing"
      ]
    },
    "storage": {
      "local": true,
      "metabob_backend": true,
      "export_formats": ["json", "csv", "prometheus"]
    },
    "analysis": {
      "pattern_recognition": true,
      "performance_tracking": true,
      "quality_metrics": true,
      "cross_repo_learning": true
    }
  }
}
EOF

echo "✓ Created metrics configuration file: devbob-metrics-config.json"
echo "✓ Configuration update complete!"