# cpg-inference API Documentation Update

**Date**: 2025-11-15  
**Status**: ✅ Complete

---

## Summary

Updated the cpg-inference README to accurately reflect the actual API implementation, added documentation for new features, and corrected version numbers.

---

## Changes Made

### 1. Version Update ✅

**File**: `cpg_inference/__init__.py`

- Updated version: `0.5.1` → `0.5.2`
- Reflects the stdout contamination fix release

### 2. API Documentation Corrections ✅

Fixed method names and signatures to match implementation:

#### CoChangePredictor

**Changed:**
```python
# OLD (incorrect)
.predict_cochanges(changed_files: list[str], all_files: dict, top_k: int)

# NEW (correct)
.predict_cochanges(changed_files: list[str], files: dict, top_k: int)
```

#### GraphQueryEngine

**Changed:**
```python
# OLD (incorrect)
.get_dependencies(component_id: str) -> set[str]
.get_dependents(component_id: str) -> set[str]
.find_paths(start_id: str, end_id: str, max_depth: int) -> list[list[str]]
.get_neighborhood(component_id: str, depth: int) -> dict
.search_by_name(pattern: str) -> list[QueryResult]
.get_impact_set(component_ids: list[str], max_depth: int) -> set[str]

# NEW (correct)
.find_dependencies(node_id: str) -> list[QueryResult]
.find_dependents(node_id: str) -> list[QueryResult]
.find_path(source_id: str, target_id: str, max_depth: int) -> list[str] | None
.get_neighborhood(node_id: str, depth: int) -> list[QueryResult]
.find_nodes_by_name(pattern: str, regex: bool = False) -> list[QueryResult]
.get_impact_set(node_ids: list[str], max_depth: int) -> list[QueryResult]
.get_reverse_impact_set(node_ids: list[str], max_depth: int) -> list[QueryResult]
```

**Key fixes:**
- `component_id` → `node_id` (consistent terminology)
- `get_dependencies` → `find_dependencies` (consistent naming)
- `find_paths` → `find_path` (returns single path, not multiple)
- Return types corrected (`list[QueryResult]` instead of `set[str]` or `dict`)
- Added `get_reverse_impact_set` (was missing)

### 3. New Feature Documentation ✅

#### Persistent Storage

Added comprehensive section on storage backends:

```python
from cpg_inference.storage import SQLiteStorage

# File-based SQLite storage (persistent)
storage = SQLiteStorage("path/to/components.db")
predictor = CoChangePredictor(config, storage_backend=storage)
```

**Documented options:**
- In-memory SQLite (default)
- File-based SQLite (persistent)
- Redis (distributed - requires `pip install cpg-inference[redis]`)

#### Logging Configuration

Added section on controlling logging output:

```python
import logging

# Suppress CPG parse warnings (production mode)
logging.getLogger("cpg_inference.cpg.progressive_parser").setLevel(logging.ERROR)

# Enable debug logging (development mode)
logging.getLogger("cpg_inference").setLevel(logging.DEBUG)

# Log to file
handler = logging.FileHandler("cpg_analysis.log")
logging.getLogger("cpg_inference").addHandler(handler)
```

**Key points documented:**
- Parse errors log to stderr (not stdout)
- Avoids contaminating stdio-based protocols (JSONRPC)
- Configurable log levels for production vs development

### 4. Installation Documentation ✅

Added optional dependencies section:

```bash
# For Redis-based storage backend
pip install cpg-inference[redis]
```

---

## Documentation Sections Updated

1. **Installation** - Added optional dependencies
2. **Quick Start** - Fixed parameter names
3. **Usage Patterns** - Fixed method calls
4. **Graph Traversal Queries** - Fixed all method names and signatures
5. **API Reference** - Corrected CoChangePredictor methods
6. **API Reference** - Corrected GraphQueryEngine methods
7. **New: Persistent Storage** - Added storage backend documentation
8. **New: Logging Configuration** - Added logging best practices

---

## Verification

All changes verified:

```bash
# Version updated
$ grep "__version__" cpg_inference/__init__.py
__version__ = "0.5.2"

# API methods corrected
$ grep "find_dependencies\|find_path\|predict_cochanges" README.md
dependencies = engine.find_dependencies("api/users.py::get_user")
predictions = predictor.predict_cochanges(
    files={"auth/login.py": content, "api/users.py": content},
deps = engine.find_dependencies("api.py::get_users")
path = engine.find_path("auth.py::login", "db.py::query", max_depth=5)
.predict_cochanges(changed_files: list[str], files: dict, top_k: int = 20)
.find_dependencies(node_id: str) -> list[QueryResult]
```

---

## Impact

### Before
- ❌ Incorrect method names in documentation
- ❌ Wrong parameter names
- ❌ Incorrect return types
- ❌ Missing storage backend documentation
- ❌ No logging configuration guidance
- ❌ Outdated version number

### After
- ✅ All methods match actual implementation
- ✅ Correct parameter names
- ✅ Accurate return types
- ✅ Complete storage backend documentation
- ✅ Logging best practices documented
- ✅ Version number current (0.5.2)

---

## Files Modified

1. `cpg_inference/__init__.py` - Version bump
2. `README.md` - Comprehensive documentation update
3. `API_DOCS_UPDATE.md` (this file) - Change summary

---

## Next Steps

### Recommended

1. **Update package build** - Rebuild with new README
   ```bash
   cd packages/cpg-inference
   uv build
   ```

2. **Test examples** - Verify all README examples work
   ```bash
   python examples/quick_start.py
   ```

3. **Update package on PyPI** (when ready)
   ```bash
   uv publish
   ```

### Future Improvements

1. Add API reference documentation generator (Sphinx)
2. Create separate examples for each feature
3. Add troubleshooting section
4. Document performance tuning options

---

**Status**: ✅ Complete  
**Documentation**: Accurate and comprehensive  
**Version**: 0.5.2 (current)

