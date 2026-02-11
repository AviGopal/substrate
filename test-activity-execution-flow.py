#!/usr/bin/env python3
"""
Test the EXACT code path that the activity tool would use.

This replicates:
1. TemplateRepository.get() → TemplateLoader.load()
2. MetabobAPI.getVariantDetails() → Direct backend call
3. Verify what error the agent would see
"""

import requests
import json
import sys

def test_activity_execution_flow():
    """Test the exact flow from activity tool"""
    
    print("=" * 80)
    print("TESTING ACTIVITY EXECUTION FLOW")
    print("=" * 80)
    print()
    
    # Step 1: Check backend health
    print("Step 1: Check backend health")
    try:
        health = requests.get("http://localhost:8080/health", timeout=2)
        if health.status_code == 200:
            print("  ✓ Backend is running")
        else:
            print(f"  ✗ Backend returned {health.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Backend not responding: {e}")
        print()
        print("Start backend with: ./devbob dev")
        return False
    print()
    
    # Step 2: Create session (agent would have this)
    print("Step 2: Create session")
    try:
        session_resp = requests.post(
            "http://localhost:8080/v2/session",
            json={
                "api_key": "test-api-key",
                "project_id": "metabob-devbob",
                "org_id": "test-org"
            },
            timeout=5
        )
        if session_resp.status_code == 200:
            session_data = session_resp.json()
            token = session_data.get("session_token") or session_data.get("metadata", {}).get("session_token")
            print(f"  ✓ Session created: {token[:20] if token else 'NO TOKEN'}...")
        else:
            print(f"  ✗ Session creation failed: {session_resp.status_code}")
            print(f"  Response: {session_resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ Session creation failed: {e}")
        return False
    print()
    
    # Step 3: List available activities (what search_activities returns)
    print("Step 3: List available activities")
    try:
        list_resp = requests.get(
            "http://localhost:8080/v2/activities/templates",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": 10},
            timeout=5
        )
        if list_resp.status_code == 200:
            data = list_resp.json()
            count = data.get("count", 0)
            templates = data.get("templates", [])
            print(f"  ✓ Found {count} activities in database")
            if count > 0:
                print("  Activities:")
                for t in templates[:5]:
                    print(f"    - {t.get('name', 'unknown')} (id: {t.get('id', 'unknown')})")
            else:
                print("  ⚠️  Database is empty - no activities registered")
                print()
                print("This is why search_activities returns 0 results.")
                print("The agent cannot execute activities that don't exist in the database.")
                return False
        else:
            print(f"  ✗ List failed: {list_resp.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ List failed: {e}")
        return False
    print()
    
    # Step 4: Try to get jiggle activity specifically
    print("Step 4: Get 'jiggle-documentation' activity")
    print("  (This is what TemplateRepository.get() would call)")
    
    activity_id = "jiggle-documentation"
    
    # The actual code calls: MetabobAPI.getVariantDetails(activityId)
    # Which does: GET /v2/activities/variants/{variant_id}
    try:
        variant_resp = requests.get(
            f"http://localhost:8080/v2/activities/variants/{activity_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        
        print(f"  GET /v2/activities/variants/{activity_id}")
        print(f"  Status: {variant_resp.status_code}")
        
        if variant_resp.status_code == 200:
            variant_data = variant_resp.json()
            print("  ✓ Activity found!")
            print(f"    Name: {variant_data.get('name', 'unknown')}")
            print(f"    Tasks: {len(variant_data.get('taskSteps', []))}")
            return True
        elif variant_resp.status_code == 404:
            print("  ✗ Activity not found in database")
            print()
            print("This is the error the agent sees.")
            print(f"Error message: {variant_resp.text}")
            return False
        else:
            print(f"  ✗ Unexpected status: {variant_resp.status_code}")
            print(f"  Response: {variant_resp.text}")
            return False
            
    except Exception as e:
        print(f"  ✗ Request failed: {e}")
        return False

if __name__ == "__main__":
    print()
    success = test_activity_execution_flow()
    print()
    print("=" * 80)
    if success:
        print("✓ FLOW WORKS - Activity can be executed")
    else:
        print("✗ FLOW BROKEN - This is the exact error the agent encounters")
    print("=" * 80)
    print()
    sys.exit(0 if success else 1)
