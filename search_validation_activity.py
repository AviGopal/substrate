import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager
import asyncio

async def search():
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        am = ActivityManager(base_url=config.base_url, session_token=token)
        
        # Search for validation/testing activities
        results = await am.search_activities(
            query="validation test",
            limit=20
        )
        
        print("Available activities:")
        for activity in results:
            print(f"  ID: {activity['id']}")
            print(f"  Name: {activity['name']}")
            print(f"  Category: {activity.get('category', 'N/A')}")
            print()
        
        await am.close()

asyncio.run(search())
