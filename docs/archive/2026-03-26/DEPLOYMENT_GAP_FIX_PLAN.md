# Deployment Gap Fix Plan

**Issue:** System only works in dev environment, breaks for testing team  
**Root Cause:** Environment-specific dependencies and hardcoded paths  
**Impact:** Critical - prevents external validation and deployment

---

## Gap Analysis

### 1. Hardcoded Paths (HIGH PRIORITY)

**Problem:**
```bash
# Found in scripts and validation:
repos/metabob-opencode/...         # 18+ occurrences
/home/avi/documents/...            # Multiple scripts
/tmp/test-*.json                   # Validation tests
./templates/                       # 28 local templates
```

**Impact:** Scripts fail when directory structure differs

**Testing team sees:**
```
Error: Cannot find repos/metabob-opencode
Error: Template 'add-feature-complete' not found
Error: /home/avi/documents/... no such directory
```

### 2. Local Templates Not Packaged (CRITICAL)

**Problem:**
```bash
# We have 28 templates locally:
templates/add-feature-complete.json
templates/fix-bug-complete.json
templates/trace-data-flow-single-feature.json
...

# But these are NOT distributed with metabob-cli
```

**Impact:** Core templates (add-feature, fix-bug, etc.) missing for users

**Testing team sees:**
```
Error: Template 'add-feature-complete' not registered
Available templates: [] (empty)
```

### 3. Template Discovery Relies on Filesystem (MEDIUM)

**Problem:**
```typescript
// Tools assume templates exist locally:
search_activities({ category: "feature" })
// Returns: [] if templates not pre-loaded
```

**Impact:** Discovery tools return empty results

### 4. No Bootstrap Process (HIGH)

**Problem:**
- No initial template installation
- No template registry seeding
- No metabob-cli integration for template pull

**Impact:** Fresh installs have zero templates

### 5. Validation Tests Assume Dev Environment (MEDIUM)

**Problem:**
```bash
# Tests reference dev paths:
cd repos/metabob-opencode && bun run cli
register_activity_template({ file_path: "/tmp/test-*.json" })
```

**Impact:** Validation tests cannot be reproduced externally

---

## Solution Architecture

### Phase 1: Template Packaging (CRITICAL - Day 1)

**Goal:** Bundle core templates with metabob-cli

**Implementation:**

```
metabob-cli/
├── templates/
│   ├── builtin/                    # Core templates (bundled)
│   │   ├── add-feature-complete.json
│   │   ├── fix-bug-complete.json
│   │   ├── refactor-with-tests.json
│   │   ├── create-activity-template.json
│   │   └── trace-data-flow-single-feature.json
│   └── registry/                   # Downloaded from metabob backend
│       └── (pulled via metabob-cli)
├── bin/
│   └── metabob-cli                 # CLI with bootstrap command
└── lib/
    └── template-bootstrap.ts       # Auto-install on first run
```

**Commands:**

```bash
# Auto-bootstrap on first run:
metabob-cli init
# → Installs builtin templates to ~/.local/share/metabob/templates/

# Manual template pull:
metabob-cli templates pull
# → Downloads from metabob backend registry

# List available:
metabob-cli templates list
```

### Phase 2: Path Resolution (HIGH - Day 1)

**Goal:** Eliminate hardcoded paths

**Implementation:**

```typescript
// Current (WRONG):
const templatePath = "/home/avi/documents/.../templates/my-template.json"

// Fixed (RIGHT):
import { getTemplateDir } from "@metabob/cli"

const templatePath = getTemplateDir("builtin", "my-template.json")
// → ~/.local/share/metabob/templates/builtin/my-template.json
```

**Path Resolution Strategy:**

```typescript
// template-paths.ts
export const TEMPLATE_DIRS = {
  builtin: () => path.join(getCliRoot(), "templates/builtin"),
  user: () => path.join(os.homedir(), ".local/share/metabob/templates"),
  registry: () => path.join(os.homedir(), ".local/share/metabob/templates/registry"),
  cache: () => path.join(os.homedir(), ".cache/metabob/templates")
}

export function resolveTemplate(id: string): string {
  // 1. Check user override
  const userPath = path.join(TEMPLATE_DIRS.user(), `${id}.json`)
  if (existsSync(userPath)) return userPath

  // 2. Check builtin
  const builtinPath = path.join(TEMPLATE_DIRS.builtin(), `${id}.json`)
  if (existsSync(builtinPath)) return builtinPath

  // 3. Check registry (pulled from backend)
  const registryPath = path.join(TEMPLATE_DIRS.registry(), `${id}.json`)
  if (existsSync(registryPath)) return registryPath

  throw new Error(`Template not found: ${id}`)
}
```

