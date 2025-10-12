import sqlite3
from contextlib import contextmanager
try:
    from category_examples import CATEGORY_EXAMPLES
except ImportError:
    CATEGORY_EXAMPLES = {}

DB_PATH = 'expense_tracker.db'

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
        
        # Staging tables for expense review before final insertion
        conn.execute('''
            CREATE TABLE IF NOT EXISTS staging_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                statement_id INTEGER,
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
                FOREIGN KEY(statement_id) REFERENCES statements(id)
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS staging_metadata (
                statement_id INTEGER PRIMARY KEY,
                metadata TEXT,
                FOREIGN KEY(statement_id) REFERENCES statements(id)
            )
        ''')
        
        conn.commit()
