#!/usr/bin/env python3
"""
HTTP GET request to retrieve execution trace data from Metabob API endpoint
Limits results to 5 and displays the response
"""

import os
import requests
import json
from typing import Dict, Any

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
TEST_API_KEY = os.getenv("TEST_API_KEY", "test-api-key")

def create_session() -> tuple[str, str]:
    """Create a session and return session_id and token."""
    session_data = {
        "api_key": TEST_API_KEY,
        "primary_language": "python",
        "tech_stack": ["python", "fastapi"],
        "project_context": {
            "project_name": "execution-trace-query",
            "org_name": "test-org",
        },
    }
    
    print(f"Creating session at {BACKEND_URL}/v2/session...")
    response = requests.post(f"{BACKEND_URL}/v2/session", json=session_data, timeout=10)
    
    if response.status_code != 200:
        raise Exception(f"Session creation failed: {response.status_code} - {response.text}")
    
    result = response.json()
    session_token = result.get("metadata", {}).get("session_token")
    session_id = result.get("session_id")
    
    if not session_token or not session_id:
        raise Exception(f"Invalid session response: {result}")
    
    print(f"✅ Session created: {session_id}")
    return session_id, session_token

def get_execution_traces(session_id: str, session_token: str, limit: int = 5) -> Dict[str, Any]:
    """Retrieve execution trace data with specified limit."""
    headers = {"Authorization": f"Bearer {session_token}"}
    
    # Try the executions endpoint with limit parameter
    url = f"{BACKEND_URL}/v2/activities/executions"
    params = {
        "session_id": session_id,
        "limit": limit
    }
    
    print(f"\nFetching execution traces from {url}...")
    print(f"Parameters: {params}")
    
    response = requests.get(url, headers=headers, params=params, timeout=10)
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.status_code}")
        print(f"Response: {response.text}")
        return {"error": f"HTTP {response.status_code}", "response": response.text}
    
    return response.json()

def main():
    """Main function to execute the HTTP GET request."""
    try:
        print("=" * 70)
        print("METABOB API - EXECUTION TRACE DATA RETRIEVAL")
        print("=" * 70)
        
        # Create session first
        session_id, session_token = create_session()
        
        # Get execution traces with limit of 5
        result = get_execution_traces(session_id, session_token, limit=5)
        
        print("\n" + "=" * 70)
        print("EXECUTION TRACE DATA RESPONSE (LIMIT: 5)")
        print("=" * 70)
        
        # Pretty print the JSON response
        print(json.dumps(result, indent=2, default=str))
        
        # Show summary if executions found
        if "executions" in result:
            executions = result["executions"]
            print(f"\n📊 SUMMARY: Found {len(executions)} execution trace(s)")
            
            for i, execution in enumerate(executions[:5], 1):
                print(f"\n[{i}] Execution ID: {execution.get('execution_id', 'N/A')}")
                print(f"    Success: {execution.get('success', 'N/A')}")
                print(f"    Duration: {execution.get('duration_seconds', 'N/A')}s")
                print(f"    Cost: ${execution.get('total_cost_usd', 'N/A')}")
                print(f"    Tokens: {execution.get('total_tokens', 'N/A')}")
        
        print("\n✅ HTTP GET request completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
