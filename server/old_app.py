# (Removed duplicate/stray text_to_sql endpoint at the top. The correct one is after app = Flask(__name__))




# --- Text to SQL Analytics Endpoint ---
# Place this after app = Flask(__name__)
import os
import sqlite3
import pandas as pd
import pdfplumber
import re
import string
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
from datetime import datetime

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from category_examples import CATEGORY_EXAMPLES


UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'pdf'}
DB_PATH = 'expense_tracker.db'

CATEGORY_LABELS = [
    "food", "groceries", "entertainment", "travel", "utilities", "shopping", "gifts", "medicines", "charity", "school"
]

# --- Merchant map for high-confidence categorization ---
MERCHANT_MAP = {
    # Groceries
    "aldi": "groceries",
    "whole foods": "groceries",
    "trader joe": "groceries",
    "wegmans": "groceries",
    "shoprite": "groceries",
    "stop & shop": "groceries",
    # Shopping
    "jcpenny": "shopping",
    "macys": "shopping",
    "forever21": "shopping",
    "shoe dept": "shopping",
    # Food
    "bent spoon": "food",
    "starbucks": "food",
    "chipotle": "food",
    "junbi": "food",
    # Charity
    "red cross": "charity",
    # Add more as needed
}





# --- Flask app initialization (keep only one, right after config/constants) ---
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- DELETE ENDPOINTS (moved here after app is defined) ---

# --- Text to SQL Analytics Endpoint ---
@app.route('/text_to_sql', methods=['POST'])
def text_to_sql():
    data = request.get_json()
    question = data.get('question', '').lower().strip()
    if not question:
        return jsonify({'error': 'No question provided'}), 400
    # Simple ruleset for demo (expand as needed)
    sql = None
    chartType = 'pie'
    label_col = None
    value_col = None
    # --- Rules ---
    if 'category' in question:
        sql = "SELECT category, SUM(amount) FROM expenses GROUP BY category"
        label_col = 'category'; value_col = 'SUM(amount)'
        chartType = 'pie'
    elif 'need' in question or 'luxury' in question:
        sql = "SELECT need_category, SUM(amount) FROM expenses GROUP BY need_category"
        label_col = 'need_category'; value_col = 'SUM(amount)'
        chartType = 'pie'
    elif 'gautami' in question or 'ameya' in question or 'spender' in question or 'who' in question:
        sql = "SELECT who, SUM(amount) FROM expenses GROUP BY who"
        label_col = 'who'; value_col = 'SUM(amount)'
        chartType = 'pie'
    elif 'month' in question:
        sql = "SELECT substr(date,1,7) as month, SUM(amount) FROM expenses GROUP BY month"
        label_col = 'month'; value_col = 'SUM(amount)'
        chartType = 'bar'
    elif 'card' in question:
        sql = "SELECT card, SUM(amount) FROM expenses GROUP BY card"
        label_col = 'card'; value_col = 'SUM(amount)'
        chartType = 'pie'
    elif 'top' in question and 'merchant' in question:
        sql = "SELECT description, SUM(amount) FROM expenses GROUP BY description ORDER BY SUM(amount) DESC LIMIT 10"
        label_col = 'description'; value_col = 'SUM(amount)'
        chartType = 'bar'
    else:
        # Fallback: try to select all expenses
        sql = "SELECT * FROM expenses LIMIT 100"
    # --- Execute SQL ---
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(sql)
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]
    except Exception as e:
        return jsonify({'error': f'SQL error: {e}'})
    # --- Format response ---
    if label_col and value_col:
        label_idx = columns.index(label_col)
        value_idx = columns.index(value_col)
        labels = [str(r[label_idx]) for r in rows]
        values = [float(r[value_idx]) for r in rows]
        return jsonify({'labels': labels, 'values': values, 'chartType': chartType})
    else:
        # Return as table
        return jsonify({'columns': columns, 'rows': rows})
