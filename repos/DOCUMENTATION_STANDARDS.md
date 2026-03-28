# Documentation Standards

This document establishes organization standards for documentation and test files across all repositories in this workspace.

## Root-level Files (Keep Minimal)

Only these files should exist at repository root:

- **README.md** - Project overview, quick start, and basic usage
- **CONTRIBUTING.md** - Contributor guidelines (optional)
- **CHANGELOG.md** - Version history (optional)
- **LICENSE.md** - License information (optional)

## Active Documentation

Current, actively maintained documentation:

- **docs/** - Current reference documentation
  - `docs/guides/` - How-to guides and tutorials
  - `docs/api/` - API documentation
  - `docs/architecture/` - Architecture decisions and diagrams
  - `docs/development/` - Development workflows and setup

- **Root-level quick references** (limited, specific purpose):
  - Quick start guides
  - Quick reference cards
  - Active development workflows
  - Configuration examples

## Historical Documentation

Documentation from past sprints, implementations, or one-time reports:

- **.archive/** - Historical implementation docs
  - `.archive/sprints/` - Sprint summaries and retrospectives
  - `.archive/implementation-history/` - Implementation notes and summaries
  - `.archive/migrations/` - Migration guides and reports

**When to archive:**
- Files ending in `*_SUMMARY.md`, `*_COMPLETE.md`, `*_IMPLEMENTATION*.md`
- One-time reports: `BUILD_SUCCESS.md`, `FINAL_SUMMARY.md`
- Sprint-specific documentation after sprint completion
- Hidden temporary files starting with `.`

## Test Organization

### Proper Test Locations

- **tests/** - Main test directory
  - `tests/unit/` - Unit tests
  - `tests/integration/` - Integration tests
  - `tests/e2e/` - End-to-end tests
  - `tests/debug/` - Debug scripts and exploratory tests
  - `tests/scratch/` - Temporary test files (gitignored)

### What Belongs in tests/debug/

- Debug scripts: `debug_*.py`, `debug_*.js`
- Exploratory tests: `test_*.py` not part of regular test suite
- One-off verification scripts
- Manual testing scripts

**Do NOT** put test files in:
- Repository root
- `scripts/` directory (unless they're production utility scripts)
- Random subdirectories

## Naming Conventions

### Documentation Files

- **Active docs**: `FEATURE_NAME.md`, `QUICK_START.md`, `API_REFERENCE.md`
- **Historical docs**: `*_SUMMARY.md`, `*_COMPLETE.md`, `*_IMPLEMENTATION*.md`
- **Avoid**: Hidden files starting with `.` (except .gitignore, .env templates)

### Test Files

- **Unit tests**: `*.test.ts`, `*.spec.ts`, `test_*.py`
- **Debug scripts**: `debug_*.py`, `debug_*.sh`
- **Manual tests**: `manual_test_*.py`

## Cleanup Guidelines

### When to Archive Documentation

Archive a document when:
1. It describes a completed sprint or implementation
2. It's a one-time report or summary
3. It hasn't been updated in 3+ months and isn't referenced
4. It starts with `.` and contains implementation notes

### When to Move Test Scripts

Move to `tests/debug/` when:
1. Test file is in repository root
2. Test file is in `scripts/` but isn't a production utility
3. File name starts with `test_*` or `debug_*`
4. File is exploratory or one-off, not part of CI

### What NOT to Archive

Keep these files active:
- Current architecture documentation
- Active development workflows
- Configuration examples in use
- Quick reference guides frequently accessed
- README, CONTRIBUTING, CHANGELOG files

## Maintenance Schedule

### Monthly Review
- Review root-level MD files
- Archive completed sprint summaries
- Move loose test scripts
- Clean up hidden `.md` files

### Quarterly Review
- Audit `.archive/` for truly obsolete docs
- Consolidate similar historical docs
- Update active documentation
- Review and update this standards document

## Examples

### ✅ Good Structure

```
my-repo/
├── README.md
├── QUICK_START.md
├── docs/
│   ├── guides/
│   │   └── deployment.md
│   └── api/
│       └── endpoints.md
├── .archive/
│   ├── sprints/
│   │   └── SPRINT_12_SUMMARY.md
│   └── implementation-history/
│       └── AUTH_REFACTOR_COMPLETE.md
└── tests/
    ├── unit/
    ├── integration/
    └── debug/
        └── debug_auth.py
```

### ❌ Bad Structure

```
my-repo/
├── README.md
├── ACTIVITY_SYSTEM_COMPLETE.md (should be archived)
├── FINAL_SUMMARY.md (should be archived)
├── .IMPLEMENTATION-COMPLETE.md (should be archived)
├── debug_script.py (should be in tests/debug/)
├── test_feature.py (should be in tests/)
└── BUILD_SUCCESS.md (should be archived)
```

## Enforcement

This is a living document. All team members and AI agents should:
1. Follow these standards when creating new documentation
2. Archive historical docs during cleanup
3. Move misplaced test files
4. Update this document if standards evolve

---

**Last Updated:** February 17, 2026
**Maintained By:** Development Team
