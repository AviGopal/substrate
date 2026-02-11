#!/usr/bin/env python3
"""Test complete activity execution flow via CLI"""
import asyncio
import json
import sys
import time
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager

async def test_activity_execution():
    """Test complete activity execution: search -> get -> start -> complete"""
    
    print("=" * 60)
    print("CLI ACTIVITY EXECUTION TEST")
    print("=" * 60)
    print()
    
    # Setup
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    execution_id = f"cli-test-{int(time.time())}"
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        session_id = sm.file_state_manager.session_id
        
        print(f"✅ Session: {session_id[:40]}...")
        print()
        
        am = ActivityManager(base_url=config.base_url, session_token=token)
        
        # Step 1: Search activities
        print("Step 1: Searching for activities...")
        results = await am.search_activities(query='test', category='feature', limit=3)
        print(f"✅ Found {len(results)} activities")
        
        if not results:
            print("❌ No activities found!")
            return False
        
        activity = results[0]
        template_id = activity['id']
        print(f"   Using: {activity['name']} ({template_id})")
        print()
        
        # Step 2: Get full activity details
        print("Step 2: Getting activity details...")
        details = await am.get_activity(template_id)
        
        if details:
            print(f"✅ Activity details retrieved")
            print(f"   Name: {details.get('name')}")
            print(f"   Tasks: {details.get('task_count', 0)}")
        else:
            print("❌ Failed to get activity details")
            return False
        print()
        
        # Step 3: Start execution
        print("Step 3: Starting execution...")
        variables = {"feature_name": "Test Feature", "test_mode": True}
        
        execution = await am.start_execution(
            activity_id=template_id,
            variables=variables,
            execution_id=execution_id,
            session_id=session_id
        )
        
        if execution:
            print(f"✅ Execution started: {execution.execution_id}")
        else:
            print("❌ Failed to start execution")
            return False
        print()
        
        # Simulate work
        await asyncio.sleep(1)
        
        # Step 4: Complete execution
        print("Step 4: Completing execution...")
        success = await am.complete_execution(
            execution_id=execution_id,
            success=True,
            outcome="Test execution completed successfully"
        )
        
        if success:
            print(f"✅ Execution completed: {execution_id}")
        else:
            print("❌ Failed to complete execution")
            return False
        print()
        
        await am.close()
        
        # Step 5: Verify in database
        print("Step 5: Verifying in database...")
        await asyncio.sleep(2)
        
        import requests
        url = "http://localhost:8000/sql"
        auth = ("local", "testing")
        headers = {"Accept": "application/json", "Content-Type": "application/sql"}
        
        query = f"""
        USE NS metabob DB development;
        SELECT execution_id, duration, success, total_cost, outcome 
        FROM activity_executions 
        WHERE execution_id = '{execution_id}';
        """
        
        response = requests.post(url, data=query, headers=headers, auth=auth)
        result = response.json()
        
        if len(result) > 1 and result[1]['result']:
            record = result[1]['result'][0]
            print(f"✅ Database record found:")
            print(f"   Execution ID: {record['execution_id']}")
            print(f"   Duration: {record.get('duration', 'N/A')}ms")
            print(f"   Success: {record.get('success', 'N/A')}")
            print(f"   Outcome: {record.get('outcome', 'N/A')}")
            print()
            return True
        else:
            print("❌ No database record found")
            print(f"Response: {json.dumps(result, indent=2)}")
            return False

if __name__ == "__main__":
    try:
        result = asyncio.run(test_activity_execution())
        print("=" * 60)
        if result:
            print("✅ CLI ACTIVITY EXECUTION TEST PASSED")
        else:
            print("❌ CLI ACTIVITY EXECUTION TEST FAILED")
        print("=" * 60)
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"❌ TEST ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
