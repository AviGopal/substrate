# CPG Inference Library

A production-ready library for predicting code co-changes using Code Property Graphs (CPG) and Graph Neural Networks (GNN).

## Purpose

When code changes, related components often need to change together. This library identifies those relationships using:
- **Machine Learning**: GNN-based embeddings capture structural similarity patterns
- **Static Analysis**: Graph queries reveal explicit dependencies and call relationships

Use it to:
- Predict which files/components should change together
- Analyze change impact across your codebase
- Navigate code structure via call graphs and dependencies
- Cache analysis results for fast incremental updates

## Core Capabilities

### Dual-Mode Analysis
Combines two complementary approaches for comprehensive code understanding:

**Similarity Search (ML-based)**
- Learns co-change patterns from code structure
- Finds components with similar structural patterns
- Works across file boundaries and indirect relationships

**Graph Queries (Static Analysis)**
- Navigates explicit relationships (calls, dependencies, inheritance)
- Provides precise caller/callee information
- Enables impact analysis via graph traversal

### Flexible Storage
Choose the right storage backend for your use case:
- **In-Memory**: Fast, no persistence, single-session analysis
- **SQLite**: Local persistent cache for development workflows
- **Redis**: Centralized cache for distributed systems with multi-repository isolation

### Incremental Processing
Efficiently handle code changes:
- Reprocess only modified files (not entire codebase)
- Persistent storage enables cross-session caching
- Significant speedup for large repositories with frequent small changes

## Installation

### Basic Installation

```bash
pip install cpg-inference
```

This installs all required dependencies:
- `tree-sitter` with language parsers (Python, Java, JavaScript, C, C++, Ruby, PHP)
- `onnxruntime` for fast GNN inference
- `numpy` for numerical operations
- `faiss-cpu` for efficient similarity search

### Optional Dependencies

```bash
# Redis support for centralized caching
pip install cpg-inference[redis]

# Development tools (pytest, pytest-cov)
pip install cpg-inference[dev]
```

## Quick Start

### Basic Usage

```python
from cpg_inference import CoChangePredictor, InferenceConfig

# Initialize with default configuration
config = InferenceConfig()
predictor = CoChangePredictor(config)

# Index your codebase
files = {
    "src/auth.py": "def login(user): ...",
    "src/user.py": "class User: ...",
}

stats = predictor.update_index(files)
print(f"Indexed {stats['components_added']} components")

# Predict co-changes
predictions = predictor.predict_cochanges(
    changed_files=["src/auth.py"],
    files=files,
    top_k=10
)

for pred in predictions:
    print(f"{pred.file_path}::{pred.component_name}")
    print(f"  Similarity: {pred.similarity_score:.3f}")
```

### With Custom Configuration

```python
from cpg_inference import CoChangePredictor, InferenceConfig

config = InferenceConfig(
    model_path="models/custom_model.onnx",  # Optional: use custom model
    simhash_bits=128,                       # Feature size: 64, 128, or 256
    neighborhood_depth=1,                    # k-hop neighborhood for features
    edge_filter_mode="all",                  # "none", "structural", or "all"
    top_k=20,                                # Number of predictions to return
    min_similarity=0.7,                      # Minimum similarity threshold
)

predictor = CoChangePredictor(config, project_root=".")
```

### Combining Graph Queries and Similarity Search

The library provides **dual-mode operation** for comprehensive code analysis:

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.cpg.models import NodeType

config = InferenceConfig()
predictor = CoChangePredictor(config)

# Index your codebase
files = {
    "src/auth.py": open("src/auth.py").read(),
    "src/user.py": open("src/user.py").read(),
    "src/api.py": open("src/api.py").read(),
}

predictor.update_index(files)

# 1. SIMILARITY-BASED: Find components likely to co-change
print("Components likely to change with auth.py:")
predictions = predictor.predict_cochanges(
    changed_files=["src/auth.py"],
    files=files,
    top_k=5
)

for pred in predictions:
    print(f"  {pred.component_name} (score: {pred.similarity_score:.3f})")

# 2. STRUCTURE-BASED: Analyze call graph
print("\nGraph-based analysis:")
query_engine = predictor.query_graph()

# Find all functions
functions = query_engine.find_nodes_by_type(NodeType.FUNCTION)
print(f"Found {len(functions)} functions")

# Find functions by name
auth_funcs = query_engine.find_nodes_by_name("login")
for result in auth_funcs:
    # Get callers and callees
    callers = query_engine.find_callers(result.node_id)
    callees = query_engine.find_callees(result.node_id)
    
    print(f"\n{result.node.name}:")
    print(f"  Called by: {[c.node.name for c in callers]}")
    print(f"  Calls: {[c.node.name for c in callees]}")

# 3. COMBINED: Find similar components + analyze their relationships
print("\nCombined analysis:")
for pred in predictions[:3]:
    # Find this component in the graph
    nodes = query_engine.find_nodes_by_name(pred.component_name)
    if nodes:
        # Analyze its impact
        neighborhood = query_engine.get_neighborhood(nodes[0].node_id, depth=1)
        print(f"{pred.component_name}: {len(neighborhood)} connected nodes")
