#!/usr/bin/env python3
"""Quick start example using the bundled model.

This example shows how to use the cpg-inference package with the
default bundled model without needing to train your own.
"""

from cpg_inference import (
    CoChangePredictor,
    InferenceConfig,
    get_model_path,
    get_model_info,
    get_recommended_config,
)


def main():
    """Run quick start example."""
    print("=" * 70)
    print("CPG Inference - Quick Start with Bundled Model")
    print("=" * 70)
    
    # Step 1: Get bundled model information
    print("\n1. Model Information:")
    model_info = get_model_info("default")
    print(f"   Architecture: {model_info['architecture']}")
    print(f"   Layers: {model_info['layers']}")
    print(f"   Embedding dim: {model_info['embedding_dim']}")
    print(f"   AUC: 0.9625")
    print(f"   Size: {model_info['size_kb']}KB")
    
    # Step 2: Initialize predictor with bundled model
    print("\n2. Initializing predictor...")
    model_path = get_model_path("default")
    config_params = get_recommended_config("default")
    
    config = InferenceConfig(
        model_path=model_path,
        index_path=None,  # Will be created in memory
        **config_params,
        top_k=5,
    )
    
    predictor = CoChangePredictor(config)
    print(f"   ✓ Model loaded from: {model_path}")
    
    # Step 3: Example codebase
    print("\n3. Processing example codebase...")
    files = {
        "auth.py": """
def login(username, password):
    '''Authenticate user.'''
    user = validate_user(username, password)
    if user:
        return create_session(user)
    return None

def validate_user(username, password):
    '''Validate credentials.'''
    return get_user(username)
""",
        "user.py": """
class User:
    '''User model.'''
    def __init__(self, username):
        self.username = username

def get_user(username):
    '''Get user by username.'''
    return User(username)
""",
        "session.py": """
def create_session(user):
    '''Create user session.'''
    return {'user_id': user.username}

def destroy_session(session_id):
    '''Destroy session.'''
    pass
""",
    }
    
    stats = predictor.update_index(files)
    print(f"   Files processed: {stats['files_processed']}")
    print(f"   Components indexed: {stats['components_added']}")
    
    # Step 4: Get co-change predictions
    print("\n4. Predicting co-changes for auth.py...")
    predictions = predictor.predict_cochanges(
        changed_files=["auth.py"],
        files=files,
        top_k=5,
    )
    
    if predictions:
        print(f"\n   Top {len(predictions)} co-change predictions:")
        for i, pred in enumerate(predictions, 1):
            print(f"   {i}. {pred.file_path}::{pred.component_name}")
            print(f"      Type: {pred.component_type}")
            print(f"      Similarity: {pred.similarity_score:.4f}")
    else:
        print("   No predictions (index may be too small)")
    
    # Step 5: Statistics
    print("\n5. Statistics:")
    stats = predictor.get_stats()
    print(f"   Files tracked: {stats['num_files']}")
    print(f"   Components indexed: {stats['num_components']}")
    
    print("\n" + "=" * 70)
    print("✅ Quick start completed successfully!")
    print("=" * 70)
    print("\nNext steps:")
    print("  - Add more files to the index")
    print("  - Save the index for persistence: predictor.save_index('index.faiss')")
    print("  - Integrate into your application")


if __name__ == "__main__":
    main()

