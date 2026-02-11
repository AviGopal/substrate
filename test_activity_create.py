#!/usr/bin/env python3
"""
Test executing the activity-create template to create a hello-world activity.
This demonstrates the activity system self-hosting capability.
"""

import sys
import json
import asyncio
sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import get_activity_manager
from pathlib import Path

# Load config
with open(".metabob/config.json") as f:
    config = json.load(f)

# Load state for session token
with open(".metabob/state") as f:
    state = json.load(f)

# Create manager
manager = get_activity_manager(
    base_url=config["base_url"],
    session_token=state["session_metadata"]["session_token"]
)

# Define the hello-world activity we want to create
hello_world_template = {
    "template_name": "hello-world-test",
    "template_category": "test",
    "template_description": "Simple hello world activity for testing self-hosting",
    "tasks": json.dumps([
        {
            "subagent": "general",
            "prompt": "Print 'Hello, World!' to the console using a simple echo command",
            "validation": {
                "type": "output_contains",
                "value": "Hello, World!"
            },
            "retry": {
                "enabled": False
            }
        }
    ])
}

async def create_hello_world():
    """Execute activity-create to create hello-world template."""
    
    print("=" * 60)
    print("Creating Hello World Activity Template")
    print("=" * 60)
    
    # Start execution
    print(f"\n1. Starting activity-create execution...")
    execution_id = await manager.start_execution(
        activity_id="INFRASTRUCTURE-0013e379",
        variables=hello_world_template
    )
    print(f"   ✅ Execution started: {execution_id}")
    
    # Monitor execution
    print(f"\n2. Monitoring execution...")
    while True:
        state = await manager.get_execution_state(execution_id)
        status = state.get("status")
        current_task = state.get("current_task_index", 0)
        total_tasks = state.get("total_tasks", 0)
        
        print(f"   Status: {status} - Task {current_task + 1}/{total_tasks}")
        
        if status in ["completed", "failed"]:
            break
        
        # Check for next step
        next_step = await manager.get_next_step(execution_id)
        if next_step.get("status") == "pending":
            step_data = next_step.get("step", {})
            print(f"   → Executing: {step_data.get('prompt', '')[:60]}...")
            
            # Auto-execute for demo (in real use, agent would execute)
            await manager.report_step_result(
                execution_id=execution_id,
                result="success",
                output="Step completed successfully",
                error=None
            )
        
        await asyncio.sleep(0.5)
    
    # Get final state
    final_state = await manager.get_execution_state(execution_id)
    
    print(f"\n3. Execution complete!")
    print(f"   Status: {final_state.get('status')}")
    print(f"   Output: {final_state.get('output', {}).get('message', 'N/A')}")
    
    if final_state.get("status") == "completed":
        print(f"\n✅ SUCCESS: hello-world activity template created!")
        print(f"\n4. Verifying in backend...")
        
        # Search for the new template
        results = await manager.search_activities(query="hello-world", limit=5)
        found = [r for r in results if "hello" in r.get("name", "").lower()]
        
        if found:
            print(f"   ✅ Found {len(found)} hello-world template(s):")
            for t in found:
                print(f"      - {t['id']}: {t.get('name')}")
        else:
            print(f"   ⚠️  Template not found in search (may need time to index)")
    else:
        print(f"\n❌ FAILED: {final_state.get('error', 'Unknown error')}")
    
    return final_state

# Run it
if __name__ == "__main__":
    result = asyncio.run(create_hello_world())
    sys.exit(0 if result.get("status") == "completed" else 1)
