"""Bundled models for CPG inference.

This module provides access to pre-trained models bundled with the package.
"""

from pathlib import Path

# Model registry with metadata
BUNDLED_MODELS = {
    "default": {
        "filename": "auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx",
        "description": "GCN model (AUC 0.9999) trained with BCE loss on multi-repo dataset",
        "architecture": "GCN",
        "layers": 2,
        "hidden_dim": 64,
        "embedding_dim": 32,
        "input_dim": 128,  # SimHash bits
        "neighborhood_depth": 1,
        "edge_filter": "all",
        "training_date": "2025-10-28",
        "size_kb": 109,  # 69KB model + 40KB data
    }
}


def get_model_path(model_name: str = "default") -> Path:
    """Get path to a bundled model.
    
    Args:
        model_name: Name of the model (default: "default")
        
    Returns:
        Path to the model file
        
    Raises:
        ValueError: If model name is not found
        
    Example:
        >>> from cpg_inference.data_models import get_model_path
        >>> model_path = get_model_path("default")
        >>> print(model_path)
    """
    if model_name not in BUNDLED_MODELS:
        available = ", ".join(BUNDLED_MODELS.keys())
        raise ValueError(
            f"Model '{model_name}' not found. Available models: {available}"
        )
    
    model_info = BUNDLED_MODELS[model_name]
    model_dir = Path(__file__).parent
    model_path = model_dir / model_info["filename"]
    
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path}. "
            "The package may not be installed correctly."
        )
    
    return model_path


def get_model_info(model_name: str = "default") -> dict:
    """Get metadata about a bundled model.
    
    Args:
        model_name: Name of the model (default: "default")
        
    Returns:
        Dictionary with model metadata
        
    Example:
        >>> from cpg_inference.data_models import get_model_info
        >>> info = get_model_info("default")
        >>> print(f"Architecture: {info['architecture']}")
        >>> print(f"Embedding dim: {info['embedding_dim']}")
    """
    if model_name not in BUNDLED_MODELS:
        available = ", ".join(BUNDLED_MODELS.keys())
        raise ValueError(
            f"Model '{model_name}' not found. Available models: {available}"
        )
    
    return BUNDLED_MODELS[model_name].copy()


def list_models() -> list[str]:
    """List all available bundled models.
    
    Returns:
        List of model names
        
    Example:
        >>> from cpg_inference.data_models import list_models
        >>> models = list_models()
        >>> print(f"Available models: {models}")
    """
    return list(BUNDLED_MODELS.keys())


def get_recommended_config(model_name: str = "default") -> dict:
    """Get recommended InferenceConfig parameters for a model.
    
    Args:
        model_name: Name of the model (default: "default")
        
    Returns:
        Dictionary with recommended config parameters
        
    Example:
        >>> from cpg_inference.data_models import get_recommended_config, get_model_path
        >>> from cpg_inference import InferenceConfig
        >>> 
        >>> config_params = get_recommended_config("default")
        >>> config = InferenceConfig(
        ...     model_path=get_model_path("default"),
        ...     **config_params
        ... )
    """
    info = get_model_info(model_name)
    
    return {
        "simhash_bits": info["input_dim"],
        "embedding_dim": info["embedding_dim"],
        "neighborhood_depth": info["neighborhood_depth"],
        "edge_filter_mode": info["edge_filter"],
    }


__all__ = [
    "get_model_path",
    "get_model_info",
    "list_models",
    "get_recommended_config",
    "BUNDLED_MODELS",
]
