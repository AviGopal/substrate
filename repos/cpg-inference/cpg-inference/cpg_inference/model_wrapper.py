"""ONNX model wrapper for inference."""

from pathlib import Path

import numpy as np
import onnxruntime as ort


class ONNXModelWrapper:
    """Wrapper for ONNX GNN model inference."""
    
    def __init__(self, model_path: Path | str, embedding_dim: int = 32, intra_op_threads: int = 0):
        """Initialize model wrapper with multi-threading support.
        
        Args:
            model_path: Path to ONNX model file
            embedding_dim: Expected output embedding dimension
            intra_op_threads: Number of threads for parallelizing ops within a node (0 = auto)
        """
        self.model_path = Path(model_path)
        self.embedding_dim = embedding_dim
        
        # Configure session for multi-threading
        sess_options = ort.SessionOptions()
        
        # Enable parallel execution within operators
        # 0 = use default (typically number of CPU cores)
        sess_options.intra_op_num_threads = intra_op_threads if intra_op_threads > 0 else 0
        
        # Enable parallel execution of independent nodes
        sess_options.inter_op_num_threads = 1  # Sequential execution across nodes (GNN is sequential)
        
        # Enable optimizations
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # Load ONNX model with optimized settings
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=sess_options,
            providers=['CPUExecutionProvider']
        )
        
        # Get input/output names
        self.input_names = [inp.name for inp in self.session.get_inputs()]
        self.output_names = [out.name for out in self.session.get_outputs()]
    
    def infer(self, node_features: np.ndarray) -> np.ndarray:
        """Run inference on node features.
        
        Args:
            node_features: Node feature matrix [num_nodes, input_dim]
            
        Returns:
            Node embeddings [num_nodes, embedding_dim]
        """
        if node_features.shape[0] == 0:
            # Empty input
            return np.zeros((0, self.embedding_dim), dtype=np.float32)
        
        # Build simple graph structure (fully connected for single-file inference)
        edge_index = self._build_edge_index(node_features.shape[0])
        
        # Run inference
        outputs = self.session.run(
            None,
            {
                'node_features': node_features.astype(np.float32),
                'edge_index': edge_index.astype(np.int64),
            }
        )
        
        # Extract embeddings
        embeddings = outputs[0]
        
        # Normalize embeddings (L2 normalization)
        embeddings = self._normalize_embeddings(embeddings)
        
        return embeddings
    
    def infer_batch(
        self,
        features_list: list[np.ndarray],
        batch_size: int = 32,
    ) -> np.ndarray:
        """Run inference on multiple feature matrices in batches.
        
        Args:
            features_list: List of feature matrices
            batch_size: Batch size for processing
            
        Returns:
            Concatenated embeddings [total_nodes, embedding_dim]
        """
        all_embeddings = []
        
        # Process in batches
        for i in range(0, len(features_list), batch_size):
            batch = features_list[i:i + batch_size]
            
            # Concatenate batch
            if batch:
                batch_features = np.vstack(batch)
                batch_embeddings = self.infer(batch_features)
                all_embeddings.append(batch_embeddings)
        
        # Concatenate all embeddings
        if all_embeddings:
            return np.vstack(all_embeddings)
        else:
            return np.zeros((0, self.embedding_dim), dtype=np.float32)
    
    def _build_edge_index(self, num_nodes: int) -> np.ndarray:
        """Build edge index for graph.
        
        For simplicity, we create a star graph where all nodes connect to node 0.
        This is sufficient for the GNN to aggregate information.
        
        Args:
            num_nodes: Number of nodes
            
        Returns:
            Edge index [2, num_edges]
        """
        if num_nodes <= 1:
            # No edges for single node
            return np.zeros((2, 0), dtype=np.int64)
        
        # Create star graph: all nodes connect to node 0
        edges = []
        for i in range(1, num_nodes):
            # Bidirectional edges
            edges.append([0, i])
            edges.append([i, 0])
        
        edge_index = np.array(edges, dtype=np.int64).T
        
        return edge_index
    
    def _normalize_embeddings(self, embeddings: np.ndarray) -> np.ndarray:
        """L2 normalize embeddings.
        
        Args:
            embeddings: Embedding matrix [num_nodes, embedding_dim]
            
        Returns:
            Normalized embeddings
        """
        # Compute L2 norms
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        
        # Avoid division by zero
        norms = np.maximum(norms, 1e-8)
        
        # Normalize
        normalized = embeddings / norms
        
        return normalized.astype(np.float32)

