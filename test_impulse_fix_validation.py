#!/usr/bin/env python3
"""Validate that the impulse data quality fix is working."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "repos/metabob-cli/src"))

from metabob_cli.mcp.activity_manager import get_activity_manager

def load_session():
    """Load session token from .metabob/state file."""
    state_file = Path(__file__).parent / ".metabob" / "state"
    
    if not state_file.exists():
        print("❌ No state file found")
        print("Run: python3 scripts/create_session_state.py")
        return None, None
    
    with open(state_file) as f:
        state = json.load(f)
    
    metadata = state.get("session_metadata", {})
    return metadata.get("session_token"), metadata.get("session_id")

async def main():
    print("=" * 70)
    print("Impulse Data Quality Fix Validation")
    print("=" * 70)
    
    # Load session
    print("\n[1/4] Loading session...")
    session_token, session_id = load_session()
    if not session_token or not session_id:
        return False
    print(f"✅ Session: {session_id[:50]}...")
    
    # Create manager
    print("\n[2/4] Creating activity manager...")
    manager = get_activity_manager("http://localhost:8080", session_token)
    print("✅ Manager created")
    
    # Find simple activity
    print("\n[3/4] Finding simple activity...")
    activities = await manager.search_activities(query="", limit=10)
    if not activities:
        print("❌ No activities found")
        return False
    
    activities.sort(key=lambda x: x.get('task_count', 999))
    selected = activities[0]
    
    print(f"✅ Selected: {selected['name']} ({selected.get('task_count', 0)} tasks)")
    
    # Execute with test impulses
    print("\n[4/4] Executing with test impulses...")
    test_impulses = [
        {
            "id": "test-file-impulse",
            "type": "file",
            "pointer": {"type": "file", "path": "test_impulse_fix_validation.py"},
            "content": "Test file content",
            "budget": 500,
            "priority": "high"
        },
        {
            "id": "test-memo-impulse",
            "type": "memo",
            "pointer": {"type": "memo", "content": "Test memo content"},
            "content": "Test memo content",
            "budget": 200,
            "priority": "medium"
        }
    ]
    
    try:
        result = await manager.start_execution(
            activity_id=selected["id"],
            variables={},
            session_id=str(session_id),
            impulses=test_impulses
        )
        
        exec_id = result.get("execution_id")
        print(f"✅ Execution started: {exec_id}")
        
        # Wait for processing
        print("\n   Waiting 10s for impulse processing...")
        await asyncio.sleep(10)
        
        print("\n" + "=" * 70)
        print("✅ TEST EXECUTION COMPLETE")
        print("=" * 70)
        print(f"\nExecution ID: {exec_id}")
        print(f"Session ID: {session_id}")
        print(f"Test Impulses: {len(test_impulses)}")
        print("\nNext: Query database to verify impulse quality")
        print(f"  Check impulse_effectiveness for execution: {exec_id}")
        
        return True
        
    except Exception as e:
        print(f"❌ Execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
