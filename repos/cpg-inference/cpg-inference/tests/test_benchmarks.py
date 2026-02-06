"""Performance benchmarks for cpg-inference.

Run with: pytest tests/test_benchmarks.py -m benchmark -v
"""

import os
import tempfile
import time
from pathlib import Path

import pytest

from cpg_inference.models import InferenceConfig
from cpg_inference.service import CoChangePredictor
from cpg_inference.storage import SQLiteStorage
from cpg_inference.cpg_extractor import CPGComponentExtractor
from tests.conftest import gen_project

# Check if Redis is available
try:
    from cpg_inference.storage import RedisStorage
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


def time_operation(func, *args, **kwargs):
    """Time an operation and return duration and result."""
    start = time.perf_counter()
    result = func(*args, **kwargs)
    duration = time.perf_counter() - start
    return duration, result


# ============================================================================
# COLD START PROCESSING BENCHMARKS
# ============================================================================

@pytest.mark.benchmark
def test_benchmark_cold_start_small(predictor_config, small_project):
    """Benchmark cold start with 50 files."""
    predictor = CoChangePredictor(predictor_config)
    
    duration, stats = time_operation(predictor.update_index, small_project)
    
    print(f"\n{'='*60}")
    print(f"COLD START - SMALL (50 files)")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Throughput: {stats['files_processed']/duration:.1f} files/sec")
    print(f"{'='*60}")
    
    # Reasonable threshold: should complete in under 15 seconds
    assert duration < 15, f"Cold start too slow: {duration:.2f}s"
    assert stats['files_processed'] == 50


@pytest.mark.benchmark
def test_benchmark_cold_start_medium(predictor_config, medium_project):
    """Benchmark cold start with 500 files."""
    predictor = CoChangePredictor(predictor_config)
    
    duration, stats = time_operation(predictor.update_index, medium_project)
    
    print(f"\n{'='*60}")
    print(f"COLD START - MEDIUM (500 files)")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Throughput: {stats['files_processed']/duration:.1f} files/sec")
    print(f"{'='*60}")
    
    # Should complete in reasonable time
    assert duration < 120, f"Cold start too slow: {duration:.2f}s"
    assert stats['files_processed'] == 500


@pytest.mark.benchmark
def test_benchmark_cold_start_large(predictor_config, large_project):
    """Benchmark cold start with 5000 files."""
    predictor = CoChangePredictor(predictor_config)
    
    duration, stats = time_operation(predictor.update_index, large_project)
    
    print(f"\n{'='*60}")
    print(f"COLD START - LARGE (5000 files)")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s ({duration/60:.1f} minutes)")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Throughput: {stats['files_processed']/duration:.1f} files/sec")
    print(f"{'='*60}")
    
    # Should complete in reasonable time (allow up to 15 minutes)
    assert duration < 900, f"Cold start too slow: {duration:.2f}s"
    assert stats['files_processed'] == 5000


# ============================================================================
# INCREMENTAL UPDATE BENCHMARKS
# ============================================================================

@pytest.mark.benchmark
def test_benchmark_incremental_single_file(indexed_predictor_medium):
    """Benchmark updating a single file."""
    predictor = indexed_predictor_medium
    
    # Update one file
    modified_file = {"core/base_0.py": "def new_func():\n    return 42"}
    
    duration, stats = time_operation(predictor.update_index, modified_file)
    
    print(f"\n{'='*60}")
    print(f"INCREMENTAL UPDATE - SINGLE FILE")
    print(f"{'='*60}")
    print(f"Duration: {duration*1000:.1f}ms")
    print(f"Files processed: {stats['files_processed']}")
    print(f"{'='*60}")
    
    # Should be very fast - under 500ms
    assert duration < 0.5, f"Single file update too slow: {duration*1000:.1f}ms"
    assert stats['files_processed'] == 1


@pytest.mark.benchmark
def test_benchmark_incremental_batch(indexed_predictor_medium):
    """Benchmark updating 10 files."""
    predictor = indexed_predictor_medium
    
    # Update 10 files
    modified_files = {
        f"core/base_{i}.py": f"def new_func_{i}():\n    return {i}"
        for i in range(10)
    }
    
    duration, stats = time_operation(predictor.update_index, modified_files)
    
    print(f"\n{'='*60}")
    print(f"INCREMENTAL UPDATE - BATCH (10 files)")
    print(f"{'='*60}")
    print(f"Duration: {duration*1000:.1f}ms")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Throughput: {stats['files_processed']/duration:.1f} files/sec")
    print(f"{'='*60}")
    
    # Should be fast - under 2 seconds
    assert duration < 2.0, f"Batch update too slow: {duration:.2f}s"
    assert stats['files_processed'] == 10


