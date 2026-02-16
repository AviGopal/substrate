#!/usr/bin/env python3
"""
Verify Step Reporting Schema Compatibility

This script checks that the execution_steps table schema matches
the ExecutionStepRequest expected by the backend.

Expected schema:
- execution_id: str
- step_order: int
- success: bool
- output: Optional[str]
- duration_ms: int
- cost: float
- tokens: int
- impulses_loaded: List[str]
- impulses_created: List[str]
"""

import sys
import psycopg2
from psycopg2 import sql

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'metabob',
    'user': 'metabob',
    'password': 'metabob'
}

EXPECTED_COLUMNS = {
    'execution_id': 'uuid',
    'step_order': 'integer',
    'success': 'boolean',
    'output': 'text',  # Optional (nullable)
    'duration_ms': 'integer',
    'cost': 'double precision',
    'tokens': 'integer',
    'impulses_loaded': 'ARRAY',  # text[]
    'impulses_created': 'ARRAY',  # text[]
}

def check_table_schema():
    """Check execution_steps table schema matches expectations."""
    print("=" * 60)
    print("Execution Steps Schema Verification")
    print("=" * 60)
    print()
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Get table schema
        cursor.execute("""
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                udt_name
            FROM information_schema.columns 
            WHERE table_name = 'execution_steps'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        if not columns:
            print("❌ Table 'execution_steps' not found!")
            return False
        
        print("Current Schema:")
        print("-" * 60)
        
        all_valid = True
        found_columns = {}
        
        for col_name, data_type, is_nullable, udt_name in columns:
            found_columns[col_name] = data_type
            
            # Check if this is an expected column
            if col_name in EXPECTED_COLUMNS:
                expected_type = EXPECTED_COLUMNS[col_name]
                
                # Special handling for arrays
                if expected_type == 'ARRAY':
                    matches = udt_name == '_text' or data_type == 'ARRAY'
                else:
                    matches = data_type.lower() == expected_type.lower()
                
                status = "✅" if matches else "❌"
                print(f"{status} {col_name:20s} {data_type:20s} (nullable: {is_nullable})")
                
                if not matches:
                    print(f"   Expected: {expected_type}")
                    all_valid = False
            else:
                # Additional column (OK, not required to match)
                print(f"ℹ️  {col_name:20s} {data_type:20s} (additional)")
        
        print()
        print("Required Columns Check:")
        print("-" * 60)
        
        for req_col, req_type in EXPECTED_COLUMNS.items():
            if req_col in found_columns:
                print(f"✅ {req_col:20s} present")
            else:
                print(f"❌ {req_col:20s} MISSING!")
                all_valid = False
        
        print()
        
        # Check for sample data
        cursor.execute("SELECT COUNT(*) FROM execution_steps;")
        count = cursor.fetchone()[0]
        print(f"Total rows: {count}")
        
        if count > 0:
            print()
            print("Sample Row:")
            print("-" * 60)
            cursor.execute("""
                SELECT 
                    execution_id,
                    step_order,
                    success,
                    duration_ms,
                    cost,
                    tokens,
                    array_length(impulses_loaded, 1) as impulses_loaded_count,
                    array_length(impulses_created, 1) as impulses_created_count
                FROM execution_steps 
                ORDER BY created_at DESC 
                LIMIT 1;
            """)
            row = cursor.fetchone()
            if row:
                print(f"  execution_id:           {row[0]}")
                print(f"  step_order:             {row[1]}")
                print(f"  success:                {row[2]}")
                print(f"  duration_ms:            {row[3]}")
                print(f"  cost:                   {row[4]}")
                print(f"  tokens:                 {row[5]}")
                print(f"  impulses_loaded_count:  {row[6] or 0}")
                print(f"  impulses_created_count: {row[7] or 0}")
        
        cursor.close()
        conn.close()
        
        print()
        print("=" * 60)
        if all_valid:
            print("✅ Schema Valid - OpenCode can send data successfully")
        else:
            print("❌ Schema Mismatch - Migration may be needed")
        print("=" * 60)
        
        return all_valid
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = check_table_schema()
    sys.exit(0 if success else 1)
