# Activity Registration - Proper Approach

**Date**: February 6, 2026  
**Insight**: Use existing infrastructure instead of reinventing

## The Right Way

You're absolutely correct. We should have:

1. **Used metabob-proto as the standard** for template format
2. **Used metabob-rpc-api's existing registration code** through admin CLI
3. **Identified reusable components** instead of writing new scripts

## What We Should Have Done

### 1. Check Existing Admin CLI Commands

```bash
# First step: Check what's already available
cd repos/metabob-rpc-api
grep -r "register.*template\|create.*variant" . --include="*.py"

# Look for admin CLI
find . -name "admin*.py" -o -name "cli*.py"
```

### 2. Use Metabob-Proto Standard Format

Instead of creating our own template format, we should have:

```bash
# Start with proto standard
cd repos/metabob-proto/activities/bootstrap

# Copy existing template as starting point
cp bug-fix.json ../../jiggle-documentation.json

# Edit to match our needs (but keep the SAME structure)
```

### 3. Use RPC API's Registration Logic

The RPC API already has proper registration code that handles serialization correctly. We should have used it:

```python
# metabob-rpc-api already has this logic!
from server.actions.activity_variants import create_variant

# This handles all serialization properly
await create_variant(db, variant_data)
```

## What Exists That We Didn't Use

### Metabob RPC API - Activity Variants Actions

**File**: `repos/metabob-rpc-api/server/actions/activity_variants.py`

This file likely contains:
- `create_variant()` - Proper variant creation with serialization
- `update_variant()` - Variant updates
- `get_variant()` - Retrieval (we found this)
- `list_variants()` - Listing

### Metabob CLI - Admin Commands

**File**: `repos/metabob-cli/src/metabob_cli/...`

Likely has admin commands:
- `metabob-cli admin create-template`
- `metabob-cli admin register-template`
- `metabob-cli admin list-templates`

### Metabob-Proto - Template Standard

**Directory**: `repos/metabob-proto/activities/bootstrap/`

This IS the standard. We should have:
1. Copied an existing template
2. Modified it to our needs
3. Used the same format exactly

## The Reuse Principle

### What You Said: "Identify When Reuse Is Possible"

**Red Flags We Ignored**:
1. ❌ Writing `scripts/init-db.py` to do raw SQL - **reuse violation**
2. ❌ Creating custom template format - **reinventing the wheel**
3. ❌ Manual database INSERT queries - **bypassing existing infrastructure**
4. ❌ Not checking for admin CLI commands first - **missed reuse opportunity**

**What We Should Have Done**:
1. ✅ Check: "Does metabob-cli have a register command?"
2. ✅ Check: "What format do existing templates use?"
3. ✅ Check: "Does the RPC API have registration endpoints?"
4. ✅ Check: "How did the 8 bootstrap templates get registered?"

## Proper Workflow (What We Should Do Now)

### Step 1: Find the Admin CLI

```bash
cd repos/metabob-cli

# Find admin commands
python -m metabob_cli --help | grep -i admin
python -m metabob_cli admin --help 2>/dev/null

# Or check source
find . -name "*admin*.py" -o -name "*cli*.py" | grep -v __pycache__
```

### Step 2: Convert Template to Proto Standard

```bash
# Use metabob-proto format
cd repos/metabob-proto/activities/bootstrap

# Create jiggle-documentation.json in EXACT same format as bug-fix.json
# Just different content
```

### Step 3: Use Existing Registration

```bash
# Option A: Admin CLI (preferred)
metabob-cli admin register-template ./jiggle-documentation.json

# Option B: RPC API endpoint (if CLI doesn't exist)
curl -X POST http://localhost:8080/admin/templates \
  -H "X-Internal-Request: true" \
  -H "Content-Type: application/json" \
  -d @jiggle-documentation.json

# Option C: Python with existing action (if no CLI/API)
python << EOF
from server.actions.activity_variants import create_variant
from server.utils.surreal_client import get_surreal_connection
import json

with open('jiggle-documentation.json') as f:
    template = json.load(f)

db = await get_surreal_connection()
await create_variant(db, template)
