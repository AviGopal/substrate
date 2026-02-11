#!/usr/bin/env python3
"""
Test MCP activity execution directly.
This simulates what metabob-cli MCP server would do when OpenCode calls metabob_activity.
"""
import requests
import json
import sys

def test_mcp_activity_execution():
    print("=== Testing MCP Activity Execution ===")
    print()
    
    # Step 1: Create backend session (MCP server needs this)
    print("Step 1: Create backend session")
    session_resp = requests.post(
        "http://localhost:8080/v2/session",
        json={
            "api_key": "test-api-key",
            "project_id": "metabob-devbob",
            "org_id": "test-org"
        }
    )
    token = session_resp.json().get("session_token") or session_resp.json().get("metadata", {}).get("session_token")
    print(f"  Token: {token[:20]}...")
    print()
    
    # Step 2: Get activity template
    print("Step 2: Get activity template")
    template_resp = requests.get(
        "http://localhost:8080/v2/activities/templates/refactor-5fccfc17",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if template_resp.status_code != 200:
        print(f"  FAILED to get template: {template_resp.status_code}")
        return False
        
    template = template_resp.json()
    print(f"  Template: {template.get('variant_name')}")
    print(f"  Tasks: {len(template.get('task_steps', []))}")
    print()
    
    # Step 3: Start execution
    print("Step 3: Start execution recording")
    exec_id = f"test-mcp-exec-{int(time.time())}" if 'time' in dir() else "test-mcp-exec-123"
    
    start_resp = requests.post(
        "http://localhost:8080/v2/activities/record/start",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "template_id": "refactor-5fccfc17",
            "variables": {"scope": "entire repo", "mode": "dryRun"},
            "session_id": "mcp-test-session",
            "execution_id": exec_id
        }
    )
    
    if start_resp.status_code != 200:
        print(f"  FAILED to start: {start_resp.status_code}")
        print(f"  Response: {start_resp.text}")
        return False
        
    print(f"  Execution started: {exec_id}")
    print()
    
    # Step 4: Simulate executing first task
    print("Step 4: Execute first task")
    first_task = template['task_steps'][0]
    print(f"  Task: {first_task['id']}")
    print(f"  Prompt length: {len(first_task['prompt']['template'])} chars")
    print()
    
    # This is where the agent would actually execute the task
    # For now, just record that we "completed" it
    print("Step 5: Record task completion")
    step_resp = requests.post(
        "http://localhost:8080/v2/activities/record/step",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "execution_id": exec_id,
            "step_order": 1,
            "success": True,
            "duration_ms": 2000,
            "cost": 0.02,
            "tokens": 800
        }
    )
    
    if step_resp.status_code != 200:
        print(f"  FAILED to record step: {step_resp.status_code}")
        return False
        
    print(f"  Step recorded successfully")
    print()
    
    # Step 6: Complete execution
    print("Step 6: Complete execution")
    complete_resp = requests.post(
        "http://localhost:8080/v2/activities/record/complete",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "execution_id": exec_id,
            "success": True,
            "total_duration_ms": 2000,
            "total_cost": 0.02,
            "total_tokens": 800
        }
    )
    
    if complete_resp.status_code != 200:
        print(f"  FAILED to complete: {complete_resp.status_code}")
        return False
        
    print(f"  Execution completed successfully")
    print()
    
    return True

if __name__ == "__main__":
    success = test_mcp_activity_execution()
    print("=" * 50)
    if success:
        print("SUCCESS: MCP activity execution flow works")
        print()
        print("This proves:")
        print("  1. Template can be fetched")
        print("  2. Execution can be started")
        print("  3. Steps can be recorded")
        print("  4. Execution can be completed")
        print()
        print("Next: Test with actual OpenCode calling the MCP tool")
    else:
        print("FAILED: MCP activity execution has errors")
    print("=" * 50)
    sys.exit(0 if success else 1)
