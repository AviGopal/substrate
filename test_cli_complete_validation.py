#!/usr/bin/env python3
"""
Complete CLI Activity System Validation Test

Tests the complete end-to-end flow:
1. Session management via CLI
2. Activity search via CLI
3. Execution recording via CLI (new methods)
4. Database verification
"""
import asyncio
import json
import sys
import time
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager

async def test_complete_cli_flow():
    """Test complete CLI activity execution flow"""
    
    print("=" * 70)
    print("CLI ACTIVITY SYSTEM COMPLETE VALIDATION TEST")
    print("=" * 70)
    print()
    
    # Generate unique execution ID
    execution_id = f"cli-validation-{int(time.time())}"
    
    # Setup configuration
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    try:
        # ====================================================================
        # STEP 1: Session Management
        # ====================================================================
        print("Step 1: Testing CLI Session Management")
        print("-" * 70)
        
        async with SessionManager(config) as sm:
            token = sm.file_state_manager.get_session_token()
            session_id = sm.file_state_manager.session_id
            
            if not token:
                print("❌ FAILED: No session token obtained")
                return False
            
            print(f"✅ Session created via CLI")
            print(f"   Session ID: {session_id[:50]}...")
            print(f"   Token: {token[:30]}...")
            print()
            
            # ====================================================================
            # STEP 2: Activity Search
            # ====================================================================
            print("Step 2: Testing CLI Activity Search")
            print("-" * 70)
            
            am = ActivityManager(base_url=config.base_url, session_token=token)
            
            results = await am.search_activities(query='test', category='feature', limit=5)
            
            if not results:
                print("❌ FAILED: No activities found")
                await am.close()
                return False
            
            print(f"✅ Found {len(results)} activities via CLI")
            
            # Select first activity
            activity = results[0]
            template_id = activity['id']
            template_name = activity['name']
            
            print(f"   Selected: {template_name}")
            print(f"   Template ID: {template_id}")
            print()
            
            # ====================================================================
            # STEP 3: Get Activity Details
            # ====================================================================
            print("Step 3: Testing CLI Activity Retrieval")
            print("-" * 70)
            
            details = await am.get_activity(template_id)
            
            if not details:
                print("❌ FAILED: Could not retrieve activity details")
                await am.close()
                return False
            
            print(f"✅ Retrieved activity details via CLI")
            print(f"   Name: {details.get('name')}")
            print(f"   Description: {details.get('description', 'N/A')[:50]}...")
            print(f"   Variables: {list(details.get('variables', {}).keys())}")
            print()
            
            # ====================================================================
            # STEP 4: Record Execution Start (NEW METHOD)
            # ====================================================================
            print("Step 4: Testing CLI Execution Start Recording")
            print("-" * 70)
            
            variables = {
                "feature_name": "Test Feature",
                "test_mode": True
            }
            
            start_result = await am.record_execution_start_external(
                template_id=template_id,
                variables=variables,
                session_id=session_id,
                execution_id=execution_id
            )
            
            if start_result.get('status') != 'success':
                print(f"❌ FAILED: Execution start recording failed")
                print(f"   Error: {start_result.get('message')}")
                await am.close()
                return False
            
            print(f"✅ Execution start recorded via CLI")
            print(f"   Execution ID: {start_result.get('execution_id')}")
            print(f"   Started at: {start_result.get('started_at')}")
            print()
            
            # Simulate work
            print("   Simulating activity execution (2 seconds)...")
            await asyncio.sleep(2)
            print()
            
            # ====================================================================
            # STEP 5: Record Execution Complete (NEW METHOD)
            # ====================================================================
            print("Step 5: Testing CLI Execution Complete Recording")
            print("-" * 70)
            
            complete_result = await am.record_execution_complete_external(
                execution_id=execution_id,
                success=True,
                duration_ms=2500,
                cost=0.035,
                tokens=1750,
                outcome="CLI validation test completed successfully",
                notes="Complete validation test via new CLI methods"
            )
            
            if complete_result.get('status') != 'success':
                print(f"❌ FAILED: Execution complete recording failed")
                print(f"   Error: {complete_result.get('message')}")
                await am.close()
                return False
            
            print(f"✅ Execution complete recorded via CLI")
            print(f"   Execution ID: {complete_result.get('execution_id')}")
            print(f"   Completed at: {complete_result.get('completed_at')}")
            print()
            
            await am.close()
        
        # Wait for database sync
        print("   Waiting for database sync (2 seconds)...")
        await asyncio.sleep(2)
        print()
        
        # ====================================================================
        # STEP 6: Database Verification
        # ====================================================================
        print("Step 6: Testing Database Persistence")
        print("-" * 70)
        
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
            
            print(f"✅ Database record verified")
            print(f"   Execution ID: {record['execution_id']}")
            print(f"   Duration: {record.get('duration', 'N/A')}ms")
            print(f"   Success: {record.get('success', 'N/A')}")
            print(f"   Cost: ${record.get('total_cost', 'N/A')}")
            outcome = record.get('outcome', 'N/A')
            outcome_str = str(outcome)[:50] if outcome else 'N/A'
            print(f"   Outcome: {outcome_str}...")
            print()
            
            # Validate values match
            if (record.get('duration') == 2500 and 
                record.get('success') == True and 
                record.get('total_cost') == 0.035):
                
                print("✅ All database values match expected")
                print()
                return True
            else:
                print("⚠️  WARNING: Database values don't match expected")
                print(f"   Expected: duration=2500, success=True, cost=0.035")
                print(f"   Got: duration={record.get('duration')}, "
                      f"success={record.get('success')}, "
                      f"cost={record.get('total_cost')}")
                print()
                return False
        else:
            print("❌ FAILED: No database record found")
            print(f"   Query result: {json.dumps(result, indent=2)}")
            print()
            return False
            
    except Exception as e:
        print(f"❌ TEST ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test runner"""
    print()
    result = await test_complete_cli_flow()
    
    print("=" * 70)
    if result:
        print("✅ CLI ACTIVITY SYSTEM VALIDATION: PASSED")
        print()
        print("Summary:")
        print("  ✅ Session management working")
        print("  ✅ Activity search working")
        print("  ✅ Activity retrieval working")
        print("  ✅ Execution start recording working (NEW)")
        print("  ✅ Execution complete recording working (NEW)")
        print("  ✅ Database persistence verified")
        print()
        print("🎉 All systems operational! Ready for production.")
    else:
        print("❌ CLI ACTIVITY SYSTEM VALIDATION: FAILED")
        print()
        print("Please check the errors above for details.")
    
    print("=" * 70)
    print()
    
    return 0 if result else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
