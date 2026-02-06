"""Tests for feature generator."""

import numpy as np
import pytest

from cpg_inference.cpg import parse_code
from cpg_inference.cpg_extractor import CPGComponentExtractor
from cpg_inference.feature_generator import FeatureGenerator


def test_generate_features_basic():
    """Test basic feature generation."""
    generator = FeatureGenerator(simhash_bits=128)
    
    code = "def hello(): pass"
    cpg = parse_code(code, language="python")
    
    extractor = CPGComponentExtractor()
    components, _ = extractor.extract_from_file("test.py", code)
    
    if components:
        features = generator.generate_features(components, cpg)
        
        assert features.shape[0] == len(components)
        assert features.shape[1] == 128
        assert features.dtype == np.float32


def test_simhash_bits_configuration():
    """Test different SimHash bit configurations."""
    for bits in [64, 128, 256]:
        generator = FeatureGenerator(simhash_bits=bits)
        
        code = "def foo(): pass"
        cpg = parse_code(code, language="python")
        
        extractor = CPGComponentExtractor()
        components, _ = extractor.extract_from_file("test.py", code)
        
        if components:
            features = generator.generate_features(components, cpg)
            assert features.shape[1] == bits


def test_edge_filter_modes():
    """Test different edge filter modes."""
    code = """
def foo():
    return bar()

def bar():
    return 42
"""
    
    for mode in ["none", "structural", "all"]:
        generator = FeatureGenerator(edge_filter_mode=mode)
        
        cpg = parse_code(code, language="python")
        extractor = CPGComponentExtractor()
        components, _ = extractor.extract_from_file("test.py", code)
        
        if components:
            features = generator.generate_features(components, cpg)
            
            # Features should be generated regardless of mode
            assert features.shape[0] == len(components)
            assert features.shape[1] == 128  # default


def test_neighborhood_depth():
    """Test different neighborhood depths."""
    code = """
class MyClass:
    def method1(self):
        return self.method2()
    
    def method2(self):
        return 42
"""
    
    for depth in [0, 1, 2]:
        generator = FeatureGenerator(neighborhood_depth=depth)
        
        cpg = parse_code(code, language="python")
        extractor = CPGComponentExtractor()
        components, _ = extractor.extract_from_file("test.py", code)
        
        if components:
            features = generator.generate_features(components, cpg)
            assert features.shape[0] == len(components)


def test_generate_batch_features():
    """Test batch feature generation."""
    generator = FeatureGenerator()
    
    files = {
        "file1.py": "def foo(): pass",
        "file2.py": "def bar(): pass",
    }
    
    extractor = CPGComponentExtractor()
    file_components, file_cpgs = extractor.extract_from_files(files)
    
    all_components, features = generator.generate_batch_features(
        file_components, file_cpgs
    )
    
    # Should have components from both files
    total_components = sum(len(comps) for comps in file_components.values())
    assert len(all_components) == total_components
    assert features.shape[0] == total_components


def test_empty_components():
    """Test handling empty component list."""
    generator = FeatureGenerator()
    
    code = ""
    cpg = parse_code(code, language="python")
    
    features = generator.generate_features([], cpg)
    
    assert features.shape[0] == 0
    assert features.shape[1] == 128


def test_feature_consistency():
    """Test that same code produces same features."""
    generator = FeatureGenerator(simhash_bits=128)
    
    code = "def hello(name): return f'Hello {name}'"
    
    # Generate features twice
    cpg1 = parse_code(code, language="python")
    extractor = CPGComponentExtractor()
    components1, _ = extractor.extract_from_file("test.py", code)
    features1 = generator.generate_features(components1, cpg1)
    
    cpg2 = parse_code(code, language="python")
    components2, _ = extractor.extract_from_file("test.py", code)
    features2 = generator.generate_features(components2, cpg2)
    
    # Features should be identical
    if features1.shape[0] > 0:
        assert np.allclose(features1, features2)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

