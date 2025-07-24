import sqlite3
import string
import numpy as np
from flask import jsonify
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from category_examples import CATEGORY_EXAMPLES

DB_PATH = 'expense_tracker.db'
DEFAULT_CATEGORY_LABELS = [
    "food", "groceries", "entertainment", "travel", "utilities",
    "shopping", "gifts", "medicines", "charity", "school"
]

# Caches
_embedder = None
_category_embeddings = None
_current_categories = None

# --------------------------- #
#      Utility Functions      #
# --------------------------- #

def normalize_merchant(text):
    """Normalize merchant string for comparison."""
    return ''.join(c for c in text.lower() if c not in string.punctuation and not c.isspace())

def get_embedder():
    """Lazy-load and return the sentence embedder."""
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('all-mpnet-base-v2')
    return _embedder

def refresh_categories():
    """Clear cached category names and embeddings."""
    global _current_categories, _category_embeddings
    _current_categories = None
    _category_embeddings = None

# --------------------------- #
#   Category DB Operations    #
# --------------------------- #

def get_all_categories():
    """Return all categories (default + custom from DB)."""
    global _current_categories
    if _current_categories is None:
        _current_categories = DEFAULT_CATEGORY_LABELS.copy()
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute('SELECT name FROM custom_categories').fetchall()
            _current_categories.extend(row[0] for row in rows)
    return _current_categories

def add_custom_category(name, icon='🏷️', color='#818cf8'):
    """Add a custom category to the database."""
    name = name.lower().strip()
    if not name:
        return False
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                'INSERT INTO custom_categories (name, icon, color) VALUES (?, ?, ?)',
                (name, icon, color)
            )
            conn.commit()
            refresh_categories()
            return True
    except sqlite3.IntegrityError:
        return False  # Category already exists

def update_custom_category(name, icon=None, color=None):
    """Update icon or color for an existing custom category."""
    name = name.lower().strip()
    if not name:
        return False

    updates, params = [], []
    if icon is not None:
        updates.append('icon = ?')
        params.append(icon)
    if color is not None:
        updates.append('color = ?')
        params.append(color)
    if not updates:
        return True

    try:
        with sqlite3.connect(DB_PATH) as conn:
            if not conn.execute('SELECT 1 FROM custom_categories WHERE name = ?', (name,)).fetchone():
                return False
            params.append(name)
            conn.execute(f'UPDATE custom_categories SET {", ".join(updates)} WHERE name = ?', params)
            conn.commit()
            refresh_categories()
            return True
    except sqlite3.Error:
        return False

def delete_custom_category(name):
    """Delete a custom category, unless it's a default one."""
    name = name.lower().strip()
    if not name or name in DEFAULT_CATEGORY_LABELS:
        return False

    try:
        with sqlite3.connect(DB_PATH) as conn:
            if not conn.execute('SELECT 1 FROM custom_categories WHERE name = ?', (name,)).fetchone():
                return False
            conn.execute('DELETE FROM custom_categories WHERE name = ?', (name,))
            conn.commit()
            refresh_categories()
            return True
    except sqlite3.Error:
        return False

def rename_custom_category(old_name, new_name):
    """Rename a custom category, including updating expenses."""
    old_name, new_name = old_name.lower().strip(), new_name.lower().strip()
    if not old_name or not new_name or old_name in DEFAULT_CATEGORY_LABELS:
        return False
    if new_name in get_all_categories():
        return False

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                'SELECT icon, color FROM custom_categories WHERE name = ?', (old_name,))
            result = cur.fetchone()
            if not result:
                return False

            conn.execute('UPDATE expenses SET category = ? WHERE category = ?', (new_name, old_name))
            conn.execute('UPDATE custom_categories SET name = ? WHERE name = ?', (new_name, old_name))
            conn.commit()
            refresh_categories()
            return True
    except sqlite3.Error:
        return False

# --------------------------- #
#     Category Inference      #
# --------------------------- #

def get_category_metadata():
    """Return metadata (icon, color) for all categories."""
    base = {
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
    with sqlite3.connect(DB_PATH) as conn:
        for name, icon, color in conn.execute('SELECT name, icon, color FROM custom_categories'):
            base[name] = {'icon': icon, 'color': color}
    return base

def get_category_embeddings():
    """Generate and cache category embeddings from examples."""
    global _category_embeddings
    if _category_embeddings is None:
        embedder = get_embedder()
        embeddings = []
        for cat in get_all_categories():
            examples = CATEGORY_EXAMPLES.get(cat, [cat])
            avg_embedding = np.mean(embedder.encode(examples), axis=0)
            embeddings.append(avg_embedding)
        _category_embeddings = np.stack(embeddings)
    return _category_embeddings

def guess_category(description):
    """Guess category for a given expense description."""
    desc = (description or "").strip()
    if not desc:
        return "shopping"

    desc_norm = desc.lower().strip()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute('SELECT category FROM user_overrides WHERE description = ?', (desc_norm,)).fetchone()
        if row:
            return row[0]

    try:
        from category_examples import MERCHANT_MAP
    except ImportError:
        MERCHANT_MAP = {}

    desc_norm_merchant = normalize_merchant(desc)
    for merchant, cat in MERCHANT_MAP.items():
        if normalize_merchant(merchant) in desc_norm_merchant:
            return cat

    embedder = get_embedder()
    desc_embed = embedder.encode([desc])[0]
    cat_embeddings = get_category_embeddings()

    if cat_embeddings is None or not len(cat_embeddings):
        return "shopping"

    sims = cosine_similarity([desc_embed], cat_embeddings)[0]
    best_idx = np.argmax(sims)
    return get_all_categories()[best_idx]

def guess_need_category(description, category=None):
    """Determine if a transaction is a 'Need' or 'Luxury'."""
    desc = (description or "").strip().lower()
    if not desc:
        return 'Need'

    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute('SELECT need_category FROM user_overrides WHERE description = ?', (desc,)).fetchone()
        if row and row[0]:
            return row[0]

    NEED_CATEGORIES = {'groceries', 'utilities', 'medicines', 'school', 'charity'}
    if category and isinstance(category, str) and category.lower() in NEED_CATEGORIES:
        return 'Need'

    LUXURY_KEYWORDS = [
        'entertainment', 'shopping', 'gift', 'restaurant', 'movie', 'cinema',
        'concert', 'amusement', 'bowling', 'show', 'mall', 'netflix', 'theater'
    ]
    return 'Luxury' if any(word in desc for word in LUXURY_KEYWORDS) else 'Need'
