"""Graph traversal and query engine for CPG analysis.

This module provides efficient graph traversal operations on Code Property Graphs,
enabling real-time monitoring, impact analysis, and dependency tracking.
"""

from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass
from typing import Any

from cpg_inference.cpg.models import CodePropertyGraph, CPGNode, EdgeType, NodeType


@dataclass
class QueryResult:
    """Result from a graph query."""
    
    node_id: str
    node: CPGNode
    distance: int = 0  # Distance from query node (for path queries)
    path: list[str] | None = None  # Path from source (if applicable)
    metadata: dict[str, Any] | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "node_id": self.node_id,
            "node_type": self.node.type.value,
            "name": self.node.name,
            "start_line": self.node.start_line,
            "end_line": self.node.end_line,
            "distance": self.distance,
        }
        if self.path:
            result["path"] = self.path
        if self.metadata:
            result["metadata"] = self.metadata
        return result


class GraphQueryEngine:
    """Engine for querying Code Property Graphs.
    
    Provides efficient graph traversal, path finding, and impact analysis
    operations on CPG structures.
    """
    
    def __init__(self, cpg: CodePropertyGraph | None = None):
        """Initialize query engine.
        
        Args:
            cpg: Code property graph to query (can be set later)
        """
        self.cpg = cpg
        self._cache_built = False
    
    def set_cpg(self, cpg: CodePropertyGraph) -> None:
        """Set or update the CPG.
        
        Args:
            cpg: Code property graph
        """
        self.cpg = cpg
        self._cache_built = False
    
    def _ensure_cache(self) -> None:
        """Ensure adjacency cache is built."""
        if self.cpg is None:
            raise ValueError("No CPG set. Call set_cpg() first.")
        
        if not self._cache_built:
            self.cpg.build_adjacency_cache()
            self._cache_built = True
    
    # ==================== Core Traversal Queries ====================
    
    def find_callers(self, node_id: str) -> list[QueryResult]:
        """Find all functions/methods that call this node.
        
        Args:
            node_id: Target node ID
            
        Returns:
            List of caller nodes
        """
        self._ensure_cache()
        caller_ids = self.cpg.get_neighbors(node_id, EdgeType.CALLS, direction="incoming")
        
        return [
            QueryResult(node_id=cid, node=self.cpg.nodes[cid])
            for cid in caller_ids
            if cid in self.cpg.nodes
        ]
    
    def find_callees(self, node_id: str) -> list[QueryResult]:
        """Find all functions/methods called by this node.
        
        Args:
            node_id: Source node ID
            
        Returns:
            List of callee nodes
        """
        self._ensure_cache()
        callee_ids = self.cpg.get_neighbors(node_id, EdgeType.CALLS, direction="outgoing")
        
        return [
            QueryResult(node_id=cid, node=self.cpg.nodes[cid])
            for cid in callee_ids
            if cid in self.cpg.nodes
        ]
    
    def find_dependencies(self, node_id: str) -> list[QueryResult]:
        """Find data dependencies (what this node uses).
        
        Args:
            node_id: Source node ID
            
        Returns:
            List of dependency nodes
        """
        self._ensure_cache()
        dep_ids = self.cpg.get_neighbors(node_id, EdgeType.DEPENDS, direction="outgoing")
        
        return [
            QueryResult(node_id=did, node=self.cpg.nodes[did])
            for did in dep_ids
            if did in self.cpg.nodes
        ]
    
    def find_dependents(self, node_id: str) -> list[QueryResult]:
        """Find reverse dependencies (what uses this node).
        
        Args:
            node_id: Target node ID
            
        Returns:
            List of dependent nodes
        """
        self._ensure_cache()
        dep_ids = self.cpg.get_neighbors(node_id, EdgeType.DEPENDS, direction="incoming")
        
        return [
            QueryResult(node_id=did, node=self.cpg.nodes[did])
            for did in dep_ids
            if did in self.cpg.nodes
        ]
    
    def find_subclasses(self, node_id: str) -> list[QueryResult]:
        """Find classes that inherit from this class.
        
        Args:
            node_id: Parent class node ID
            
        Returns:
            List of subclass nodes
        """
        self._ensure_cache()
        subclass_ids = self.cpg.get_neighbors(node_id, EdgeType.INHERITS, direction="incoming")
        
        return [
            QueryResult(node_id=sid, node=self.cpg.nodes[sid])
            for sid in subclass_ids
            if sid in self.cpg.nodes
        ]
    
    def find_parent_class(self, node_id: str) -> QueryResult | None:
        """Find parent class (if any).
        
        Args:
            node_id: Child class node ID
            
        Returns:
            Parent class node or None
        """
        self._ensure_cache()
        parent_ids = self.cpg.get_neighbors(node_id, EdgeType.INHERITS, direction="outgoing")
        
        if not parent_ids:
            return None
        
        # Return first parent (Python doesn't have true multiple inheritance in CPG)
        parent_id = parent_ids[0]
        if parent_id in self.cpg.nodes:
            return QueryResult(node_id=parent_id, node=self.cpg.nodes[parent_id])
        return None
    
    def find_container(self, node_id: str) -> QueryResult | None:
        """Get containing class or file.
        
        Args:
            node_id: Node ID
            
        Returns:
            Container node or None
        """
        node = self.cpg.nodes.get(node_id)
        if not node or not node.parent_id:
            return None
        
        parent = self.cpg.nodes.get(node.parent_id)
        if parent:
            return QueryResult(node_id=node.parent_id, node=parent)
        return None
    
    def find_children(self, node_id: str) -> list[QueryResult]:
        """Get contained elements.
        
        Args:
            node_id: Container node ID
            
        Returns:
            List of child nodes
        """
        node = self.cpg.nodes.get(node_id)
        if not node:
            return []
        
        return [
            QueryResult(node_id=cid, node=self.cpg.nodes[cid])
            for cid in node.children_ids
            if cid in self.cpg.nodes
        ]
    
    # ==================== Path & Reachability ====================
    
    def find_path(
        self,
        source_id: str,
        target_id: str,
        edge_types: list[EdgeType] | None = None,
        max_depth: int = 100,
    ) -> list[str] | None:
        """Find shortest path between two nodes.
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            edge_types: Optional list of edge types to follow
            max_depth: Maximum path length
            
        Returns:
            Path as list of node IDs, or None if no path exists
        """
        self._ensure_cache()
        
        if source_id not in self.cpg.nodes or target_id not in self.cpg.nodes:
            return None
        
        if source_id == target_id:
            return [source_id]
        
        # BFS for shortest path
        queue = deque([(source_id, [source_id])])
        visited = {source_id}
        
        while queue:
            current_id, path = queue.popleft()
            
            if len(path) > max_depth:
                continue
            
            # Get neighbors
            if edge_types is None:
                neighbors = self.cpg.get_neighbors(current_id, direction="outgoing")
            else:
                neighbors = []
                for edge_type in edge_types:
                    neighbors.extend(self.cpg.get_neighbors(current_id, edge_type, direction="outgoing"))
            
            for neighbor_id in neighbors:
                if neighbor_id == target_id:
                    return path + [neighbor_id]
                
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    queue.append((neighbor_id, path + [neighbor_id]))
        
        return None
    
    def is_reachable(
        self,
        source_id: str,
        target_id: str,
        edge_types: list[EdgeType] | None = None,
        max_depth: int = 10,
    ) -> bool:
        """Check if target is reachable from source.
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            edge_types: Optional list of edge types to follow
            max_depth: Maximum search depth
            
        Returns:
            True if reachable, False otherwise
        """
        path = self.find_path(source_id, target_id, edge_types, max_depth)
        return path is not None
    
    def get_neighborhood(
        self,
        node_id: str,
        depth: int = 1,
        edge_types: list[EdgeType] | None = None,
        direction: str = "outgoing",
    ) -> list[QueryResult]:
        """Get k-hop neighborhood of a node.
        
        Args:
            node_id: Center node ID
            depth: Number of hops (1 = immediate neighbors)
            edge_types: Optional list of edge types to follow
            direction: "outgoing", "incoming", or "both"
            
        Returns:
            List of nodes in neighborhood with distances
        """
        self._ensure_cache()
        
        if node_id not in self.cpg.nodes:
            return []
        
        # BFS to collect neighborhood
        visited = {node_id: 0}
        queue = deque([(node_id, 0)])
        
        while queue:
            current_id, current_depth = queue.popleft()
            
            if current_depth >= depth:
                continue
            
            # Get neighbors based on edge types and direction
            if edge_types is None:
                neighbors = self.cpg.get_neighbors(current_id, direction=direction)
            else:
                neighbors = []
                for edge_type in edge_types:
                    neighbors.extend(self.cpg.get_neighbors(current_id, edge_type, direction=direction))
            
            for neighbor_id in neighbors:
                if neighbor_id not in visited:
                    visited[neighbor_id] = current_depth + 1
                    queue.append((neighbor_id, current_depth + 1))
        
        # Build results (exclude center node)
        results = []
        for nid, dist in visited.items():
            if nid != node_id and nid in self.cpg.nodes:
                results.append(
                    QueryResult(
                        node_id=nid,
                        node=self.cpg.nodes[nid],
                        distance=dist,
                    )
                )
        
        return results
    
    # ==================== Impact Analysis ====================
    
    def get_impact_set(
        self,
        node_ids: list[str],
        max_depth: int = 3,
        edge_types: list[EdgeType] | None = None,
    ) -> list[QueryResult]:
        """Get all nodes reachable from changed nodes (forward impact).
        
        Args:
            node_ids: List of changed node IDs
            max_depth: Maximum propagation depth
            edge_types: Optional list of edge types to follow (default: CALLS, DEPENDS)
            
        Returns:
            List of impacted nodes with distances
        """
        if edge_types is None:
            edge_types = [EdgeType.CALLS, EdgeType.DEPENDS]
        
        # Collect neighborhoods from all changed nodes
        all_impacted = {}
        
        for node_id in node_ids:
            neighborhood = self.get_neighborhood(
                node_id,
                depth=max_depth,
                edge_types=edge_types,
                direction="outgoing",
            )
            
            for result in neighborhood:
                # Keep minimum distance
                if result.node_id not in all_impacted:
                    all_impacted[result.node_id] = result
                elif result.distance < all_impacted[result.node_id].distance:
                    all_impacted[result.node_id] = result
        
        return sorted(all_impacted.values(), key=lambda r: r.distance)
    
    def get_reverse_impact_set(
        self,
        node_ids: list[str],
        max_depth: int = 3,
        edge_types: list[EdgeType] | None = None,
    ) -> list[QueryResult]:
        """Get all nodes that can reach changed nodes (reverse impact).
        
        Args:
            node_ids: List of changed node IDs
            max_depth: Maximum propagation depth
            edge_types: Optional list of edge types to follow (default: CALLS, DEPENDS)
            
        Returns:
            List of nodes that depend on changed nodes
        """
        if edge_types is None:
            edge_types = [EdgeType.CALLS, EdgeType.DEPENDS]
        
        # Collect reverse neighborhoods
        all_impacted = {}
        
        for node_id in node_ids:
            neighborhood = self.get_neighborhood(
                node_id,
                depth=max_depth,
                edge_types=edge_types,
                direction="incoming",
            )
            
            for result in neighborhood:
                # Keep minimum distance
                if result.node_id not in all_impacted:
                    all_impacted[result.node_id] = result
                elif result.distance < all_impacted[result.node_id].distance:
                    all_impacted[result.node_id] = result
        
        return sorted(all_impacted.values(), key=lambda r: r.distance)
    
    # ==================== Filtering & Search ====================
    
    def find_nodes_by_type(self, node_type: NodeType) -> list[QueryResult]:
        """Get all nodes of a specific type.
        
        Args:
            node_type: Type of nodes to find
            
        Returns:
            List of matching nodes
        """
        if self.cpg is None:
            raise ValueError("No CPG set. Call set_cpg() first.")
        
        nodes = self.cpg.get_nodes_by_type(node_type)
        return [QueryResult(node_id=node.id, node=node) for node in nodes]
    
    def find_nodes_by_name(self, pattern: str, regex: bool = False) -> list[QueryResult]:
        """Find nodes by name pattern.
        
        Args:
            pattern: Name pattern (string or regex)
            regex: If True, treat pattern as regex
            
        Returns:
            List of matching nodes
        """
        if self.cpg is None:
            raise ValueError("No CPG set. Call set_cpg() first.")
        
        results = []
        
        if regex:
            pattern_re = re.compile(pattern)
            for node_id, node in self.cpg.nodes.items():
                if pattern_re.search(node.name):
                    results.append(QueryResult(node_id=node_id, node=node))
        else:
            for node_id, node in self.cpg.nodes.items():
                if pattern in node.name:
                    results.append(QueryResult(node_id=node_id, node=node))
        
        return results
    
    def find_components_at_line(self, file_path: str, line_num: int) -> list[QueryResult]:
        """Find components containing a specific line.
        
        Args:
            file_path: File path (as stored in node IDs)
            line_num: Line number (1-indexed)
            
        Returns:
            List of components containing the line
        """
        if self.cpg is None:
            raise ValueError("No CPG set. Call set_cpg() first.")
        
        results = []
        
        for node_id, node in self.cpg.nodes.items():
            # Check if node contains the line
            # For unified CPG: node_id = "file.py::FUNC_name", file_path should be in node_id
            # For standalone CPG: node_id = "node_X" or "FUNC_name", check all nodes
            in_right_file = (file_path in node_id) or ("::" not in node_id)
            
            if in_right_file and node.start_line <= line_num <= node.end_line:
                results.append(QueryResult(node_id=node_id, node=node))
        
        # Sort by specificity (smaller ranges first)
        results.sort(key=lambda r: r.node.end_line - r.node.start_line)
        
        return results
    
    # ==================== Utility Methods ====================
    
    def get_stats(self) -> dict[str, Any]:
        """Get graph statistics.
        
        Returns:
            Dictionary with graph stats
        """
        if self.cpg is None:
            return {"error": "No CPG set"}
        
        edge_counts = {}
        for edge in self.cpg.edges:
            edge_type = edge.type.value
            edge_counts[edge_type] = edge_counts.get(edge_type, 0) + 1
        
        node_counts = {}
        for node in self.cpg.nodes.values():
            node_type = node.type.value
            node_counts[node_type] = node_counts.get(node_type, 0) + 1
        
        return {
            "total_nodes": len(self.cpg.nodes),
            "total_edges": len(self.cpg.edges),
            "nodes_by_type": node_counts,
            "edges_by_type": edge_counts,
            "cache_built": self._cache_built,
        }

