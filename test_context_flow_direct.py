#!/usr/bin/env python3
"""
Direct test of context requirements flow via activity execution.
This will show console.log output from our enhanced tracing.
"""

import asyncio
import json
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager

async def main():
    print("=" * 60)
    print("Context Requirements Flow Test")
    print("=" * 60)
    print()
    
    # Get config
    state_mgr = FileStateManager()
    config = state_mgr.get_config()
    session_data = state_mgr.reload_state(force=True)
    
    base_url = config.get("base_url", "http://localhost:8080")
    session_token = session_data.get("session_token")
    session_id = session_data.get("session_metadata", {}).get("session_id")
    
    print(f"Base URL: {base_url}")
    print(f"Session: {session_id}")
    print()
    
    # Create activity manager
    manager = get_activity_manager(base_url, session_token)
    
    # Search for activities with context requirements
    print("[1/3] Searching for refactor activities...")
    activities = await manager.search_activities(category="refactor")
    
    if not activities:
        print("❌ No refactor activities found")
        return
    
    # Find one with context_requirements
    target_activity = None
    for act in activities:
        activity_id = act.get("activity_id") or act.get("id")
        if activity_id:
            # Get full details
            details = await manager.get_activity(activity_id)
            if details and details.get("context_requirements"):
                target_activity = details
                break
    
    if not target_activity:
        print("❌ No activities with context_requirements found")
        print(f"Searched {len(activities)} activities")
        return
    
    activity_id = target_activity.get("activity_id") or target_activity.get("id")
    reqs = target_activity.get("context_requirements", [])
    
    print(f"✅ Found: {activity_id}")
    print(f"   Name: {target_activity.get('name')}")
    print(f"   Context Requirements: {len(reqs)}")
    for req in reqs:
        print(f"     - {req.get('key')}: {req.get('impulse_types')} (required: {req.get('required')})")
    print()
    
    # Execute activity
    print("[2/3] Executing activity...")
    print("⏳ This will show [CONTEXT_REQUIREMENTS_EXTRACTED] and [IMPULSE_CREATED_*] logs")
    print()
    
    exec_id = await manager.start_execution(
        activity_id=activity_id,
        variables={
            "target_file": "sample.ts",
            "refactor_goal": "Convert class-based code to functional style",
            "preserve_behavior": "true"
        },
        session_id=session_id
    )
    
    print(f"✅ Execution started: {exec_id}")
    print()
    
    # Poll for completion (with console output)
    print("[3/3] Waiting for completion (showing console logs)...")
    print("-" * 60)
    
    max_wait = 300  # 5 minutes
    for i in range(max_wait):
        await asyncio.sleep(2)
        
        try:
            status_data = await manager.get_execution_status(
                execution_id=exec_id.get("execution_id"),
                session_id=session_id
            )
            
            status = status_data.get("status")
            
            if status in ["completed", "failed", "cancelled"]:
                print()
                print("-" * 60)
                print(f"✅ Execution {status}")
                print(json.dumps(status_data, indent=2))
                break
                
            # Show progress
            if i % 5 == 0:
                current_task = status_data.get("current_task_index", 0)
                total_tasks = status_data.get("total_tasks", 0)
                print(f"  [{i*2}s] Status: {status} | Task: {current_task + 1}/{total_tasks}")
        except Exception as e:
            print(f"  Error checking status: {e}")
            break
    
    print()
    print("=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