```

**Key Capabilities:**

- **Similarity Search**: Find co-changes based on structural patterns (ML-based)
- **Graph Queries**: Navigate call graphs, dependencies, and relationships
- **Impact Analysis**: Combine both to understand ripple effects of changes
- **Flexible**: Use independently or together based on your needs

## API Reference

### `InferenceConfig`

Configuration for the inference service.

**Parameters:**
- `model_path` (Path | str): Path to ONNX model file
- `index_path` (Path | str | None): Path to FAISS index (optional)
- `neighborhood_depth` (int): k-hop neighborhood for SimHash (default: 1)
- `simhash_bits` (int): Number of SimHash bits - 64, 128, or 256 (default: 128)
- `edge_filter_mode` (str): Edge types to include - "none", "structural", "all" (default: "all")
- `embedding_dim` (int): Output embedding dimension (default: 32)
- `batch_size` (int): Batch size for inference (default: 32)
- `top_k` (int): Number of results to return (default: 10)
- `min_similarity` (float): Minimum similarity threshold (default: 0.0)
- `component_types` (list[str]): Types to extract - ["function", "method", "class"] (default: all)

### `CoChangePredictor`

Main API for co-change prediction.

#### Methods

##### `__init__(config: InferenceConfig, project_root: str = ".", storage_backend: StorageBackend | None = None)`

Initialize predictor with configuration.

**Parameters:**
- `config`: Inference configuration
- `project_root`: Root directory for the project (default: ".")
- `storage_backend`: Optional storage backend for component caching (default: in-memory SQLite)

**Example:**
```python
# Default: in-memory storage
predictor = CoChangePredictor(config)

