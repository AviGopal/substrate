"""CPG Subtree Embedding Module.

This module implements learning-based embeddings for CPG subtrees to improve
co-change prediction beyond raw SimHash similarity.
"""

from cpg_inference.embedding.subtree_extractor import CPGSubtree, extract_subtree
from cpg_inference.embedding.structural_simhash import (
    EdgeFilterConfig,
    StructuralSimHashGenerator,
)

__all__ = [
    "CPGSubtree",
    "extract_subtree",
    "EdgeFilterConfig",
    "StructuralSimHashGenerator",
]

