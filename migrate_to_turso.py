import sqlite3
import urllib.request
import json
import os
import re
import sys

def get_turso_creds():
    env = open('.env.local').read()
    token = re.search(r'TURSO_AUTH_TOKEN="(.*?)"', env).group(1)
    url = re.search(r'TURSO_DATABASE_URL="libsql://(.*?)"', env).group(1)
    return token, url

def execute_batch(token, url, statements):
    req = urllib.request.Request(
        f"https://{url}/v2/pipeline",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps({"requests": statements + [{"type": "close"}]}).encode("utf-8")
    )
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read())
        for result in res["results"]:
            if result["type"] == "error":
                print("Error in batch:", result["error"])
        return res

def migrate_table(cursor, table_name, token, url):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns_info = cursor.fetchall()
    columns = [col[1] for col in columns_info]
    
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    if not rows:
        print(f"Table {table_name} is empty, skipping.")
        return

    print(f"Migrating {len(rows)} rows for table {table_name}...")
    
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        statements = []
        for row in batch:
            args = []
            for val in row:
                if val is None:
                    args.append({"type": "null"})
                elif isinstance(val, int):
                    args.append({"type": "integer", "value": str(val)})
                elif isinstance(val, float):
                    args.append({"type": "float", "value": val})
                else:
                    args.append({"type": "text", "value": str(val)})
            
            stmt = {
                "type": "execute",
                "stmt": {
                    "sql": f"INSERT OR IGNORE INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(['?'] * len(columns))})",
                    "args": args
                }
            }
            statements.append(stmt)
        
        execute_batch(token, url, statements)

try:
    token, url = get_turso_creds()
    conn = sqlite3.connect('xreso.db')
    cursor = conn.cursor()
    
    # Ordered by dependencies roughly
    tables = [
        "users", "categories", "notes", "tags", "note_tags", "bookmarks", "views", "reports",
        "advanced_tracks", "advanced_track_topics", "advanced_track_resources", "advanced_track_resource_tags"
    ]
    
    for table in tables:
        try:
            migrate_table(cursor, table, token, url)
        except Exception as e:
            print(f"Error migrating {table}: {e}")
            
    print("Migration complete!")
except Exception as e:
    print("Fatal error:", e)
    import traceback
    traceback.print_exc()