### Phase 3: Template Registry Integration (MEDIUM - Day 2)

**Goal:** Pull templates from metabob backend dynamically

**Implementation:**

```typescript
// metabob-cli templates pull
async function pullTemplates() {
  const backend = getMetabobBackend() // from config
  
  // Pull from Metabob RPC API
  const templates = await fetch(`${backend}/v2/activities/templates`)
  
  for (const template of templates) {
    const path = TEMPLATE_DIRS.registry() + `/${template.id}.json`
    await writeFile(path, JSON.stringify(template, null, 2))
  }
  
  console.log(`Pulled ${templates.length} templates from registry`)
}
```

**Offline Support:**

```typescript
// Builtin templates work without network
// Registry templates cached after first pull
// Fallback to builtin if registry unavailable
```

### Phase 4: Portable Validation (MEDIUM - Day 2)

**Goal:** Make validation tests work anywhere

**Implementation:**

```bash
# Instead of:
cd /home/avi/documents/.../repos/metabob-opencode

# Use:
cd $(metabob-cli config get cli-path)

# Instead of:
register_activity_template({ file_path: "/tmp/test.json" })

# Use:
register_activity_template({ 
  file_path: "$(metabob-cli templates path builtin)/test.json" 
})
```

**Validation Test Updates:**

```typescript
// test-activity-learning.ts (FIXED)
import { getBuiltinTemplate } from "@metabob/cli"

const testTemplate = getBuiltinTemplate("test-learning-debugging")
// → Resolves correctly regardless of environment
```

### Phase 5: Bootstrap on First Run (HIGH - Day 1)

**Goal:** Auto-setup templates on initial use

**Implementation:**

```typescript
// On first metabob-cli run:
async function bootstrap() {
  const userTemplateDir = TEMPLATE_DIRS.user()
  
  if (!existsSync(userTemplateDir)) {
    console.log("First run detected. Installing templates...")
    
    // Copy builtin templates
    await copyBuiltinTemplates()
    
    // Try to pull from registry (optional)
    try {
      await pullTemplates()
    } catch (err) {
      console.warn("Could not pull from registry (offline?)")
    }
    
    console.log("✓ Templates installed successfully")
  }
}
```

---

## Implementation Plan

### Day 1: Critical Fixes

**1. Package Core Templates (2 hours)**

```bash
# Create template bundle
mkdir -p metabob-cli/templates/builtin/
cp templates/add-feature-complete.json metabob-cli/templates/builtin/
cp templates/fix-bug-complete.json metabob-cli/templates/builtin/
cp templates/refactor-with-tests.json metabob-cli/templates/builtin/
cp templates/create-activity-template.json metabob-cli/templates/builtin/
cp templates/trace-data-flow-single-feature.json metabob-cli/templates/builtin/
```

**2. Add Path Resolution (3 hours)**

```typescript
// Add to metabob-cli:
export { getTemplateDir, resolveTemplate } from "./lib/template-paths"

// Update all hardcoded paths in:
// - src/tool/register-activity-template.ts
// - src/tool/search-activities.ts
// - src/tool/activity.ts
```

**3. Add Bootstrap Command (2 hours)**

```bash
metabob-cli init
# → Copies builtin templates to user directory
# → Creates config if not exists
# → Validates installation
```

**Total Day 1:** 7 hours

### Day 2: Registry Integration

**4. Implement Template Pull (4 hours)**

```bash
metabob-cli templates pull
# → Fetches from metabob backend
# → Caches locally
# → Updates registry

metabob-cli templates list
# → Shows builtin + registry templates
```

**5. Update Validation Tests (3 hours)**

```bash
# Make tests portable:
scripts/validate-core-use-case-portable.sh
# → Uses metabob-cli paths
# → Works on any machine
```

**Total Day 2:** 7 hours

### Day 3: Documentation & Testing

**6. Update Documentation (2 hours)**

```markdown
# Installation Guide (NEW)
1. Install metabob-cli
2. Run: metabob-cli init
3. Verify: metabob-cli templates list
```

**7. Test Deployment (3 hours)**

```bash
# Test on fresh VM:
1. Install metabob-cli only
2. Run init
3. Execute validation tests
4. Verify all templates work
```

**Total Day 3:** 5 hours

---

## Testing Plan

### Test Scenario 1: Fresh Install

```bash
# Clean environment (Docker):
docker run -it ubuntu:22.04 bash

# Install metabob-cli:
curl -fsSL https://metabob.com/install.sh | sh

# Bootstrap:
metabob-cli init

# Verify templates:
metabob-cli templates list
# Expected: 5+ builtin templates

# Test execution:
metabob-cli exec activity --template add-feature-complete --vars '{...}'
# Expected: Works without errors
```

