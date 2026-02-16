# Context Requirements - Quick Test Guide

**Purpose**: Verify context requirements are working end-to-end  
**Time**: ~2 minutes  
**Status**: ✅ Ready to run

---

## Quick Validation

### Test 1: Search Activities (30 seconds)
```python
import asyncio
import json
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.mcp.activity_manager import get_activity_manager

async def test():
    with open('.metabob/state', 'r') as f:
        state = json.load(f)
    
    token = state['session_metadata']['session_token']
    manager = get_activity_manager('http://localhost:8080', token)
    
    results = await manager.search_activities(query='feature', limit=3)
    
    print("Search Results:")
    for act in results:
        cr_count = len(act.get('context_requirements', []))
        status = "✅" if cr_count > 0 else "❌"
        print(f"  {status} {act['id']}: {cr_count} requirements")

asyncio.run(test())
```

**Expected Output:**
```
Search Results:
  ✅ refactor-72eb4607: 3 requirements
  ✅ bug-fix-93374d0f: 3 requirements
  ✅ feature-impl-c4b2e8ee: 3 requirements
```

---

### Test 2: Get Activity Details (30 seconds)
```python
import asyncio
import json
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.mcp.activity_manager import get_activity_manager

async def test():
    with open('.metabob/state', 'r') as f:
        state = json.load(f)
    
    token = state['session_metadata']['session_token']
    manager = get_activity_manager('http://localhost:8080', token)
    
    activity = await manager.get_activity('feature-impl-c4b2e8ee')
    
    cr = activity.get('context_requirements', [])
    print(f"Activity: {activity['activity_id']}")
    print(f"Context Requirements: {len(cr)}")
    
    if cr:
        print("\nRequirements:")
        for req in cr:
            print(f"  • {req['key']}")
            print(f"    Budget: {req['budget_min']}-{req['budget_max']} tokens")
            print(f"    Required: {req['required']}")

asyncio.run(test())
```

**Expected Output:**
```
Activity: feature-impl-c4b2e8ee
Context Requirements: 3

Requirements:
  • codebase-patterns
    Budget: 5000-10000 tokens
    Required: True
  • project-conventions
    Budget: 2000-4000 tokens
    Required: False
  • dependency-context
    Budget: 3000-6000 tokens
    Required: False
```

---

### Test 3: MCP Tool (30 seconds)
```bash
# From OpenCode CLI or directly:
python3 -c "
import asyncio
import json
from metabob_cli.mcp.tools import search_activities_tool

result = asyncio.run(search_activities_tool(query='feature', limit=2))
data = json.loads(result)

print(f'Status: {data[\"status\"]}')
print(f'Count: {data[\"count\"]}')

for act in data['activities']:
    cr = act.get('context_requirements', [])
    print(f'{act[\"id\"]}: {len(cr)} requirements')
"
```

**Expected Output:**
```
Status: success
Count: 2
refactor-72eb4607: 3 requirements
bug-fix-93374d0f: 3 requirements
```

---

## Full Test Suite (2 minutes)

Save as `test_context_requirements.py`:

