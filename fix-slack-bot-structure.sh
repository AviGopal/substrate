#!/bin/bash

echo "🔧 Fixing slack-bot chart structure to match helmfile expectations"
echo "=================================================================="
echo ""

cd repos/platform/metabob-apps/charts/slack-bot || exit 1

echo "📁 Creating charts/ subdirectory..."
mkdir -p charts

echo "📦 Moving Chart.yaml, templates/, and values.yaml to charts/..."
mv Chart.yaml charts/
mv templates charts/
mv values.yaml charts/

echo ""
echo "✅ Done! New structure:"
ls -R

echo ""
echo "📋 Now run the test again:"
echo "  cd ../../.. && ./test-helmfile.sh"