@app.route('/delete_all_expenses', methods=['DELETE'])
def delete_all_expenses():
    print('DELETE /delete_all_expenses endpoint loaded')
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('DELETE FROM expenses')
        conn.execute('DELETE FROM statements')
        conn.execute('DELETE FROM user_overrides')
        conn.commit()
    return jsonify({'success': True, 'message': 'All data deleted.'})

@app.route('/statement/<int:statement_id>', methods=['DELETE'])
def delete_statement(statement_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('DELETE FROM expenses WHERE statement_id = ?', (statement_id,))
        conn.execute('DELETE FROM statements WHERE id = ?', (statement_id,))
        conn.commit()
    return jsonify({'success': True, 'message': f'Statement {statement_id} and its expenses deleted.'})



UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'pdf'}
DB_PATH = 'expense_tracker.db'

CATEGORY_LABELS = [
    "food", "groceries", "entertainment", "travel", "utilities", "shopping", "gifts", "medicines", "charity", "school"
]

# --- Merchant map for high-confidence categorization ---
MERCHANT_MAP = {
    # Groceries
    "aldi": "groceries",
    "whole foods": "groceries",
    "trader joe": "groceries",
    "wegmans": "groceries",
    "shoprite": "groceries",
    "stop & shop": "groceries",
    # Shopping
    "jcpenny": "shopping",
    "macys": "shopping",
    "forever21": "shopping",
    "shoe dept": "shopping",
    # Food
    "bent spoon": "food",
    "starbucks": "food",
    "chipotle": "food",
    "junbi": "food",
    # Charity
    "red cross": "charity",
    # Add more as needed
}




def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
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

@app.route('/upload', methods=['POST'])
def upload_statement():
    if 'statement' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['statement']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Check for duplicate filename in statements table
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute('SELECT 1 FROM statements WHERE filename = ?', (filename,))
            if cur.fetchone():
                return jsonify({'error': 'Duplicate file', 'duplicate': True, 'filename': filename}), 409
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        ext = filename.rsplit('.', 1)[1].lower()
        statement_id = None
        # Get card value from form (dropdown or custom)
        card = request.form.get('card')
        custom_card = request.form.get('custom_card')
        if card == 'other' and custom_card:
            card = custom_card.strip()
        if ext == 'pdf':
            # Store PDF in DB
            with open(filepath, 'rb') as f:
                pdf_bytes = f.read()
            with sqlite3.connect(DB_PATH) as conn:
                cur = conn.execute(
                    'INSERT INTO statements (filename, upload_date, file) VALUES (?, ?, ?)',
                    (filename, datetime.now().isoformat(), pdf_bytes)
                )
                statement_id = cur.lastrowid
            df = parse_pdf(filepath)
        elif ext == 'csv':
            df = pd.read_csv(filepath)
        else:
            os.remove(filepath)
            return jsonify({'error': 'Unsupported file type'}), 400
        # Autofill card column for all rows if card is provided
        if card:
            df['card'] = card
        insert_expenses(df, statement_id)
        os.remove(filepath)
        # Auto-cleanup null/empty rows after upload
        cleanup_null_rows()
        return jsonify({'success': True, 'count': len(df)})
    return jsonify({'error': 'Invalid file'}), 400