# With persistent storage
from cpg_inference.storage import SQLiteStorage
storage = SQLiteStorage("cache/cpg.db")
predictor = CoChangePredictor(config, storage_backend=storage)
```

##### `update_index(files: dict[str, str]) -> dict[str, int]`

Update FAISS index with new or changed files.

**Parameters:**
- `files`: Mapping of file_path -> file_content

**Returns:**
- Statistics dictionary with:
  - `files_processed`: Number of files processed
  - `components_added`: Number of new components
  - `components_updated`: Number of updated components

**Example:**
```python
files = {"src/auth.py": "def login(): pass"}
stats = predictor.update_index(files)
```

##### `remove_files(file_paths: list[str]) -> int`

Remove files and their components from index.

**Parameters:**
- `file_paths`: List of file paths to remove

**Returns:**
- Number of components removed

**Example:**
```python
removed = predictor.remove_files(["src/old_module.py"])
```

##### `predict_cochanges(changed_files: list[str], files: dict[str, str], top_k: int | None = None, exclude_same_file: bool = True) -> list[CoChangePrediction]`

Predict co-changes for recently changed files.

**Parameters:**
- `changed_files`: List of file paths that changed
- `files`: All available files (for parsing changed files)
- `top_k`: Number of results (uses config.top_k if None)
- `exclude_same_file`: Exclude components from same file (default: True)

**Returns:**
- List of `CoChangePrediction` objects sorted by similarity score

**Example:**
```python
predictions = predictor.predict_cochanges(
    changed_files=["src/auth.py"],
    files=all_files,
    top_k=10,
)
```

##### `get_component_embeddings(file_path: str, files: dict[str, str]) -> dict[str, np.ndarray]`

Get embeddings for all components in a file.

**Parameters:**
- `file_path`: Path to file
- `files`: All available files

**Returns:**
- Mapping of component_id -> embedding vector

##### `save_index(path: Path | str | None = None) -> None`

Save FAISS index to disk.

**Parameters:**
- `path`: Path to save to (uses config.index_path if None)

##### `get_stats() -> dict[str, int]`

Get statistics about predictor state.

**Returns:**
- Dictionary with:
  - `num_files`: Number of tracked files
  - `num_components`: Number of components in index
  - `num_cached_components`: Number of cached components

### `CoChangePrediction`

Result of co-change prediction.

**Attributes:**
- `component_id` (str): Unique component ID
- `similarity_score` (float): Similarity score (0.0 to 1.0)
- `file_path` (str): Path to file containing component
- `component_name` (str): Name of component
- `component_type` (str): Type of component ("function", "method", "class")
- `start_line` (int): Starting line number

**Methods:**
- `to_dict()`: Convert to dictionary

### `CPGComponent`

Represents a semantic code component.

**Attributes:**
- `id` (str): Unique ID (format: `{file_path}::{type}::{name}::{start_line}`)
- `file_path` (str): Path to source file
- `component_type` (NodeType): FUNCTION, METHOD, or CLASS
- `name` (str): Component name
- `start_line` (int): Starting line (1-indexed)
- `end_line` (int): Ending line (inclusive)
- `source_text` (str): Full source code
- `language` (str): Programming language
- `complexity` (int): Cyclomatic complexity
- `lines_of_code` (int): Non-blank lines
- `depth` (int): Depth in hierarchy

### `GraphQueryEngine`

Query engine for graph traversal and structural analysis.

#### Methods

##### `__init__(cpg: CodePropertyGraph | None = None)`

Initialize query engine with optional CPG.

##### `set_cpg(cpg: CodePropertyGraph)`

Set or update the CPG to query.

##### `find_callers(node_id: str) -> list[QueryResult]`

Find all functions/methods that call this node.

**Example:**
```python
query = predictor.query_graph("auth.py")
callers = query.find_callers("auth.py::function::login::10")
```

##### `find_callees(node_id: str) -> list[QueryResult]`

Find all functions/methods called by this node.

##### `find_dependencies(node_id: str) -> list[QueryResult]`

Find data dependencies (what this node uses).

##### `find_dependents(node_id: str) -> list[QueryResult]`

Find reverse dependencies (what uses this node).

##### `find_path(source_id: str, target_id: str, edge_types: list[EdgeType] | None, max_depth: int) -> list[str] | None`

Find shortest path between two nodes.

**Example:**
```python
path = query.find_path(source_id, target_id, edge_types=[EdgeType.CALLS], max_depth=10)
```

##### `get_neighborhood(node_id: str, depth: int, edge_types: list[EdgeType] | None, direction: str) -> list[QueryResult]`

Get k-hop neighborhood of a node.

**Parameters:**
- `node_id`: Center node ID
- `depth`: Number of hops (1 = immediate neighbors)
- `edge_types`: Optional edge types to follow
- `direction`: "outgoing", "incoming", or "both"

##### `get_impact_set(node_ids: list[str], max_depth: int, edge_types: list[EdgeType] | None) -> list[QueryResult]`

Get all nodes reachable from changed nodes (forward impact).

##### `get_reverse_impact_set(node_ids: list[str], max_depth: int, edge_types: list[EdgeType] | None) -> list[QueryResult]`

Get all nodes that can reach changed nodes (reverse impact).

##### `find_nodes_by_type(node_type: NodeType) -> list[QueryResult]`

Get all nodes of a specific type (FUNCTION, CLASS, METHOD, etc.).

##### `find_nodes_by_name(pattern: str, regex: bool = False) -> list[QueryResult]`

Find nodes by name pattern (string match or regex).

##### `find_components_at_line(file_path: str, line_num: int) -> list[QueryResult]`

Find components containing a specific line number.

### Graph Query Integration

The `CoChangePredictor` class provides integrated graph query methods:

#### `query_graph(file_path: str) -> GraphQueryEngine`

Get query engine for a specific file's CPG.

**Example:**
```python
predictor.update_index(files)
query = predictor.query_graph("auth.py")
callers = query.find_callers(component_id)
```

#### `analyze_change_impact(component_ids: list[str], max_depth: int = 3, combine_with_embeddings: bool = True) -> dict`

Analyze impact of changing components using graph structure + embeddings.

**Parameters:**
- `component_ids`: List of changed component IDs
- `max_depth`: Maximum graph traversal depth
- `combine_with_embeddings`: Whether to include embedding similarity
- `embedding_top_k`: Number of embedding-based results

**Returns:**
Dictionary with:
- `graph_reachable`: Components reachable via graph edges
- `graph_reverse`: Components that reach changed components
- `embedding_similar`: Semantically similar components (if enabled)
- `combined`: Union of all impacts with risk scores
- `stats`: Statistics about the analysis

**Example:**
```python
impact = predictor.analyze_change_impact(
    component_ids=["auth.py::function::login::10"],
    max_depth=3
)

print(f"Total impacted: {impact['stats']['total_impacted']}")
for component in impact['combined'][:5]:
    print(f"{component['name']}: risk={component['risk_score']:.2f}")
```

#### `get_call_graph(file_paths: list[str] | None = None) -> dict`

Get call graph structure for visualization or analysis.

**Returns:**
Dictionary with:
- `nodes`: List of all nodes
- `edges`: List of call edges
- `stats`: Statistics

**Example:**
```python
call_graph = predictor.get_call_graph(["auth.py", "api.py"])
# Export for visualization
import json
with open("call_graph.json", "w") as f:
    json.dump(call_graph, f)
```

### `QueryResult`

Result from a graph query.

**Attributes:**
- `node_id` (str): Node identifier
- `node` (CPGNode): The CPG node
- `distance` (int): Distance from query node (for path queries)
- `path` (list[str] | None): Path from source (if applicable)
- `metadata` (dict | None): Additional metadata

**Methods:**
- `to_dict()`: Convert to dictionary

## Architecture

### Data Flow

```
Input: {file_path: file_content}
  ↓
CPG Parser (tree-sitter)
  ↓
Component Extraction (functions/classes)
  ↓
SimHash Feature Generation (structural hashing)
  ↓
ONNX Model Inference (GNN embeddings)
  ↓
FAISS Index Update (replace by component ID)
  ↓
Similarity Search (top-k co-change candidates)
  ↓
