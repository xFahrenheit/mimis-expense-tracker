from flask import request, abort, jsonify
from .database_service import get_db_connection
from .category_service import guess_category, guess_need_category
from . import expense_service
import pandas as pd
import json

def save_staging_data(statement_id, df, metadata=None):
    """Save parsed statement data to staging table for user review"""
    with get_db_connection() as conn:
        # Clear any existing staging data for this statement
        conn.execute('DELETE FROM staging_expenses WHERE statement_id = ?', (statement_id,))
        
        for _, row in df.iterrows():
            category = row.get('category')
            if not category or pd.isna(category):
                category = guess_category(row.get('description'))
            
            need_category = row.get('need_category')
            if not need_category or pd.isna(need_category):
                need_category = guess_need_category(row.get('description'), category)
            
            # Default spender from metadata if provided
            who = row.get('who')
            if not who or pd.isna(who):
                who = metadata.get('default_spender') if metadata else 'Gautami'
            
            split_cost = int(bool(row.get('split_cost', False)))
            outlier = int(bool(row.get('outlier', False)))
            
            conn.execute('''
                INSERT INTO staging_expenses (
                    statement_id, date, description, amount, category, need_category, 
                    card, who, notes, split_cost, outlier
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                statement_id,
                row.get('date'),
                row.get('description'),
                float(row.get('amount', 0)),
                category,
                need_category,
                row.get('card'),
                who,
                row.get('notes'),
                split_cost,
                outlier
            ))
        
        # Store metadata
        if metadata:
            conn.execute('''
                INSERT OR REPLACE INTO staging_metadata (statement_id, metadata)
                VALUES (?, ?)
            ''', (statement_id, json.dumps(metadata)))
        
        conn.commit()

def get_staging_data(statement_id):
    """Get staging data for a specific statement"""
    with get_db_connection() as conn:
        # Get statement info
        stmt_cur = conn.execute(
            'SELECT filename, upload_date FROM statements WHERE id = ?', 
            (statement_id,)
        )
        statement_info = stmt_cur.fetchone()
        
        if not statement_info:
            return None
            
        # Get staging expenses
        exp_cur = conn.execute(
            'SELECT * FROM staging_expenses WHERE statement_id = ? ORDER BY date DESC', 
            (statement_id,)
        )
        expenses = [dict(zip([column[0] for column in exp_cur.description], row)) 
                   for row in exp_cur.fetchall()]
        
        # Get metadata
        meta_cur = conn.execute(
            'SELECT metadata FROM staging_metadata WHERE statement_id = ?', 
            (statement_id,)
        )
        metadata_row = meta_cur.fetchone()
        metadata = json.loads(metadata_row[0]) if metadata_row else {}
        
        return {
            'statement_id': statement_id,
            'filename': statement_info[0],
            'upload_date': statement_info[1],
            'expenses': expenses,
            'metadata': metadata
        }

def update_staging_expense(staging_id, data):
    """Update a staging expense"""
    fields = ['date', 'description', 'amount', 'category', 'need_category', 'card', 'who', 'notes', 'split_cost', 'outlier']
    updates = []
    values = []
    
    for field in fields:
        if field in data:
            updates.append(f"{field} = ?")
            values.append(data[field])
    
    if not updates:
        return jsonify({'error': 'No fields to update'}), 400
    
    values.append(staging_id)
    
    with get_db_connection() as conn:
        conn.execute(f"UPDATE staging_expenses SET {', '.join(updates)} WHERE id = ?", values)
        
        # Update user overrides if category or need_category changed
        if 'category' in data or 'need_category' in data:
            cur = conn.execute('SELECT description FROM staging_expenses WHERE id = ?', (staging_id,))
            row = cur.fetchone()
            if row:
                desc_norm = row[0].lower().strip()
                if 'category' in data:
                    conn.execute('INSERT OR REPLACE INTO user_overrides (description, category) VALUES (?, ?)', 
                               (desc_norm, data['category']))
                if 'need_category' in data:
                    conn.execute('INSERT OR REPLACE INTO user_overrides (description, need_category) VALUES (?, ?)', 
                               (desc_norm, data['need_category']))
        
        conn.commit()
    
    return jsonify({'success': True, 'id': staging_id})

def delete_staging_expense(staging_id):
    """Delete a staging expense"""
    with get_db_connection() as conn:
        conn.execute('DELETE FROM staging_expenses WHERE id = ?', (staging_id,))
        conn.commit()
    
    return jsonify({'success': True, 'message': f'Staging expense {staging_id} deleted.'})

def recategorize_staging_expenses(statement_id):
    """Recategorize all staging expenses for a statement"""
    with get_db_connection() as conn:
        cur = conn.execute('SELECT id, description FROM staging_expenses WHERE statement_id = ?', (statement_id,))
        updates = []
        for row in cur.fetchall():
            staging_id, desc = row
            new_cat = guess_category(desc)
            new_need = guess_need_category(desc, new_cat)
            updates.append((new_cat, new_need, staging_id))
        
        conn.executemany('UPDATE staging_expenses SET category = ?, need_category = ? WHERE id = ?', updates)
        conn.commit()
    
    return jsonify({'success': True, 'updated': len(updates)})

def approve_staging_data(statement_id):
    """Move staging data to the main expenses table using existing expense service logic"""
    with get_db_connection() as conn:
        # Get all staging expenses for this statement
        cur = conn.execute('''
            SELECT date, description, amount, category, need_category, card, who, notes, split_cost, outlier
            FROM staging_expenses WHERE statement_id = ? ORDER BY date
        ''', (statement_id,))
        
        staging_expenses = cur.fetchall()
        
        if not staging_expenses:
            return jsonify({'error': 'No staging expenses found for this statement'}), 404
        
        # Convert staging data to DataFrame format expected by expense_service
        expense_data = []
        for expense in staging_expenses:
            expense_dict = {
                'date': expense[0],
                'description': expense[1],
                'amount': expense[2],
                'category': expense[3],
                'need_category': expense[4],
                'card': expense[5],
                'who': expense[6],
                'notes': expense[7],
                'split_cost': expense[8],
                'outlier': expense[9]
            }
            expense_data.append(expense_dict)
        
        # Create DataFrame
        df = pd.DataFrame(expense_data)
        
        # Use existing expense service logic to insert the data
        expense_service.insert_expenses(df, statement_id)
        
        # Clean up staging data
        conn.execute('DELETE FROM staging_expenses WHERE statement_id = ?', (statement_id,))
        conn.execute('DELETE FROM staging_metadata WHERE statement_id = ?', (statement_id,))
        
        conn.commit()
    
    return jsonify({'success': True, 'message': f'Approved {len(staging_expenses)} expenses from statement {statement_id}'})

def cancel_staging_data(statement_id):
    """Cancel staging and delete the statement"""
    with get_db_connection() as conn:
        # Clean up staging data
        conn.execute('DELETE FROM staging_expenses WHERE statement_id = ?', (statement_id,))
        conn.execute('DELETE FROM staging_metadata WHERE statement_id = ?', (statement_id,))
        
        # Delete the statement record
        conn.execute('DELETE FROM statements WHERE id = ?', (statement_id,))
        
        conn.commit()
    
    return jsonify({'success': True, 'message': f'Cancelled and deleted statement {statement_id}'})

def get_all_pending_statements():
    """Get all statements that have staging data (pending approval)"""
    with get_db_connection() as conn:
        cur = conn.execute('''
            SELECT DISTINCT s.id, s.filename, s.upload_date, COUNT(se.id) as expense_count
            FROM statements s
            INNER JOIN staging_expenses se ON s.id = se.statement_id
            GROUP BY s.id, s.filename, s.upload_date
            ORDER BY s.upload_date DESC
        ''')
        
        statements = [dict(zip([column[0] for column in cur.description], row)) 
                     for row in cur.fetchall()]
    
    return jsonify(statements)