"""Main inference service for co-change prediction."""

from pathlib import Path

import numpy as np

from cpg_inference.cpg_extractor import CPGComponentExtractor
from cpg_inference.cpg.progressive_parser import ProgressiveCPGParser
from cpg_inference.feature_generator import FeatureGenerator
from cpg_inference.graph_queries import GraphQueryEngine, QueryResult
from cpg_inference.index_manager import FAISSIndexManager
from cpg_inference.model_wrapper import ONNXModelWrapper
from cpg_inference.models import (
    CPGComponent,
    CoChangePrediction,
    InferenceConfig,
)
from cpg_inference.cpg.models import CodePropertyGraph, EdgeType, NodeType
from cpg_inference.storage import StorageBackend, SQLiteStorage


class CoChangePredictor:
    """Main API for co-change prediction with unified CPG.
    
    Treats the entire codebase as a single organism with progressive file parsing.
    
    Supports pluggable storage backends for persistent caching:
    - Default: In-memory SQLite (same as current dict-based approach)
    - File-based SQLite: Persistent local cache
    - Redis: Centralized shared cache
    """
    
    def __init__(self, config: InferenceConfig, 
                 project_root: str = ".",
                 storage_backend: StorageBackend | None = None):
        """Initialize predictor.
        
        Args:
            config: Inference configuration
            project_root: Root directory of project
            storage_backend: Optional storage backend. Defaults to in-memory SQLite.
        """
        self.config = config
        self.project_root = project_root
        
        # Storage backend for components (defaults to in-memory)
        self.storage = storage_backend or SQLiteStorage(":memory:")
        
        # Unified CPG parser (single global graph)
        self.parser = ProgressiveCPGParser(
            language=config.language if hasattr(config, 'language') else "python",
            project_root=project_root,
        )
        
        # Legacy extractor for component extraction (still needed for features)
        self.extractor = CPGComponentExtractor(config.component_types)
        
        # Feature generation and model
        self.feature_generator = FeatureGenerator(
            simhash_bits=config.simhash_bits,
            neighborhood_depth=config.neighborhood_depth,
            edge_filter_mode=config.edge_filter_mode,
        )
        self.model = ONNXModelWrapper(
            model_path=config.model_path,
            embedding_dim=config.embedding_dim,
            intra_op_threads=config.intra_op_threads,
        )
        self.index_manager = FAISSIndexManager(
            embedding_dim=config.embedding_dim,
            index_path=config.index_path,
        )
        
        # Graph query engine (single global engine)
        self._graph_engine: GraphQueryEngine | None = None
    
    def add_file(self, file_path: str, content: str) -> dict:
        """Add new file to global CPG and update embeddings.
        
        Args:
            file_path: Path to file
            content: File content
            
        Returns:
            Stats dict
        """
        # Add to unified CPG
        parse_stats = self.parser.add_file(file_path, content)
        
        # Extract components for embedding (legacy path)
        file_components, file_cpgs = self.extractor.extract_from_files({file_path: content})
        
        if file_path in file_components and file_components[file_path]:
            components = file_components[file_path]
            
            # Generate features and embeddings
            features = self.feature_generator.generate_batch_features(
                {file_path: components},
                file_cpgs
            )[1]
            
            if len(features) > 0:
                embeddings = self.model.infer(features)
                component_ids = [c.id for c in components]
                
                # Update FAISS index
                self.index_manager.update(component_ids, embeddings)
                
                # Update storage
                self.storage.set_file_components(file_path, component_ids)
                self.storage.batch_store_components(components)
                
                # Invalidate graph engine
                self._graph_engine = None
        
        return {
            **parse_stats,
            "components_indexed": len(file_components.get(file_path, [])),
        }
    
    def update_file(self, file_path: str, content: str) -> dict:
        """Update existing file in global CPG.
        
        Args:
            file_path: Path to file
            content: Updated content
            
        Returns:
            Stats dict
        """
        # Remove old embeddings
        old_component_ids = self.storage.get_file_components(file_path)
        if old_component_ids:
            self.index_manager.remove(old_component_ids)
            for cid in old_component_ids:
                self.storage.delete_component(cid)
        
        # Update CPG
        parse_stats = self.parser.update_file(file_path, content)
        
        # Re-add (same as add_file logic)
        return self.add_file(file_path, content)
    
    def delete_file(self, file_path: str) -> dict:
        """Remove file from global CPG.
        
        Args:
            file_path: Path to file
            
        Returns:
            Stats dict
        """
        # Remove from embeddings
        component_ids = self.storage.get_file_components(file_path)
        components_removed = 0
        if component_ids:
            self.index_manager.remove(component_ids)
            components_removed = len(component_ids)
            
            # Delete from storage
            self.storage.delete_file(file_path)
        
        # Remove from CPG
        parse_stats = self.parser.delete_file(file_path)
        
        # Invalidate graph engine
        self._graph_engine = None
        
        return {
            **parse_stats,
            "components_removed": components_removed,
        }
    
    def query_graph(self) -> GraphQueryEngine:
        """Get query engine for the entire codebase.
        
        Returns:
            Graph query engine operating on global CPG
        """
        if self._graph_engine is None:
            self._graph_engine = GraphQueryEngine(self.parser.cpg)
        return self._graph_engine
    
    def process_files(
        self,
        files: dict[str, str],
    ) -> dict[str, list[CPGComponent]]:
        """Parse files and extract components (without updating index).
        
        Legacy method for compatibility.
        
        Args:
            files: Mapping of file_path -> content
            
        Returns:
            Mapping of file_path -> list of components
        """
        file_components, _ = self.extractor.extract_from_files(files)
        return file_components
    
    def update_index(self, files: dict[str, str]) -> dict[str, int]:
        """Update FAISS index with new/changed files.
        
        Args:
            files: Mapping of file_path -> content
            
        Returns:
            Statistics: {
                "files_processed": int,
                "components_added": int,
                "components_updated": int,
            }
        """
        # Update unified CPG for each file
        for file_path, content in files.items():
            # Check if file exists in parser
            if file_path in self.parser.cpg.file_index:
                # File exists - update it
                self.parser.update_file(file_path, content)
            else:
                # New file - add it
                self.parser.add_file(file_path, content)
        
        # Extract components and CPGs
        file_components, file_cpgs = self.extractor.extract_from_files(files)
        
        # Generate features
        all_components, features = self.feature_generator.generate_batch_features(
            file_components, file_cpgs
        )
        
        if len(all_components) == 0:
            return {
                "files_processed": len(files),
                "components_added": 0,
                "components_updated": 0,
            }
        
        # Generate embeddings
        embeddings = self.model.infer(features)
        
        # Determine which components are new vs updates
        component_ids = [c.id for c in all_components]
        new_ids = [cid for cid in component_ids if not self.index_manager.contains(cid)]
        update_ids = [cid for cid in component_ids if self.index_manager.contains(cid)]
        
        # Update index
        self.index_manager.update(component_ids, embeddings)
        
        # Update file -> components mapping
        for file_path, components in file_components.items():
            component_ids = [c.id for c in components]
            self.storage.set_file_components(file_path, component_ids)
        
        # Update component storage
        self.storage.batch_store_components(all_components)
        
        # Unified CPG is managed by parser, no per-file cache needed
        # Invalidate global graph engine
        self._graph_engine = None
        
        return {
            "files_processed": len(files),
            "components_added": len(new_ids),
            "components_updated": len(update_ids),
        }
    
    def remove_files(self, file_paths: list[str]) -> int:
        """Remove files and their components from index.
        
        Args:
            file_paths: List of file paths to remove
            
        Returns:
            Number of components removed
        """
        components_to_remove = []
        
        for file_path in file_paths:
            component_ids = self.storage.get_file_components(file_path)
            if component_ids:
                components_to_remove.extend(component_ids)
                
                # Delete from storage
                self.storage.delete_file(file_path)
            
            # Delete from unified CPG
            self.parser.delete_file(file_path)
        
        # Invalidate global graph engine
        self._graph_engine = None
        
        # Remove from index
        if components_to_remove:
            self.index_manager.remove(components_to_remove)
        
        return len(components_to_remove)
    
    def predict_cochanges(
        self,
        changed_files: list[str],
        files: dict[str, str],
        top_k: int | None = None,
        exclude_same_file: bool = True,
    ) -> list[CoChangePrediction]:
        """Predict co-changes for recently changed files.
        
        Args:
            changed_files: List of file paths that changed
            files: All available files (for parsing changed files)
            top_k: Number of results to return (uses config.top_k if None)
            exclude_same_file: Exclude components from same file
            
        Returns:
            List of predictions sorted by similarity score
        """
        if top_k is None:
            top_k = self.config.top_k
        
        # Filter to only changed files that exist
        changed_files = [f for f in changed_files if f in files]
        
        if not changed_files:
            return []
        
        # Extract components from changed files
        changed_file_dict = {f: files[f] for f in changed_files}
        file_components, file_cpgs = self.extractor.extract_from_files(changed_file_dict)
        
        # Generate features
        query_components, query_features = self.feature_generator.generate_batch_features(
            file_components, file_cpgs
        )
        
        if len(query_components) == 0:
            return []
        
        # Generate embeddings
        query_embeddings = self.model.infer(query_features)
        
        # Build exclusion set
        exclude_ids = set()
        if exclude_same_file:
            # Exclude components from changed files
            for file_path in changed_files:
                component_ids = self.storage.get_file_components(file_path)
                if component_ids:
                    exclude_ids.update(component_ids)
        
        # Also exclude the query components themselves
        exclude_ids.update(c.id for c in query_components)
        
        # Search index
        result_ids, result_scores = self.index_manager.search(
            query_embeddings,
            k=top_k,
            exclude_ids=exclude_ids,
        )
        
        # Aggregate results across all query components
        # Use max score for each component
        component_scores: dict[str, float] = {}
        
        for i in range(len(query_components)):
            for j in range(len(result_ids[i])):
                component_id = result_ids[i][j]
                score = result_scores[i][j]
                
                # Keep max score
                if component_id not in component_scores or score > component_scores[component_id]:
                    component_scores[component_id] = score
        
        # Filter by minimum similarity
        if self.config.min_similarity > 0:
            component_scores = {
                cid: score
                for cid, score in component_scores.items()
                if score >= self.config.min_similarity
            }
        
        # Sort by score and take top k
        sorted_components = sorted(
            component_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:top_k]
        
        # Build predictions
        predictions = []
        for component_id, score in sorted_components:
            # Get component from storage
            component = self.storage.get_component(component_id)
            
            if component:
                prediction = CoChangePrediction.from_component(component, score)
                predictions.append(prediction)
        
        return predictions
    
    def get_component_embeddings(
        self,
        file_path: str,
        files: dict[str, str],
    ) -> dict[str, np.ndarray]:
        """Get embeddings for all components in a file.
        
        Args:
            file_path: Path to file
            files: All available files
            
        Returns:
            Mapping of component_id -> embedding
        """
        if file_path not in files:
            return {}
        
        # Extract components
        file_dict = {file_path: files[file_path]}
        file_components, file_cpgs = self.extractor.extract_from_files(file_dict)
        
        components = file_components.get(file_path, [])
        if not components:
            return {}
        
        # Generate features
        cpg = file_cpgs[file_path]
        features = self.feature_generator.generate_features(components, cpg)
        
        # Generate embeddings
        embeddings = self.model.infer(features)
        
        # Build result
        result = {}
        for i, component in enumerate(components):
            result[component.id] = embeddings[i]
        
        return result
    
    def save_index(self, path: Path | str | None = None) -> None:
        """Save FAISS index to disk.
        
        Args:
            path: Path to save to (uses config.index_path if None)
        """
        save_path = path if path else self.config.index_path
        if save_path is None:
            raise ValueError("No save path provided")
        
        self.index_manager.save(save_path)
    
    def get_stats(self) -> dict[str, int]:
        """Get statistics about the predictor state.
        
        Returns:
            Statistics dictionary
        """
        parser_stats = self.parser.get_stats()
        storage_stats = self.storage.get_stats()
        return {
            "num_files": storage_stats.get("num_files", 0),
            "num_components": self.index_manager.get_size(),
            "num_cached_components": storage_stats.get("num_components", 0),
            "num_cpg_nodes": parser_stats.get("total_nodes", 0),
            "num_cpg_edges": parser_stats.get("total_edges", 0),
            "num_cpg_files": parser_stats.get("total_files", 0),
            "num_symbols": parser_stats.get("total_symbols", 0),
        }
    
    # ==================== Graph Query Methods ====================
    
    def get_cpg(self) -> CodePropertyGraph:
        """Get the global unified CPG.
        
        Returns:
            Global CodePropertyGraph
        """
        return self.parser.cpg
    
    def analyze_change_impact(
        self,
        component_ids: list[str],
        max_depth: int = 3,
        combine_with_embeddings: bool = True,
        embedding_top_k: int = 20,
    ) -> dict:
        """Analyze impact of changing components using unified graph + embeddings.
        
        Works seamlessly across all files in the codebase - no distinction
        between same-file and cross-file impact.
        
        Args:
            component_ids: List of changed component IDs
            max_depth: Maximum graph traversal depth
            combine_with_embeddings: Whether to include embedding similarity
            embedding_top_k: Number of embedding-based results to include
            
        Returns:
            Dictionary with:
                - graph_reachable: Components reachable via graph edges
                - graph_reverse: Components that reach changed components
                - embedding_similar: Semantically similar components (if enabled)
                - combined: Union of all impacts with risk scores
                - stats: Statistics about the analysis
        """
        # Use unified graph query engine - seamless across all files
        engine = self.query_graph()
        
        # Forward impact (what these components affect)
        graph_forward = engine.get_impact_set(
            component_ids,
            max_depth=max_depth,
            edge_types=[EdgeType.CALLS, EdgeType.DEPENDS, EdgeType.IMPORTS],
        )
        
        # Reverse impact (what affects these components)
        graph_reverse = engine.get_reverse_impact_set(
            component_ids,
            max_depth=max_depth,
            edge_types=[EdgeType.CALLS, EdgeType.DEPENDS, EdgeType.IMPORTS],
        )
        
        result = {
            "graph_reachable": [r.to_dict() for r in graph_forward],
            "graph_reverse": [r.to_dict() for r in graph_reverse],
            "embedding_similar": [],
            "combined": [],
            "stats": {
                "changed_components": len(component_ids),
                "graph_forward_count": len(graph_forward),
                "graph_reverse_count": len(graph_reverse),
            },
        }
        
        # Add embedding-based similarity if requested
        if combine_with_embeddings:
            # Note: Embedding analysis works best with predict_cochanges method
            # which uses the FAISS index for semantic similarity
            result["stats"]["embedding_analysis"] = "use predict_cochanges for semantic similarity"
        
        # Combine all impacts
        all_impacted = {}
        
        # Add graph forward (structural dependencies)
        for item in graph_forward:
            node_id = item["node_id"]
            all_impacted[node_id] = {
                **item,
                "sources": ["graph_forward"],
                "risk_score": 1.0 / (item["distance"] + 1),  # Closer = higher risk
            }
        
        # Add graph reverse (reverse dependencies)
        for item in graph_reverse:
            node_id = item["node_id"]
            if node_id in all_impacted:
                all_impacted[node_id]["sources"].append("graph_reverse")
                all_impacted[node_id]["risk_score"] += 1.0 / (item["distance"] + 1)
            else:
                all_impacted[node_id] = {
                    **item,
                    "sources": ["graph_reverse"],
                    "risk_score": 1.0 / (item["distance"] + 1),
                }
        
        # Sort by risk score
        combined = sorted(
            all_impacted.values(),
            key=lambda x: x["risk_score"],
            reverse=True,
        )
        
        result["combined"] = combined
        result["stats"]["total_impacted"] = len(combined)
        
        return result
    
    def get_call_graph(self, file_paths: list[str] | None = None) -> dict:
        """Get call graph information.
        
        Args:
            file_paths: Optional list of files to analyze (default: all cached files)
            
        Returns:
            Dictionary with call graph structure:
                - nodes: List of all nodes
                - edges: List of call edges
                - stats: Statistics
        """
        if file_paths is None:
            file_paths = list(self._cpg_cache.keys())
        
        all_nodes = {}
        all_edges = []
        
        for file_path in file_paths:
            if file_path not in self._cpg_cache:
                continue
            
            cpg = self._cpg_cache[file_path]
            
            # Add nodes
            for node_id, node in cpg.nodes.items():
                all_nodes[node_id] = {
                    "id": node_id,
                    "name": node.name,
                    "type": node.type.value,
                    "file": file_path,
                    "start_line": node.start_line,
                }
            
            # Add call edges
            for edge in cpg.edges:
                if edge.type == EdgeType.CALLS:
                    all_edges.append({
                        "source": edge.source_id,
                        "target": edge.target_id,
                        "type": "calls",
                    })
        
        return {
            "nodes": list(all_nodes.values()),
            "edges": all_edges,
            "stats": {
                "num_files": len(file_paths),
                "num_nodes": len(all_nodes),
                "num_edges": len(all_edges),
            },
        }