Output: [(component_id, similarity_score)]
```

### Components

1. **CPG Extractor** (`cpg_extractor.py`)
   - Parses code files into CPG
   - Extracts semantic components (functions, classes, methods)
   - Generates stable component IDs

2. **Feature Generator** (`feature_generator.py`)
   - Converts CPG components to SimHash features
   - Configurable neighborhood depth and edge filters
   - Outputs bit vectors for model input

3. **Model Wrapper** (`model_wrapper.py`)
   - Loads and runs ONNX GNN model
   - Handles graph construction and batch inference
   - Returns normalized embeddings

4. **Index Manager** (`index_manager.py`)
   - Manages FAISS index with ID-based updates
   - Supports add, update, remove, and search operations
   - Persists index to disk

5. **Service** (`service.py`)
   - Main API orchestrating all components
   - Tracks file-to-component mappings
   - Handles streaming updates

6. **Storage Backend** (`storage/`)
   - Abstract interface for component persistence
   - In-memory, SQLite, and Redis implementations
   - Handles serialization and caching

7. **Graph Query Engine** (`graph_queries.py`)
   - Provides structural query API over CPG
   - Supports traversal, search, and analysis operations
   - Operates on unified CPG from ProgressiveParser

### Internal API Design

The library follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────┐
│  Public API (CoChangePredictor)             │
│  - predict_cochanges()                      │
│  - query_graph()                            │
│  - update_index()                           │
└────────────┬────────────────────────────────┘
             │
┌────────────┴────────────────────────────────┐
│  Service Layer                              │
│  - Coordinates all subsystems               │
│  - Manages state and lifecycle              │
└────┬───────┬────────┬────────┬──────────────┘
     │       │        │        │
┌────▼──┐ ┌──▼───┐ ┌─▼────┐ ┌─▼──────────┐
│ CPG   │ │Index │ │Model │ │Storage     │
│Parser │ │Mgr   │ │      │ │Backend     │
└───────┘ └──────┘ └──────┘ └────────────┘
```

**Key Interfaces:**

1. **StorageBackend**: Persistence contract
   ```python
   class StorageBackend(ABC):
       def store_component(self, component: CPGComponent) -> None: ...
       def get_component(self, component_id: str) -> CPGComponent | None: ...
       def get_all_files(self) -> list[str]: ...
       def clear(self) -> None: ...
   ```

2. **GraphQueryEngine**: Structural query contract
   ```python
   class GraphQueryEngine:
       def find_nodes_by_type(self, node_type: NodeType) -> list[QueryResult]: ...
       def find_callers(self, node_id: str) -> list[QueryResult]: ...
       def get_neighborhood(self, node_id: str, depth: int) -> list[QueryResult]: ...
   ```

3. **IndexManager**: Similarity search contract
   ```python
   class FAISSIndexManager:
       def add(self, embeddings: ndarray, component_ids: list[str]) -> None: ...
       def search(self, query: ndarray, k: int) -> tuple[ndarray, list[str]]: ...
       def update(self, embeddings: ndarray, component_ids: list[str]) -> None: ...
   ```

## Integration Patterns

### Pattern 1: Development Tool Integration

**Use Case:** IDE plugin, CLI tool, or pre-commit hook

**Architecture:**
- Single process, local execution
- In-memory or SQLite storage for session persistence
- Fast startup required

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.storage import SQLiteStorage

class CodeAnalysisTool:
    def __init__(self, workspace_root: str):
        self.workspace_root = workspace_root
        
        # Use persistent local cache for fast restarts
        cache_path = f"{workspace_root}/.cpg-cache/components.db"
        storage = SQLiteStorage(cache_path)
        
        config = InferenceConfig()
        self.predictor = CoChangePredictor(
            config, 
            project_root=workspace_root,
            storage_backend=storage
        )
        
    def analyze_change(self, changed_files: list[str]) -> dict:
        """Analyze impact of file changes."""
        # Load only files that exist
        files = self._load_files(changed_files)
        
        # Update index (incremental if cache exists)
        self.predictor.update_index(files)
        
        # Get co-change predictions
        predictions = self.predictor.predict_cochanges(
            changed_files=changed_files,
            files=files,
            top_k=10
        )
        
        # Get graph-based impact
        query_engine = self.predictor.query_graph()
        graph_impact = []
        
        for file in changed_files:
            components = self.predictor.storage.get_file_components(file)
            for comp_id in components:
                results = query_engine.find_nodes_by_name(comp_id.split("::")[-2])
                if results:
                    callers = query_engine.find_callers(results[0].node_id)
                    graph_impact.extend(callers)
        
        return {
            "similarity_based": [p.to_dict() for p in predictions],
            "graph_based": [r.to_dict() for r in graph_impact],
        }
    
    def _load_files(self, file_paths: list[str]) -> dict[str, str]:
        """Load file contents from disk."""
        files = {}
        for path in file_paths:
            full_path = f"{self.workspace_root}/{path}"
            with open(full_path) as f:
                files[path] = f.read()
        return files
```

**Benefits:**
- Persistent cache across tool invocations
- Incremental updates for fast response
- Self-contained (no external services)

### Pattern 2: CI/CD Pipeline Integration

**Use Case:** Automated change impact analysis in continuous integration

**Architecture:**
- Ephemeral execution (container-based)
- Fresh analysis on each run
- Focus on speed over caching

```python
import os
from cpg_inference import CoChangePredictor, InferenceConfig

