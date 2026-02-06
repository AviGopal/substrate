"""Structural SimHash for CPG subtrees.

Enhanced SimHash that includes edge types, directions, and structural patterns
in addition to node features.
"""

from dataclasses import dataclass

from cpg_inference.cpg.models import CodePropertyGraph, CPGNode, EdgeType
from cpg_inference.embedding.subtree_extractor import CPGSubtree
from cpg_inference.simhash.features import SemanticFeatureExtractor
from cpg_inference.simhash.simhash import SimHashGenerator


@dataclass
class EdgeFilterConfig:
    """Configuration for which edge types to include in structural SimHash."""

    include_contains: bool = True  # Structural edges (parent-child, hierarchical)
    include_calls: bool = True  # Semantic edges (function calls)
    include_depends: bool = True  # Data/control dependency edges
    include_inherits: bool = True  # Class inheritance edges

    @property
    def name(self) -> str:
        """Human-readable name for this configuration."""
        if not any(
            [
                self.include_contains,
                self.include_calls,
                self.include_depends,
                self.include_inherits,
            ]
        ):
            return "none"
        elif (
            self.include_contains
            and not self.include_calls
            and not self.include_depends
            and not self.include_inherits
        ):
            return "structural"
        elif all(
            [
                self.include_contains,
                self.include_calls,
                self.include_depends,
                self.include_inherits,
            ]
        ):
            return "all"
        else:
            return "custom"


class StructuralSimHashGenerator:
    """Generate SimHash for CPG subtrees including structural information."""

    def __init__(self, cpg: CodePropertyGraph, bits: int = 64):
        """Initialize generator.

        Args:
            cpg: Full code property graph (needed for node lookups)
            bits: Number of bits in SimHash (64, 128, or 256)
        """
        self.cpg = cpg
        self.bits = bits
        self.feature_extractor = SemanticFeatureExtractor()
        self.simhash_generator = SimHashGenerator(bits=bits)

    def compute_subtree_hash(
        self,
        subtree: CPGSubtree,
        edge_filter: EdgeFilterConfig,
    ) -> int:
        """Compute SimHash for entire subtree including structure.

        Args:
            subtree: The subtree to hash
            edge_filter: Configuration for which edges to include

        Returns:
            64-bit SimHash of the subtree

        The hash includes:
        1. Node types and features (from existing SimHash)
        2. Edge types and directions (NEW)
        3. Structural patterns like degree (NEW)
        """
        features = []

        # 1. Node features (existing approach)
        for node_id in subtree.nodes:
            if node_id in self.cpg.nodes:
                node = self.cpg.nodes[node_id]
                node_features = self._extract_node_features(node)
                features.extend(node_features)

        # 2. Edge features (NEW)
        for edge in subtree.edges:
            if self._should_include_edge(edge, edge_filter):
                edge_feature = self._extract_edge_feature(edge)
                if edge_feature:
                    features.append(edge_feature)

        # 3. Structural patterns (NEW)
        patterns = self._extract_structural_patterns(subtree, edge_filter)
        features.extend(patterns)

        # Compute SimHash on combined features
        if not features:
            # Empty subtree or all edges filtered out
            return 0

        return self.simhash_generator.compute(features)

    def _extract_node_features(self, node: CPGNode) -> list[str]:
        """Extract features from a single node.

        Uses the existing semantic feature extractor.
        """
        # Get existing features
        existing_features = self.feature_extractor.extract(node, self.cpg)

        # Add node type as a feature
        features = [f"type:{node.type.name}"]
        features.extend(existing_features)

        return features

    def _should_include_edge(self, edge, edge_filter: EdgeFilterConfig) -> bool:
        """Check if edge should be included based on filter config."""
        edge_type = edge.type

        if edge_type == EdgeType.CONTAINS:
            return edge_filter.include_contains
        elif edge_type == EdgeType.CALLS:
            return edge_filter.include_calls
        elif edge_type == EdgeType.DEPENDS:
            return edge_filter.include_depends
        elif edge_type == EdgeType.INHERITS:
            return edge_filter.include_inherits
        else:
            # Unknown edge type, include if any filter is enabled
            return any(
                [
                    edge_filter.include_contains,
                    edge_filter.include_calls,
                    edge_filter.include_depends,
                    edge_filter.include_inherits,
                ]
            )

    def _extract_edge_feature(self, edge) -> str:
        """Extract feature string from an edge.

        Format: "source_type→edge_type→target_type"
        """
        source_node = self.cpg.nodes.get(edge.source_id)
        target_node = self.cpg.nodes.get(edge.target_id)

        if not source_node or not target_node:
            return ""

        return f"{source_node.type.name}→{edge.type.name}→{target_node.type.name}"

    def _extract_structural_patterns(
        self,
        subtree: CPGSubtree,
        edge_filter: EdgeFilterConfig,
    ) -> list[str]:
        """Extract graph structure patterns.

        Patterns:
        - Node degree (in/out)
        - Edge type distribution
        """
        patterns = []

        # Pattern 1: Node degree (for each node in subtree)
        for node_id in subtree.nodes:
            in_degree = sum(
                1
                for e in subtree.edges
                if e.target_id == node_id and self._should_include_edge(e, edge_filter)
            )
            out_degree = sum(
                1
                for e in subtree.edges
                if e.source_id == node_id and self._should_include_edge(e, edge_filter)
            )

            if in_degree > 0 or out_degree > 0:
                patterns.append(f"degree:in{in_degree}_out{out_degree}")

        # Pattern 2: Edge type distribution
        edge_type_counts = {}
        for edge in subtree.edges:
            if self._should_include_edge(edge, edge_filter):
                edge_type = edge.type.name
                edge_type_counts[edge_type] = edge_type_counts.get(edge_type, 0) + 1

        for edge_type, count in edge_type_counts.items():
            patterns.append(f"edge_count:{edge_type}_x{count}")

        return patterns


def create_edge_filter_configs() -> list[EdgeFilterConfig]:
    """Create standard set of edge filter configurations for grid search.

    Returns:
        List of 3 configs: none, structural_only, all
    """
    return [
        # No edges
        EdgeFilterConfig(
            include_contains=False,
            include_calls=False,
            include_depends=False,
            include_inherits=False,
        ),
        # Structural only (CONTAINS)
        EdgeFilterConfig(
            include_contains=True,
            include_calls=False,
            include_depends=False,
            include_inherits=False,
        ),
        # All edges
        EdgeFilterConfig(
            include_contains=True,
            include_calls=True,
            include_depends=True,
            include_inherits=True,
        ),
    ]

