#!/usr/bin/env python3
import json
import sys
sys.path.insert(0, "repos/metabob-cli/src")

# Read config
with open(".metabob/config.json") as f:
    config = json.load(f)

# Read state
with open(".metabob/state") as f:
    state = json.load(f)

# Create ActivityManager  
from metabob_cli.mcp.activity_manager import get_activity_manager
manager = get_activity_manager(
    base_url=config["base_url"],
    session_token=state["session_token"]
)

# Search for activity-create template
import asyncio
async def search():
    results = await manager.search_activities(
        query="create activity",
        limit=10
    )
    return results

activities = asyncio.run(search())
print(f"Found {len(activities)} matching activities:")
for act in activities:
    print(f"  {act['id']}: {act.get('name', 'unnamed')} - {len(act.get('tasks', []))} tasks")
    if 'create' in act.get('name', '').lower():
        print(f"    ⭐ This one!")
