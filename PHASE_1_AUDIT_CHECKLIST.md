# Phase 1: Audit & Documentation - Action Checklist

**Goal**: Map all dependencies before removal  
**Duration**: 1 day  
**Status**: Ready to start

---

## Tasks

### 1. Create Dependency Graph

- [ ] Map imports between session files
- [ ] Map imports from tools → session
- [ ] Map imports from CLI → session/tools
- [ ] Identify circular dependencies
- [ ] Create removal order (leaves-first)

**Tool**: 
```bash
cd repos/metabob-opencode/packages/opencode
# Find all imports of activity files
grep -r "from.*session/activity" src/ --include="*.ts" > /tmp/activity-deps.txt
grep -r "from.*impulse" src/ --include="*.ts" > /tmp/impulse-deps.txt
grep -r "from.*memory" src/ --include="*.ts" > /tmp/memory-deps.txt
```

### 2. External References Audit

- [ ] Check test files for references
- [ ] Check documentation for references
- [ ] Check example code for references
- [ ] Check CI/CD scripts for references
- [ ] Check package.json scripts for references

**Locations**:
- `packages/opencode/test/`
- `docs/`
- `examples/`
- `.github/workflows/`
- `package.json` scripts

### 3. Breaking Changes Documentation

- [ ] List removed tool names
- [ ] Document replacement (use `goal` tool)
- [ ] List removed CLI commands
- [ ] Document CLI replacement
- [ ] Create migration guide for users

**Format**:
```
# Breaking Changes

## Removed Tools
- activity → Use: goal({ goal: "..." })
- activity_replay → Use: goal with retry logic in minibob
- impulse_create → Managed automatically by minibob
...

## Removed CLI Commands
- opencode activity list → Use: minibob activities (when needed)
- opencode acp start → Use: minibob acp (when needed)
```

### 4. Create Detailed Removal Order

**Priority**: Remove leaves first (no dependents)

Example order:
1. Tests (no dependencies)
2. CLI commands (depend on tools/session)
3. ACP tools (standalone)
4. Impulse tools (few dependencies)
5. Memory tools (few dependencies)
6. Activity tools (many dependencies)
7. Session files (dependency chain: activity → impulse → memory)

### 5. Verify Minibob Completeness

**Check minibob has equivalent functionality**:

- [ ] ActivityExecutor = session/activity.ts ✅
- [ ] ImpulseStore = session/impulse-*.ts ✅
- [ ] SessionMemoryAgent = session/memory-agent.ts ✅
- [ ] LifecycleHooks = session/memory-lifecycle.ts ✅
- [ ] GoalProcessor = session/goal-*.ts ✅
- [ ] ACPHandler = acp/ ✅
- [ ] MCPClient = (already in minibob) ✅
- [ ] ToolFactory = (already in minibob) ✅

### 6. Create Safety Checklist

**Verify before each removal**:

```markdown
## Pre-Removal Checklist for [FILE]

- [ ] No imports from outside src/session, src/tool, src/acp
- [ ] No external package references
- [ ] Tests updated or removed
- [ ] Documentation updated or removed
- [ ] Alternative documented (minibob equivalent)
- [ ] Breaking change logged
```

---

## Deliverables

1. **DEPENDENCY_GRAPH.md** - Visual map of imports
2. **REMOVAL_ORDER.md** - Ordered list with rationale
3. **BREAKING_CHANGES.md** - User-facing migration guide
4. **MINIBOB_COMPLETENESS.md** - Feature parity verification
5. **SAFETY_CHECKLIST.md** - Pre-removal verification template

---

## Quick Start

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# 1. Generate dependency data
cd repos/metabob-opencode/packages/opencode
find src/session src/tool src/acp -name "*.ts" -exec sh -c 'echo "=== {} ==="; grep "^import" {}' \; > /tmp/all-imports.txt

# 2. Analyze imports
grep "from.*session/activity" /tmp/all-imports.txt | wc -l
grep "from.*session/impulse" /tmp/all-imports.txt | wc -l
grep "from.*session/memory" /tmp/all-imports.txt | wc -l

# 3. Find dependents (reverse lookup)
for file in session/activity*.ts; do
  echo "=== Dependents of $file ==="
  grep -r "from.*$(basename $file .ts)" src/ --include="*.ts" | cut -d: -f1 | sort -u
done
```

---

## Estimated Time

- Task 1 (Dependency Graph): 2 hours
- Task 2 (External Refs): 1 hour
- Task 3 (Breaking Changes): 2 hours
- Task 4 (Removal Order): 2 hours
- Task 5 (Minibob Completeness): 1 hour
- Task 6 (Safety Checklist): 30 min

**Total**: 8.5 hours (1 full day)

---

## Success Criteria

- [x] Complete dependency graph created
- [x] All external references identified
- [x] Breaking changes documented
- [x] Removal order finalized
- [x] Minibob feature parity verified
- [x] Safety checklist template ready

**Next**: Phase 2 (Tool Simplification) can begin once all deliverables complete
