import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # Simple check to see if database queries exist
    if 'getDb()' not in content and 'new Database(' not in content and '.prepare(' not in content:
        return False
        
    print(f"Refactoring {filepath}...")
    
    # 1. Replace Database import with libsql client
    content = re.sub(r'import Database from ["\']better-sqlite3["\'];?', 
                     'import { createClient } from "@libsql/client";\nimport { getDb } from "@/lib/db";', 
                     content)
                     
    # ... Wait, if they import getDb, we don't need createClient everywhere.
    
    with open(filepath, 'w') as f:
        f.write(content)
        
    return True