def parse_pdf(filepath):
    FIELD_MAP = {
        'date': ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'posted date'],
        'description': ['description', 'transaction description', 'details', 'merchant', 'narration'],
        'amount': ['amount', 'transaction amount', 'debit', 'credit', 'amt'],
        'category': ['category', 'type'],
        'card': ['card', 'account', 'card number'],
        'who': ['who', 'spender', 'user'],
        'notes': ['notes', 'memo', 'remarks'],
    }
    def map_header(header):
        h = header.strip().lower()
        for field, options in FIELD_MAP.items():
            if any(opt in h for opt in options):
                return field
        return h

    def parse_month_day(md_str, year=None):
        # Convert 'Apr 26' to 'YYYY-MM-DD'
        try:
            if not year:
                year = datetime.now().year
            return datetime.strptime(f"{md_str} {year}", "%b %d %Y").strftime("%Y-%m-%d")
        except Exception:
            return md_str

    rows = []
    found_table = False
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                # Find header row
                header_row = None
                for i, row in enumerate(table[:3]):
                    if any(re.search(r'date|desc|amount|debit|credit', str(cell or '').lower()) for cell in row):
                        header_row = i
                        break
                if header_row is None:
                    continue
                headers = [map_header(str(h or '')) for h in table[header_row]]
                for row in table[header_row+1:]:
                    if not any(row):
                        continue
                    record = dict(zip(headers, row))
                    # Use 'trans date' or 'date' as the date
                    date_val = record.get('date') or record.get('trans date')
                    if date_val and re.match(r'^[A-Za-z]{3} \d{1,2}$', date_val.strip()):
                        date_val = parse_month_day(date_val.strip())
                    record['date'] = date_val
                    if record.get('date') and record.get('description') and record.get('amount'):
                        amt = str(record['amount']).replace('$','').replace(',','').replace('(','-').replace(')','').strip()
                        try:
                            record['amount'] = float(amt)
                        except Exception:
                            continue
                        rows.append(record)
                found_table = True
    if rows:
        print('PDF Table Headers:', list(rows[0].keys()))
        print('Sample rows:', rows[:3])
    # Fallback: regex line extraction for Capital One-like lines
    if not found_table or not rows:
        print('No valid tables found, falling back to regex line extraction.')
        all_text = "\n".join(page.extract_text() or '' for page in pdf.pages)
        lines = all_text.splitlines()
        print('--- PDF Extracted Text Sample (first 20 lines) ---')
        for l in lines[:20]:
            print(l)
        print('--- End of Sample ---')
        # Example: Apr 26 Apr 28 JCPENNEY 0700TRENTONNJ $12.25
        line_re = re.compile(r"([A-Za-z]{3} \d{1,2})\s+[A-Za-z]{3} \d{1,2}\s+(.+?)\s+\$([\d.]+)")
        for line in lines:
            m = line_re.search(line)
            if m:
                date, desc, amt = m.groups()
                date = parse_month_day(date)
                try:
                    amt = float(amt)
                except Exception:
                    continue
                rows.append({'date': date, 'description': desc, 'amount': amt})
        print('Regex fallback found rows:', rows[:3])
    return pd.DataFrame(rows)