### Test Scenario 2: Template Discovery

```bash
# Should work without network:
metabob-cli templates list --source builtin
# Expected: Shows 5 core templates

# Should pull from registry:
metabob-cli templates pull
# Expected: Downloads additional templates

# Should resolve correctly:
metabob-cli templates path add-feature-complete
# Expected: /home/user/.local/share/metabob/templates/builtin/add-feature-complete.json
```

### Test Scenario 3: Validation Tests

```bash
# Run on any machine:
git clone https://github.com/metabob/validation-tests
cd validation-tests
./scripts/validate-core-use-case-portable.sh

# Expected: All tests pass
# No hardcoded paths
# No missing templates
```

---

## Files to Create/Modify

### New Files

1. **metabob-cli/lib/template-paths.ts**
   - Path resolution logic
   - Template directory management

2. **metabob-cli/lib/template-bootstrap.ts**
   - First-run initialization
   - Template installation

3. **metabob-cli/lib/template-registry.ts**
   - Pull from metabob backend
   - Cache management

4. **metabob-cli/commands/init.ts**
   - Bootstrap command
   - Setup wizard

5. **metabob-cli/commands/templates.ts**
   - list, pull, path subcommands

6. **scripts/validate-core-use-case-portable.sh**
   - Portable validation test
   - No hardcoded paths

### Modified Files

1. **repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts**
   - Use resolveTemplate() instead of hardcoded paths

2. **repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts**
   - Search in all template directories

3. **repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts**
   - Multi-directory support (builtin, user, registry)

4. **All validation scripts in scripts/**
   - Replace hardcoded paths with metabob-cli commands

---

## Success Criteria

### ✅ Acceptance Tests

1. **Fresh install works:**
   ```bash
   # On clean Ubuntu VM:
   curl -fsSL https://metabob.com/install.sh | sh
   metabob-cli init
   metabob-cli templates list
   # → Shows 5+ templates
   ```

2. **Core templates available:**
   ```bash
   metabob-cli templates list
   # → add-feature-complete ✓
   # → fix-bug-complete ✓
   # → refactor-with-tests ✓
   # → create-activity-template ✓
   # → trace-data-flow-single-feature ✓
   ```

3. **Validation tests portable:**
   ```bash
   # Works on any machine with metabob-cli:
   ./scripts/validate-core-use-case-portable.sh
   # → All tests pass
   # → No "file not found" errors
   ```

4. **Registry integration works:**
   ```bash
   metabob-cli templates pull
   # → Downloads from backend
   # → Caches locally
   
   metabob-cli templates list
   # → Shows builtin + registry templates
   ```

5. **Offline mode works:**
   ```bash
   # Disconnect network
   metabob-cli templates list
   # → Still shows builtin templates
   
   # Execute activity
   metabob-cli exec activity --template add-feature-complete
   # → Works from builtin cache
   ```

---

## Risk Mitigation

### Risk 1: Template Format Compatibility

**Risk:** Builtin templates out of sync with backend registry

**Mitigation:**
- Version builtin templates
- Add format validation
- Auto-update check on init

### Risk 2: Path Conflicts

**Risk:** User and builtin templates have same ID

**Mitigation:**
- User templates take precedence
- Clear resolution order documented
- Warning on ID conflicts

### Risk 3: Registry Unavailable

**Risk:** Cannot pull templates from backend

**Mitigation:**
- Builtin templates always available
- Graceful degradation
- Offline mode supported

### Risk 4: Breaking Changes for Existing Users

**Risk:** Path changes break existing workflows

**Mitigation:**
- Legacy path support (deprecation warning)
- Migration guide
- Backward compatibility period

---

## Rollout Plan

### Week 1: Internal Testing

- Deploy to internal testing team
- Gather feedback on template resolution
- Fix critical bugs

### Week 2: Beta Release

- Package with metabob-cli beta
- Document new commands
- Test on multiple platforms

### Week 3: Production Release

- Include in stable metabob-cli
- Deprecate hardcoded paths (warnings)
- Update all documentation

---

## Summary

**Current State:** ❌ Only works in dev environment  
**Target State:** ✅ Works on any machine with metabob-cli

**Key Changes:**
1. Bundle core templates with CLI
2. Eliminate hardcoded paths
3. Add template registry integration
4. Bootstrap templates on first run
5. Make validation tests portable

**Estimated Effort:** 3 days (19 hours)

**Priority:** CRITICAL - Blocks external validation and deployment

**Next Step:** Implement Phase 1 (template packaging + path resolution)