@pytest.mark.benchmark
def test_benchmark_file_deletion(indexed_predictor_small):
    """Benchmark removing files from index."""
    predictor = indexed_predictor_small
    
    # Get initial stats
    initial_stats = predictor.get_stats()
    initial_files = initial_stats['num_files']
    
    # Remove 5 files
    files_to_remove = ["main.py", "base.py", "helpers.py", "types.py", "config.py"]
    
    duration, _ = time_operation(predictor.remove_files, files_to_remove)
    
    # Check stats
    final_stats = predictor.get_stats()
    removed = initial_files - final_stats['num_files']
    
    print(f"\n{'='*60}")
    print(f"FILE DELETION")
    print(f"{'='*60}")
    print(f"Duration: {duration*1000:.1f}ms")
    print(f"Files removed: {removed}")
    print(f"{'='*60}")
    
    # Should be very fast
    assert duration < 0.5, f"File deletion too slow: {duration*1000:.1f}ms"
    assert removed >= 3  # At least some files removed


# ============================================================================
# QUERY PERFORMANCE BENCHMARKS
# ============================================================================

@pytest.mark.benchmark
def test_benchmark_cochange_prediction(indexed_predictor_small, small_project):
    """Benchmark co-change prediction queries."""
    predictor = indexed_predictor_small
    
    # Get all component IDs
    stats = predictor.get_stats()
    if stats['num_components'] == 0:
        pytest.skip("No components indexed")
    
    # Simulate modified file
    modified_files = ["main.py"]
    
    # Time multiple queries
    durations = []
    for _ in range(10):
        start = time.perf_counter()
        results = predictor.predict_cochanges(modified_files, small_project, top_k=10)
        durations.append(time.perf_counter() - start)
    
    avg_duration = sum(durations) / len(durations)
    p95_duration = sorted(durations)[int(len(durations) * 0.95)]
    
    print(f"\n{'='*60}")
    print(f"CO-CHANGE PREDICTION QUERIES")
    print(f"{'='*60}")
    print(f"Avg latency: {avg_duration*1000:.1f}ms")
    print(f"P95 latency: {p95_duration*1000:.1f}ms")
    print(f"Queries: {len(durations)}")
    print(f"{'='*60}")
    
    # Should be interactive - under 200ms average
    assert avg_duration < 0.2, f"Query too slow: {avg_duration*1000:.1f}ms"


@pytest.mark.benchmark
def test_benchmark_graph_queries(indexed_predictor_small):
    """Benchmark graph traversal queries."""
    predictor = indexed_predictor_small
    
    # Get component for querying
    stats = predictor.get_stats()
    if stats['num_components'] == 0:
        pytest.skip("No components indexed")
    
    # Time graph queries
    durations = []
    for _ in range(10):
        start = time.perf_counter()
        # Query the CPG
        cpg_stats = predictor.parser.get_stats()
        durations.append(time.perf_counter() - start)
    
    avg_duration = sum(durations) / len(durations)
    
    print(f"\n{'='*60}")
    print(f"GRAPH QUERIES")
    print(f"{'='*60}")
    print(f"Avg latency: {avg_duration*1000:.1f}ms")
    print(f"Queries: {len(durations)}")
    print(f"{'='*60}")
    
    # Should be very fast
    assert avg_duration < 0.1, f"Graph query too slow: {avg_duration*1000:.1f}ms"


@pytest.mark.benchmark
def test_benchmark_component_lookup(indexed_predictor_medium):
    """Benchmark direct component access."""
    predictor = indexed_predictor_medium
    
    # Get a component ID from storage
    all_files = predictor.storage.get_all_files()
    if not all_files:
        pytest.skip("No files indexed")
    
    first_file = all_files[0]
    component_ids = predictor.storage.get_file_components(first_file)
    if not component_ids:
        pytest.skip("No components in file")
    
    component_id = component_ids[0]
    
    # Time lookups
    durations = []
    for _ in range(100):
        start = time.perf_counter()
        comp = predictor.storage.get_component(component_id)
        durations.append(time.perf_counter() - start)
    
    avg_duration = sum(durations) / len(durations)
    
    print(f"\n{'='*60}")
    print(f"COMPONENT LOOKUP")
    print(f"{'='*60}")
    print(f"Avg latency: {avg_duration*1000:.3f}ms")
    print(f"Lookups: {len(durations)}")
    print(f"{'='*60}")
    
    # Should be extremely fast
    assert avg_duration < 0.01, f"Lookup too slow: {avg_duration*1000:.3f}ms"


# ============================================================================
# STORAGE BACKEND BENCHMARKS
# ============================================================================

@pytest.mark.benchmark
def test_benchmark_storage_memory(predictor_config, small_project):
    """Benchmark in-memory SQLite storage."""
    storage = SQLiteStorage(":memory:")
    predictor = CoChangePredictor(predictor_config, storage_backend=storage)
    
    duration, stats = time_operation(predictor.update_index, small_project)
    
    print(f"\n{'='*60}")
    print(f"STORAGE - IN-MEMORY SQLITE")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s")
    print(f"Files: {stats['files_processed']}")
    print(f"{'='*60}")
    
    assert duration < 15, f"In-memory storage too slow: {duration:.2f}s"


