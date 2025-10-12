
# --- Modular Flask App using Services ---
import os
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

# Import service modules
from services import database_service, expense_service, category_service, pdf_service, cleanup_service, statement_service, staging_service

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'pdf'}


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Enable CORS for all routes if flask_cors is available
if CORS:
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
else:
    print("[WARNING] flask_cors not installed. CORS will not be enabled.")
# --- Endpoints ---

# Favicon route to prevent 404 errors
@app.route('/favicon.ico')
def favicon():
    return '', 204

# Initialize database on startup
try:
    database_service.init_db()
    print("Database initialized successfully")
except Exception as e:
    print(f"Database initialization error: {e}")

# Also initialize on every request if needed
@app.before_request
def ensure_database():
    try:
        with database_service.get_db_connection() as conn:
            # Quick check to see if tables exist
            conn.execute('SELECT COUNT(*) FROM user_overrides LIMIT 1').fetchone()
    except Exception:
        # Tables don't exist, initialize database
        database_service.init_db()
        print("Database reinitialized due to missing tables")

# --- Utility ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Endpoints ---
@app.route('/delete_all_expenses', methods=['DELETE'])
def delete_all_expenses():
    return statement_service.delete_all_expenses()

@app.route('/statement/<int:statement_id>', methods=['DELETE'])
def delete_statement(statement_id):
    return statement_service.delete_statement(statement_id)

@app.route('/upload', methods=['POST'])
def upload_statement():
    if 'statement' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['statement']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Check for duplicate filename
        if statement_service.is_duplicate_statement(filename):
            return jsonify({'error': 'Duplicate file', 'duplicate': True, 'filename': filename}), 409
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        ext = filename.rsplit('.', 1)[1].lower()
        card = request.form.get('card')
        custom_card = request.form.get('custom_card')
        bank_type = request.form.get('bank_type', 'generic')  # Get bank type
        default_spender = request.form.get('default_spender')  # Get default spender
        if card == 'other' and custom_card:
            card = custom_card.strip()
        # Parse file
        if ext == 'pdf':
            statement_id = statement_service.save_pdf_statement(filename, filepath)
            df = pdf_service.parse_pdf(filepath, bank_type)  # Pass bank type
        elif ext == 'csv':
            statement_id = statement_service.save_csv_statement(filename, filepath)
            df = expense_service.read_csv(filepath)
        else:
            try:
                os.remove(filepath)
            except FileNotFoundError:
                pass
            return jsonify({'error': 'Unsupported file type'}), 400
        
        if card:
            df['card'] = card
        
        # Save to staging instead of directly inserting
        metadata = {
            'card': card,
            'default_spender': default_spender,
            'bank_type': bank_type
        }
        staging_service.save_staging_data(statement_id, df, metadata)
        
        # Clean up uploaded file
        os.remove(filepath)
        cleanup_service.cleanup_null_rows()
        
        # Return staging redirect info instead of success
        return jsonify({
            'success': True, 
            'staging': True, 
            'statement_id': statement_id,
            'count': len(df),
            'redirect_url': f'/staging/{statement_id}'
        })
    return jsonify({'error': 'Invalid file'}), 400

@app.route('/expense', methods=['POST'])
def add_expense():
    return expense_service.add_expense(request)

@app.route('/expense/<int:row_id>/category', methods=['PATCH'])
def update_expense_category(row_id):
    return expense_service.update_expense_category(row_id, request)

@app.route('/expense/<int:row_id>/need_category', methods=['PATCH'])
def update_expense_need_category(row_id):
    return expense_service.update_expense_need_category(row_id, request)

@app.route('/expense/<int:row_id>', methods=['DELETE'])
def delete_expense(row_id):
    return expense_service.delete_expense(row_id)

@app.route('/expenses/bulk_delete', methods=['DELETE'])
def bulk_delete_expenses():
    return expense_service.bulk_delete_expenses(request)

@app.route('/expense/<int:row_id>', methods=['PATCH'])
def patch_expense(row_id):
    return expense_service.patch_expense(row_id, request)

@app.route('/expenses', methods=['GET'])
def get_expenses():
    return expense_service.get_expenses()

# --- HTML Page Routes (must come before API routes to avoid conflicts) ---
@app.route('/')
def serve_index():
    return send_from_directory('../html', 'index.html')

@app.route('/staging/<int:statement_id>')
def serve_staging(statement_id):
    return send_from_directory('../html', 'staging.html')

# --- Staging API Endpoints ---
@app.route('/api/staging', methods=['GET'])
def get_pending_statements():
    """Get all statements pending approval in staging"""
    return staging_service.get_all_pending_statements()

@app.route('/api/staging/<int:statement_id>', methods=['GET'])
def get_staging_data(statement_id):
    """Get staging data for a specific statement"""
    data = staging_service.get_staging_data(statement_id)
    if not data:
        return jsonify({'error': 'Statement not found or no staging data'}), 404
    return jsonify(data)

