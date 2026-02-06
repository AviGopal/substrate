"""Data models for inference service."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from cpg_inference.cpg.models import CPGNode, NodeType


@dataclass
class CPGComponent:
    """Represents a semantic code component (function, class, method).
    
    This is the unit of granularity for co-change prediction.
    """
    
    id: str  # Unique ID: {file_path}::{type}::{name}::{start_line}
    file_path: str  # Path to source file
    component_type: NodeType  # FUNCTION, METHOD, or CLASS
    name: str  # Component name
    start_line: int  # Starting line (1-indexed)
    end_line: int  # Ending line (inclusive)
    source_text: str  # Full source code
    language: str  # Programming language
    
    # CPG metadata
    cpg_node_id: str  # ID in the CPG
    complexity: int = 1  # Cyclomatic complexity
    lines_of_code: int = 0  # Non-blank lines
    depth: int = 0  # Depth in hierarchy
    
    # Additional metadata
    metadata: dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_cpg_node(cls, node: CPGNode, file_path: str, cpg_node_id: str) -> "CPGComponent":
        """Create component from CPG node.
        
        Args:
            node: CPG node
            file_path: Path to source file
            cpg_node_id: Node ID in CPG
            
        Returns:
            CPGComponent instance
        """
        component_id = cls.generate_id(
            file_path=file_path,
            component_type=node.type,
            name=node.name,
            start_line=node.start_line,
        )
        
        return cls(
            id=component_id,
            file_path=file_path,
            component_type=node.type,
            name=node.name,
            start_line=node.start_line,
            end_line=node.end_line,
            source_text=node.source_text,
            language=node.language,
            cpg_node_id=cpg_node_id,
            complexity=node.complexity,
            lines_of_code=node.lines_of_code,
            depth=node.depth,
        )
    
    @staticmethod
    def generate_id(file_path: str, component_type: NodeType, name: str, start_line: int) -> str:
        """Generate stable component ID.
        
        Args:
            file_path: Path to source file
            component_type: Type of component
            name: Component name
            start_line: Starting line number
            
        Returns:
            Component ID string
        """
        type_str = component_type.value if isinstance(component_type, NodeType) else str(component_type)
        return f"{file_path}::{type_str}::{name}::{start_line}"


@dataclass
class InferenceConfig:
    """Configuration for inference service."""
    
    # Model configuration
    model_path: Path | str  # Path to ONNX model
    index_path: Path | str | None = None  # Path to FAISS index (optional)
    
    # Feature generation
    neighborhood_depth: int = 1  # k-hop neighborhood for SimHash
    simhash_bits: int = 128  # Number of SimHash bits (64, 128, or 256)
    edge_filter_mode: str = "all"  # Edge types: "none", "structural", "all"
    
    # Inference parameters
    embedding_dim: int = 32  # Output embedding dimension
    batch_size: int = 32  # Batch size for inference
    intra_op_threads: int = 0  # ONNX intra-op parallelism (0 = auto, uses all cores)
    
    # Search parameters
    top_k: int = 10  # Number of results to return
    min_similarity: float = 0.0  # Minimum similarity threshold
    
    # Component filtering
    component_types: list[str] = field(
        default_factory=lambda: ["function", "method", "class"]
    )  # Types to extract
    
    def __post_init__(self):
        """Validate and convert paths."""
        if isinstance(self.model_path, str):
            self.model_path = Path(self.model_path)
        if isinstance(self.index_path, str):
            self.index_path = Path(self.index_path)
        
        # Validate parameters
        if self.simhash_bits not in (64, 128, 256):
            raise ValueError(f"simhash_bits must be 64, 128, or 256, got {self.simhash_bits}")
        
        if self.edge_filter_mode not in ("none", "structural", "all"):
            raise ValueError(f"edge_filter_mode must be 'none', 'structural', or 'all'")
        
        if self.neighborhood_depth < 0:
            raise ValueError(f"neighborhood_depth must be >= 0")


@dataclass
class CoChangePrediction:
    """Result of co-change prediction."""
    
    component_id: str  # ID of predicted component
    similarity_score: float  # Similarity score (0.0 to 1.0)
    file_path: str  # Path to file containing component
    component_name: str  # Name of component
    component_type: str  # Type of component
    start_line: int  # Starting line
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "component_id": self.component_id,
            "similarity_score": self.similarity_score,
            "file_path": self.file_path,
            "component_name": self.component_name,
            "component_type": self.component_type,
            "start_line": self.start_line,
        }
    
    @classmethod
    def from_component(
        cls,
        component: CPGComponent,
        similarity_score: float,
    ) -> "CoChangePrediction":
        """Create prediction from component.
        
        Args:
            component: CPG component
            similarity_score: Similarity score
            
        Returns:
            CoChangePrediction instance
        """
        return cls(
            component_id=component.id,
            similarity_score=similarity_score,
            file_path=component.file_path,
            component_name=component.name,
            component_type=component.component_type.value,
            start_line=component.start_line,
        )

