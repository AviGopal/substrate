# Changelog

All notable changes to the cpg-inference project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] - 2025-11-15

### Fixed
- Fixed stdout contamination issue in progressive parser
- Replaced print() statements with proper logging to avoid breaking JSONRPC stdio communication
- Parse errors now log to stderr via Python's logging module instead of stdout

### Changed
- Added logging module to progressive_parser.py for proper error handling

## [0.2.0] - 2025-10-30

### Changed
- Updated default model to top-performing variant (AUC 0.9999, +37% improvement)
- Switched from ranking loss to BCE loss architecture
- Model trained 2025-10-28

### Performance
- AUC improved from 0.9625 to 0.9999
- Latency: 0.37ms (14% faster than PyTorch)
- Same model size (109KB total)

## [0.1.0] - 2025-01-26

### Added
- Initial release of cpg-inference library
- CPG component extraction for functions, classes, and methods
- SimHash feature generation with configurable neighborhood depth
- ONNX model wrapper for GNN inference
- FAISS IndexIDMap for efficient similarity search
- CoChangePredictor service for co-change prediction
- Support for streaming file updates (5-10 files at a time)
- Comprehensive test suite (48 tests, 90%+ coverage)
- Full documentation and examples

### Features
- Multi-language support (Python, Java, JavaScript, C/C++, Ruby, PHP)
- Configurable edge filters (none, structural, all)
- Persistent FAISS index with metadata
- Batch processing for efficiency
- Component-level granularity (functions/classes/methods)

### Dependencies
- tree-sitter >= 0.21.0
- onnxruntime >= 1.17.0
- numpy >= 1.24.0
- faiss-cpu >= 1.8.0

[0.1.0]: https://github.com/sacpgo/cpg-inference/releases/tag/v0.1.0

