#!/usr/bin/env python3
"""
Test activity execution flow directly via backend API
"""
import requests
import json

API_URL = "http://localhost:8080"

print("=" * 60)
print("Testing Activity Execution Flow")
print("=" * 60)
print()

# Step 1: Search for available activities
print("1. Searching for available activities...")
try:
    response = requests.get(f"{API_URL}/activities", params={"limit": 5})
    
    if response.status_code == 401:
        print("   ⚠️  Authorization required")
        print("   Creating test session...")
        
        # Create a test session
        session_resp = requests.post(
            f"{API_URL}/sessions",
            json={
                "project_id": "test-project",
                "codebase_name": "metabob-devbob",
                "username": "test-user"
            }
        )
        
        if session_resp.status_code == 200:
            session_data = session_resp.json()
            print(f"   ✓ Session created: {session_data.get('session_id', 'N/A')[:20]}...")
            
            # Try activities endpoint again with session
            # Note: May need to extract and use auth token from session
            print("   Note: Session-based auth may require additional token extraction")
        else:
            print(f"   ✗ Session creation failed: {session_resp.status_code}")
            print(f"   Response: {session_resp.text[:200]}")
    elif response.status_code == 200:
        activities = response.json()
        print(f"   ✓ Found {len(activities.get('activities', []))} activities")
        
        for activity in activities.get('activities', [])[:3]:
            print(f"      - {activity.get('variant_id')} ({activity.get('activity_id')})")
    else:
        print(f"   ✗ Request failed: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        
except Exception as e:
    print(f"   ✗ Error: {e}")

print()

# Step 2: Check activity recommendation endpoint
print("2. Checking activity recommendation system...")
try:
    response = requests.get(f"{API_URL}/activity-recommendations/health")
    
    if response.status_code == 200:
        health = response.json()
        print(f"   ✓ Recommendation system: {health}")
    else:
        print(f"   ⚠️  Health check returned: {response.status_code}")
        
except Exception as e:
    print(f"   ✗ Error: {e}")

print()
print("=" * 60)
print("Test complete!")
print("=" * 60)