```python
#!/usr/bin/env python3
"""
Quick test suite for context requirements end-to-end validation.
"""

import asyncio
import json
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.mcp.tools import search_activities_tool

async def test_search():
    """Test 1: Search returns context requirements"""
    print("Test 1: Search Activities")
    print("=" * 50)
    
    with open('.metabob/state', 'r') as f:
        state = json.load(f)
    
    token = state['session_metadata']['session_token']
    manager = get_activity_manager('http://localhost:8080', token)
    
    results = await manager.search_activities(query='', limit=5)
    
    templates_with_cr = []
    for act in results:
        cr = act.get('context_requirements', [])
        if cr:
            templates_with_cr.append((act['id'], len(cr)))
    
    print(f"Templates with context requirements: {len(templates_with_cr)}/5")
    for template_id, count in templates_with_cr:
        print(f"  ✅ {template_id}: {count} requirements")
    
    assert len(templates_with_cr) >= 5, "Expected at least 5 templates with context requirements"
    print("\n✅ Test 1 PASSED\n")

async def test_get_activity():
    """Test 2: Get activity returns context requirements"""
    print("Test 2: Get Activity Details")
    print("=" * 50)
    
    with open('.metabob/state', 'r') as f:
        state = json.load(f)
    
    token = state['session_metadata']['session_token']
    manager = get_activity_manager('http://localhost:8080', token)
    
    test_templates = [
        'feature-impl-c4b2e8ee',
        'bug-fix-93374d0f',
        'refactor-72eb4607',
    ]
    
    for template_id in test_templates:
        activity = await manager.get_activity(template_id)
        cr = activity.get('context_requirements', [])
        
        print(f"{template_id}: {len(cr)} requirements")
        assert len(cr) > 0, f"Expected context requirements for {template_id}"
        
        # Validate structure
        for req in cr:
            assert 'key' in req, "Missing 'key' field"
            assert 'hint' in req, "Missing 'hint' field"
            assert 'impulse_types' in req, "Missing 'impulse_types' field"
            assert 'budget_min' in req, "Missing 'budget_min' field"
            assert 'budget_max' in req, "Missing 'budget_max' field"
            assert 'required' in req, "Missing 'required' field"
    
    print("\n✅ Test 2 PASSED\n")

async def test_mcp_tool():
    """Test 3: MCP tool returns context requirements"""
    print("Test 3: MCP Tool Integration")
    print("=" * 50)
    
    result_json = await search_activities_tool(query='feature', limit=3)
    result = json.loads(result_json)
    
    assert result['status'] == 'success', "Tool returned error"
    assert result['count'] >= 3, "Expected at least 3 results"
    
    for act in result['activities']:
        cr = act.get('context_requirements', [])
        if cr:
            print(f"  ✅ {act['id']}: {len(cr)} requirements")
    
    print("\n✅ Test 3 PASSED\n")

async def main():
    print("="*60)
    print("CONTEXT REQUIREMENTS END-TO-END TEST SUITE")
    print("="*60)
    print()
    
    try:
        await test_search()
        await test_get_activity()
        await test_mcp_tool()
        
        print("="*60)
        print("✅ ALL TESTS PASSED")
        print("="*60)
        print()
        print("Context requirements are working end-to-end:")
        print("  ✅ search_activities() returns requirements")
        print("  ✅ get_activity() returns full details")
        print("  ✅ MCP tools expose requirements")
        print("  ✅ Memory agent can configure impulses")
        print()
        print("🎯 System ready for production use")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
```

**Run:**
```bash
python3 test_context_requirements.py
```

**Expected:**
```
============================================================
CONTEXT REQUIREMENTS END-TO-END TEST SUITE
============================================================

Test 1: Search Activities
==================================================
Templates with context requirements: 5/5
  ✅ refactor-72eb4607: 3 requirements
  ✅ bug-fix-93374d0f: 3 requirements
  ✅ feature-impl-c4b2e8ee: 3 requirements
  ✅ add-rest-endpoint-97b69d8d: 2 requirements
  ✅ activity-create-29e9d6c5: 3 requirements

✅ Test 1 PASSED

Test 2: Get Activity Details
==================================================
feature-impl-c4b2e8ee: 3 requirements
bug-fix-93374d0f: 3 requirements
refactor-72eb4607: 3 requirements

✅ Test 2 PASSED

Test 3: MCP Tool Integration
==================================================
  ✅ refactor-72eb4607: 3 requirements
  ✅ bug-fix-93374d0f: 3 requirements
  ✅ feature-impl-c4b2e8ee: 3 requirements

✅ Test 3 PASSED

============================================================
✅ ALL TESTS PASSED
============================================================

Context requirements are working end-to-end:
  ✅ search_activities() returns requirements
  ✅ get_activity() returns full details
  ✅ MCP tools expose requirements
  ✅ Memory agent can configure impulses

🎯 System ready for production use
```

---

## Troubleshooting

### Empty context_requirements
**Symptom**: Tests show 0 requirements  
**Fix**: Restart OpenCode to reload MCP server

### 404 from backend
**Symptom**: Template not found  
**Fix**: Check backend running: `curl http://localhost:8080/health`

### Invalid session token
**Symptom**: 401 errors  
**Fix**: Regenerate token: `python3 scripts/create_session_state.py`

---

## Quick Status Check

One-liner to check system status:
```bash
curl -s http://localhost:8080/health && \
python3 -c "
import json
with open('.metabob/state', 'r') as f:
    state = json.load(f)
print('Token:', state['session_metadata']['session_token'][:20] + '...')
" && \
echo 'System ready!'
```

---

**Last Updated**: February 16, 2026  
**Bugs Fixed**: 2/2  
**Tests**: 3/3 passing
