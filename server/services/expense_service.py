from flask import request, abort, jsonify
from .database_service import get_db_connection
from .category_service import guess_category, guess_need_category
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from household_config import HOUSEHOLD_CONFIG
import pandas as pd

def read_csv(filepath, bank_type='generic'):
    """Read and parse CSV file for expense data"""
    try:
        # Check if it's an Indian bank statement
        if bank_type == 'indian' or is_indian_bank_statement(filepath):
            from .indian_bank_parser import parse_indian_bank_statement
            return parse_indian_bank_statement(filepath)
        
        # Default CSV parsing for other formats
        df = pd.read_csv(filepath)
        return df
    except Exception as e:
        raise ValueError(f"Error reading CSV file: {str(e)}")

def is_indian_bank_statement(filepath):
    """Detect if a CSV file is an Indian bank statement"""
    try:
        # Read first few rows to check format
        df_sample = pd.read_csv(filepath, nrows=5)
        columns = [col.lower() for col in df_sample.columns]
        
        # Check for Indian bank statement indicators
        indian_indicators = [
            'upi payment' in str(df_sample.values).lower(),
            '₹' in str(df_sample.values),
            'neft' in str(df_sample.values).lower(),
            'imps' in str(df_sample.values).lower(),
            any('payment type' in col for col in columns),
            any('transaction name' in col for col in columns),
        ]
        
        # If 2 or more indicators are present, likely Indian format
        return sum(indian_indicators) >= 2
        
    except Exception:
        return False

def add_expense(req):
    data = req.get_json()
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
    with get_db_connection() as conn:
        cur = conn.execute('''
            INSERT INTO expenses (date, description, amount, category, need_category, card, who, notes, split_cost, outlier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (date, description, float(amount), category, need_category, card, who, notes, split_cost, outlier))
        conn.commit()
        row_id = cur.lastrowid
    return jsonify({'success': True, 'id': row_id})

def update_expense_category(row_id, req):
    data = req.get_json()
    new_cat = data.get('category')
    if not new_cat:
        abort(400, 'Missing category')
    with get_db_connection() as conn:
        conn.execute('UPDATE expenses SET category = ? WHERE id = ?', (new_cat, row_id))
        cur = conn.execute('SELECT description FROM expenses WHERE id = ?', (row_id,))
        row = cur.fetchone()
        if row:
            desc_norm = row[0].lower().strip()
            conn.execute('INSERT OR REPLACE INTO user_overrides (description, category) VALUES (?, ?)', (desc_norm, new_cat))
            
            # Apply the same category to other expenses with identical descriptions
            # (learning from manual corrections)
            similar_cur = conn.execute('''
                UPDATE expenses 
                SET category = ? 
                WHERE LOWER(TRIM(description)) = ? AND id != ?
            ''', (new_cat, desc_norm, row_id))
            
            updated_count = similar_cur.rowcount
            print(f"Updated {updated_count} similar transactions for '{row[0]}' to category '{new_cat}'")
            
        conn.commit()
    return jsonify({'success': True, 'id': row_id, 'category': new_cat, 'similar_updated': updated_count if 'updated_count' in locals() else 0})

def update_expense_need_category(row_id, req):
    data = req.get_json()
    new_need = data.get('need_category')
    if not new_need:
        abort(400, 'Missing need_category')
    with get_db_connection() as conn:
        conn.execute('UPDATE expenses SET need_category = ? WHERE id = ?', (new_need, row_id))
        cur = conn.execute('SELECT description FROM expenses WHERE id = ?', (row_id,))
        row = cur.fetchone()
        if row:
            desc_norm = row[0].lower().strip()
            conn.execute('INSERT OR REPLACE INTO user_overrides (description, need_category) VALUES (?, ?)', (desc_norm, new_need))
        conn.commit()
    return jsonify({'success': True, 'id': row_id, 'need_category': new_need})

def patch_expense(row_id, req):
    data = req.get_json()
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
    with get_db_connection() as conn:
        conn.execute(f"UPDATE expenses SET {', '.join(updates)} WHERE id = ?", values)
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

def delete_expense(row_id):
    with get_db_connection() as conn:
        conn.execute('DELETE FROM expenses WHERE id = ?', (row_id,))
        conn.commit()
    return jsonify({'success': True, 'message': f'Row {row_id} deleted.'})

def bulk_delete_expenses(req):
    """Delete multiple expenses by their IDs"""
    data = req.get_json()
    if not data or 'ids' not in data:
        return jsonify({'error': 'No expense IDs provided'}), 400
    
    ids = data['ids']
    if not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'error': 'Invalid or empty expense IDs list'}), 400
    
    # Validate that all IDs are integers
    try:
        ids = [int(id) for id in ids]
    except (ValueError, TypeError):
        return jsonify({'error': 'All expense IDs must be valid integers'}), 400
    
    deleted_count = 0
    with get_db_connection() as conn:
        for expense_id in ids:
            cursor = conn.execute('DELETE FROM expenses WHERE id = ?', (expense_id,))
            deleted_count += cursor.rowcount
        conn.commit()
    
    return jsonify({
        'success': True, 
        'message': f'Successfully deleted {deleted_count} out of {len(ids)} expense(s).',
        'deleted_count': deleted_count,
        'requested_count': len(ids)
    })

def recategorize_all_expenses():
    with get_db_connection() as conn:
        cur = conn.execute('SELECT id, description, category FROM expenses')
        updates = []
        for row in cur.fetchall():
            row_id, desc, current_category = row
            # Normalize description to match the same format used in update_expense_category
            desc_norm = desc.lower().strip()
            
            # Check if this description has a manual override - if so, skip it
            override_cur = conn.execute('SELECT category FROM user_overrides WHERE description = ?', (desc_norm,))
            override_result = override_cur.fetchone()
            if override_result:
                continue  # Skip expenses with manual corrections
            
            # Don't override good categories from PDF parsing (non-generic ones)
            # Only re-categorize if current category is generic/default or obviously wrong
            if current_category and current_category not in ['shopping', 'other', 'uncategorized', '']:
                # Keep the PDF-assigned category unless it's clearly wrong
                continue
            
            new_cat = guess_category(desc)
            # Only update if the new category is actually different
            if new_cat != current_category:
                updates.append((new_cat, row_id))
        
        if updates:
            conn.executemany('UPDATE expenses SET category = ? WHERE id = ?', updates)
            conn.commit()
    return jsonify({'success': True, 'updated': len(updates)})
from flask import jsonify

def get_expenses():
    """Fetch all expenses from the database and return as JSON list of dicts."""
    with get_db_connection() as conn:
        cur = conn.execute('SELECT * FROM expenses')
        rows = [dict(zip([column[0] for column in cur.description], row)) for row in cur.fetchall()]
    return jsonify(rows)

def insert_expenses(df, statement_id=None):
    with get_db_connection() as conn:
        for _, row in df.iterrows():
            category = row.get('category')
            if not category or pd.isna(category):
                category = guess_category(row.get('description'))
            need_category = row.get('need_category')
            if not need_category or pd.isna(need_category):
                need_category = guess_need_category(row.get('description'), category)
            
            # Use configured default spender if not specified
            who = row.get('who')
            if not who or pd.isna(who):
                who = HOUSEHOLD_CONFIG['default_spender']
            
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
                who,
                row.get('notes'),
                split_cost,
                outlier,
                statement_id
            ))
        conn.commit()