class ChangeImpactAnalyzer:
    """Analyze PR/commit impact in CI pipeline."""
    
    def __init__(self):
        config = InferenceConfig()
        # Use in-memory storage (no persistence needed in CI)
        self.predictor = CoChangePredictor(config)
    
    def analyze_pr(self, base_commit: str, head_commit: str) -> dict:
        """Analyze files changed in a PR."""
        # Get changed files from git
        changed_files = self._get_changed_files(base_commit, head_commit)
        
        # Load entire codebase (fresh analysis)
        all_files = self._load_all_files()
        
        # Index and analyze
        self.predictor.update_index(all_files)
        
        predictions = self.predictor.predict_cochanges(
            changed_files=changed_files,
            files=all_files,
            top_k=20
        )
        
        # Filter to high-confidence predictions
        high_confidence = [
            p for p in predictions 
            if p.similarity_score > 0.7
        ]
        
        return {
            "changed_files": changed_files,
            "suggested_reviews": [p.file_path for p in high_confidence],
            "confidence_scores": {
                p.file_path: p.similarity_score 
                for p in high_confidence
            }
        }
    
    def _get_changed_files(self, base: str, head: str) -> list[str]:
        import subprocess
        result = subprocess.run(
            ["git", "diff", "--name-only", base, head],
            capture_output=True, text=True
        )
        return result.stdout.strip().split("\n")
    
    def _load_all_files(self) -> dict[str, str]:
        """Load all source files in repository."""
        files = {}
        for root, _, filenames in os.walk("."):
            for filename in filenames:
                if filename.endswith((".py", ".java", ".js")):
                    path = os.path.join(root, filename)
                    with open(path) as f:
                        files[path] = f.read()
        return files
```

**Benefits:**
- No external dependencies (in-memory)
- Simple deployment (single container)
- Consistent analysis (fresh state each run)

### Pattern 3: Shared Service Architecture

**Use Case:** Multiple microservices analyzing the same codebase

**Architecture:**
- Centralized Redis cache
- Multiple predictor instances
- Namespace isolation per repository

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.storage import RedisStorage
import os

class SharedCodeAnalysisService:
    """Shared analysis service with centralized caching."""
    
    def __init__(self, repository_name: str):
        # Connect to shared Redis with repository-specific prefix
        storage = RedisStorage(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            prefix=repository_name,  # Namespace isolation
            ttl=86400  # Expire cache after 24 hours
        )
        
        config = InferenceConfig()
        self.predictor = CoChangePredictor(
            config,
            storage_backend=storage
        )
    
    def handle_webhook(self, event: dict) -> dict:
        """Handle code change webhook."""
        if event["type"] == "push":
            # Incremental update for pushed files
            files = self._fetch_changed_files(event["commits"])
            stats = self.predictor.update_index(files)
            
            return {
                "status": "indexed",
                "files_processed": stats["files_processed"],
                "components_added": stats["components_added"],
                "cache_shared": True
            }
        
        elif event["type"] == "query":
            # Query co-changes (uses shared cache)
            predictions = self.predictor.predict_cochanges(
                changed_files=event["files"],
                files=self._fetch_files(event["files"]),
                top_k=10
            )
            
            return {
                "predictions": [p.to_dict() for p in predictions],
                "cache_hit": True
            }
    
    def _fetch_changed_files(self, commits: list[dict]) -> dict[str, str]:
        """Fetch file contents for changed files."""
        # Implementation depends on VCS integration
        pass
    
    def _fetch_files(self, file_paths: list[str]) -> dict[str, str]:
        """Fetch specific files from repository."""
        # Implementation depends on VCS integration
        pass
```

**Deployment:**

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
  
  analysis-service-1:
    build: .
    environment:
      REDIS_HOST: redis
      REPOSITORY: "project-a"
    depends_on:
      - redis
  
  analysis-service-2:
    build: .
    environment:
      REDIS_HOST: redis
      REPOSITORY: "project-b"
    depends_on:
      - redis
```

**Benefits:**
- Shared cache across services (no redundant processing)
- Multi-repository support via namespacing
- Horizontal scalability
- Automatic cache expiration

### Pattern 4: Custom Storage Backend

**Use Case:** Integration with existing data infrastructure

```python
from cpg_inference.storage.base import StorageBackend
from cpg_inference.models import CPGComponent
import pickle

