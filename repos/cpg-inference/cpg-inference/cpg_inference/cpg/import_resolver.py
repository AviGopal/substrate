"""Import resolver for mapping module names to file paths.

Resolves import statements to actual file paths for cross-file analysis.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


class ImportResolver:
    """Resolve import statements to file paths.
    
    Language-specific logic to map module/package names to file paths
    in the project directory structure.
    """
    
    def __init__(self, project_root: str = "."):
        """Initialize import resolver.
        
        Args:
            project_root: Root directory of project
        """
        self.root = Path(project_root).resolve()
        
        # Cache: module_name -> file_path
        self.module_index: dict[str, str] = {}
        
        # Build initial index
        self._build_module_index()
    
    def _build_module_index(self) -> None:
        """Build index of module names to file paths.
        
        Scans project directory to map importable modules to their files.
        """
        # For now, simple implementation
        # TODO: More sophisticated index building with package detection
        pass
    
    def add_file(self, file_path: str) -> None:
        """Add a file to the module index.
        
        Args:
            file_path: Path to file
        """
        # Convert file path to module name and store mapping
        module_name = self._file_to_module(file_path)
        if module_name:
            self.module_index[module_name] = file_path
    
    def remove_file(self, file_path: str) -> None:
        """Remove a file from the module index.
        
        Args:
            file_path: Path to file
        """
        # Remove all entries pointing to this file
        to_remove = [
            mod for mod, path in self.module_index.items()
            if path == file_path
        ]
        for mod in to_remove:
            del self.module_index[mod]
    
    def resolve(self, module_spec: str, source_file: str, language: str = "python") -> str | None:
        """Resolve import to file path.
        
        Args:
            module_spec: Module/package being imported
            source_file: File doing the importing (for relative imports)
            language: Programming language
            
        Returns:
            Resolved file path or None
        """
        if language == "python":
            return self.resolve_python(module_spec, source_file)
        elif language == "java":
            return self.resolve_java(module_spec, source_file)
        elif language in ["javascript", "typescript"]:
            return self.resolve_javascript(module_spec, source_file)
        elif language in ["c", "cpp"]:
            return self.resolve_c(module_spec, source_file)
        
        return None
    
    def resolve_python(self, import_spec: str, source_file: str) -> str | None:
        """Resolve Python import to file path.
        
        Examples:
        - "auth" → "auth.py" or "auth/__init__.py"
        - ".database" → "../database.py" (relative)
        - "utils.validation" → "utils/validation.py"
        
        Args:
            import_spec: Python import string
            source_file: Source file path
            
        Returns:
            Resolved file path or None
        """
        # Check cache first
        if import_spec in self.module_index:
            return self.module_index[import_spec]
        
        # Handle relative imports (starts with .)
        if import_spec.startswith('.'):
            return self._resolve_python_relative(import_spec, source_file)
        
        # Handle absolute imports
        return self._resolve_python_absolute(import_spec)
    
    def _resolve_python_relative(self, spec: str, source_file: str) -> str | None:
        """Resolve Python relative import.
        
        Args:
            spec: Relative import spec (starts with .)
            source_file: Source file path
            
        Returns:
            Resolved file path or None
        """
        # Count leading dots
        level = 0
        while level < len(spec) and spec[level] == '.':
            level += 1
        
        # Get module name after dots
        module_name = spec[level:] if level < len(spec) else ""
        
        # Navigate up from source file
        source_path = Path(source_file).resolve()
        current_dir = source_path.parent
        
        # Go up 'level' directories
        for _ in range(level - 1):
            current_dir = current_dir.parent
        
        # If there's a module name, navigate to it
        if module_name:
            module_path = current_dir / module_name.replace('.', os.sep)
            
            # Try as .py file
            py_file = module_path.with_suffix('.py')
            if py_file.exists():
                # Make relative to project root if possible
                try:
                    return str(py_file.relative_to(self.root))
                except ValueError:
                    return str(py_file)
            
            # Try as package (__init__.py)
            init_file = module_path / "__init__.py"
            if init_file.exists():
                try:
                    return str(init_file.relative_to(self.root))
                except ValueError:
                    return str(init_file)
        else:
            # No module name, just relative directory
            init_file = current_dir / "__init__.py"
            if init_file.exists():
                try:
                    return str(init_file.relative_to(self.root))
                except ValueError:
                    return str(init_file)
        
        return None
    
    def _resolve_python_absolute(self, spec: str) -> str | None:
        """Resolve Python absolute import.
        
        Args:
            spec: Absolute import spec (e.g. "utils.auth")
            
        Returns:
            Resolved file path or None
        """
        # Convert dots to path separators
        module_path = self.root / spec.replace('.', os.sep)
        
        # Try as .py file
        py_file = module_path.with_suffix('.py')
        if py_file.exists():
            try:
                return str(py_file.relative_to(self.root))
            except ValueError:
                return str(py_file)
        
        # Try as package (__init__.py)
        init_file = module_path / "__init__.py"
        if init_file.exists():
            try:
                return str(init_file.relative_to(self.root))
            except ValueError:
                return str(init_file)
        
        # Check module index
        if spec in self.module_index:
            return self.module_index[spec]
        
        return None
    
    def resolve_java(self, import_spec: str, source_file: str) -> str | None:
        """Resolve Java import to file path.
        
        Example: com.example.Foo → com/example/Foo.java
        
        Args:
            import_spec: Java import string
            source_file: Source file path
            
        Returns:
            Resolved file path or None
        """
        # Convert dots to path separators
        module_path = self.root / import_spec.replace('.', os.sep)
        
        # Try as .java file
        java_file = module_path.with_suffix('.java')
        if java_file.exists():
            try:
                return str(java_file.relative_to(self.root))
            except ValueError:
                return str(java_file)
        
        return None
    
    def resolve_javascript(self, import_spec: str, source_file: str) -> str | None:
        """Resolve JavaScript/TypeScript import to file path.
        
        Examples:
        - "./utils" → "./utils.js" or "./utils.ts"
        - "../auth" → "../auth.js"
        - "react" → node_modules (skip)
        
        Args:
            import_spec: JS import string
            source_file: Source file path
            
        Returns:
            Resolved file path or None
        """
        # Skip node_modules imports
        if not import_spec.startswith('.') and not import_spec.startswith('/'):
            return None
        
        source_path = Path(source_file).resolve()
        
        # Resolve relative to source file
        if import_spec.startswith('.'):
            import_path = (source_path.parent / import_spec).resolve()
        else:
            import_path = self.root / import_spec
        
        # Try various extensions
        for ext in ['.js', '.ts', '.jsx', '.tsx']:
            file_with_ext = import_path.with_suffix(ext)
            if file_with_ext.exists():
                try:
                    return str(file_with_ext.relative_to(self.root))
                except ValueError:
                    return str(file_with_ext)
        
        # Try index files
        for ext in ['.js', '.ts', '.jsx', '.tsx']:
            index_file = import_path / f"index{ext}"
            if index_file.exists():
                try:
                    return str(index_file.relative_to(self.root))
                except ValueError:
                    return str(index_file)
        
        return None
    
    def resolve_c(self, import_spec: str, source_file: str) -> str | None:
        """Resolve C/C++ include to file path.
        
        Examples:
        - "my_header.h" → "./my_header.h" (relative to source)
        - <stdio.h> → system header (skip)
        
        Args:
            import_spec: Include spec
            source_file: Source file path
            
        Returns:
            Resolved file path or None
        """
        # Skip system headers (assume anything without extension or common system headers)
        if '.' not in import_spec or import_spec in ['stdio.h', 'stdlib.h', 'string.h']:
            return None
        
        source_path = Path(source_file).resolve()
        
        # Try relative to source file
        header_path = source_path.parent / import_spec
        if header_path.exists():
            try:
                return str(header_path.relative_to(self.root))
            except ValueError:
                return str(header_path)
        
        # Try in project root
        header_path = self.root / import_spec
        if header_path.exists():
            try:
                return str(header_path.relative_to(self.root))
            except ValueError:
                return str(header_path)
        
        return None
    
    def _file_to_module(self, file_path: str) -> str | None:
        """Convert file path to importable module name.
        
        Args:
            file_path: File path
            
        Returns:
            Module name or None
        """
        path = Path(file_path)
        
        # Remove extension
        module_parts = path.with_suffix('').parts
        
        # Convert to dot notation
        if module_parts:
            # Remove __init__ if present
            if module_parts[-1] == '__init__':
                module_parts = module_parts[:-1]
            
            return '.'.join(module_parts)
        
        return None
    
    def clear(self) -> None:
        """Clear the module index."""
        self.module_index.clear()

