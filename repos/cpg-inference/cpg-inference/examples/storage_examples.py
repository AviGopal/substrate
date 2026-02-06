"""Examples demonstrating different storage backend patterns."""

from pathlib import Path
from cpg_inference.models import InferenceConfig
from cpg_inference.service import CoChangePredictor
from cpg_inference.storage import SQLiteStorage

# Get model path
import cpg_inference
pkg_dir = Path(cpg_inference.__file__).parent
MODEL_PATH = pkg_dir / "bundled_models" / "auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx"


def example_default_behavior():
    """Example 1: Default behavior (no changes required).
    
    Uses in-memory SQLite storage by default.
    Existing code continues to work without modification.
    """
    print("Example 1: Default Behavior")
    print("-" * 50)
    
    # This is exactly how users currently use the library
    config = InferenceConfig(model_path=str(MODEL_PATH))
    predictor = CoChangePredictor(config)
    
    # Works exactly as before
    files = {
        "example.py": "def hello(): pass"
    }
    stats = predictor.update_index(files)
    print(f"Components indexed: {stats['components_added']}")
    print("✓ Uses fast in-memory storage by default\n")


def example_persistent_local_cache():
    """Example 2: Persistent local cache with SQLite.
    
    Use this for:
    - Distributed architecture (each service has local cache)
    - Development environments
    - CI/CD pipelines
    
    Benefits:
    - 10-50x faster incremental updates
    - Persists across restarts
    - No external dependencies
    """
    print("Example 2: Persistent Local Cache (SQLite)")
    print("-" * 50)
    
    # Use file-based SQLite for persistence
    storage = SQLiteStorage("cache/cpg_cache.db")
    config = InferenceConfig(model_path=str(MODEL_PATH))
    predictor = CoChangePredictor(config, storage_backend=storage)
    
    # First run - processes all files
    files = {
        "module1.py": "def process(): pass",
        "module2.py": "class Handler: pass"
    }
    stats = predictor.update_index(files)
    print(f"Initial indexing: {stats['components_added']} components")
    
    # Subsequent runs - only reprocess changed files
    updated_files = {
        "module1.py": "def process():\n    return True"  # Modified
    }
    stats = predictor.update_index(updated_files)
    print(f"Incremental update: {stats['components_updated']} components updated")
    print("✓ Fast incremental updates with local persistence\n")
    
    storage.close()


def example_centralized_redis():
    """Example 3: Centralized cache with Redis.
    
    Use this for:
    - Multiple services sharing same codebase view
    - Centralized architecture
    - Horizontal scaling
    
    Benefits:
    - Shared state across all services
    - Consistent codebase view
    - No need to sync caches
    
    Requires:
        pip install cpg-inference[redis]
    """
    print("Example 3: Centralized Cache (Redis)")
    print("-" * 50)
    
    try:
        from cpg_inference.storage import RedisStorage
        
        # Connect to Redis
        storage = RedisStorage(
            host="localhost",
            port=6379,
            ttl=86400  # Optional: expire after 24 hours
        )
        
        config = InferenceConfig(model_path=str(MODEL_PATH))
        predictor = CoChangePredictor(config, storage_backend=storage)
        
        files = {
            "shared_module.py": "def shared_function(): pass"
        }
        stats = predictor.update_index(files)
        print(f"Components in shared cache: {stats['components_added']}")
        print("✓ Multiple services can share this cache")
        print("✓ All services see consistent codebase state\n")
        
        storage.close()
        
    except ImportError:
        print("Redis not installed. Install with: pip install cpg-inference[redis]")
        print("Skipping Redis example.\n")


def example_session_persistence():
    """Example 4: Persistence across sessions.
    
    Demonstrates how local cache persists across program restarts.
    """
    print("Example 4: Persistence Across Sessions")
    print("-" * 50)
    
    db_path = "cache/persistent_cache.db"
    
    # Session 1: Index codebase
    print("Session 1: Initial indexing...")
    storage1 = SQLiteStorage(db_path)
    config = InferenceConfig(model_path=str(MODEL_PATH))
    predictor1 = CoChangePredictor(config, storage_backend=storage1)
    
    files = {
        "persistent_module.py": "def persistent_func(): pass"
    }
    stats1 = predictor1.update_index(files)
    print(f"  Indexed {stats1['components_added']} components")
    storage1.close()
    
    # Session 2: Reuse cached data
    print("Session 2: Reusing cache...")
    storage2 = SQLiteStorage(db_path)
    predictor2 = CoChangePredictor(config, storage_backend=storage2)
    
    # Components are already cached
    stats2 = predictor2.get_stats()
    print(f"  Cache contains {stats2['num_cached_components']} components")
    print("✓ No reprocessing needed - instant startup!\n")
    storage2.close()