class PostgresStorage(StorageBackend):
    """Example: Store components in PostgreSQL."""
    
    def __init__(self, connection_string: str):
        import psycopg2
        self.conn = psycopg2.connect(connection_string)
        self._create_schema()
    
    def _create_schema(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS components (
                    component_id VARCHAR PRIMARY KEY,
                    data BYTEA NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS file_mappings (
                    file_path VARCHAR PRIMARY KEY,
                    component_ids TEXT[] NOT NULL
                )
            """)
            self.conn.commit()
    
    def store_component(self, component: CPGComponent) -> None:
        data = pickle.dumps(component)
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO components (component_id, data)
                VALUES (%s, %s)
                ON CONFLICT (component_id) DO UPDATE SET data = EXCLUDED.data
            """, (component.id, data))
            self.conn.commit()
    
    def get_component(self, component_id: str) -> CPGComponent | None:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT data FROM components WHERE component_id = %s",
                (component_id,)
            )
            row = cur.fetchone()
            if row:
                return pickle.loads(row[0])
        return None
    
    # Implement other required methods...
    
    def get_all_files(self) -> list[str]:
        with self.conn.cursor() as cur:
            cur.execute("SELECT file_path FROM file_mappings")
            return [row[0] for row in cur.fetchall()]
    
    def clear(self) -> None:
        with self.conn.cursor() as cur:
            cur.execute("DELETE FROM components")
            cur.execute("DELETE FROM file_mappings")
            self.conn.commit()
    
    def close(self) -> None:
        self.conn.close()
```

**Usage:**
```python
storage = PostgresStorage("postgresql://localhost/cpg_cache")
predictor = CoChangePredictor(config, storage_backend=storage)
```

## Configuration

### Model Requirements

The library is designed for GNN models with the following contract:

**Input Format:**
- SimHash feature vectors (64, 128, or 256 bits)
- Configurable via `simhash_bits` parameter

**Output Format:**
- L2-normalized embeddings
- Typical dimensions: 16, 32, 64, or 128
- Configurable via `embedding_dim` parameter

**Graph Structure:**
- Nodes: Code components (functions, methods, classes)
- Edges: Structural and semantic relationships

**Edge Types:**
- `CONTAINS`: Parent-child relationships (e.g., class contains method)
- `CALLS`: Function invocation relationships
- `DEPENDS`: Data dependencies
- `INHERITS`: Inheritance relationships

**Configuration Modes:**
- `edge_filter_mode="none"`: Node features only, no graph structure
- `edge_filter_mode="structural"`: Only CONTAINS edges
- `edge_filter_mode="all"`: All edge types (CONTAINS, CALLS, DEPENDS, INHERITS)

### Component Extraction

The library extracts three types of semantic components:

**Functions:**
- Standalone function definitions
- Top-level scope in modules

**Methods:**
- Functions defined within class bodies
- Includes static methods, class methods, instance methods

**Classes:**
- Class definitions treated as single units
- Contains nested methods and attributes

## Performance Characteristics

### Expected Performance (on typical codebase)

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Parse file (100 LOC) | ~10ms | ~100 files/sec |
| Extract components | ~5ms | ~200 files/sec |
| Generate features | ~20ms | ~50 files/sec |
| Model inference (10 components) | ~50ms | ~200 components/sec |
| FAISS search (k=10) | <1ms | >10,000 queries/sec |
| Update index (5 files) | ~200ms | ~25 batches/sec |

### Memory Footprint

| Component | Size (1000 components) |
|-----------|------------------------|
| FAISS Index | ~128 KB |
| Component Cache | ~500 KB |
| Model | ~50 MB |
| Peak Memory | ~200 MB |

### Scaling Characteristics

Performance scales approximately linearly with repository size:

| Repository Size | Cold Start Processing | Incremental Update (1 file) |
|-----------------|----------------------|----------------------------|
| 100 files | ~5-10s | ~50-100ms |
| 500 files | ~20-40s | ~100-200ms |
| 1,000 files | ~40-80s | ~200-400ms |
| 5,000 files | ~3-5min | ~500ms-1s |

**Key Insights:**
- Incremental updates are typically **10-50x faster** than full reprocessing
- Query latency remains **< 100ms** for interactive use across all scales
- Memory usage grows linearly with codebase size (~40MB per 1000 components)

### Storage Backend Selection

Choose a storage backend based on your use case:

| Scenario | Recommendation | Rationale |
|----------|----------------|-----------|
| < 500 files, infrequent updates | In-memory (default) | Cold start overhead is acceptable |
| 500-1K files, daily updates | SQLite local cache | Worthwhile speedup for incremental updates |
| 1K-5K files, frequent updates | SQLite local cache | Significant time savings on updates |
| > 5K files, any frequency | SQLite + index persistence | Required for practical performance |
| Multiple services, same repo | Redis with shared prefix | Avoids redundant processing |
| Multiple repos, shared infra | Redis with unique prefixes | Centralized management, namespace isolation |

### Performance Optimization Tips

**If parsing is the bottleneck:**
- Cache parsed CPGs between runs
- Use parallel file processing
- Filter files by relevance

**If feature generation is slow:**
- Reduce `neighborhood_depth` from 2 to 1
- Use `edge_filter_mode="structural"` instead of "all"
- Cache SimHash features

**If model inference is slow:**
- Increase `batch_size` (try 64 or 128)
- Consider GPU acceleration with onnxruntime-gpu
- Use quantized models (FP16 or INT8)

**If FAISS operations are slow:**
- Use quantized indexes (IVF, PQ) for large datasets
- Reduce `embedding_dim` if acceptable
- Shard indexes across multiple instances

**If overall throughput is low:**
- Batch file processing where possible
- Use persistent storage to avoid reprocessing
- Consider parallel processing for large codebases
- Profile to identify specific bottlenecks

## Storage Backends

The library supports pluggable storage backends for caching parsed CPG components and file mappings. This enables significant performance improvements for incremental updates.

### Default: In-Memory Storage

By default, components are stored in-memory using SQLite:

```python
from cpg_inference import CoChangePredictor, InferenceConfig

