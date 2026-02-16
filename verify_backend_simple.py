#!/usr/bin/env python3
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-rpc-api"))
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

async def main():
    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="metabob"
    )
    
    db = SurrealDBClient(config)
    await db.connect()
    
    print("=" * 70)
    print(" BACKEND INTEGRATION STATUS")
    print("=" * 70 + "\n")
    
    # Activities count
    result = await db.query("SELECT count() FROM activities GROUP ALL")
    activities = result[0].get('count', 0) if result and result[0] else 0
    
    # Variants count  
    result = await db.query("SELECT count() FROM activity_variants GROUP ALL")
    variants = result[0].get('count', 0) if result and result[0] else 0
    
    # API keys count
    try:
        result = await db.query("SELECT count() FROM api_keys WHERE active = true GROUP ALL")
        keys = result[0].get('count', 0) if result and result[0] else 0
    except:
        keys = 0
    
    # Sample activities
    result = await db.query("SELECT id, name, version FROM activities LIMIT 8")
    
    print(f"✅ Database: Connected (metabob/metabob)")
    print(f"✅ Activities: {activities}")
    print(f"✅ Variants: {variants}")
    print(f"{'✅' if keys > 0 else '⚠️ '} API Keys: {keys}\n")
    
    if result and result[0]:
        print("📦 Sample Activities:")
        for activity in result[0][:8]:
            aid = activity.get('id', 'N/A')
            if hasattr(aid, 'record_id'):
                aid = aid.record_id
            name = activity.get('name', 'N/A')
            ver = activity.get('version', 1)
            print(f"   • {aid} (v{ver}): {name}")
    
    await db.disconnect()
    
    print("\n" + "=" * 70)
    print(" CONFIGURATION NEEDED")
    print("=" * 70)
    print("\n1. metabob-cli:")
    print('   export METABOB_BASE_URL="http://localhost:8080"')
    print('\n2. metabob-opencode:')
    print('   Update .metabob/config.json → "base_url": "http://localhost:8080"')
    print("\n3. Backend API:")
    print("   Health: http://localhost:8080/health")
    print("   Templates: http://localhost:8080/v2/activities/templates")
    print("   (Requires authentication)")
    
    return 0

asyncio.run(main())
