# Bootstrap Templates - Quick Reference

**Status**: 🟢 ALL SYSTEMS OPERATIONAL  
**Last Updated**: February 16, 2026

---

## System Status

```
✅ Templates Registered: 16/16 (100%)
✅ Activities: 14
✅ Variants: 16
✅ Inheritance System: READY
✅ Database: Production SurrealDB
```

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Total Templates** | 16 JSON files |
| **Activities Registered** | 14 (2 have multiple variants) |
| **Variants Available** | 16 |
| **Categories** | feature (1), bugfix (3), refactor (2), infrastructure (9) |
| **Average Tasks per Template** | 4-6 tasks |

---

## Template Catalog

### By Category

**Feature** (1):
- `feature-impl` - Implement new features with tests

**Bugfix** (3):
- `bug-fix` - General bug fixing workflow
- `fix-security-bug` - Security vulnerability fixes
- `security-audit-complete` - Comprehensive security audit (NEW!)

**Refactor** (2):
- `refactor` - Code refactoring workflow
- `safe-refactor` - Refactoring with safety checks

**Infrastructure** (9):
- `activity-create` (2 variants) - Create new activity templates
- `activity-debug` - Debug activity execution
- `activity-evolve` - Evolve existing templates
- `add-rest-endpoint` - Add REST API endpoints
- `boredom-task-processor` - Process background tasks
- `code-analysis` - Analyze code quality
- `create-activity-template` (2 variants) - Template creation
- `jiggle-documentation` - Update documentation

---

## Database Tables

### Core Tables
- `activities` - Activity definitions (14 records)
- `activity_variants` - Template variants (16 records)

### New: Inheritance Tables
- `project_activity_template` - Project-template links
- `template_customization` - Project-specific overrides

### Helper Function
- `fn::inherit_templates_to_project(project_id, org_id, source)` - Auto-link templates

---

## Common Commands

### Check Template Count
```bash
POD=$(kubectl -n metabob get pods -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

kubectl -n metabob exec $POD -c rpc-api -- python3 -c "
import asyncio
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

async def main():
    config = Settings()
    db = SurrealDBClient(config)
    await db.connect()
    
    activities = await db.query('SELECT count() FROM activities GROUP ALL')
    variants = await db.query('SELECT count() FROM activity_variants GROUP ALL')
    
    print(f'Activities: {activities[0][\"count\"]}')
    print(f'Variants: {variants[0][\"count\"]}')
    
    await db.disconnect()

asyncio.run(main())
" 2>&1 | grep -E "Activities|Variants"
```

### List All Templates
```bash
kubectl -n metabob exec $POD -c rpc-api -- python3 -c "
import asyncio
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

async def main():
    config = Settings()
    db = SurrealDBClient(config)
    await db.connect()
    
    result = await db.query('SELECT activity_id, name, category FROM activities ORDER BY name')
    for r in result:
        print(f'{r[\"activity_id\"]}: {r[\"name\"]} [{r[\"category\"]}]')
    
    await db.disconnect()

asyncio.run(main())
"
```

### Inherit Templates to Project
```bash
# SurrealDB query
SELECT * FROM fn::inherit_templates_to_project('my-project', 'my-org', NONE)
```

---

## File Locations

### In Repository
```
repos/metabob-proto/activities/bootstrap/*.json (16 files)
```

### In Production Pod
```
/opt/metabob-proto/activities/bootstrap/*.json (16 files)
```

### Scripts
- `register_bootstrap_prod.py` - Template registration
- `add_template_inheritance_schema.py` - Inheritance setup

---

## What's Complete ✅

1. ✅ All 16 templates registered to database
2. ✅ Template inheritance schema created
3. ✅ Inheritance function implemented
4. ✅ Fixed `security-audit-complete.json` schema issue
5. ✅ End-to-end testing passed

---

## What's Next 🔧

1. **Integrate inheritance into org/project creation**
   - Auto-create default project on org creation
   - Call `fn::inherit_templates_to_project` automatically

2. **Add project-specific API endpoints**
   - `GET /v2/projects/{id}/templates`
   - `PATCH /v2/projects/{id}/templates/{variant_id}`
   - `POST /v2/projects/{id}/templates/inherit`

3. **Update agent execution**
   - Filter templates by project context
   - Apply project-specific customizations

---

## Database Connection

```
Type: SurrealDB
URL: ws://surrealdb:8000
Namespace: metabob
Database: production
Username: metabob-admin
Password: production-password-change-me
```

---

## Template Variants

**Activities with Multiple Variants**:

1. **activity-create** (2 variants):
   - `v1-baseline` - Original version
   - `v2-self-validating` - With validation

2. **create-activity-template** (2 variants):
   - `v3` - Latest version
   - `v3-compat` - Compatibility mode

All other activities have 1 variant each (usually `v1`).

---

## Category Distribution

```
Infrastructure: 9 templates (56%)
Bugfix:        3 templates (19%)
Refactor:      2 templates (13%)
Feature:       1 template  (6%)
```

---

## Success Criteria Met

- [x] 100% template registration success
- [x] All V2 schema compliant
- [x] Inheritance system operational
- [x] Production database stable
- [x] Documentation complete

---

**For detailed documentation, see**: `DATABASE_BOOTSTRAP_COMPLETE_FEB16.md`
