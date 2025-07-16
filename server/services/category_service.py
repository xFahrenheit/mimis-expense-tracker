from category_examples import CATEGORY_EXAMPLES
import sqlite3
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import string

DB_PATH = 'expense_tracker.db'
CATEGORY_LABELS = [
    "food", "groceries", "entertainment", "travel", "utilities", "shopping", "gifts", "medicines", "charity", "school"
]

_embedder = None
_category_embeddings = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedder

def get_category_embeddings():
    global _category_embeddings
    if _category_embeddings is None:
        embedder = get_embedder()
        _category_embeddings = []
        for cat in CATEGORY_LABELS:
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
    return CATEGORY_LABELS[best_idx]

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
