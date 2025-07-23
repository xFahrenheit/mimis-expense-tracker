
import sqlite3
from contextlib import contextmanager
import os
import subprocess
try:
    from category_examples import CATEGORY_EXAMPLES
except ImportError:
    CATEGORY_EXAMPLES = {}

# Dynamically select DB path based on git branch
def get_db_path():
    branch = os.environ.get('EXPENSE_TRACKER_BRANCH')
    if not branch:
        try:
            branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=os.path.dirname(__file__)+'/../..').decode().strip()
        except Exception:
            branch = 'main'
    if branch == 'custom-user':
        return os.path.abspath(os.path.join(os.path.dirname(__file__), '../expense_tracker_custom_user.db'))
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '../expense_tracker.db'))

DB_PATH = get_db_path()

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
        conn.commit()
