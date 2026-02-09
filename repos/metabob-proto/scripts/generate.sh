#!/bin/bash
# Code generation script for metabob-proto
# Generates Python code from Protocol Buffer definitions

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Generating code from Protocol Buffers...${NC}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$REPO_DIR"

# Clean previous generation
echo "Cleaning previous generated code..."
rm -rf gen/python gen/typescript
mkdir -p gen/python gen/typescript

# Generate Python code
echo "Generating Python code..."
protoc \
  --python_out=gen/python \
  --pyi_out=gen/python \
  --proto_path=proto \
  proto/metabob/**/*.proto

# Generate TypeScript code
echo "Generating TypeScript code..."
protoc \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=gen/typescript \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=forceLong=long \
  --ts_proto_opt=useOptionals=messages \
  --ts_proto_opt=useDate=true \
  --ts_proto_opt=stringEnums=true \
  --ts_proto_opt=outputClientImpl=false \
  --ts_proto_opt=outputServices=false \
  --proto_path=proto \
  proto/metabob/**/*.proto

# Create __init__.py files for Python package
echo "Creating Python package structure..."
for dir in gen/python gen/python/metabob gen/python/metabob/activity gen/python/metabob/auth gen/python/metabob/common gen/python/metabob/learning gen/python/metabob/metrics gen/python/metabob/session; do
  if [ ! -f "$dir/__init__.py" ]; then
    touch "$dir/__init__.py"
  fi
done

# Create main __init__.py
cat > gen/python/metabob/__init__.py << 'EOF'
"""
Metabob Protocol Buffer Generated Code

This package contains auto-generated Python code from Protocol Buffer definitions.
Do not edit these files manually.
"""

__version__ = "0.1.0"
EOF

# Create activity __init__.py with exports
cat > gen/python/metabob/activity/__init__.py << 'EOF'
"""Activity system protocol buffer types"""

from .variant_pb2 import (
    ActivityVariant,
    TaskStep,
    TaskPrompt,
    TaskValidation,
    TaskRetry,
    TaskMetrics,
    TaskComplexity,
    VariantPerformanceMetrics,
    CompositionConfig,
    LearningConfig,
    ExpectedOutcome,
)
from .execution_pb2 import (
    ExecutionConfig,
    ContextRequirement,
    IntegrationConfig,
    HooksConfig,
    TaskExecutionConfig,
    ImpulseReference,
)
from .optimization_pb2 import (
    OptimizationConfig,
    ThompsonSamplingConfig,
    TrafficAllocationConfig,
)
from .admin_pb2 import (
    AdminConfig,
    AuthoringMetadata,
    ValidationRules,
    DocumentationMetadata,
    DeploymentConfig,
)

__all__ = [
    # Variant types
    "ActivityVariant",
    "TaskStep",
    "TaskPrompt",
    "TaskValidation",
    "TaskRetry",
    "TaskMetrics",
    "TaskComplexity",
    "VariantPerformanceMetrics",
    "CompositionConfig",
    "LearningConfig",
    "ExpectedOutcome",
    # Execution types
    "ExecutionConfig",
    "ContextRequirement",
    "IntegrationConfig",
    "HooksConfig",
    "TaskExecutionConfig",
    "ImpulseReference",
    # Optimization types
    "OptimizationConfig",
    "ThompsonSamplingConfig",
    "TrafficAllocationConfig",
    # Admin types
    "AdminConfig",
    "AuthoringMetadata",
    "ValidationRules",
    "DocumentationMetadata",
    "DeploymentConfig",
]
EOF

# Create common __init__.py
cat > gen/python/metabob/common/__init__.py << 'EOF'
"""Common protocol buffer types"""

from .types_pb2 import (
    Genealogy,
    EntityStatus,
)

__all__ = [
    "Genealogy",
    "EntityStatus",
]
EOF

# Verify generation
echo "Verifying generated code..."
python3 -c "import sys; sys.path.insert(0, 'gen/python'); from metabob.activity import ActivityVariant, TaskStep; from metabob.common import Genealogy"

echo -e "${GREEN}✓ Code generation complete!${NC}"
echo ""
echo "Generated files:"
find gen/python -name "*.py" | wc -l | xargs echo "  Python files:"
find gen/python -name "*.pyi" | wc -l | xargs echo "  Type stub files:"
find gen/typescript -name "*.ts" | wc -l | xargs echo "  TypeScript files:"