config = InferenceConfig()
predictor = CoChangePredictor(config)  # Uses in-memory storage
```

**When to use:** Small codebases (< 500 files), single-session processing, no persistence needed.

### Local Persistent Storage (SQLite)

Store components in a local SQLite database for persistence across sessions:

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.storage import SQLiteStorage

# Create persistent storage
storage = SQLiteStorage("cache/cpg_cache.db")

config = InferenceConfig()
predictor = CoChangePredictor(config, storage_backend=storage)

# First run: processes all files
files = load_codebase()
predictor.update_index(files)

# Subsequent runs: only reprocess changed files
# (up to 1472x faster for incremental updates)
predictor.update_index(modified_files)

# Clean up
storage.close()
```

**When to use:** 
- Codebases with 500+ files
- Frequent incremental updates (hourly/daily)
- Development environments
- CI/CD pipelines
- Distributed architecture (each service has local cache)

**Benefits:**
- 10-1472x faster incremental updates
- Persists across restarts
- No external dependencies
- File-based, portable cache

### Centralized Cache (Redis)

Share component cache across multiple services using Redis:

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.storage import RedisStorage

# Connect to Redis
storage = RedisStorage(
    host="localhost",
    port=6379,
    db=0,
    ttl=86400,  # Optional: expire after 24 hours
)

config = InferenceConfig()
predictor = CoChangePredictor(config, storage_backend=storage)

# All services share the same cache
predictor.update_index(files)

# Clean up
storage.close()
```

**Multiple repositories on same Redis instance:**

```python
# Repository A with custom prefix
storage_a = RedisStorage(
    host="localhost",
    port=6379,
    prefix="project_a"  # Custom prefix for isolation
)
predictor_a = CoChangePredictor(config, storage_backend=storage_a)

# Repository B with different prefix (isolated)
storage_b = RedisStorage(
    host="localhost",
    port=6379,
    prefix="project_b"  # Different prefix = different namespace
)
predictor_b = CoChangePredictor(config, storage_backend=storage_b)

# Both can use the same Redis, keys won't collide
predictor_a.update_index(files_a)
predictor_b.update_index(files_b)
```

**Installation:**
```bash
pip install cpg-inference[redis]
```

**When to use:**
- Multiple services analyzing the same codebase
- Centralized architecture
- Horizontal scaling
- Consistent codebase view required
- Multiple repositories sharing Redis (use `prefix` parameter)

**Benefits:**
- Shared state across all services
- No cache synchronization needed
- Centralized invalidation
- Optional TTL for automatic expiration
- Multi-repository support via prefix parameter

**Data Management:**

```python
# Redis stores data with namespace prefixes
# Key pattern: {prefix}:component:{component_id}
#              {prefix}:file:{file_path}:components

# Example keys for "project_a" prefix:
# - project_a:component:auth.py::function::login::10
# - project_a:file:auth.py:components

# Clean up specific repository
storage = RedisStorage(host="localhost", prefix="project_a")
storage.clear()  # Removes only keys with "project_a" prefix

# Clean up all repositories (use with caution)
import redis
client = redis.Redis(host="localhost")
client.flushdb()  # WARNING: Clears entire database

# View what's stored
keys = client.keys("project_a:*")
print(f"Repository has {len(keys)} keys")
```

### Context Manager Pattern

Use context managers for automatic resource cleanup:

```python
from cpg_inference import CoChangePredictor, InferenceConfig
from cpg_inference.storage import SQLiteStorage

config = InferenceConfig()

with SQLiteStorage("cache/cpg_cache.db") as storage:
    predictor = CoChangePredictor(config, storage_backend=storage)
    predictor.update_index(files)
# Storage automatically closed
```

### Storage Backend Comparison

| Feature | In-Memory | SQLite File | Redis |
|---------|-----------|-------------|-------|
| **Persistence** | No | Yes | Yes |
| **Setup** | None | Path only | Redis server |
| **Performance** | Fastest | Fast | Fast (network) |
| **Use Case** | Single session | Local persistence | Shared cache |
| **Best For** | < 500 files | 500-5K files | Multiple services |
| **Cold Start** | ~1.5s/50 files | ~1.5s/50 files | ~2s/50 files |
| **Incremental** | N/A | ~50ms/file | ~50ms/file |
| **Multi-Repo** | N/A | Separate files | Via prefix param |

### Performance Guidelines

Use the benchmark suite to determine the best storage backend:

```bash
pytest tests/test_benchmarks.py -m benchmark -k "storage" -v
```

**General recommendations:**

| Scenario | Recommendation |
|----------|----------------|
| < 500 files, infrequent updates | In-memory (default) |
| 500-1K files, daily updates | SQLite file-based |
| 1K-5K files, frequent updates | SQLite file-based |
| > 5K files | SQLite file-based + index persistence |
| Multiple services | Redis centralized cache |
| Single service | SQLite local cache |

### Custom Storage Backend

Implement your own storage backend by extending `StorageBackend`. See Pattern 4 in the [Integration Patterns](#integration-patterns) section for a complete PostgreSQL example.

**Required Methods:**
```python
from cpg_inference.storage.base import StorageBackend
from cpg_inference.models import CPGComponent

