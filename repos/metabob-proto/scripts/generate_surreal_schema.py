#!/usr/bin/env python3
"""
Generate SurrealDB schema from protobuf definitions.

This script reads .proto files from metabob-proto and generates
SurrealQL schema definitions for SurrealDB tables.

Usage:
    python scripts/generate_surreal_schema.py > schema.surql
    python scripts/generate_surreal_schema.py --output schema/
    python scripts/generate_surreal_schema.py --apply

The script parses proto comments for SurrealDB-specific annotations:
    // SurrealDB Table: table_name
    // Indexes: field1 (unique), field2
"""

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ProtoField:
    """Represents a protobuf field."""
    name: str
    type_name: str
    is_repeated: bool = False
    is_optional: bool = False
    is_map: bool = False
    map_key_type: str = ""
    map_value_type: str = ""


@dataclass
class ProtoMessage:
    """Represents a protobuf message."""
    name: str
    fields: list[ProtoField] = field(default_factory=list)
    surreal_table: str = ""
    surreal_indexes: list[tuple[str, bool]] = field(default_factory=list)  # (field, is_unique)


# Proto type to SurrealDB type mapping
PROTO_TO_SURREAL = {
    # Scalars
    "string": "string",
    "bytes": "bytes",
    "bool": "bool",
    "int32": "int",
    "int64": "int",
    "uint32": "int",
    "uint64": "int",
    "sint32": "int",
    "sint64": "int",
    "fixed32": "int",
    "fixed64": "int",
    "sfixed32": "int",
    "sfixed64": "int",
    "float": "float",
    "double": "float",
    
    # Well-known types
    "google.protobuf.Timestamp": "datetime",
    "google.protobuf.Struct": "object",
    "google.protobuf.Value": "any",
    
    # Custom types (nested messages become objects)
    "Genealogy": "object",
    "TokenUsage": "object",
    "Cost": "object",
    "TaskStep": "object",
    "metabob.common.Genealogy": "object",
    "metabob.common.TokenUsage": "object",
    "metabob.common.Cost": "object",
    "metabob.common.EntityStatus": "string",
    "metabob.common.EvolutionType": "string",
    "metabob.common.ActivityCategory": "string",
    "SessionType": "string",
}


def parse_proto_file(path: Path) -> list[ProtoMessage]:
    """Parse a .proto file and extract messages with SurrealDB annotations."""
    content = path.read_text()
    messages = []
    
    # Remove single-line comments but capture SurrealDB annotations
    annotations = {}
    current_annotations = {}
    
    lines = content.split("\n")
    processed_lines = []
    
    for line in lines:
        # Check for SurrealDB annotations in comments
        table_match = re.search(r"//\s*SurrealDB Table:\s*(\w+)", line)
        if table_match:
            current_annotations["table"] = table_match.group(1)
            
        index_match = re.search(r"//\s*Indexes?:\s*(.+)", line)
        if index_match:
            indexes_str = index_match.group(1)
            indexes = []
            for idx in indexes_str.split(","):
                idx = idx.strip()
                is_unique = "(unique)" in idx.lower()
                field_name = re.sub(r"\s*\(unique\)\s*", "", idx, flags=re.IGNORECASE).strip()
                if field_name:
                    indexes.append((field_name, is_unique))
            current_annotations["indexes"] = indexes
        
        # Check for message declaration
        msg_match = re.match(r"\s*message\s+(\w+)\s*\{", line)
        if msg_match:
            msg_name = msg_match.group(1)
            annotations[msg_name] = current_annotations.copy()
            current_annotations = {}
        
        processed_lines.append(line)
    
    content = "\n".join(processed_lines)
    
    # Find all message definitions
    message_pattern = re.compile(
        r"message\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
        re.MULTILINE | re.DOTALL
    )
    
    for match in message_pattern.finditer(content):
        name = match.group(1)
        body = match.group(2)
        
        msg = ProtoMessage(name=name)
        
        # Apply annotations
        if name in annotations:
            msg.surreal_table = annotations[name].get("table", "")
            msg.surreal_indexes = annotations[name].get("indexes", [])
        
        # Parse fields
        field_pattern = re.compile(
            r"(?:(repeated|optional)\s+)?(?:map\s*<\s*(\w+)\s*,\s*([.\w]+)\s*>|([.\w]+))\s+(\w+)\s*=\s*(\d+)",
            re.MULTILINE
        )
        
        for field_match in field_pattern.finditer(body):
            modifier = field_match.group(1)
            map_key = field_match.group(2)
            map_value = field_match.group(3)
            type_name = field_match.group(4)
            field_name = field_match.group(5)
            
            proto_field = ProtoField(name=field_name, type_name="")
            
            if map_key and map_value:
                proto_field.is_map = True
                proto_field.map_key_type = map_key
                proto_field.map_value_type = map_value
                proto_field.type_name = f"map<{map_key},{map_value}>"
            else:
                proto_field.type_name = type_name
            
            if modifier == "repeated":
                proto_field.is_repeated = True
            elif modifier == "optional":
                proto_field.is_optional = True
            
            msg.fields.append(proto_field)
        
        messages.append(msg)
    
    return messages


def proto_type_to_surreal(proto_type: str, is_repeated: bool = False, is_optional: bool = False, is_map: bool = False) -> str:
    """Convert proto type to SurrealDB type."""
    if is_map:
        return "object"
    
    surreal_type = PROTO_TO_SURREAL.get(proto_type, "object")
    
    if is_repeated:
        return "array"
    
    if is_optional:
        return f"option<{surreal_type}>"
    
    return surreal_type