@app.route('/api/staging/<int:statement_id>/approve', methods=['POST'])
def approve_staging(statement_id):
    """Approve and move staging data to main expenses table"""
    return staging_service.approve_staging_data(statement_id)

@app.route('/api/staging/<int:statement_id>/cancel', methods=['DELETE'])
def cancel_staging(statement_id):
    """Cancel staging and delete the statement"""
    return staging_service.cancel_staging_data(statement_id)

@app.route('/api/staging/<int:statement_id>/recategorize', methods=['POST'])
def recategorize_staging(statement_id):
    """Recategorize all expenses in staging for a specific statement"""
    return staging_service.recategorize_staging_expenses(statement_id)

@app.route('/api/staging/expense/<int:staging_id>', methods=['PATCH'])
def update_staging_expense(staging_id):
    """Update a staging expense"""
    data = request.get_json()
    return staging_service.update_staging_expense(staging_id, data)

@app.route('/api/staging/expense/<int:staging_id>', methods=['DELETE'])
def delete_staging_expense(staging_id):
    """Delete a staging expense"""
    return staging_service.delete_staging_expense(staging_id)

@app.route('/categories', methods=['GET'])
def get_categories():
    return jsonify({
        'categories': category_service.get_all_categories(),
        'metadata': category_service.get_category_metadata()
    })

@app.route('/categories', methods=['POST'])
def add_category():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Category name is required'}), 400
    
    name = data['name'].lower().strip()
    icon = data.get('icon', '🏷️')
    color = data.get('color', '#818cf8')
    
    if category_service.add_custom_category(name, icon, color):
        return jsonify({'success': True, 'message': f'Category "{name}" added successfully'})
    else:
        return jsonify({'error': 'Category already exists or invalid name'}), 400

@app.route('/categories/<category_name>', methods=['PATCH'])
def update_category(category_name):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    name = category_name.lower().strip()
    icon = data.get('icon')
    color = data.get('color')
    
    if category_service.update_custom_category(name, icon, color):
        return jsonify({'success': True, 'message': f'Category "{name}" updated successfully'})
    else:
        return jsonify({'error': 'Category not found or update failed'}), 400

@app.route('/categories/<category_name>', methods=['DELETE'])
def delete_category(category_name):
    name = category_name.lower().strip()
    
    if category_service.delete_custom_category(name):
        return jsonify({'success': True, 'message': f'Category "{name}" deleted successfully'})
    else:
        return jsonify({'error': 'Category not found, is a default category, or delete failed'}), 400

@app.route('/categories/<category_name>/rename', methods=['PATCH'])
def rename_category(category_name):
    data = request.get_json()
    if not data or 'new_name' not in data:
        return jsonify({'error': 'New category name is required'}), 400
    
    old_name = category_name.lower().strip()
    new_name = data['new_name'].lower().strip()
    
    if category_service.rename_custom_category(old_name, new_name):
        return jsonify({'success': True, 'message': f'Category "{old_name}" renamed to "{new_name}" successfully'})
    else:
        return jsonify({'error': 'Category not found, is a default category, new name already exists, or rename failed'}), 400

@app.route('/cleanup', methods=['POST'])
def cleanup_null_rows():
    return cleanup_service.cleanup_null_rows()

@app.route('/statements', methods=['GET'])
def list_statements():
    return statement_service.list_statements()

@app.route('/statement/<int:statement_id>/reimport', methods=['POST'])
def reimport_statement(statement_id):
    return statement_service.reimport_statement(statement_id, app.config['UPLOAD_FOLDER'])

@app.route('/backup-and-push', methods=['POST'])
def backup_and_push():
    """Backup database and push changes to git repository"""
    import subprocess
    import os
    
    try:
        # Check if password environment variable is set
        if 'EXPENSE_DB_PASSWORD' not in os.environ:
            return jsonify({
                'success': False,
                'message': 'EXPENSE_DB_PASSWORD environment variable not set'
            }), 400
        
        # Change to the parent directory (where db_manager.sh is located)
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Run the upload command with environment
        result = subprocess.run(
            ['bash', './db_manager.sh', 'upload'],
            cwd=parent_dir,
            capture_output=True,
            text=True,
            timeout=60,
            env=dict(os.environ, LC_ALL='C', LANG='C'),
            input='y\n'  # Auto-confirm any prompts
        )
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'Database backed up and pushed successfully!',
                'output': result.stdout
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Backup failed',
                'error': result.stderr,
                'output': result.stdout
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'message': 'Backup operation timed out'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Backup failed: {str(e)}'
        }), 500

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('../html', filename)

if __name__ == '__main__':
    database_service.init_db()
    app.run(host='0.0.0.0', port=3001, debug=True)
