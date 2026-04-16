#!/usr/bin/env python3
"""
Mock HTTP GET request demonstration for Metabob API execution trace data
Since the backend is not running, this simulates the request and shows expected response
"""

import json
from datetime import datetime, timedelta

def simulate_http_get_request():
    """Simulate the HTTP GET request and response for execution trace data."""
    
    backend_url = "http://localhost:8080"
    endpoint = "/v2/activities/executions"
    full_url = f"{backend_url}{endpoint}"
    
    params = {
        "limit": 5,
        "session_id": "session-abc123def456"
    }
    
    headers = {
        "Authorization": "Bearer tok_xyz789...",
        "Content-Type": "application/json"
    }
    
    print("=" * 70)
    print("METABOB API - EXECUTION TRACE DATA HTTP GET REQUEST")
    print("=" * 70)
    
    print("\n📡 HTTP REQUEST DETAILS:")
    print(f"Method: GET")
    print(f"URL: {full_url}")
    print(f"Parameters: {json.dumps(params, indent=2)}")
    print(f"Headers: {json.dumps(headers, indent=2)}")
    
    print("\n🐍 PYTHON REQUESTS CODE:")
    print("```python")
    print(f'response = requests.get(')
    print(f'    url="{full_url}",')
    print(f'    params={params},')
    print(f'    headers={headers},')
    print(f'    timeout=10')
    print(f')')
    print("```")
    
    # Mock response data
    mock_response = {
        "executions": [
            {
                "execution_id": "exec-a1b2c3d4e5f6",
                "session_id": "session-abc123def456",
                "activity_id": "activity-feature-impl-001",
                "success": True,
                "duration_seconds": 45.3,
                "total_cost_usd": 0.15,
                "total_tokens": 4500,
                "outcome": "Feature implementation completed successfully"
            },
            {
                "execution_id": "exec-f6e5d4c3b2a1",
                "session_id": "session-abc123def456",
                "activity_id": "activity-bug-fix-002",
                "success": True,
                "duration_seconds": 28.7,
                "total_cost_usd": 0.08,
                "total_tokens": 2800,
                "outcome": "Memory leak fixed"
            },
            {
                "execution_id": "exec-123abc456def",
                "session_id": "session-abc123def456",
                "activity_id": "activity-refactor-003",
                "success": False,
                "duration_seconds": 12.1,
                "total_cost_usd": 0.03,
                "total_tokens": 1200,
                "outcome": "Refactoring failed: circular dependency"
            },
            {
                "execution_id": "exec-def456abc123",
                "session_id": "session-abc123def456",
                "activity_id": "activity-test-gen-004",
                "success": True,
                "duration_seconds": 67.9,
                "total_cost_usd": 0.22,
                "total_tokens": 6800,
                "outcome": "Generated comprehensive unit tests"
            },
            {
                "execution_id": "exec-789ghi012jkl",
                "session_id": "session-abc123def456",
                "activity_id": "activity-docs-005",
                "success": True,
                "duration_seconds": 34.2,
                "total_cost_usd": 0.11,
                "total_tokens": 3400,
                "outcome": "Documentation updated successfully"
            }
        ],
        "total_count": 5,
        "has_more": False
    }
    
    print("\n" + "=" * 70)
    print("MOCK RESPONSE (LIMIT: 5 RESULTS)")
    print("=" * 70)
    print(json.dumps(mock_response, indent=2))
    
    print(f"\n📊 SUMMARY: Retrieved {len(mock_response['executions'])} execution traces")
    for i, execution in enumerate(mock_response['executions'], 1):
        print(f"\n[{i}] {execution['execution_id']}")
        print(f"    Activity: {execution['activity_id']}")
        print(f"    Success: {execution['success']}")
        print(f"    Duration: {execution['duration_seconds']}s")
        print(f"    Cost: ${execution['total_cost_usd']}")
        print(f"    Tokens: {execution['total_tokens']}")
        print(f"    Outcome: {execution['outcome']}")
    
    print("\n✅ HTTP GET request demonstration completed!")

if __name__ == "__main__":
    simulate_http_get_request()
