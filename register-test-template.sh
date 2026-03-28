#!/bin/bash
# Register the test-boredom-system-docker template

TEMPLATE_FILE="templates/testing/test-boredom-system-docker.json"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Copy to .metabob/activities for local storage
TEMPLATE_ID="test-boredom-system-docker"
DEST="$HOME/.metabob/activities/${TEMPLATE_ID}.json"

mkdir -p "$HOME/.metabob/activities"
cp "$TEMPLATE_FILE" "$DEST"

echo "✅ Registered template: $TEMPLATE_ID"
echo "   Location: $DEST"
echo ""
echo "To execute this template, use:"
echo "  activity({ templateId: 'test-boredom-system-docker', variables: {}, reason: 'Test boredom system in Docker' })"
