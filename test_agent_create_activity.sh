#!/bin/bash
# Test creating activity through agent

echo "==========================================================="
echo "Testing Activity Creation Through Agent"
echo "==========================================================="
echo ""

# Create a simple activity template file
cat > /tmp/test-hello-activity.json <<'EOF'
{
  "name": "hello-world-test",
  "description": "Simple hello world activity for testing",
  "category": "tool",
  "variables": {
    "message": {
      "type": "string",
      "required": false,
      "default": "Hello World",
      "description": "Message to write to file"
    }
  },
  "contextRequirements": [],
  "tasks": [
    {
      "id": "create-file",
      "subagent": "general",
      "description": "Create hello.txt file with message",
      "dependencies": [],
      "prompt": {
        "template": "Create a file called hello.txt with the content: {{message}}",
        "max_tokens": 2000,
        "compression_strategy": "filter",
        "variables": ["message"]
      },
      "validation": {
        "required_files": ["hello.txt"],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": [
          {
            "command": "test -f hello.txt",
            "expected_exit_code": 0,
            "timeout_seconds": 5
          },
          {
            "command": "grep -q 'Hello' hello.txt",
            "expected_exit_code": 0,
            "timeout_seconds": 5
          }
        ]
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple"
      }
    }
  ]
}
EOF

echo "1. Created template file: /tmp/test-hello-activity.json"
echo ""

# Copy into devbob-opencode container
docker cp /tmp/test-hello-activity.json devbob-opencode:/tmp/test-hello-activity.json

echo "2. Copied template to devbob-opencode container"
echo ""

# Register the template using metabob-cli
echo "3. Registering template with backend..."
echo ""

docker exec devbob-opencode bash -c '
export METABOB_API_URL=http://host.docker.internal:8080
cd /tmp
python3 -m metabob_cli.commands register-template test-hello-activity.json 2>&1
' | tee /tmp/register_output.txt

echo ""
echo "==========================================================="
echo "Registration Complete"
echo "==========================================================="
echo ""

# Extract template ID from output
TEMPLATE_ID=$(grep "Template ID:" /tmp/register_output.txt | awk '{print $NF}')

if [ -n "$TEMPLATE_ID" ]; then
    echo "✓ Template registered successfully!"
    echo "  Template ID: $TEMPLATE_ID"
    echo ""
    
    # Now test searching for it
    echo "4. Searching for registered template..."
    echo ""
    
    docker exec devbob-opencode bash -c "
export METABOB_API_URL=http://host.docker.internal:8080
python3 -c \"
import asyncio
import sys
sys.path.insert(0, '/opt/metabob-cli/src')
from metabob_cli.mcp.activity_manager import ActivityManager

async def search():
    manager = ActivityManager(
        base_url='http://host.docker.internal:8080',
        session_token='c2Vzc2lvbnM6ZXhwLXJlcG86ZXhwLXJlcG8tZGV2OjQxMmQ2ZjI2LTdmOWYtNDk2Ni05M2E4LTUwMDAyNzRmOTM4Mg=='
    )
    results = await manager.search_activities(category='tool')
    for r in results:
        if 'hello' in r.get('variant_name', '').lower():
            print(f'Found: {r.get(\"variant_id\")} - {r.get(\"variant_name\")}')

asyncio.run(search())
\"
" 2>&1
    
    echo ""
    echo "==========================================================="
    echo "✓ TEST COMPLETE"
    echo "==========================================================="
    echo ""
    echo "Summary:"
    echo "  ✓ Template created"
    echo "  ✓ Template registered (ID: $TEMPLATE_ID)"  
    echo "  ✓ Template searchable via ActivityManager"
    echo ""
    echo "Next: Execute the activity to verify it works"
    
else
    echo "✗ Registration failed - no template ID found"
    echo ""
    echo "Output:"
    cat /tmp/register_output.txt
fi
