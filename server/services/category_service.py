from category_examples import CATEGORY_EXAMPLES
import sqlite3
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import string
from flask import jsonify

DB_PATH = 'expense_tracker.db'
DEFAULT_CATEGORY_LABELS = [
    "food", "groceries", "entertainment", "travel", "utilities", "shopping", "gifts", "medicines", "charity", "school"
]

_embedder = None
_category_embeddings = None
_current_categories = None

def get_all_categories():
    """Get all categories (default + custom)"""
    global _current_categories
    if _current_categories is None:
        _current_categories = DEFAULT_CATEGORY_LABELS.copy()
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute('SELECT name FROM custom_categories')
            custom_cats = [row[0] for row in cur.fetchall()]
            _current_categories.extend(custom_cats)
    return _current_categories

def refresh_categories():
    """Force refresh of category cache"""
    global _current_categories, _category_embeddings
    _current_categories = None
    _category_embeddings = None

def add_custom_category(name, icon='🏷️', color='#818cf8'):
    """Add a new custom category"""
    name = name.lower().strip()
    if not name:
        return False
    
    with sqlite3.connect(DB_PATH) as conn:
        try:
            conn.execute('INSERT INTO custom_categories (name, icon, color) VALUES (?, ?, ?)', 
                        (name, icon, color))
            conn.commit()
            refresh_categories()
            return True
        except sqlite3.IntegrityError:
            return False  # Category already exists

def update_custom_category(name, icon=None, color=None):
    """Update an existing custom category"""
    name = name.lower().strip()
    if not name:
        return False
    
    with sqlite3.connect(DB_PATH) as conn:
        # Check if category exists
        cur = conn.execute('SELECT name FROM custom_categories WHERE name = ?', (name,))
        if not cur.fetchone():
            return False
        
        # Build update query dynamically
        updates = []
        params = []
        
        if icon is not None:
            updates.append('icon = ?')
            params.append(icon)
        
        if color is not None:
            updates.append('color = ?')
            params.append(color)
        
        if not updates:
            return True  # Nothing to update
        
        params.append(name)
        query = f'UPDATE custom_categories SET {", ".join(updates)} WHERE name = ?'
        
        try:
            conn.execute(query, params)
            conn.commit()
            refresh_categories()
            return True
        except sqlite3.Error:
            return False

def delete_custom_category(name):
    """Delete a custom category"""
    name = name.lower().strip()
    if not name:
        return False
    
    # Don't allow deletion of default categories
    if name in DEFAULT_CATEGORY_LABELS:
        return False
    
    with sqlite3.connect(DB_PATH) as conn:
        try:
            # Check if category exists
            cur = conn.execute('SELECT name FROM custom_categories WHERE name = ?', (name,))
            if not cur.fetchone():
                return False
            
            # Delete the category
            conn.execute('DELETE FROM custom_categories WHERE name = ?', (name,))
            conn.commit()
            refresh_categories()
            return True
        except sqlite3.Error:
            return False

def rename_custom_category(old_name, new_name):
    """Rename a custom category"""
    old_name = old_name.lower().strip()
    new_name = new_name.lower().strip()
    
    if not old_name or not new_name:
        return False
    
    # Don't allow renaming default categories
    if old_name in DEFAULT_CATEGORY_LABELS:
        return False
    
    # Check if new name conflicts with existing categories
    all_categories = get_all_categories()
    if new_name in all_categories:
        return False
    
    with sqlite3.connect(DB_PATH) as conn:
        try:
            # Check if old category exists
            cur = conn.execute('SELECT name, icon, color FROM custom_categories WHERE name = ?', (old_name,))
            result = cur.fetchone()
            if not result:
                return False
            
            icon, color = result[1], result[2]
            
            # Update all expenses that use this category
            conn.execute('UPDATE expenses SET category = ? WHERE category = ?', (new_name, old_name))
            
            # Update the category name
            conn.execute('UPDATE custom_categories SET name = ? WHERE name = ?', (new_name, old_name))
            
            conn.commit()
            refresh_categories()
            return True
        except sqlite3.Error:
            return False

def get_category_metadata():
    """Get metadata for all categories"""
    metadata = {
        'food': {'color': '#a78bfa', 'icon': '🍔'},
        'groceries': {'color': '#22c55e', 'icon': '🛒'},
        'entertainment': {'color': '#f472b6', 'icon': '🎬'},
        'travel': {'color': '#60a5fa', 'icon': '✈️'},
        'utilities': {'color': '#fbbf24', 'icon': '💡'},
        'shopping': {'color': '#34d399', 'icon': '🛍️'},
        'gifts': {'color': '#f87171', 'icon': '🎁'},
        'medicines': {'color': '#4ade80', 'icon': '💊'},
        'charity': {'color': '#facc15', 'icon': '🤝'},
        'school': {'color': '#38bdf8', 'icon': '🎓'},
    }
    
    # Add custom categories
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute('SELECT name, icon, color FROM custom_categories')
            for row in cur.fetchall():
                name, icon, color = row
                metadata[name] = {'icon': icon, 'color': color}
    except sqlite3.OperationalError as e:
        print(f"Warning: Could not load custom categories: {e}")
        # Initialize the database if table doesn't exist
        from . import database_service
        database_service.init_db()
    
    return metadata

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedder

def get_category_embeddings():
    global _category_embeddings
    if _category_embeddings is None:
        embedder = get_embedder()
        categories = get_all_categories()
        _category_embeddings = []
        for cat in categories:
            examples = CATEGORY_EXAMPLES.get(cat, [cat])
            example_embeds = embedder.encode(examples)
            avg_embed = example_embeds.mean(axis=0)
            _category_embeddings.append(avg_embed)
        _category_embeddings = np.stack(_category_embeddings)
    return _category_embeddings

def normalize_merchant(s):
    return ''.join(c for c in s.lower() if c not in string.punctuation and not c.isspace())

def guess_category(description):
    desc = (description or "").strip()
    if not desc:
        return "shopping"
    desc_norm = desc.lower().strip()
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT category FROM user_overrides WHERE description = ?', (desc_norm,))
        row = cur.fetchone()
        if row:
            return row[0]
    # Use MERCHANT_MAP if available
    try:
        from category_examples import MERCHANT_MAP
    except ImportError:
        MERCHANT_MAP = {}
    desc_norm_merchant = normalize_merchant(desc)
    for merchant, cat in MERCHANT_MAP.items():
        if normalize_merchant(merchant) in desc_norm_merchant:
            return cat
    embedder = get_embedder()
    cat_embeds = get_category_embeddings()
    if cat_embeds is None or len(cat_embeds) == 0:
        return "shopping"
    desc_embed = embedder.encode([desc])[0]
    from sklearn.metrics.pairwise import cosine_similarity
    sims = cosine_similarity([desc_embed], cat_embeds)[0]
    best_idx = sims.argmax()
    categories = get_all_categories()
    return categories[best_idx]

def guess_need_category(description, category=None):
    desc = (description or '').strip().lower()
    if not desc:
        return 'Need'
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT need_category FROM user_overrides WHERE description = ?', (desc,))
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    NEED_CATEGORIES = {'groceries', 'utilities', 'medicines', 'school', 'charity'}
    if category and isinstance(category, str) and category.lower() in NEED_CATEGORIES:
        return 'Need'
    LUXURY_KEYWORDS = ['entertainment', 'shopping', 'gift', 'restaurant', 'movie', 'cinema', 'concert', 'amusement', 'bowling', 'show', 'mall', 'netflix', 'theater']
    if any(word in desc for word in LUXURY_KEYWORDS):
        return 'Luxury'
    return 'Need'
