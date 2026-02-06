"""Shared fixtures for cpg-inference tests."""

import random
import tempfile
from pathlib import Path
from typing import Dict

import pytest

from cpg_inference.models import InferenceConfig
from cpg_inference.service import CoChangePredictor


class CodeGen:
    """Generate realistic Python code for testing."""
    
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.func_names = self._gen_func_names()
        self.class_names = self._gen_class_names()
        self.var_names = ["result", "data", "value", "item", "config", "params"]
    
    def _gen_func_names(self):
        prefixes = ["get", "set", "create", "update", "delete", "process"]
        subjects = ["user", "data", "config", "item", "record", "value"]
        return [f"{p}_{s}" for p in prefixes for s in subjects]
    
    def _gen_class_names(self):
        bases = ["Manager", "Handler", "Processor", "Service", "Controller"]
        domains = ["User", "Data", "Config", "Task", "Event"]
        return [f"{d}{b}" for d in domains for b in bases]
    
    def gen_func(self, name=None, num_lines=10):
        name = name or self.rng.choice(self.func_names)
        lines = [f"def {name}():"]
        lines.append(f'    """Perform {name.replace("_", " ")}."""')
        
        for _ in range(num_lines):
            choice = self.rng.choice(["assign", "call", "return"])
            if choice == "assign":
                var = self.rng.choice(self.var_names)
                lines.append(f"    {var} = None")
            elif choice == "call":
                func = self.rng.choice(self.func_names[:10])
                lines.append(f"    {func}()")
            elif choice == "return":
                var = self.rng.choice(self.var_names)
                lines.append(f"    return {var}")
                break
        
        if not any("return" in line for line in lines):
            lines.append("    return None")
        
        return "\n".join(lines)
    
    def gen_class(self, name=None, num_methods=4):
        name = name or self.rng.choice(self.class_names)
        lines = [f"class {name}:", f'    """Manage {name.lower()}."""', ""]
        lines.extend(["    def __init__(self):", "        self.data = None", ""])
        
        for _ in range(num_methods - 1):
            method = self.gen_func(num_lines=5)
            method = method.replace("def ", "def ").replace("():", "(self):")
            for line in method.split("\n"):
                lines.append(f"    {line}" if line else "")
            lines.append("")
        
        return "\n".join(lines)
    
    def gen_file(self, num_funcs=5, num_classes=2):
        lines = ["import os", "from typing import Dict, List", "", ""]
        
        for _ in range(num_classes):
            lines.append(self.gen_class())
            lines.append("")
        
        for _ in range(num_funcs):
            lines.append(self.gen_func())
            lines.append("")
        
        return "\n".join(lines)


def gen_project(num_files: int, seed: int = 42) -> Dict[str, str]:
    """Generate synthetic Python project.
    
    Args:
        num_files: Number of files
        seed: Random seed
        
    Returns:
        Dict mapping file_path -> content
    """
    gen = CodeGen(seed)
    rng = random.Random(seed)
    files = {}
    
    packages = ["core", "utils", "models", "services"]
    modules = ["base", "helpers", "types", "config"]
    
    for i in range(num_files):
        if i == 0:
            path = "main.py"
        elif i < 5:
            path = f"{modules[i % len(modules)]}.py"
        else:
            pkg = packages[(i // 10) % len(packages)]
            mod = modules[i % len(modules)]
            path = f"{pkg}/{mod}_{i}.py"
        
        num_funcs = rng.randint(3, 8)
        num_classes = rng.randint(1, 3)
        files[path] = gen.gen_file(num_funcs, num_classes)
    
    return files


@pytest.fixture
def small_project():
    """Generate 50-file project for benchmarks."""
    return gen_project(50, seed=42)


@pytest.fixture
def medium_project():
    """Generate 500-file project for benchmarks."""
    return gen_project(500, seed=42)


@pytest.fixture
def large_project():
    """Generate 5000-file project for benchmarks."""
    return gen_project(5000, seed=42)


@pytest.fixture
def tiny_project():
    """Generate 10-file project for quick tests."""
    return gen_project(10, seed=42)


@pytest.fixture
def predictor_config():
    """Create test predictor config."""
    # Find model path
    import cpg_inference
    pkg_dir = Path(cpg_inference.__file__).parent
    model_path = pkg_dir / "bundled_models" / "auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx"
    
    return InferenceConfig(model_path=str(model_path))


@pytest.fixture
def temp_predictor(predictor_config):
    """Create predictor with temp storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        predictor = CoChangePredictor(predictor_config, project_root=tmpdir)
        yield predictor


@pytest.fixture
def indexed_predictor_small(predictor_config, small_project):
    """Create predictor pre-indexed with small project."""
    with tempfile.TemporaryDirectory() as tmpdir:
        predictor = CoChangePredictor(predictor_config, project_root=tmpdir)
        predictor.update_index(small_project)
        yield predictor


@pytest.fixture
def indexed_predictor_medium(predictor_config, medium_project):
    """Create predictor pre-indexed with medium project."""
    with tempfile.TemporaryDirectory() as tmpdir:
        predictor = CoChangePredictor(predictor_config, project_root=tmpdir)
        predictor.update_index(medium_project)
        yield predictor

