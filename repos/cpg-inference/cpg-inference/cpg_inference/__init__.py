"""CPG Inference - Lightweight co-change prediction library.

This package provides production-ready inference for CPG-based co-change prediction
using ONNX models and FAISS indexing.
"""

from cpg_inference.models import (
    CPGComponent,
    CoChangePrediction,
    InferenceConfig,
)
from cpg_inference.service import CoChangePredictor
from cpg_inference.bundled_models import (
    get_model_path,
    get_model_info,
    list_models,
    get_recommended_config,
)
from cpg_inference.graph_queries import (
    GraphQueryEngine,
    QueryResult,
)

__all__ = [
    "CoChangePredictor",
    "InferenceConfig",
    "CPGComponent",
    "CoChangePrediction",
    "GraphQueryEngine",
    "QueryResult",
    "get_model_path",
    "get_model_info",
    "list_models",
    "get_recommended_config",
]

__version__ = "0.5.2"
