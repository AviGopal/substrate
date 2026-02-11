#!/usr/bin/env python3
"""Test MCP search_activities tool directly"""
import asyncio
import sys
sys.path.insert(0, './repos/metabob-cli/src')

from metabob_cli.mcp.tools import search_activities_tool
from metabob_cli.mcp.server import ConfigManager

async def test():
    # Set up config
    config = ConfigManager()
    config.set("base_url", "http://localhost:8080")
    
    # Create session first
    import requests
    session_resp = requests.post("http://localhost:8080/v2/session", json={"api_key": "test-api-key", "project_id": "metabob-devbob", "org_id": "test-org"})
    token = session_resp.json().get("session_token") or session_resp.json().get("metadata", {}).get("session_token")
    config.set("session_token", token)
    
    # Call search tool
    result = await search_activities_tool(query="", category="", limit=10)
    print(result)

asyncio.run(test())