def insert_expenses(df, statement_id=None):
    with sqlite3.connect(DB_PATH) as conn:
        for _, row in df.iterrows():
            category = row.get('category')
            if not category or pd.isna(category):
                category = guess_category(row.get('description'))
            need_category = row.get('need_category')
            if not need_category or pd.isna(need_category):
                need_category = guess_need_category(row.get('description'), category)
            split_cost = int(bool(row.get('split_cost', False)))
            outlier = int(bool(row.get('outlier', False)))
            conn.execute('''
                INSERT INTO expenses (date, description, amount, category, need_category, card, who, notes, split_cost, outlier, statement_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row.get('date'),
                row.get('description'),
                float(row.get('amount', 0)),
                category,
                need_category,
                row.get('card'),
                row.get('who'),
                row.get('notes'),
                split_cost,
                outlier,
                statement_id
            ))
        conn.commit()

# --- Need/Luxury categorization ---
def guess_need_category(description, category=None):
    desc = (description or '').strip().lower()
    if not desc:
        return 'Need'
    # 1. User override check
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT need_category FROM user_overrides WHERE description = ?', (desc,))
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    # 2. Heuristic: certain categories are always needs
    NEED_CATEGORIES = {'groceries', 'utilities', 'medicines', 'school', 'charity'}
    if category and category.lower() in NEED_CATEGORIES:
        return 'Need'
    # 3. LLM/embedding fallback (simple, can be improved)
    # For now, use keywords. You can replace with embedding logic if desired.
    LUXURY_KEYWORDS = ['entertainment', 'shopping', 'gift', 'restaurant', 'movie', 'cinema', 'concert', 'amusement', 'bowling', 'show', 'mall', 'netflix', 'theater']
    if any(word in desc for word in LUXURY_KEYWORDS):
        return 'Luxury'
    return 'Need'
# --- PATCH endpoint for updating category ---
@app.route('/expense/<int:row_id>/need_category', methods=['PATCH'])
def update_expense_need_category(row_id):
    data = request.get_json()
    new_need = data.get('need_category')
    if not new_need:
        abort(400, 'Missing need_category')
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('UPDATE expenses SET need_category = ? WHERE id = ?', (new_need, row_id))
        # Also store the override for this description
        cur = conn.execute('SELECT description FROM expenses WHERE id = ?', (row_id,))
        row = cur.fetchone()
        if row:
            desc_norm = row[0].lower().strip()
            conn.execute('INSERT OR REPLACE INTO user_overrides (description, need_category) VALUES (?, ?)', (desc_norm, new_need))
        conn.commit()
    return jsonify({'success': True, 'id': row_id, 'need_category': new_need})
@app.route('/expense', methods=['POST'])
def add_expense():
    data = request.get_json()
    date = data.get('date')
    description = data.get('description')
    amount = data.get('amount')
    category = data.get('category')
    need_category = data.get('need_category')
    card = data.get('card')
    who = data.get('who')
    notes = data.get('notes')
    split_cost = int(bool(data.get('split_cost', False)))
    outlier = int(bool(data.get('outlier', False)))
    if not date or not description or not amount:
        return jsonify({'error': 'Missing required fields'}), 400
    if not category:
        category = guess_category(description)
    if not need_category:
        need_category = guess_need_category(description, category)
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('''
            INSERT INTO expenses (date, description, amount, category, need_category, card, who, notes, split_cost, outlier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (date, description, float(amount), category, need_category, card, who, notes, split_cost, outlier))
        conn.commit()
        row_id = cur.lastrowid
    return jsonify({'success': True, 'id': row_id})


# --- Embedding cache for efficiency ---
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
        import numpy as np
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
    # 1. User override check (exact match, normalized)
    desc_norm = desc.lower().strip()
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT category FROM user_overrides WHERE description = ?', (desc_norm,))
        row = cur.fetchone()
        if row:
            return row[0]
    # 2. Merchant map check (robust normalization)
    desc_norm_merchant = normalize_merchant(desc)
    for merchant, cat in MERCHANT_MAP.items():
        if normalize_merchant(merchant) in desc_norm_merchant:
            return cat
    # 3. LLM/embedding fallback
    embedder = get_embedder()
    import numpy as np
    cat_embeds = get_category_embeddings()
    desc_embed = embedder.encode([desc])[0]
    from sklearn.metrics.pairwise import cosine_similarity
    sims = cosine_similarity([desc_embed], cat_embeds)[0]
    best_idx = sims.argmax()
    return CATEGORY_LABELS[best_idx]

# --- Re-categorize all expenses endpoint ---
@app.route('/recategorize', methods=['POST'])
def recategorize_all_expenses():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT id, description FROM expenses')
        updates = []
        for row in cur.fetchall():
            row_id, desc = row
            new_cat = guess_category(desc)
            updates.append((new_cat, row_id))
        conn.executemany('UPDATE expenses SET category = ? WHERE id = ?', updates)
        conn.commit()
    return jsonify({'success': True, 'updated': len(updates)})

# --- PATCH endpoint for updating category ---
from flask import abort

@app.route('/expense/<int:row_id>/category', methods=['PATCH'])
def update_expense_category(row_id):
    data = request.get_json()
    new_cat = data.get('category')
    if not new_cat:
        abort(400, 'Missing category')
    with sqlite3.connect(DB_PATH) as conn:
        # Update the expense row
        conn.execute('UPDATE expenses SET category = ? WHERE id = ?', (new_cat, row_id))
        # Also store the override for this description
        cur = conn.execute('SELECT description FROM expenses WHERE id = ?', (row_id,))
        row = cur.fetchone()
        if row:
            desc_norm = row[0].lower().strip()
            conn.execute('INSERT OR REPLACE INTO user_overrides (description, category) VALUES (?, ?)', (desc_norm, new_cat))
        conn.commit()
    return jsonify({'success': True, 'id': row_id, 'category': new_cat})

@app.route('/expenses', methods=['GET'])
def get_expenses():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT * FROM expenses')
        rows = [dict(zip([column[0] for column in cur.description], row)) for row in cur.fetchall()]
    return jsonify(rows)

@app.route('/cleanup', methods=['POST'])
def cleanup_null_rows():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('''
            DELETE FROM expenses
            WHERE date IS NULL OR date = ''
               OR description IS NULL OR description = ''
               OR amount IS NULL OR amount = ''
        ''')
        conn.commit()
    return jsonify({'success': True, 'message': 'Null/empty/zero rows deleted.'})

@app.route('/expense/<int:row_id>', methods=['DELETE'])
def delete_expense(row_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('DELETE FROM expenses WHERE id = ?', (row_id,))
        conn.commit()
    return jsonify({'success': True, 'message': f'Row {row_id} deleted.'})

# PATCH endpoint for full row update (edit all fields)
@app.route('/expense/<int:row_id>', methods=['PATCH'])
def patch_expense(row_id):
    data = request.get_json()
    fields = ['date', 'description', 'amount', 'category', 'need_category', 'card', 'who', 'notes', 'split_cost', 'outlier']
    updates = []
    values = []
    for f in fields:
        if f in data:
            updates.append(f"{f} = ?")
            values.append(data[f])
    if not updates:
        return jsonify({'error': 'No fields to update'}), 400
    values.append(row_id)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(f"UPDATE expenses SET {', '.join(updates)} WHERE id = ?", values)
        # If category or need_category changed, update user_overrides
        if 'category' in data or 'need_category' in data:
            cur = conn.execute('SELECT description FROM expenses WHERE id = ?', (row_id,))
            row = cur.fetchone()
            if row:
                desc_norm = row[0].lower().strip()
                cat = data.get('category')
                need = data.get('need_category')
                if cat:
                    conn.execute('INSERT OR REPLACE INTO user_overrides (description, category) VALUES (?, ?)', (desc_norm, cat))
                if need:
                    conn.execute('INSERT OR REPLACE INTO user_overrides (description, need_category) VALUES (?, ?)', (desc_norm, need))
        conn.commit()
    return jsonify({'success': True, 'id': row_id})

@app.route('/')
def serve_index():
    return send_from_directory('../html', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('../html', filename)

# --- Statement List & Re-import Endpoints ---
@app.route('/statements', methods=['GET'])
def list_statements():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT id, filename, upload_date FROM statements ORDER BY upload_date DESC')
        rows = [dict(zip([column[0] for column in cur.description], row)) for row in cur.fetchall()]
    return jsonify(rows)

@app.route('/statement/<int:statement_id>/reimport', methods=['POST'])
def reimport_statement(statement_id):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute('SELECT filename, file FROM statements WHERE id = ?', (statement_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Statement not found'}), 404
        filename, file_bytes = row
        ext = filename.rsplit('.', 1)[-1].lower()
        # Save file temporarily
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f'_reimport_{statement_id}.{ext}')
        with open(temp_path, 'wb') as f:
            f.write(file_bytes)
        # Parse and insert
        if ext == 'pdf':
            df = parse_pdf(temp_path)
        elif ext == 'csv':
            df = pd.read_csv(temp_path)
        else:
            os.remove(temp_path)
            return jsonify({'error': 'Unsupported file type'}), 400
        insert_expenses(df, statement_id)
        os.remove(temp_path)
    return jsonify({'success': True, 'count': len(df)})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=3001, debug=True)
