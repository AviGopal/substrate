# Deployment Manifest - Self-Contained Bootstrap Templates

**Date**: 2026-02-16  
**Deployment Type**: Production-Ready Distribution  
**Risk Level**: LOW (backward compatible)

---

## Files Changed

### metabob-proto Repository

#### New Files (3)
```
activities/bootstrap/create-activity-self-contained.json (24KB)
activities/bootstrap/debug-activity-self-contained.json (26KB)
activities/bootstrap/evolve-activity-self-contained.json (36KB)
```

#### Git Commit
```
Commit: 09b8639
Message: "Add self-contained bootstrap templates"
Branch: master
```

---

### metabob-opencode Repository

#### New Files (3)
```
packages/opencode/templates/built-in/create-activity-self-contained.json (24KB)
packages/opencode/templates/built-in/debug-activity-self-contained.json (26KB)
packages/opencode/templates/built-in/evolve-activity-self-contained.json (36KB)
```

#### Modified Files (2)
```
packages/opencode/src/session/bootstrap-templates.ts
  - Updated TEMPLATE_FILES to reference self-contained templates
  - Updated TEMPLATE_IDS array
  - Updated field mapping (subagent || agent)

packages/opencode/test/session/bootstrap-templates.test.ts
  - Updated tests to validate new templates
  - All 14 tests passing
```

#### Git Commit
```
Commit: 1ca9a2d1
Message: "Add self-contained bootstrap templates to distribution"
Branch: feat/acp-delegation-improvements
```

---

## Template Details

### 1. Create Activity Template (Self-Contained)
- **File**: `create-activity-self-contained.json`
- **Size**: 24KB
- **Tasks**: 4
  1. gather-requirements
  2. design-task-graph
  3. write-template-json
  4. validate-and-document
- **Context Requirements**: 0 (fully self-contained)
- **Category**: infrastructure

### 2. Debug Activity Execution (Self-Contained)
- **File**: `debug-activity-self-contained.json`
- **Size**: 26KB
- **Tasks**: 4
  1. gather-execution-evidence
  2. analyze-task-failures
  3. identify-root-causes
  4. recommend-fixes
- **Context Requirements**: 0 (fully self-contained)
- **Category**: infrastructure

### 3. Evolve Activity Template (Self-Contained)
- **File**: `evolve-activity-self-contained.json`
- **Size**: 36KB
- **Tasks**: 4
  1. collect-execution-evidence
  2. identify-patterns
  3. generate-improvements
  4. validate-changes
- **Context Requirements**: 0 (fully self-contained)
- **Category**: infrastructure

---

## Bundle Integration

### Template Loading Flow
```
1. Build opencode binary
   └─> Bundles: packages/opencode/templates/built-in/*.json

2. Binary deployed to customer

3. Organization created
   └─> Calls: InstanceBootstrap()
       └─> Calls: TemplateLibrary.initialize()
           └─> Loads: templates/built-in/*.json
               └─> Registers with Metabob backend

4. Templates available
   └─> Via: search_activities, ActivityTemplate.list(), CLI
```

### Template IDs Generated
```
create-activity-self-contained  (from create-activity-self-contained.json)
debug-activity-self-contained   (from debug-activity-self-contained.json)
evolve-activity-self-contained  (from evolve-activity-self-contained.json)
```

---

## Verification Checklist

- [x] Templates exist in proto repo
- [x] Templates exist in opencode repo (built-in/)
- [x] Templates are valid JSON
- [x] Templates have required structure (name, tasks, category)
- [x] Templates have zero context requirements
- [x] Bootstrap integration updated
- [x] Tests updated and passing (14/14)
- [x] Git commits completed
- [x] Documentation created
- [x] Deployment verification passed (20/20)

---

## Build Instructions

### Building the Bundle
```bash
cd repos/metabob-opencode
npm run build
# Templates will be bundled automatically from templates/built-in/
```

### Verifying the Bundle
```bash
# Check templates are in bundle
ls -la dist/platform/templates/built-in/*self-contained*

# Expected output:
# create-activity-self-contained.json
# debug-activity-self-contained.json
# evolve-activity-self-contained.json
```

### Testing the Bundle
```bash
# Run opencode from built binary
./dist/platform/bin/opencode activity list | grep self-contained

# Expected output:
# create-activity-self-contained
# debug-activity-self-contained
# evolve-activity-self-contained
```

---

## Rollback Instructions

### If Issues Found After Deployment

1. **Revert Git Commits**
```bash
# Revert opencode repo
cd repos/metabob-opencode
git revert 1ca9a2d1

# Revert proto repo
cd ../metabob-proto
git revert 09b8639
```

2. **Rebuild Binary**
```bash
cd ../metabob-opencode
npm run build
```

3. **Redeploy**
```bash
# Deploy reverted binary
# Old templates remain functional
```

---

## Monitoring

### Metrics to Track
- Template load success rate (target: 100%)
- Template execution success rate (target: >90%)
- Template usage by ID (track adoption)
- Error rates (loading, parsing, execution)

### Health Checks
```bash
# After deployment, verify:
opencode activity list                        # Templates appear
opencode activity info create-activity-self-contained  # Details correct
opencode --log-level=debug                    # No errors during load
```

---

## Related Documentation

- `SELF_CONTAINED_TEMPLATES_DEPLOYMENT.md` - Complete deployment guide
- `DEPLOYMENT_VERIFICATION_RESULTS.md` - Verification results
- `ACTIVITY_TEMPLATE_CREATION_GUIDE.md` - Template creation guide
- `BOOTSTRAP_TEMPLATE_STATUS.md` - Previous template audit

---

## Sign-Off

**Created By**: Activity Mode (AI Agent)  
**Date**: 2026-02-16  
**Status**: Production Ready ✅  
**Verification**: 20/20 Checks Passed ✅  
**Risk Assessment**: LOW (backward compatible) 🟢

---

## Next Steps

1. **Build**: Run `npm run build` in opencode repo
2. **Test**: Verify templates in bundle
3. **Deploy**: Deploy binary to production
4. **Monitor**: Track template usage and error rates
5. **Document**: Update release notes with new templates

**Ready for Production Release** 🚀
