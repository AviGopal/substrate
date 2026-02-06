"""Subtree extraction from Code Property Graphs.

This module extracts k-hop neighborhoods around nodes in a CPG.
"""

from collections import deque
from dataclasses import dataclass

from cpg_inference.cpg.models import CodePropertyGraph, CPGEdge


@dataclass
class CPGSubtree:
    """A subtree of the CPG (k-hop neighborhood around a root node)."""

    root_node_id: str
    nodes: set[str]  # All nodes in subtree
    edges: list[CPGEdge]  # All edges in subtree
    depth: int  # Max hops from root


def extract_subtree(
    cpg: CodePropertyGraph,
    root_node_id: str,
    max_depth: int,
) -> CPGSubtree:
    """Extract k-hop neighborhood around a node using BFS.

    Args:
        cpg: Full code property graph
        root_node_id: Starting node ID
        max_depth: Maximum number of hops to include (0 = node only)

    Returns:
        Subtree rooted at the specified node

    Example:
        >>> subtree = extract_subtree(cpg, "node_123", max_depth=2)
        >>> print(f"Nodes: {len(subtree.nodes)}, Edges: {len(subtree.edges)}")
        Nodes: 12, Edges: 11
    """
    if root_node_id not in cpg.nodes:
        raise ValueError(f"Node {root_node_id} not found in CPG")

    if max_depth < 0:
        raise ValueError(f"max_depth must be >= 0, got {max_depth}")

    # Special case: 0-hop subtree (just the node itself)
    if max_depth == 0:
        return CPGSubtree(
            root_node_id=root_node_id,
            nodes={root_node_id},
            edges=[],
            depth=0,
        )

    # BFS to explore k-hop neighborhood
    visited = {root_node_id}
    current_level = {root_node_id}
    edges_in_subtree = []

    for depth in range(max_depth):
        next_level = set()

        for node_id in current_level:
            # Find all edges connected to this node
            for edge in cpg.edges:
                # Outgoing edge
                if edge.source_id == node_id:
                    target_id = edge.target_id
                    if target_id in cpg.nodes and target_id not in visited:
                        next_level.add(target_id)
                        visited.add(target_id)
                        edges_in_subtree.append(edge)
                    elif target_id in visited and edge not in edges_in_subtree:
                        # Edge within subtree (not crossing boundary)
                        edges_in_subtree.append(edge)

                # Incoming edge
                elif edge.target_id == node_id:
                    source_id = edge.source_id
                    if source_id in cpg.nodes and source_id not in visited:
                        next_level.add(source_id)
                        visited.add(source_id)
                        edges_in_subtree.append(edge)
                    elif source_id in visited and edge not in edges_in_subtree:
                        # Edge within subtree (not crossing boundary)
                        edges_in_subtree.append(edge)

        current_level = next_level
        if not current_level:
            # No more nodes to explore
            break

    return CPGSubtree(
        root_node_id=root_node_id,
        nodes=visited,
        edges=edges_in_subtree,
        depth=min(depth + 1, max_depth),
    )


def extract_all_subtrees(
    cpg: CodePropertyGraph,
    max_depth: int,
    stride: int = 1,
) -> list[CPGSubtree]:
    """Extract subtrees for all nodes in CPG.

    Args:
        cpg: Code property graph
        max_depth: Maximum hops for each subtree
        stride: Step size (1 = every node, 2 = every other node)

    Returns:
        List of subtrees, one per node (or every stride-th node)
    """
    node_ids = list(cpg.nodes.keys())
    subtrees = []

    for i in range(0, len(node_ids), stride):
        node_id = node_ids[i]
        subtree = extract_subtree(cpg, node_id, max_depth)
        subtrees.append(subtree)

    return subtrees

