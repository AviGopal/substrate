"""Test to reproduce task_steps empty array bug"""
import asyncio
import json
from repos.metabob_rpc_api.server.actions.activity_variants import create_variant, get_variant

# Test data with task_steps
test_variant_data = {
    "activity_id": "test-bug",
    "variant_name": "Bug Reproduction Test",
    "description": "Testing task_steps persistence",
    "version": 1,
    "task_steps": [
        {
            "id": "step-1",
            "description": "First test step",
            "subagent": "general",
            "dependencies": [],
            "prompt": {
                "template": "Test prompt",
                "maxTokens": 8000,
                "compressionStrategy": "filter"
            },
            "validation": {
                "check": "none",
                "error": "Validation failed",
                "requiredFiles": [],
                "requiredPatterns": [],
                "forbiddenPatterns": [],
                "commands": []
            },
            "retry": {
                "max_attempts": 2,
                "strategy": "simple"
            }
        },
        {
            "id": "step-2",
            "description": "Second test step", 
            "subagent": "general",
            "dependencies": ["step-1"],
            "prompt": {
                "template": "Test prompt 2",
                "maxTokens": 8000,
                "compressionStrategy": "filter"
            },
            "validation": {
                "check": "none",
                "error": "Validation failed",
                "requiredFiles": [],
                "requiredPatterns": [],
                "forbiddenPatterns": [],
                "commands": []
            },
            "retry": {
                "max_attempts": 2,
                "strategy": "simple"
            }
        }
    ],
    "variables": {},
    "prompt_strategy": "guided",
}

async def test_create():
    # Import here to avoid import errors
    import sys
    sys.path.insert(0, 'repos/metabob-rpc-api')
    from server.utils.dependencies import get_surreal_connection
    
    db = await anext(get_surreal_connection())
    
    print("=== Testing task_steps persistence ===\n")
    print(f"Input task_steps length: {len(test_variant_data['task_steps'])}")
    print(f"First task ID: {test_variant_data['task_steps'][0]['id']}")
    
    # Create variant
    print("\n--- Creating variant ---")
    variant = await create_variant(db, test_variant_data.copy())
    
    print(f"\nCreated variant ID: {variant.variant_id}")
    print(f"Variant task_steps type: {type(variant.task_steps)}")
    print(f"Variant task_steps length: {len(variant.task_steps) if variant.task_steps else 0}")
    
    # Read it back
    print("\n--- Reading back from database ---")
    retrieved = await get_variant(db, variant.variant_id)
    
    if retrieved:
        print(f"Retrieved variant ID: {retrieved.variant_id}")
        print(f"Retrieved task_steps type: {type(retrieved.task_steps)}")
        print(f"Retrieved task_steps length: {len(retrieved.task_steps) if retrieved.task_steps else 0}")
        
        if retrieved.task_steps:
            print(f"First task: {retrieved.task_steps[0]}")
        else:
            print("❌ BUG CONFIRMED: task_steps is empty!")
    else:
        print("❌ Failed to retrieve variant")
    
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(test_create())
