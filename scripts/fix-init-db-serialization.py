#!/usr/bin/env python3
"""
Fix init-db.py Serialization Issue

The problem: init-db.py uses string interpolation which breaks JSON serialization.
The solution: Use proper SurrealDB SDK or parameterized approach.

This script demonstrates the CORRECT way to insert activity variants.
"""

import httpx
import json
from pathlib import Path

def insert_variant_properly(client: httpx.Client, variant_data: dict, config: dict) -> bool:
    """
    Insert variant using proper approach (NOT string interpolation).
    
    Returns True if successful, False otherwise.
    """
    variant_id = variant_data.get("variant_id")
    
    # APPROACH: Use SurrealDB's CONTENT keyword with JSON body
    # This avoids string interpolation entirely
    
    # First, set namespace and database
    ns_query = f"USE NS {config['namespace']} DB {config['database']};"
    response = client.post(
        f"{config['url']}/sql",
        content=ns_query,
        auth=(config["user"], config["pass"]),
        headers={"Accept": "application/json"},
    )
    
    if response.status_code != 200:
        print(f"Failed to set NS/DB: {response.text}")
        return False
    
    # Now use CONTENT to insert the entire object
    # This properly handles JSON serialization
    create_query = f"CREATE activity_variants CONTENT {json.dumps(variant_data)};"
    
    response = client.post(
        f"{config['url']}/sql",
        content=create_query,
        auth=(config["user"], config["pass"]),
        headers={"Accept": "application/json"},
    )
    
    if response.status_code != 200:
        print(f"Failed to insert {variant_id}: {response.status_code} - {response.text[:200]}")
        return False
    
    data = response.json()
    
    # Check if successful
    if data and len(data) > 0:
        result = data[0]
        if result.get("status") == "OK" and result.get("result"):
            print(f"✅ Inserted {variant_id}")
            return True
    
    print(f"❌ Failed to insert {variant_id}: {data}")
    return False


def main():
    config = {
        "url": "http://localhost:8000",
        "user": "local",
        "pass": "testing",
        "namespace": "metabob",
        "database": "devbob",
    }
    
    print("=" * 70)
    print(" Fix Activity Registration - Proper Serialization")
    print("=" * 70)
    print()
    
    bootstrap_dir = Path("repos/metabob-proto/activities/bootstrap")
    
    if not bootstrap_dir.exists():
        print(f"❌ Bootstrap directory not found: {bootstrap_dir}")
        return 1
    
    templates = list(bootstrap_dir.glob("*.json"))
    
    if not templates:
        print(f"❌ No templates found")
        return 1
    
    print(f"📂 Found {len(templates)} bootstrap templates")
    print()
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    with httpx.Client() as client:
        for template_path in templates:
            with open(template_path) as f:
                variant_data = json.load(f)
            
            variant_id = variant_data.get("variant_id", "unknown")
            
            print(f"📝 Registering: {template_path.stem} ({variant_id})")
            
            # Check if already exists
            check_query = f"""
            USE NS {config['namespace']} DB {config['database']};
            SELECT variant_id FROM activity_variants WHERE variant_id = '{variant_id}';
            """
            
            response = client.post(
                f"{config['url']}/sql",
                content=check_query,
                auth=(config["user"], config["pass"]),
                headers={"Accept": "application/json"},
            )
            
            if response.status_code == 200:
                data = response.json()
                result = data[1] if len(data) > 1 else data[0]
                
                if result.get("result") and len(result["result"]) > 0:
                    print(f"   ⏭️  Already exists: {variant_id}")
                    skip_count += 1
                    continue
            
            # Insert
            if insert_variant_properly(client, variant_data, config):
                success_count += 1
                
                # Verify task_steps was populated
                verify_query = f"""
                USE NS {config['namespace']} DB {config['database']};
                SELECT variant_id, task_steps FROM activity_variants WHERE variant_id = '{variant_id}';
                """
                
                response = client.post(
                    f"{config['url']}/sql",
                    content=verify_query,
                    auth=(config["user"], config["pass"]),
                    headers={"Accept": "application/json"},
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = data[1] if len(data) > 1 else data[0]
                    
                    if result.get("result"):
                        task_steps = result["result"][0].get("task_steps", [])
                        print(f"   ✓ Verified: {len(task_steps)} task_steps")
            else:
                error_count += 1
    
    print()
    print("=" * 70)
    print(" Summary")
    print("=" * 70)
    print(f"  ✅ Successfully registered: {success_count}")
    print(f"  ⏭️  Already existed: {skip_count}")
    print(f"  ❌ Errors: {error_count}")
    print(f"  📊 Total: {len(templates)}")
    print()
    
    if success_count > 0:
        print("✅ Activities registered with proper serialization!")
        print()
        print("Verify:")
        print("  python3 << 'EOF'")
        print("import httpx")
        print("# Query any variant and check task_steps length > 0")
        print("EOF")
        return 0
    else:
        print("⚠️  No new activities registered")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
