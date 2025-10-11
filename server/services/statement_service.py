from flask import jsonify, request
import pandas as pd
import os

def list_statements():
    with get_db_connection() as conn:
        cur = conn.execute('SELECT id, filename, upload_date FROM statements ORDER BY upload_date DESC')
        rows = [dict(zip([column[0] for column in cur.description], row)) for row in cur.fetchall()]
    return jsonify(rows)

def reimport_statement(statement_id, upload_folder):
    with get_db_connection() as conn:
        cur = conn.execute('SELECT filename, file FROM statements WHERE id = ?', (statement_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Statement not found'}), 404
        filename, file_bytes = row
        if file_bytes is None:
            return jsonify({'error': 'This statement was uploaded before file storage was enabled and cannot be re-imported.'}), 400
        ext = filename.rsplit('.', 1)[-1].lower()
        temp_path = os.path.join(upload_folder, f'_reimport_{statement_id}.{ext}')
        with open(temp_path, 'wb') as f:
            f.write(file_bytes)
        # Import services here to avoid circular import
        from services import pdf_service, expense_service
        if ext == 'pdf':
            df = pdf_service.parse_pdf(temp_path)
        elif ext == 'csv':
            df = pd.read_csv(temp_path)
        else:
            os.remove(temp_path)
            return jsonify({'error': 'Unsupported file type'}), 400
        expense_service.insert_expenses(df, statement_id, None)
        os.remove(temp_path)
    return jsonify({'success': True, 'count': len(df)})

def save_pdf_statement(filename, filepath):
    """Save PDF file to DB and return new statement_id."""
    from datetime import datetime
    print(f"[DEBUG] save_pdf_statement called with filename: {filename} and filepath: {filepath}")
    with open(filepath, 'rb') as f:
        pdf_bytes = f.read()
    with get_db_connection() as conn:
        cur = conn.execute(
            'INSERT INTO statements (filename, upload_date, file) VALUES (?, ?, ?)',
            (filename, datetime.now().isoformat(), pdf_bytes)
        )
        conn.commit()
        print(f"[DEBUG] Inserted PDF statement: {filename} (rowid: {cur.lastrowid})")
        return cur.lastrowid

def save_csv_statement(filename, filepath):
    """Save CSV file to DB and return new statement_id."""
    from datetime import datetime
    print(f"[DEBUG] save_csv_statement called with filename: {filename} and filepath: {filepath}")
    with open(filepath, 'rb') as f:
        csv_bytes = f.read()
    with get_db_connection() as conn:
        cur = conn.execute(
            'INSERT INTO statements (filename, upload_date, file) VALUES (?, ?, ?)',
            (filename, datetime.now().isoformat(), csv_bytes)
        )
        conn.commit()
        print(f"[DEBUG] Inserted CSV statement: {filename} (rowid: {cur.lastrowid})")
        return cur.lastrowid
    
    
def is_duplicate_statement(filename):
    with get_db_connection() as conn:
        cur = conn.execute('SELECT 1 FROM statements WHERE filename = ?', (filename,))
        return cur.fetchone() is not None
from services.database_service import get_db_connection
import sqlite3

def delete_all_expenses():
    with get_db_connection() as conn:
        conn.execute('DELETE FROM expenses')
        conn.execute('DELETE FROM statements')
        conn.execute('DELETE FROM user_overrides')
        conn.commit()
    return jsonify({'success': True, 'message': 'All data deleted.'})

def delete_statement(statement_id):
    with get_db_connection() as conn:
        conn.execute('DELETE FROM expenses WHERE statement_id = ?', (statement_id,))
        conn.execute('DELETE FROM statements WHERE id = ?', (statement_id,))
        conn.commit()
    return {'success': True, 'message': f'Statement {statement_id} and its expenses deleted.'}
