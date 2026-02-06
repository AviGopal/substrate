# CPG Inference

Real-time codebase analysis through unified Code Property Graphs and semantic embeddings.

## Overview

CPG Inference provides a living representation of your codebase—treating all files as a single organism with progressive updates, cross-file dependency tracking, and intelligent co-change prediction.

## Core Capabilities

**Graph Construction**
- Parse code into semantic property graphs (functions, classes, dependencies)
- Track relationships: calls, data flow, inheritance, imports
- Progressive updates: add, modify, delete files without full rebuilds

**Dependency Analysis**
- Cross-file symbol resolution with import awareness
- Transitive dependency traversal
- Impact analysis for change propagation
- Cycle detection and topological ordering

**Co-change Prediction**
- Structural similarity via SimHash fingerprints
- GNN-based semantic embeddings (ONNX inference)
- Efficient similarity search (FAISS indexing)
- Hybrid graph + embedding recommendations

## Installation

```bash
pip install cpg-inference
```

### Optional Dependencies

```bash
# For Redis-based storage backend
pip install cpg-inference[redis]
```

### From source

```bash
git clone https://github.com/sacpgo/cpg-inference.git
cd cpg-inference
pip install -e .
```

## Quick Start

```python
from cpg_inference import CoChangePredictor, InferenceConfig, get_model_path

# Initialize with bundled model
config = InferenceConfig(
    model_path=get_model_path("default"),
    embedding_dim=32,
)
predictor = CoChangePredictor(config, project_root="./src")

# Progressive file operations
predictor.add_file("auth/login.py", open("auth/login.py").read())
predictor.add_file("auth/session.py", open("auth/session.py").read())
predictor.add_file("api/users.py", open("api/users.py").read())

# Update when file changes
predictor.update_file("auth/login.py", new_content)

# Analyze change impact
impact = predictor.analyze_change_impact(
    component_ids=["auth/login.py::login"],
    max_depth=3,
)

print(f"Direct dependencies: {len(impact['graph_forward'])}")
print(f"Components affected: {len(impact['graph_backward'])}")
print(f"Similar components: {len(impact['embedding_similar'])}")

# Query the code graph
engine = predictor.query_graph()
callers = engine.find_callers("auth/login.py::login")
dependencies = engine.find_dependencies("api/users.py::get_user")

# Predict co-changes
predictions = predictor.predict_cochanges(
    changed_files=["auth/login.py"],
    files={"auth/login.py": content, "api/users.py": content},
    top_k=10,
)
```

## Usage Patterns

### Progressive Codebase Management

Treat your codebase as a living graph that evolves:

```python
# Initial setup
predictor = CoChangePredictor(config, project_root="./")

# Add files as you encounter them
for file_path in discovered_files:
    content = read_file(file_path)
    predictor.add_file(file_path, content)

# Update on file change
def on_file_change(file_path, new_content):
    predictor.update_file(file_path, new_content)

# Remove deleted files
def on_file_delete(file_path):
    predictor.delete_file(file_path)

# Query anytime - always uses latest graph
engine = predictor.query_graph()
```

### Cross-File Impact Analysis

Understand how changes propagate:

```python
# Analyze impact of changing a function
impact = predictor.analyze_change_impact(
    component_ids=["utils.py::helper"],
    max_depth=3,  # Traverse 3 hops
)

# Components that call this function
for comp_id in impact["graph_backward"]:
    print(f"Caller: {comp_id}")

# Components this function depends on
for comp_id in impact["graph_forward"]:
    print(f"Dependency: {comp_id}")

# Semantically similar components (may also need changes)
for comp_id in impact["embedding_similar"]:
    print(f"Similar: {comp_id}")
```

### Graph Traversal Queries

Navigate the code graph:

```python
engine = predictor.query_graph()

# Find who calls this function
callers = engine.find_callers("auth.py::login")

# Find what this function calls
callees = engine.find_callees("auth.py::login")

# Get all dependencies (direct)
deps = engine.find_dependencies("api.py::get_users")

# Find shortest path
path = engine.find_path("auth.py::login", "db.py::query", max_depth=5)

# Get component neighborhood
neighbors = engine.get_neighborhood("auth.py::login", depth=2)
```

### Persistent Storage

Use storage backends for caching components across sessions:

```python
from cpg_inference import CoChangePredictor, InferenceConfig, get_model_path
from cpg_inference.storage import SQLiteStorage

# File-based SQLite storage (persistent)
storage = SQLiteStorage("path/to/components.db")

config = InferenceConfig(model_path=get_model_path("default"))
predictor = CoChangePredictor(config, storage_backend=storage)

# Components are automatically cached to disk
predictor.add_file("auth.py", content)
predictor.add_file("api.py", content)

# Next time - load from cache (much faster)
predictor2 = CoChangePredictor(config, storage_backend=storage)
stats = predictor2.get_stats()  # Instant - loaded from cache
```

**Storage Options:**

- **In-memory** (default): `SQLiteStorage(":memory:")` - Fast, no persistence
- **File-based SQLite**: `SQLiteStorage("path/to/db")` - Persistent, single-node
- **Redis**: `RedisStorage(host, port)` - Shared cache, distributed