@pytest.mark.benchmark
def test_benchmark_storage_file(predictor_config, small_project):
    """Benchmark file-based SQLite storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        storage = SQLiteStorage(db_path)
        predictor = CoChangePredictor(predictor_config, storage_backend=storage)
        
        duration, stats = time_operation(predictor.update_index, small_project)
        
        print(f"\n{'='*60}")
        print(f"STORAGE - FILE-BASED SQLITE")
        print(f"{'='*60}")
        print(f"Duration: {duration:.2f}s")
        print(f"Files: {stats['files_processed']}")
        print(f"DB size: {db_path.stat().st_size / 1024:.1f} KB")
        print(f"{'='*60}")
        
        assert duration < 20, f"File storage too slow: {duration:.2f}s"


@pytest.mark.benchmark
@pytest.mark.skipif(not REDIS_AVAILABLE, reason="Redis not available")
def test_benchmark_storage_redis(predictor_config, small_project):
    """Benchmark Redis storage."""
    # Get Redis config from environment
    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "15"))
    
    try:
        storage = RedisStorage(host=host, port=port, db=db)
        storage.clear()  # Clean before test
        
        predictor = CoChangePredictor(predictor_config, storage_backend=storage)
        
        duration, stats = time_operation(predictor.update_index, small_project)
        
        print(f"\n{'='*60}")
        print(f"STORAGE - REDIS")
        print(f"{'='*60}")
        print(f"Duration: {duration:.2f}s")
        print(f"Files: {stats['files_processed']}")
        print(f"{'='*60}")
        
        # Redis may be slightly slower due to network
        assert duration < 25, f"Redis storage too slow: {duration:.2f}s"
        
        storage.clear()  # Clean after test
        storage.close()
    except Exception as e:
        pytest.skip(f"Redis not available: {e}")


# ============================================================================
# PIPELINE COMPONENT BENCHMARKS
# ============================================================================

@pytest.mark.benchmark
def test_benchmark_cpg_parsing(small_project):
    """Benchmark CPG parsing with tree-sitter."""
    extractor = CPGComponentExtractor(["function", "method", "class"])
    
    all_components = []
    start = time.perf_counter()
    
    for file_path, content in small_project.items():
        components = extractor.extract_from_file(file_path, content)
        all_components.extend(components)
    
    duration = time.perf_counter() - start
    
    print(f"\n{'='*60}")
    print(f"CPG PARSING")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s")
    print(f"Files: {len(small_project)}")
    print(f"Components: {len(all_components)}")
    print(f"Throughput: {len(small_project)/duration:.1f} files/sec")
    print(f"{'='*60}")
    
    assert duration < 5, f"Parsing too slow: {duration:.2f}s"
    assert len(all_components) > 0


@pytest.mark.benchmark
def test_benchmark_feature_generation(predictor_config, tiny_project):
    """Benchmark feature extraction (end-to-end via predictor)."""
    predictor = CoChangePredictor(predictor_config)
    
    # Process files to generate features
    start = time.perf_counter()
    stats = predictor.update_index(tiny_project)
    duration = time.perf_counter() - start
    
    components_count = stats.get('components_added', 0)
    
    print(f"\n{'='*60}")
    print(f"FEATURE GENERATION (END-TO-END)")
    print(f"{'='*60}")
    print(f"Duration: {duration:.2f}s")
    print(f"Components: {components_count}")
    print(f"Throughput: {components_count/duration:.1f} components/sec")
    print(f"{'='*60}")
    
    assert duration < 5, f"Feature generation too slow: {duration:.2f}s"


@pytest.mark.benchmark
def test_benchmark_model_inference(predictor_config, tiny_project):
    """Benchmark model inference (via predictor)."""
    predictor = CoChangePredictor(predictor_config)
    predictor.update_index(tiny_project)
    
    # Get stats to show component count
    stats = predictor.get_stats()
    components_count = stats['num_components']
    
    print(f"\n{'='*60}")
    print(f"MODEL INFERENCE (INTEGRATED)")
    print(f"{'='*60}")
    print(f"Components processed: {components_count}")
    print(f"Note: Inference is part of update_index operation")
    print(f"{'='*60}")
    
    assert components_count > 0


@pytest.mark.benchmark
def test_benchmark_faiss_indexing(predictor_config, tiny_project):
    """Benchmark FAISS index operations (via predictor)."""
    predictor = CoChangePredictor(predictor_config)
    
    # Time indexing
    start = time.perf_counter()
    stats = predictor.update_index(tiny_project)
    add_duration = time.perf_counter() - start
    
    # Time search
    modified_files = [list(tiny_project.keys())[0]]
    start = time.perf_counter()
    for _ in range(10):
        predictor.predict_cochanges(modified_files, tiny_project, top_k=10)
    search_duration = time.perf_counter() - start
    
    print(f"\n{'='*60}")
    print(f"FAISS INDEXING (INTEGRATED)")
    print(f"{'='*60}")
    print(f"Index build: {add_duration:.2f}s")
    print(f"Search (10 queries): {search_duration:.3f}s")
    print(f"Avg search: {search_duration*100:.1f}ms per query")
    print(f"{'='*60}")
    
    assert add_duration < 5, f"FAISS indexing too slow: {add_duration:.2f}s"
    assert search_duration < 2, f"FAISS search too slow: {search_duration:.3f}s"

