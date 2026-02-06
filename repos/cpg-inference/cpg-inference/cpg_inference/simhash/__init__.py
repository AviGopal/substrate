"""SimHash generation and feature extraction for code similarity."""

from cpg_inference.simhash.features import (
    FeatureExtractor,
    HybridFeatureExtractor,
    MetricFeatureExtractor,
    SemanticFeatureExtractor,
    StructuralFeatureExtractor,
)
from cpg_inference.simhash.simhash import SimHashGenerator

__all__ = [
    # Core SimHash
    "SimHashGenerator",
    # Feature extractors
    "FeatureExtractor",
    "StructuralFeatureExtractor",
    "SemanticFeatureExtractor",
    "MetricFeatureExtractor",
    "HybridFeatureExtractor",
]

