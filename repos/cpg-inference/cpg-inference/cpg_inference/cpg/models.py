"""CPG data models - language-agnostic representation of code structure."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from cpg_inference.cpg.symbol_table import GlobalSymbolTable
    from cpg_inference.cpg.import_graph import ImportGraph


class NodeType(Enum):
    """CPG node types representing code hierarchy."""

    FILE = "file"
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    STATEMENT = "statement"
    EXPRESSION = "expression"


class EdgeType(Enum):
    """CPG edge types representing relationships."""

    CONTAINS = "contains"  # Parent-child containment
    CALLS = "calls"  # Function/method call
    DEPENDS = "depends"  # Data/control dependency
    INHERITS = "inherits"  # Class inheritance
    IMPORTS = "imports"  # Module/file imports


@dataclass
class CPGNode:
    """A node in the Code Property Graph.

    Represents a code element (file, class, function, statement, etc.)
    with associated metadata and metrics.
    """

    id: str  # Unique identifier
    type: NodeType  # Type of code element
    name: str  # Name of the element (function name, class name, etc.)
    start_line: int  # Starting line number (1-indexed)
    end_line: int  # Ending line number (inclusive)
    start_byte: int = 0  # Starting byte offset
    end_byte: int = 0  # Ending byte offset
    source_text: str = ""  # Original source code text
    language: str = "python"  # Source language

    # Metadata
    parent_id: str | None = None  # ID of parent node
    children_ids: list[str] = field(default_factory=list)  # IDs of child nodes

    # Metrics
    complexity: int = 1  # Cyclomatic complexity
    lines_of_code: int = 0  # Non-blank, non-comment lines
    num_params: int = 0  # Number of parameters (for functions/methods)
    depth: int = 0  # Depth in hierarchy (0 = file level)

    # AST metadata (flexible storage for language-specific details)
    ast_metadata: dict[str, Any] = field(default_factory=dict)

    def __hash__(self) -> int:
        """Make node hashable by ID."""
        return hash(self.id)


@dataclass
class CPGEdge:
    """An edge in the Code Property Graph.

    Represents a relationship between two code elements.
    """

    source_id: str  # ID of source node
    target_id: str  # ID of target node
    type: EdgeType  # Type of relationship
    metadata: dict[str, Any] = field(default_factory=dict)  # Additional info

    def __hash__(self) -> int:
        """Make edge hashable."""
        return hash((self.source_id, self.target_id, self.type))


@dataclass
class FileMetadata:
    """Track file state in global CPG."""
    
    file_path: str
    content_hash: str  # Hash of file content for change detection
    node_ids: set[str] = field(default_factory=set)  # Nodes from this file
    imports: list[str] = field(default_factory=list)  # Module names imported
    exports: set[str] = field(default_factory=set)  # Exported symbol node_ids
    last_updated: datetime = field(default_factory=datetime.now)
    
    def __hash__(self) -> int:
        """Make hashable by file path."""
        return hash(self.file_path)


class CodePropertyGraph:
    """Unified Code Property Graph spanning entire codebase.

    A language-agnostic graph representation of code structure,
    consisting of nodes (code elements) and edges (relationships).
    
    This is a unified global graph - all files are represented together,
    and edges connect freely across file boundaries.
    """

    def __init__(self, language: str = "python"):
        """Initialize empty global CPG.

        Args:
            language: Default source code language (can be overridden per file)
        """
        self.language = language
        
        # Core graph data
        self.nodes: dict[str, CPGNode] = {}  # All nodes globally
        self.edges: list[CPGEdge] = []  # All edges globally
        self.root_id: str | None = None  # ID of root (file) node (legacy)
        
        # Global indexes for unified analysis
        self.file_index: dict[str, FileMetadata] = {}  # file_path -> metadata
        
        # Symbol table and import graph (set externally to avoid circular imports)
        self.symbol_table: GlobalSymbolTable | None = None
        self.import_graph: ImportGraph | None = None
        
        # Adjacency caches for efficient traversal
        self._adjacency_cache: dict[str, dict[EdgeType, list[str]]] | None = None
        self._reverse_adjacency_cache: dict[str, dict[EdgeType, list[str]]] | None = None
        
        # Imports extracted during parsing (temporary storage)
        self.file_imports: list[dict[str, Any]] = []

    def add_node(self, node: CPGNode) -> None:
        """Add a node to the graph.

        Args:
            node: Node to add
        """
        self.nodes[node.id] = node
        if node.type == NodeType.FILE and self.root_id is None:
            self.root_id = node.id

    def add_edge(self, edge: CPGEdge) -> None:
        """Add an edge to the graph.

        Args:
            edge: Edge to add
        """
        self.edges.append(edge)

        # Update parent-child relationships for CONTAINS edges
        if edge.type == EdgeType.CONTAINS:
            parent = self.nodes.get(edge.source_id)
            child = self.nodes.get(edge.target_id)
            if parent and child:
                if edge.target_id not in parent.children_ids:
                    parent.children_ids.append(edge.target_id)
                child.parent_id = edge.source_id
        
        # Invalidate adjacency caches when edges are added
        self._adjacency_cache = None
        self._reverse_adjacency_cache = None

    def get_node(self, node_id: str) -> CPGNode | None:
        """Get node by ID.

        Args:
            node_id: Node ID

        Returns:
            Node if found, None otherwise
        """
        return self.nodes.get(node_id)

    def get_children(self, node_id: str) -> list[CPGNode]:
        """Get all children of a node.

        Args:
            node_id: Parent node ID

        Returns:
            List of child nodes
        """
        node = self.nodes.get(node_id)
        if not node:
            return []
        return [self.nodes[cid] for cid in node.children_ids if cid in self.nodes]

    def get_nodes_by_type(self, node_type: NodeType) -> list[CPGNode]:
        """Get all nodes of a specific type.

        Args:
            node_type: Type of nodes to retrieve

        Returns:
            List of matching nodes
        """
        return [node for node in self.nodes.values() if node.type == node_type]

    def get_root(self) -> CPGNode | None:
        """Get root (file) node.

        Returns:
            Root node if exists, None otherwise
        """
        return self.nodes.get(self.root_id) if self.root_id else None

    def __len__(self) -> int:
        """Return number of nodes in graph."""
        return len(self.nodes)

    def build_adjacency_cache(self) -> None:
        """Build adjacency lists for fast O(1) edge lookups.
        
        Builds both forward (outgoing) and reverse (incoming) adjacency lists.
        Call this once after building the graph to enable fast queries.
        """
        from collections import defaultdict
        
        # Initialize adjacency dictionaries
        self._adjacency_cache = defaultdict(lambda: defaultdict(list))
        self._reverse_adjacency_cache = defaultdict(lambda: defaultdict(list))
        
        # Build adjacency lists
        for edge in self.edges:
            self._adjacency_cache[edge.source_id][edge.type].append(edge.target_id)
            self._reverse_adjacency_cache[edge.target_id][edge.type].append(edge.source_id)
        
        # Convert to regular dicts
        self._adjacency_cache = {
            node_id: dict(edges_by_type)
            for node_id, edges_by_type in self._adjacency_cache.items()
        }
        self._reverse_adjacency_cache = {
            node_id: dict(edges_by_type)
            for node_id, edges_by_type in self._reverse_adjacency_cache.items()
        }
    
    def get_outgoing_edges(self, node_id: str, edge_type: EdgeType | None = None) -> list[CPGEdge]:
        """Get edges going out from a node.
        
        Args:
            node_id: Source node ID
            edge_type: Optional edge type filter
            
        Returns:
            List of outgoing edges
        """
        if edge_type is None:
            return [e for e in self.edges if e.source_id == node_id]
        return [e for e in self.edges if e.source_id == node_id and e.type == edge_type]
    
    def get_incoming_edges(self, node_id: str, edge_type: EdgeType | None = None) -> list[CPGEdge]:
        """Get edges coming into a node.
        
        Args:
            node_id: Target node ID
            edge_type: Optional edge type filter
            
        Returns:
            List of incoming edges
        """
        if edge_type is None:
            return [e for e in self.edges if e.target_id == node_id]
        return [e for e in self.edges if e.target_id == node_id and e.type == edge_type]
    
    def get_neighbors(self, node_id: str, edge_type: EdgeType | None = None, direction: str = "outgoing") -> list[str]:
        """Get neighboring node IDs.
        
        Args:
            node_id: Node ID
            edge_type: Optional edge type filter
            direction: "outgoing", "incoming", or "both"
            
        Returns:
            List of neighbor node IDs
        """
        # Use cache if available
        if direction == "outgoing" and self._adjacency_cache is not None:
            if node_id not in self._adjacency_cache:
                return []
            if edge_type is None:
                return [n for neighbors in self._adjacency_cache[node_id].values() for n in neighbors]
            return self._adjacency_cache[node_id].get(edge_type, [])
        
        if direction == "incoming" and self._reverse_adjacency_cache is not None:
            if node_id not in self._reverse_adjacency_cache:
                return []
            if edge_type is None:
                return [n for neighbors in self._reverse_adjacency_cache[node_id].values() for n in neighbors]
            return self._reverse_adjacency_cache[node_id].get(edge_type, [])
        
        # Fallback to edge iteration
        neighbors = set()
        if direction in ("outgoing", "both"):
            for edge in self.edges:
                if edge.source_id == node_id:
                    if edge_type is None or edge.type == edge_type:
                        neighbors.add(edge.target_id)
        
        if direction in ("incoming", "both"):
            for edge in self.edges:
                if edge.target_id == node_id:
                    if edge_type is None or edge.type == edge_type:
                        neighbors.add(edge.source_id)
        
        return list(neighbors)

    def __repr__(self) -> str:
        """String representation."""
        return f"CodePropertyGraph(language={self.language}, nodes={len(self.nodes)}, edges={len(self.edges)})"

