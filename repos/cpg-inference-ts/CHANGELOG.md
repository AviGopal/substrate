# Changelog

All notable changes to @metabob/cpg-inference will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-24

### Added

- Initial release of TypeScript CPG inference library
- Code Property Graph construction from TypeScript, JavaScript, and Python
- Tree-sitter based parsing for multi-language support
- GCN-based code embeddings using ONNX Runtime
- Pre-trained model (109KB) trained on git co-change patterns
- Vector similarity search using USearch
- `CoChangePredictor` API for co-change prediction
- Graph traversal and query engine
- Progressive file updates and incremental indexing
- Comprehensive test suite (48/55 tests passing)
- Full API documentation and examples

### Technical Details

**Core Components:**
- `CodePropertyGraph`: Graph structure and query engine
- `SourceParser`: Tree-sitter based multi-language parser
- `GraphBuilder`: AST to CPG conversion
- `ONNXEmbeddingModel`: GCN model inference (32-dim embeddings)
- `FAISSIndex`: Vector similarity search with USearch
- `CoChangePredictor`: Main API for co-change analysis

**Model:**
- Architecture: 2-layer Graph Convolutional Network
- Input: 128-bit SimHash features
- Output: 32-dimensional embeddings
- Training: Multi-repository co-change dataset (AUC 0.9999)
- Size: 109KB (69KB model + 40KB data)

**Dependencies:**
- `onnxruntime-node`: ^1.20.1
- `tree-sitter`: ^0.21.1
- `usearch`: ^2.21.4
- `better-sqlite3`: ^11.7.0 (optional)

### Known Issues

- 7 GraphCache tests require better-sqlite3 native module build
- Formal benchmarks deferred (Python baseline not accessible)

[0.1.0]: https://github.com/metabob/cpg-inference-ts/releases/tag/v0.1.0
