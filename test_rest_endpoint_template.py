#!/usr/bin/env python3
"""Test executing the add-rest-endpoint-v2 template"""

import json
from pathlib import Path
from metabob_cli.mcp.activity_manager import get_activity_manager

def get_session_token():
    state_file = Path.home() / ".local/share/opencode/.metabob/state"
    if not state_file.exists():
        state_file = Path(".metabob/state")
    
    with open(state_file, "r") as f:
        state = json.load(f)
    return state.get("session_metadata", {}).get("session_token", "")

async def main():
    base_url = "http://localhost:8080"
    session_token = get_session_token()
    session_id = "test-session-rest-endpoint"
    
    manager = get_activity_manager(base_url, session_token)
    
    # Start execution with required variables
    variables = {
        "endpoint_path": "/api/test/example",
        "http_method": "GET",
        "endpoint_description": "Test endpoint to demonstrate template execution",
        "request_schema": "",  # Optional
        "response_schema": '{"id": "string", "message": "string"}'  # Optional
    }
    
    print("Starting execution of add-rest-endpoint-v2 template")
    print(f"Variables: {json.dumps(variables, indent=2)}")
    print()
    
    result = await manager.start_execution(
        activity_id="feature-fdb6afae",
        variables=variables,
        session_id=session_id
    )
    
    print(f"Execution started:")
    print(f"  Execution ID: {result.get('execution_id')}")
    print(f"  Status: {result.get('status')}")
    print()
    print("✅ Template execution initiated successfully!")
    print()
    print("To monitor progress:")
    print(f"  Watch backend logs for execution: {result.get('execution_id')}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