### Logging Configuration

Control logging output for parse errors and diagnostics:

```python
import logging

# Suppress CPG parse warnings (production mode)
logging.getLogger("cpg_inference.cpg.progressive_parser").setLevel(logging.ERROR)

# Or enable debug logging (development mode)
logging.getLogger("cpg_inference").setLevel(logging.DEBUG)

# Log to file instead of stderr
handler = logging.FileHandler("cpg_analysis.log")
handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
logging.getLogger("cpg_inference").addHandler(handler)
```

**Note**: Parse errors are logged to stderr (not stdout) to avoid contaminating stdio-based communication protocols like JSONRPC.

## Architecture

### Unified Code Property Graph

All files exist in a single, continuously updated graph:

- **Nodes**: Functions, classes, methods, statements
- **Edges**: 
  - `CONTAINS`: Structural hierarchy
  - `CALLS`: Function/method invocations
  - `DEPENDS`: Data and control flow
  - `INHERITS`: Class inheritance
  - `IMPORTS`: Module dependencies

### Progressive Parsing

No full rebuilds—update the graph incrementally:

1. **Add**: Parse new file, merge nodes into global graph
2. **Update**: Remove old nodes, add new ones, preserve other files
3. **Delete**: Remove all nodes and edges, update dependents

### Import-Aware Resolution

Symbol lookup respects import context:

```python
# file_a.py
from utils import helper
result = helper()  # Resolves to utils.py::helper

# file_b.py  
def helper(): pass
result = helper()  # Resolves to file_b.py::helper (local priority)
```

### Hybrid Analysis

Combines structural and semantic understanding:

- **Graph traversal**: Explicit dependencies (calls, imports)
- **Embedding similarity**: Implicit relationships (similar logic)
- **Co-change prediction**: Historical patterns + current structure

## Bundled Model

Pre-trained GCN (69KB) for immediate use:

- 2-layer Graph Convolutional Network
- 128-bit SimHash → 32-dim embeddings
- Trained on multi-language codebase
- AUC 0.9999 on validation set

```python
from cpg_inference import get_model_path, get_model_info

# Use bundled model
model_path = get_model_path("default")
info = get_model_info("default")

# Or provide your own ONNX model
config = InferenceConfig(model_path="custom_model.onnx")
```

## Language Support

Powered by tree-sitter parsers:

| Language   | Import Resolution | Status |
|------------|-------------------|--------|
| Python     | ✓                | Full   |
| Java       | ✓                | Full   |
| JavaScript | ✓                | Full   |
| TypeScript | ✓                | Full   |
| C/C++      | ✓                | Full   |
| Ruby       | Partial          | Beta   |
| PHP        | Partial          | Beta   |

## API Reference

### CoChangePredictor

Main interface for codebase analysis:

```python
CoChangePredictor(config: InferenceConfig, project_root: str = ".")

# File operations
.add_file(file_path: str, content: str) -> dict
.update_file(file_path: str, content: str) -> dict
.delete_file(file_path: str) -> dict

# Analysis
.analyze_change_impact(component_ids: list[str], max_depth: int = 3) -> dict
.predict_cochanges(changed_files: list[str], files: dict, top_k: int = 20)

# Graph access
.query_graph() -> GraphQueryEngine
.get_cpg() -> CodePropertyGraph
.get_stats() -> dict
```

### GraphQueryEngine

Navigate the code graph:

```python
engine = predictor.query_graph()

# Traversal
.find_callers(node_id: str) -> list[QueryResult]
.find_callees(node_id: str) -> list[QueryResult]
.find_dependencies(node_id: str) -> list[QueryResult]
.find_dependents(node_id: str) -> list[QueryResult]

# Search
.find_path(source_id: str, target_id: str, max_depth: int) -> list[str] | None
.get_neighborhood(node_id: str, depth: int) -> list[QueryResult]
.find_nodes_by_name(pattern: str, regex: bool = False) -> list[QueryResult]
.find_components_at_line(file_path: str, line_num: int) -> list[QueryResult]

# Analysis
.get_impact_set(node_ids: list[str], max_depth: int) -> list[QueryResult]
.get_reverse_impact_set(node_ids: list[str], max_depth: int) -> list[QueryResult]
.get_stats() -> dict
```

## Requirements

- Python ≥ 3.10
- tree-sitter ≥ 0.25.0
- onnxruntime ≥ 1.23.0
- numpy ≥ 2.1.0
- faiss-cpu ≥ 1.12.0


## Performance Characteristics

**Parse Time**: ~10-50ms per file (depends on size)  
**Update Time**: ~20-100ms per file (parse + graph merge)  
**Query Time**: ~1-10ms for typical traversals  
**Memory**: ~1-5MB per 100 files (graph structure)  
**Index Size**: ~100KB per 1000 components (FAISS)

Designed for real-time monitoring with sub-second response times.

## Use Cases

**Change Impact Analysis**  
Understand blast radius before committing changes

**Code Review Assistance**  
Identify related components that may need updates

**Test Selection**  
Find tests affected by code changes

**Refactoring Support**  
Track dependencies during restructuring

**Documentation Generation**  
Map component relationships and usage