class CustomStorage(StorageBackend):
    def store_component(self, component: CPGComponent) -> None:
        """Store a single component."""
        
    def get_component(self, component_id: str) -> CPGComponent | None:
        """Retrieve a component by ID, or None if not found."""
        
    def set_file_components(self, file_path: str, component_ids: list[str]) -> None:
        """Map a file to its component IDs."""
        
    def get_file_components(self, file_path: str) -> list[str]:
        """Get component IDs for a file."""
        
    def get_all_files(self) -> list[str]:
        """List all indexed files."""
        
    def remove_file(self, file_path: str) -> None:
        """Remove a file and its components from storage."""
        
    def clear(self) -> None:
        """Clear all stored data."""
        
    def get_stats(self) -> dict[str, int]:
        """Return statistics about storage state."""
        
    def close(self) -> None:
        """Clean up resources."""
```

Reference implementation in `cpg_inference/storage/base.py` and concrete examples in `cpg_inference/storage/sqlite_backend.py` and `redis_backend.py`.

## Testing

Run tests with pytest:

```bash
# All tests
pytest tests/ -v

# Specific test file
pytest tests/test_service_integration.py -v

# With coverage
pytest tests/ --cov=cpg_inference --cov-report=html
```

### Optional Redis Tests

Redis storage backend tests are automatically skipped if Redis is not available:

```bash
# Install Redis support (optional)
pip install cpg-inference[redis]

# Start Redis (Docker)
docker run --name redis-test -p 6379:6379 -d redis:latest

# Run all tests (Redis tests will run if server is available)
pytest tests/

# Run only Redis tests
pytest tests/test_storage_redis.py -v
```

Configure Redis connection via environment variables:

```bash
export REDIS_HOST=localhost      # default
export REDIS_PORT=6379          # default
export REDIS_DB=15              # default (for tests)
export REDIS_PASSWORD=secret    # optional
```

Redis tests automatically skip if the server is not available, making them safe to run in any environment.

### Performance Benchmarks

Performance benchmarks are available to evaluate the impact of changes on library performance:

```bash
# Run all benchmarks
pytest tests/test_benchmarks.py -m benchmark -v

# Run specific benchmark category
pytest tests/test_benchmarks.py -m benchmark -k "cold_start" -v
pytest tests/test_benchmarks.py -m benchmark -k "incremental" -v
pytest tests/test_benchmarks.py -m benchmark -k "storage" -v
pytest tests/test_benchmarks.py -m benchmark -k "pipeline" -v

# Run a specific benchmark
pytest tests/test_benchmarks.py::test_benchmark_cold_start_small -v
```

**Available benchmarks:**

- **Cold Start:** Full repository processing (50, 500, 5000 files)
- **Incremental Updates:** Single file, batch updates, file deletion
- **Query Performance:** Co-change prediction, graph queries, component lookup
- **Storage Backends:** In-memory SQLite, file-based SQLite, Redis
- **Pipeline Components:** CPG parsing, feature generation, model inference, FAISS indexing

Benchmarks include performance thresholds to detect regressions and provide detailed timing reports.

## Troubleshooting

### Issue: Model not found

**Solution**: Ensure the ONNX model file exists at the specified path.

```python
from pathlib import Path
model_path = Path("path/to/model.onnx")
assert model_path.exists(), f"Model not found: {model_path}"
```

### Issue: FAISS index errors

**Solution**: Delete the index file and rebuild:

```python
predictor.index_manager = FAISSIndexManager(embedding_dim=32)
predictor.update_index(all_files)
predictor.save_index()
```

### Issue: Parsing errors

**Solution**: Check for syntax errors in source files. The library handles parsing errors gracefully but logs them.

### Issue: Low similarity scores

**Solution**: Ensure the model was trained on similar code and that the configuration matches the training setup (simhash_bits, neighborhood_depth, edge_filter_mode).

## Advanced Usage

### Custom Component Filtering

```python
# Only extract functions
config = InferenceConfig(
    model_path="model.onnx",
    component_types=["function"],
)
```

### Adjusting Search Parameters

```python
# Get more results with lower threshold
predictions = predictor.predict_cochanges(
    changed_files=["src/auth.py"],
    files=all_files,
    top_k=20,
)

# Filter by minimum similarity
config.min_similarity = 0.7
```

### Batch Inference Optimization

```python
# Increase batch size for throughput
config.batch_size = 64
```

## License

This library is part of the SACPGO project.

