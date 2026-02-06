"""Generate SimHash features from CPG components."""

import numpy as np

from cpg_inference.cpg.models import CodePropertyGraph
from cpg_inference.embedding.structural_simhash import (
    EdgeFilterConfig,
    StructuralSimHashGenerator,
)
from cpg_inference.embedding.subtree_extractor import extract_subtree
from cpg_inference.models import CPGComponent


class FeatureGenerator:
    """Generate SimHash bit vector features for CPG components."""
    
    def __init__(
        self,
        simhash_bits: int = 128,
        neighborhood_depth: int = 1,
        edge_filter_mode: str = "all",
    ):
        """Initialize feature generator.
        
        Args:
            simhash_bits: Number of bits in SimHash (64, 128, or 256)
            neighborhood_depth: k-hop neighborhood depth
            edge_filter_mode: Edge filter mode ("none", "structural", "all")
        """
        self.simhash_bits = simhash_bits
        self.neighborhood_depth = neighborhood_depth
        self.edge_filter = self._create_edge_filter(edge_filter_mode)
    
    def _create_edge_filter(self, mode: str) -> EdgeFilterConfig:
        """Create edge filter configuration.
        
        Args:
            mode: Filter mode
            
        Returns:
            EdgeFilterConfig instance
        """
        if mode == "none":
            return EdgeFilterConfig(
                include_contains=False,
                include_calls=False,
                include_depends=False,
                include_inherits=False,
            )
        elif mode == "structural":
            return EdgeFilterConfig(
                include_contains=True,
                include_calls=False,
                include_depends=False,
                include_inherits=False,
            )
        elif mode == "all":
            return EdgeFilterConfig(
                include_contains=True,
                include_calls=True,
                include_depends=True,
                include_inherits=True,
            )
        else:
            raise ValueError(f"Unknown edge filter mode: {mode}")
    
    def generate_features(
        self,
        components: list[CPGComponent],
        cpg: CodePropertyGraph,
    ) -> np.ndarray:
        """Generate features for multiple components.
        
        Args:
            components: List of components
            cpg: Code property graph
            
        Returns:
            Feature matrix [num_components, simhash_bits]
        """
        if not components:
            return np.zeros((0, self.simhash_bits), dtype=np.float32)
        
        # Initialize SimHash generator
        simhash_gen = StructuralSimHashGenerator(cpg, bits=self.simhash_bits)
        
        # Generate features for each component
        features = []
        for component in components:
            feature = self._generate_single_feature(component, cpg, simhash_gen)
            features.append(feature)
        
        return np.array(features, dtype=np.float32)
    
    def _generate_single_feature(
        self,
        component: CPGComponent,
        cpg: CodePropertyGraph,
        simhash_gen: StructuralSimHashGenerator,
    ) -> np.ndarray:
        """Generate feature for a single component.
        
        Args:
            component: CPG component
            cpg: Code property graph
            simhash_gen: SimHash generator
            
        Returns:
            Bit vector [simhash_bits]
        """
        try:
            # Extract subtree around component
            subtree = extract_subtree(
                cpg,
                component.cpg_node_id,
                self.neighborhood_depth,
            )
            
            # Compute SimHash
            simhash_value = simhash_gen.compute_subtree_hash(subtree, self.edge_filter)
            
            # Convert to bit vector
            bit_vector = self._simhash_to_bitvector(simhash_value)
            
            return bit_vector
        
        except Exception:
            # Return zero vector on failure
            return np.zeros(self.simhash_bits, dtype=np.float32)
    
    def _simhash_to_bitvector(self, simhash: int) -> np.ndarray:
        """Convert SimHash integer to bit vector.
        
        Args:
            simhash: SimHash as integer
            
        Returns:
            Bit vector [simhash_bits]
        """
        # Convert to binary string (padded to bit width)
        binary_str = bin(simhash)[2:].zfill(self.simhash_bits)
        
        # Convert to numpy array of floats
        bit_vector = np.array([float(b) for b in binary_str], dtype=np.float32)
        
        return bit_vector
    
    def generate_batch_features(
        self,
        file_components: dict[str, list[CPGComponent]],
        file_cpgs: dict[str, CodePropertyGraph],
    ) -> tuple[list[CPGComponent], np.ndarray]:
        """Generate features for components from multiple files.
        
        Args:
            file_components: file_path -> list of components
            file_cpgs: file_path -> CPG
            
        Returns:
            Tuple of (all_components, features)
            - all_components: Flattened list of all components
            - features: Feature matrix [num_components, simhash_bits]
        """
        all_components = []
        all_features = []
        
        for file_path, components in file_components.items():
            cpg = file_cpgs.get(file_path)
            
            # Skip if no CPG or no components
            if cpg is None or not components:
                continue
            
            # Generate features for this file's components
            features = self.generate_features(components, cpg)
            
            all_components.extend(components)
            all_features.append(features)
        
        # Concatenate all features
        if all_features:
            features_matrix = np.vstack(all_features)
        else:
            features_matrix = np.zeros((0, self.simhash_bits), dtype=np.float32)
        
        return all_components, features_matrix

