#!/bin/bash
# Script to build the standalone cpg-inference package

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
PKG_DIR="$SCRIPT_DIR/cpg_inference"

echo "Building cpg-inference package..."
echo "Root: $ROOT_DIR"
echo "Package: $PKG_DIR"

# Clean existing package
echo "Cleaning existing package..."
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"

# Copy inference module
echo "Copying inference module..."
cp -r "$ROOT_DIR/optimizer/inference/"* "$PKG_DIR/"

# Copy required CPG modules
echo "Copying CPG modules..."
mkdir -p "$PKG_DIR/cpg"
cp "$ROOT_DIR/optimizer/cpg/__init__.py" "$PKG_DIR/cpg/"
cp "$ROOT_DIR/optimizer/cpg/converter.py" "$PKG_DIR/cpg/"
cp "$ROOT_DIR/optimizer/cpg/models.py" "$PKG_DIR/cpg/"
cp "$ROOT_DIR/optimizer/cpg/node_mappings.py" "$PKG_DIR/cpg/"
cp -r "$ROOT_DIR/optimizer/cpg/parsers" "$PKG_DIR/cpg/"

# Copy SimHash modules
echo "Copying SimHash modules..."
mkdir -p "$PKG_DIR/simhash"
cp "$ROOT_DIR/optimizer/simhash/__init__.py" "$PKG_DIR/simhash/"
cp "$ROOT_DIR/optimizer/simhash/simhash.py" "$PKG_DIR/simhash/"
cp "$ROOT_DIR/optimizer/simhash/features.py" "$PKG_DIR/simhash/"

# Copy required embedding modules
echo "Copying embedding modules..."
mkdir -p "$PKG_DIR/embedding"
cp "$ROOT_DIR/optimizer/embedding/__init__.py" "$PKG_DIR/embedding/"
cp "$ROOT_DIR/optimizer/embedding/structural_simhash.py" "$PKG_DIR/embedding/"
cp "$ROOT_DIR/optimizer/embedding/subtree_extractor.py" "$PKG_DIR/embedding/"

# Update imports in all Python files
echo "Updating imports..."
find "$PKG_DIR" -name "*.py" -type f -exec sed -i 's/from optimizer\./from cpg_inference./g' {} \;
find "$PKG_DIR" -name "*.py" -type f -exec sed -i 's/import optimizer\./import cpg_inference./g' {} \;

# Copy tests
echo "Copying tests..."
rm -rf "$SCRIPT_DIR/tests"
cp -r "$ROOT_DIR/tests/inference" "$SCRIPT_DIR/tests"

# Update test imports
find "$SCRIPT_DIR/tests" -name "*.py" -type f -exec sed -i 's/from optimizer\.inference/from cpg_inference/g' {} \;
find "$SCRIPT_DIR/tests" -name "*.py" -type f -exec sed -i 's/from optimizer\.cpg/from cpg_inference.cpg/g' {} \;
find "$SCRIPT_DIR/tests" -name "*.py" -type f -exec sed -i 's/import optimizer\.inference/import cpg_inference/g' {} \;

# Create __init__.py for package root
cat > "$PKG_DIR/__init__.py" << 'EOF'
"""CPG Inference - Lightweight co-change prediction library.

This package provides production-ready inference for CPG-based co-change prediction
using ONNX models and FAISS indexing.
"""

from cpg_inference.models import (
    CPGComponent,
    CoChangePrediction,
    InferenceConfig,
)
from cpg_inference.service import CoChangePredictor

__all__ = [
    "CoChangePredictor",
    "InferenceConfig",
    "CPGComponent",
    "CoChangePrediction",
]

__version__ = "0.1.0"
EOF

echo "Package structure created successfully!"
echo ""
echo "To build the wheel:"
echo "  cd $SCRIPT_DIR"
echo "  pip install build"
echo "  python -m build"
echo ""
echo "To install locally:"
echo "  pip install -e $SCRIPT_DIR"
echo ""
echo "To run tests:"
echo "  cd $SCRIPT_DIR"
echo "  pytest tests/ -v"

