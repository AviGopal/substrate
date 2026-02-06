# CPG Inference Package - Build and Distribution Guide

## Overview

The `cpg-inference` package is a standalone, lightweight Python library for CPG-based co-change prediction. It can be installed independently without the full SACPGO research codebase.

## Package Structure

```
packages/cpg-inference/
├── cpg_inference/              # Main package
│   ├── __init__.py            # Public API
│   ├── models.py              # Data models
│   ├── cpg_extractor.py       # Component extraction
│   ├── feature_generator.py   # Feature generation
│   ├── model_wrapper.py       # ONNX inference
│   ├── index_manager.py       # FAISS management
│   ├── service.py             # Main service
│   ├── cpg/                   # CPG parsing (copied from optimizer.cpg)
│   ├── simhash/               # SimHash (copied from optimizer.simhash)
│   └── embedding/             # Embedding utils (copied from optimizer.embedding)
├── tests/                     # Test suite
├── pyproject.toml             # Package configuration
├── README.md                  # User documentation
├── LICENSE                    # MIT License
├── CHANGELOG.md               # Version history
├── MANIFEST.in                # Package manifest
├── build_package.sh           # Build script
└── dist/                      # Built distributions
    ├── cpg_inference-0.1.0-py3-none-any.whl
    └── cpg_inference-0.1.0.tar.gz
```

## Building the Package

### Prerequisites

```bash
pip install build
```

### Build Steps

1. **Run the build script** (copies files from main codebase):
   ```bash
   cd packages/cpg-inference
   bash build_package.sh
   ```

2. **Build the wheel**:
   ```bash
   python -m build
   ```

3. **Output**: Wheel and source distribution in `dist/`:
   - `cpg_inference-0.1.0-py3-none-any.whl`
   - `cpg_inference-0.1.0.tar.gz`

## Installing the Package

### From Wheel

```bash
pip install dist/cpg_inference-0.1.0-py3-none-any.whl
```

### From Source

```bash
pip install -e .
```

### From PyPI (when published)

```bash
pip install cpg-inference
```

## Dependencies

The package has minimal production dependencies:

- `tree-sitter` >= 0.21.0 - AST parsing
- `tree-sitter-python` >= 0.21.0 - Python language support
- `tree-sitter-java` >= 0.21.0 - Java language support
- `tree-sitter-javascript` >= 0.21.0 - JavaScript language support
- `tree-sitter-c` >= 0.21.0 - C language support
- `tree-sitter-cpp` >= 0.22.0 - C++ language support
- `tree-sitter-ruby` >= 0.21.0 - Ruby language support
- `tree-sitter-php` >= 0.22.0 - PHP language support
- `onnxruntime` >= 1.17.0 - ONNX model inference
- `numpy` >= 1.24.0 - Array operations
- `faiss-cpu` >= 1.8.0 - Similarity search

## Usage Example

```python
from cpg_inference import CoChangePredictor, InferenceConfig

# Initialize
config = InferenceConfig(
    model_path="model.onnx",
    index_path="index.faiss",
    simhash_bits=128,
    neighborhood_depth=1,
    edge_filter_mode="all",
    embedding_dim=32,
)

predictor = CoChangePredictor(config)

# Update index
files = {"auth.py": "def login(): ..."}
stats = predictor.update_index(files)

# Get predictions
predictions = predictor.predict_cochanges(["auth.py"], files)
```

## Testing

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=cpg_inference --cov-report=html
```

## Publishing to PyPI

### Test PyPI (recommended first)

```bash
# Install twine
pip install twine

# Upload to Test PyPI
python -m twine upload --repository testpypi dist/*

# Test installation
pip install --index-url https://test.pypi.org/simple/ cpg-inference
```

### Production PyPI

```bash
# Upload to PyPI
python -m twine upload dist/*
```

## Version Management

Update version in:
1. `pyproject.toml` - `version = "X.Y.Z"`
2. `cpg_inference/__init__.py` - `__version__ = "X.Y.Z"`
3. `CHANGELOG.md` - Add new version section

## Maintenance

### Updating from Main Codebase

When changes are made to the inference code in the main codebase:

1. Run `bash build_package.sh` to copy updated files
2. Test the package: `pytest tests/ -v`
3. Update version numbers
4. Rebuild: `python -m build`
5. Publish new version

### Adding New Features

1. Implement in main codebase (`optimizer/inference/`)
2. Test in main codebase
3. Run build script to copy to package
4. Test standalone package
5. Update documentation
6. Bump version and publish

## File Copying Strategy

The `build_package.sh` script copies:

**From `optimizer/inference/`**:
- All inference module files

**From `optimizer/cpg/`**:
- Core CPG parsing modules
- Parser implementations

**From `optimizer/simhash/`**:
- SimHash generation

**From `optimizer/embedding/`**:
- Structural SimHash
- Subtree extraction

**Import Updates**:
- Automatically updates all imports from `optimizer.*` to `cpg_inference.*`

## Distribution Checklist

Before publishing a new version:

- [ ] Run build script: `bash build_package.sh`
- [ ] Update version in `pyproject.toml`
- [ ] Update version in `cpg_inference/__init__.py`
- [ ] Update `CHANGELOG.md`
- [ ] Run tests: `pytest tests/ -v`
- [ ] Build package: `python -m build`
- [ ] Test wheel installation: `pip install dist/*.whl`
- [ ] Test import: `python -c "from cpg_inference import CoChangePredictor"`
- [ ] Upload to Test PyPI
- [ ] Test installation from Test PyPI
- [ ] Upload to PyPI
- [ ] Tag release in git: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`

## Continuous Integration

Consider setting up GitHub Actions for:

1. **Testing**: Run tests on multiple Python versions
2. **Building**: Build wheel on each commit
3. **Publishing**: Auto-publish to PyPI on tagged releases

Example `.github/workflows/publish.yml`:

```yaml
name: Publish to PyPI

on:
  release:
    types: [created]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-python@v2
      with:
        python-version: '3.10'
    - name: Install dependencies
      run: |
        pip install build twine
    - name: Build package
      run: python -m build
    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
      run: twine upload dist/*
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/sacpgo/cpg-inference/issues
- Documentation: See `README.md`

## License

MIT License - see `LICENSE` file