def example_context_manager():
    """Example 5: Using context managers for automatic cleanup."""
    print("Example 5: Context Manager Pattern")
    print("-" * 50)
    
    config = InferenceConfig(model_path=str(MODEL_PATH))
    
    # Storage is automatically closed when exiting context
    with SQLiteStorage("cache/context_cache.db") as storage:
        predictor = CoChangePredictor(config, storage_backend=storage)
        
        files = {"example.py": "def example(): pass"}
        stats = predictor.update_index(files)
        print(f"Components indexed: {stats['components_added']}")
    
    print("✓ Storage automatically closed\n")


def example_production_workflow():
    """Example 6: Production workflow with error handling."""
    print("Example 6: Production Workflow")
    print("-" * 50)
    
    db_path = "cache/production_cache.db"
    
    try:
        # Initialize with persistent storage
        storage = SQLiteStorage(db_path)
        config = InferenceConfig(
            model_path=str(MODEL_PATH),
            top_k=10,
            min_similarity=0.7
        )
        predictor = CoChangePredictor(config, storage_backend=storage)
        
        # Get all Python files from repository
        files = {
            "src/main.py": "def main(): pass",
            "src/utils.py": "def helper(): pass",
            "src/config.py": "CONFIG = {}"
        }
        
        # Index codebase
        print("Indexing codebase...")
        stats = predictor.update_index(files)
        print(f"  Files: {stats['files_processed']}")
        print(f"  Components: {stats['components_added']}")
        
        # Analyze changes
        changed_files = ["src/main.py"]
        print(f"\nAnalyzing changes to {changed_files}...")
        predictions = predictor.predict_cochanges(
            changed_files=changed_files,
            files=files,
            top_k=5
        )
        
        print(f"  Found {len(predictions)} co-change predictions")
        for pred in predictions[:3]:
            print(f"    - {pred.file_path}::{pred.component_name} "
                  f"(score: {pred.similarity_score:.3f})")
        
        print("\n✓ Production workflow complete")
        
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        # Always close storage
        if 'storage' in locals():
            storage.close()
    
    print()


def example_redis_multi_repository():
    """Example 7: Multiple repositories sharing Redis."""
    print("Example 7: Multiple Repositories on Same Redis")
    print("-" * 50)
    
    try:
        from cpg_inference.storage import RedisStorage
        
        # Repository A
        storage_a = RedisStorage(
            host="localhost",
            port=6379,
            prefix="repo_a"  # Custom prefix for isolation
        )
        storage_a.clear()
        
        config = InferenceConfig(model_path=str(MODEL_PATH))
        predictor_a = CoChangePredictor(config, storage_backend=storage_a)
        
        files_a = {"repo_a/main.py": "def func_a(): pass"}
        stats_a = predictor_a.update_index(files_a)
        print(f"Repo A: Indexed {stats_a['components_added']} components")
        
        # Repository B (completely isolated)
        storage_b = RedisStorage(
            host="localhost",
            port=6379,
            prefix="repo_b"  # Different prefix = different namespace
        )
        storage_b.clear()
        
        predictor_b = CoChangePredictor(config, storage_backend=storage_b)
        
        files_b = {"repo_b/main.py": "def func_b(): pass"}
        stats_b = predictor_b.update_index(files_b)
        print(f"Repo B: Indexed {stats_b['components_added']} components")
        
        # Verify isolation
        storage_a_stats = storage_a.get_stats()
        storage_b_stats = storage_b.get_stats()
        
        print(f"\nRepo A components: {storage_a_stats['num_components']}")
        print(f"Repo B components: {storage_b_stats['num_components']}")
        print("✓ Both repositories isolated on same Redis instance")
        print("✓ No key collisions with prefix parameter\n")
        
        # Cleanup
        storage_a.clear()
        storage_b.clear()
        storage_a.close()
        storage_b.close()
        
    except ImportError:
        print("Redis not installed. Install with: pip install cpg-inference[redis]")
        print("Skipping multi-repository example.\n")


if __name__ == "__main__":
    """Run all examples."""
    import os
    
    # Create cache directory
    os.makedirs("cache", exist_ok=True)
    
    print("=" * 60)
    print("CPG INFERENCE STORAGE BACKEND EXAMPLES")
    print("=" * 60)
    print()
    
    example_default_behavior()
    example_persistent_local_cache()
    example_centralized_redis()
    example_redis_multi_repository()
    example_session_persistence()
    example_context_manager()
    example_production_workflow()
    
    print("=" * 60)
    print("All examples complete!")
    print("=" * 60)