def generate_surreal_schema(messages: list[ProtoMessage]) -> str:
    """Generate SurrealDB schema from parsed messages."""
    output = []
    output.append("-- =============================================================================")
    output.append("-- SurrealDB Schema - Generated from metabob-proto")
    output.append("-- =============================================================================")
    output.append("-- DO NOT EDIT MANUALLY - Regenerate with:")
    output.append("--   python scripts/generate_surreal_schema.py")
    output.append("-- =============================================================================")
    output.append("")
    
    for msg in messages:
        if not msg.surreal_table:
            continue
        
        table = msg.surreal_table
        
        output.append(f"-- ---------------------------------------------------------------------------")
        output.append(f"-- Table: {table} (from {msg.name})")
        output.append(f"-- ---------------------------------------------------------------------------")
        output.append("")
        output.append(f"DEFINE TABLE IF NOT EXISTS {table} SCHEMAFULL;")
        output.append("")
        
        # Define fields
        for field in msg.fields:
            surreal_type = proto_type_to_surreal(
                field.type_name,
                field.is_repeated,
                field.is_optional,
                field.is_map
            )
            
            # Handle defaults
            default = ""
            if field.is_repeated or field.is_map:
                if surreal_type == "array":
                    default = " DEFAULT []"
                else:
                    default = " DEFAULT {}"
            elif surreal_type == "datetime" and field.name in ("created_at", "updated_at", "last_activity", "shown_at", "last_updated"):
                default = " DEFAULT time::now()"
            elif surreal_type == "string" and field.name in ("prompt_strategy",):
                default = " DEFAULT 'guided'"
            elif surreal_type == "string" and field.name in ("status",):
                default = " DEFAULT 'testing'"
            elif surreal_type == "int" and "tokens" in field.name:
                default = " DEFAULT 10000"
            elif surreal_type == "float" and "score" in field.name:
                default = " DEFAULT 0.5"
            elif surreal_type == "float" and ("alpha" in field.name or "beta" in field.name):
                default = " DEFAULT 1.0"
            elif surreal_type == "float":
                default = " DEFAULT 0.0"
            elif surreal_type == "int":
                default = " DEFAULT 0"
            elif surreal_type == "bool":
                default = " DEFAULT false"
            
            output.append(f"DEFINE FIELD {field.name} ON {table} TYPE {surreal_type}{default};")
        
        output.append("")
        
        # Define indexes
        for idx_field, is_unique in msg.surreal_indexes:
            unique = " UNIQUE" if is_unique else ""
            idx_name = f"{idx_field}_idx"
            
            # Handle composite indexes
            if "+" in idx_field:
                fields = [f.strip() for f in idx_field.split("+")]
                idx_name = "_".join(fields) + "_idx"
                fields_str = ", ".join(fields)
                output.append(f"DEFINE INDEX {idx_name} ON {table} FIELDS {fields_str}{unique};")
            else:
                output.append(f"DEFINE INDEX {idx_name} ON {table} FIELDS {idx_field}{unique};")
        
        output.append("")
    
    return "\n".join(output)


def find_proto_files(proto_dir: Path) -> list[Path]:
    """Find all .proto files in directory tree."""
    return list(proto_dir.rglob("*.proto"))


def main():
    parser = argparse.ArgumentParser(
        description="Generate SurrealDB schema from protobuf definitions"
    )
    parser.add_argument(
        "--proto-dir",
        type=Path,
        default=Path(__file__).parent.parent / "proto",
        help="Directory containing .proto files"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file or directory"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply schema directly to SurrealDB"
    )
    parser.add_argument(
        "--surreal-url",
        default="http://localhost:8000",
        help="SurrealDB URL (for --apply)"
    )
    parser.add_argument(
        "--namespace",
        default="metabob",
        help="SurrealDB namespace"
    )
    parser.add_argument(
        "--database",
        default="devbob",
        help="SurrealDB database"
    )
    
    args = parser.parse_args()
    
    # Find and parse proto files
    proto_files = find_proto_files(args.proto_dir)
    
    if not proto_files:
        print(f"No .proto files found in {args.proto_dir}", file=sys.stderr)
        sys.exit(1)
    
    all_messages = []
    for proto_file in proto_files:
        messages = parse_proto_file(proto_file)
        all_messages.extend(messages)
    
    # Generate schema
    schema = generate_surreal_schema(all_messages)
    
    # Add USE statement at the top
    full_schema = f"USE NS {args.namespace} DB {args.database};\n\n{schema}"
    
    if args.apply:
        import httpx
        import os
        
        user = os.getenv("SURREAL_USER", "root")
        password = os.getenv("SURREAL_PASS", "root")
        
        print(f"Applying schema to {args.surreal_url}...", file=sys.stderr)
        
        response = httpx.post(
            f"{args.surreal_url}/sql",
            content=full_schema,
            auth=(user, password),
            headers={"Accept": "application/json", "Content-Type": "text/plain"},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            ok_count = sum(1 for r in result if r.get("status") == "OK")
            print(f"Schema applied: {ok_count} statements executed", file=sys.stderr)
        else:
            print(f"Error: {response.status_code} - {response.text}", file=sys.stderr)
            sys.exit(1)
    
    elif args.output:
        if args.output.is_dir():
            output_file = args.output / "schema.surql"
        else:
            output_file = args.output
        
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(full_schema)
        print(f"Schema written to {output_file}", file=sys.stderr)
    
    else:
        print(full_schema)


if __name__ == "__main__":
    main()
