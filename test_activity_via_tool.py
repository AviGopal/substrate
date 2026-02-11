#!/usr/bin/env python3
"""
Test activity execution using the actual tools/methods
This simulates how OpenCode would use the activity system
"""
import asyncio
import sys
import time
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager

async def main():
    print("=" * 70)
    print("ACTIVITY SYSTEM - REAL TOOL USAGE TEST")
    print("=" * 70)
    print()
    
    # Configuration
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        session_id = sm.file_state_manager.session_id
        
        print(f"✅ Session established")
        print(f"   Session ID: {session_id[:50]}...")
        print()
        
        # Create activity manager
        am = ActivityManager(base_url=config.base_url, session_token=token)
        
        # STEP 1: Search for activities (like search_activities MCP tool)
        print("=" * 70)
        print("STEP 1: Search Activities (MCP Tool: search_activities)")
        print("=" * 70)
        print()
        
        results = await am.search_activities(
            query="add REST endpoint",
            category="feature",
            limit=5
        )
        
        print(f"✅ Search returned {len(results)} activities")
        print()
        print("Available activities:")
        for i, activity in enumerate(results[:5], 1):
            name = activity.get('name', 'Unknown')
            template_id = activity.get('id', 'Unknown')
            category = activity.get('category', 'Unknown')
            print(f"  {i}. {name}")
            print(f"     ID: {template_id}")
            print(f"     Category: {category}")
        print()
        
        # Select activity
        selected = results[0]
        template_id = selected['id']
        template_name = selected['name']
        
        print(f"Selected: {template_name}")
        print(f"Template ID: {template_id}")
        print()
        
        # STEP 2: Get activity details (like get_activity MCP tool)
        print("=" * 70)
        print("STEP 2: Get Activity Details (MCP Tool: get_activity)")
        print("=" * 70)
        print()
        
        details = await am.get_activity(template_id)
        
        if details:
            print(f"✅ Activity details retrieved")
            print(f"   Name: {details.get('name')}")
            print(f"   Description: {details.get('description', 'N/A')[:60]}...")
            print(f"   Required variables: {list(details.get('variables', {}).keys())}")
            
            task_steps = details.get('task_steps', [])
            print(f"   Number of steps: {len(task_steps)}")
            
            if task_steps:
                print(f"   Steps:")
                for i, step in enumerate(task_steps[:3], 1):
                    print(f"      {i}. {step.get('description', 'N/A')[:50]}...")
        print()
        
        # STEP 3: Start execution (NEW METHOD - simulates activity tool)
        print("=" * 70)
        print("STEP 3: Start Activity Execution (Tool: activity)")
        print("=" * 70)
        print()
        
        execution_id = f"real-tool-test-{int(time.time())}"
        variables = {
            "feature_name": "User Profile API",
            "endpoint": "/api/users/:id/profile",
            "method": "GET"
        }
        
        print(f"Starting execution with variables:")
        for key, value in variables.items():
            print(f"   {key}: {value}")
        print()
        
        start_result = await am.record_execution_start_external(
            template_id=template_id,
            variables=variables,
            session_id=session_id,
            execution_id=execution_id
        )
        
        if start_result.get('status') == 'success':
            print(f"✅ Execution started successfully")
            print(f"   Execution ID: {execution_id}")
            print(f"   Started at: {start_result.get('started_at')}")
        else:
            print(f"❌ Failed to start: {start_result.get('message')}")
            await am.close()
            return False
        print()
        
        # STEP 4: Simulate activity execution
        print("=" * 70)
        print("STEP 4: Execute Activity Steps")
        print("=" * 70)
        print()
        print("Simulating activity execution...")
        print("  (In real usage, OpenCode would execute each task step)")
        print("  - Step 1: Create endpoint handler... ✓")
        print("  - Step 2: Add validation logic... ✓")
        print("  - Step 3: Write tests... ✓")
        print("  - Step 4: Update documentation... ✓")
        await asyncio.sleep(2)
        print()
        print("✅ All steps completed")
        print()
        
        # STEP 5: Record completion (NEW METHOD)
        print("=" * 70)
        print("STEP 5: Record Execution Completion")
        print("=" * 70)
        print()
        
        complete_result = await am.record_execution_complete_external(
            execution_id=execution_id,
            success=True,
            duration_ms=2000,
            cost=0.018,
            tokens=1200,
            outcome="Successfully implemented User Profile API endpoint with tests",
            notes="Automated test - Real tool usage simulation"
        )
        
        if complete_result.get('status') == 'success':
            print(f"✅ Execution completion recorded")
            print(f"   Execution ID: {execution_id}")
            print(f"   Completed at: {complete_result.get('completed_at')}")
            print(f"   Duration: 2000ms")
            print(f"   Cost: $0.018")
            print(f"   Tokens: 1200")
        else:
            print(f"❌ Failed to record completion: {complete_result.get('message')}")
            await am.close()
            return False
        print()
        
        await am.close()
        
        # STEP 6: Verify in database
        print("=" * 70)
        print("STEP 6: Database Verification")
        print("=" * 70)
        print()
        print("Waiting for database sync...")
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
        
        record = None
        for item in result:
            if isinstance(item, dict) and item.get('result'):
                if isinstance(item['result'], list) and len(item['result']) > 0:
                    record = item['result'][0]
                    break
        
        if record:
            print(f"✅ Database record verified:")
            print(f"   Execution ID: {record['execution_id']}")
            print(f"   Duration: {record.get('duration')}ms")
            print(f"   Success: {record.get('success')}")
            print(f"   Cost: ${record.get('total_cost')}")
            outcome = record.get('outcome', 'N/A')
            if outcome:
                print(f"   Outcome: {str(outcome)[:60]}...")
            print()
            
            # Validate values
            if (record.get('duration') == 2000 and 
                record.get('success') == True and 
                record.get('total_cost') == 0.018):
                print("✅ All database values correct!")
                print()
                return True
            else:
                print("⚠️  Database values don't match expected")
                return False
        else:
            print("❌ No database record found")
            return False
    
    return False

if __name__ == "__main__":
    print()
    result = asyncio.run(main())
    print("=" * 70)
    print()
    if result:
        print("🎉 REAL TOOL USAGE TEST: PASSED")
        print()
        print("This demonstrates the complete activity system workflow:")
        print("  1. ✅ Search for activities")
        print("  2. ✅ Get activity details")
        print("  3. ✅ Start execution recording")
        print("  4. ✅ Execute activity (simulated)")
        print("  5. ✅ Record completion")
        print("  6. ✅ Verify in database")
        print()
        print("The activity system is ready for production use!")
    else:
        print("❌ REAL TOOL USAGE TEST: FAILED")
    print()
    print("=" * 70)
    sys.exit(0 if result else 1)
