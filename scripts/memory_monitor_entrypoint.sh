#!/bin/bash
# Memory Monitor Container Entrypoint
# Installs dependencies and runs the memory monitor

set -e

echo "Installing Python dependencies..."
pip install psutil docker

echo "Starting memory monitor..."
exec python /opt/metabob/memory_monitor.py