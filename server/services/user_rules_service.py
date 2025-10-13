import sqlite3
from flask import jsonify
from .database_service import get_db_connection

def update_user_override_for_expense(description, category=None, need_category=None, conn=None):
    """
    Utility function to update user overrides when an expense is categorized.
    This consolidates the logic used across multiple services.
    
    Args:
        description: The transaction description (will be normalized)
        category: Category to set (optional)
        need_category: Need category to set (optional)
        conn: Database connection to use (optional, will create new if not provided)
    """
    if not description or not description.strip():
        return
    
    desc_norm = description.strip().lower()
    
    # Use provided connection or create new one
    if conn:
        _update_override_with_conn(conn, desc_norm, category, need_category)
    else:
        with get_db_connection() as new_conn:
            _update_override_with_conn(new_conn, desc_norm, category, need_category)

def _update_override_with_conn(conn, desc_norm, category=None, need_category=None):
    """
    Helper function to update or insert user overrides with a given connection.
    This is the core logic used by both API endpoints and internal expense updates.
    """
    # Get existing rule to merge with new data
    existing = conn.execute(
        'SELECT category, need_category FROM user_overrides WHERE description = ?',
        (desc_norm,)
    ).fetchone()
    
    # Determine final values (new values override existing ones)
    final_category = category if category is not None else (existing[0] if existing else None)
    final_need_category = need_category if need_category is not None else (existing[1] if existing else None)
    
    # Update or insert the rule with merged data
    if final_category is not None or final_need_category is not None:
        conn.execute('''
            INSERT OR REPLACE INTO user_overrides (description, category, need_category) 
            VALUES (?, ?, ?)
        ''', (desc_norm, final_category, final_need_category))

def get_all_user_rules():
    """Get all user override rules from the database."""
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT description, category, need_category 
                FROM user_overrides 
                ORDER BY description
            ''')
            user_rules = []
            for row in cursor.fetchall():
                user_rules.append({
                    'description': row[0],
                    'category': row[1] if row[1] else '',
                    'need_category': row[2] if row[2] else ''
                })
            return jsonify({'success': True, 'user_rules': user_rules})
    except Exception as e:
        print(f"Error fetching user rules: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def add_user_rule(description, category=None, need_category=None):
    """Add a new user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    desc_norm = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule already exists (for API validation)
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (desc_norm,)
            ).fetchone()
            
            if existing:
                return jsonify({'success': False, 'error': 'User rule already exists for this description'}), 409
            
            # Use the consolidated function to insert the rule
            _update_override_with_conn(conn, desc_norm, category, need_category)
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule added successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error adding user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def update_user_rule(description, category=None, need_category=None):
    """Update an existing user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    desc_norm = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule exists (for API validation)
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (desc_norm,)
            ).fetchone()
            
            if not existing:
                return jsonify({'success': False, 'error': 'User rule not found'}), 404
            
            # Use the consolidated function to update the rule (preserves existing data)
            _update_override_with_conn(conn, desc_norm, category, need_category)
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule updated successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error updating user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def delete_user_rule(description):
    """Delete a user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    description = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule exists
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (description,)
            ).fetchone()
            
            if not existing:
                return jsonify({'success': False, 'error': 'User rule not found'}), 404
            
            # Delete rule
            conn.execute('DELETE FROM user_overrides WHERE description = ?', (description,))
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule deleted successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error deleting user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def search_user_rules(search_term):
    """Search user override rules by description."""
    if not search_term:
        return get_all_user_rules()
    
    search_term = f"%{search_term.strip().lower()}%"
    
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT description, category, need_category 
                FROM user_overrides 
                WHERE description LIKE ?
                ORDER BY description
            ''', (search_term,))
            
            user_rules = []
            for row in cursor.fetchall():
                user_rules.append({
                    'description': row[0],
                    'category': row[1] if row[1] else '',
                    'need_category': row[2] if row[2] else ''
                })
            
            return jsonify({'success': True, 'user_rules': user_rules})
            
    except Exception as e:
        print(f"Error searching user rules: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500