import sqlite3
from contextlib import contextmanager
try:
    from category_examples import CATEGORY_EXAMPLES
except ImportError:
    CATEGORY_EXAMPLES = {}
try:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from household_config import HOUSEHOLD_CONFIG
    DB_PATH = HOUSEHOLD_CONFIG['db_path']
except ImportError:
    # Fallback to relative path if config not available
    DB_PATH = './expense_tracker.db'

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS statements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                upload_date TEXT,
                file BLOB
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                description TEXT,
                amount REAL,
                category TEXT,
                need_category TEXT,
                card TEXT,
                who TEXT,
                notes TEXT,
                split_cost INTEGER DEFAULT 0,
                outlier INTEGER DEFAULT 0,
                statement_id INTEGER,
                FOREIGN KEY(statement_id) REFERENCES statements(id)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_overrides (
                description TEXT PRIMARY KEY,
                category TEXT,
                need_category TEXT
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS custom_categories (
                name TEXT PRIMARY KEY,
                icon TEXT DEFAULT '🏷️',
                color TEXT DEFAULT '#818cf8'
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS household_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                config_json TEXT NOT NULL
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        
        conn.commit()
