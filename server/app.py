
# --- Modular Flask App using Services ---
import os
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from flask_cors import CORS

# Import service modules
from services import database_service, expense_service, category_service, pdf_service, cleanup_service, statement_service, household_service, auth_service

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'pdf'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Utility ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Authentication Endpoints ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    return auth_service.register_user(
        data.get('email'),
        data.get('password'),
        data.get('full_name')
    )

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    return auth_service.login_user(
        data.get('email'),
        data.get('password')
    )

@app.route('/logout', methods=['POST'])
def logout():
    session_token = request.headers.get('Authorization')
    if session_token and session_token.startswith('Bearer '):
        session_token = session_token[7:]
        return auth_service.logout_user(session_token)
    return jsonify({'error': 'No session token provided'}), 400

@auth_service.require_auth
@app.route('/me', methods=['GET'])
@auth_service.require_auth
def get_current_user():
    return jsonify({'user': request.current_user})

# --- Existing Endpoints (now protected) ---
@auth_service.require_auth
@app.route('/delete_all_expenses', methods=['DELETE'])
@auth_service.require_auth
def delete_all_expenses():
    return statement_service.delete_all_expenses()

@auth_service.require_auth
@app.route('/statement/<int:statement_id>', methods=['DELETE'])
@auth_service.require_auth
def delete_statement(statement_id):
    return statement_service.delete_statement(statement_id)

@auth_service.require_auth
@app.route('/upload', methods=['POST'])
@auth_service.require_auth
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
        if card == 'other' and custom_card:
            card = custom_card.strip()
        # Parse file
        if ext == 'pdf':
            statement_id = statement_service.save_pdf_statement(filename, filepath)
            df = pdf_service.parse_pdf(filepath, bank_type)  # Pass bank type
        elif ext == 'csv':
            statement_id = statement_service.save_csv_statement(filename, filepath)
            df = expense_service.read_csv(filepath, bank_type)  # Pass bank type
        else:
            try:
                os.remove(filepath)
            except FileNotFoundError:
                pass
            return jsonify({'error': 'Unsupported file type'}), 400
        if card:
            df['card'] = card
        expense_service.insert_expenses(df, statement_id)
        os.remove(filepath)
        cleanup_service.cleanup_null_rows()
        return jsonify({'success': True, 'count': len(df)})
    return jsonify({'error': 'Invalid file'}), 400

@auth_service.require_auth
@app.route('/expense', methods=['POST'])
def add_expense():
    return expense_service.add_expense(request)

@auth_service.require_auth
@app.route('/expense/<int:row_id>/category', methods=['PATCH'])
def update_expense_category(row_id):
    return expense_service.update_expense_category(row_id, request)

@auth_service.require_auth
@app.route('/expense/<int:row_id>/need_category', methods=['PATCH'])
def update_expense_need_category(row_id):
    return expense_service.update_expense_need_category(row_id, request)

@auth_service.require_auth
@app.route('/expense/<int:row_id>', methods=['DELETE'])
def delete_expense(row_id):
    return expense_service.delete_expense(row_id)

@auth_service.require_auth
@app.route('/expenses/bulk_delete', methods=['DELETE'])
def bulk_delete_expenses():
    return expense_service.bulk_delete_expenses(request)

@auth_service.require_auth
@app.route('/expense/<int:row_id>', methods=['PATCH'])
def patch_expense(row_id):
    return expense_service.patch_expense(row_id, request)

@auth_service.require_auth
@app.route('/expenses', methods=['GET'])
def get_expenses():
    return expense_service.get_expenses()

@auth_service.require_auth
@app.route('/recategorize', methods=['POST'])
def recategorize_all_expenses():
    return expense_service.recategorize_all_expenses()

@auth_service.require_auth
@app.route('/recategorize_all', methods=['POST'])
def recategorize_all_expenses_new():
    return expense_service.recategorize_all_expenses()

@auth_service.require_auth
@app.route('/categories', methods=['GET'])
def get_categories():
    return jsonify({
        'categories': category_service.get_all_categories(),
        'metadata': category_service.get_category_metadata()
    })

@auth_service.require_auth
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

@auth_service.require_auth
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

@auth_service.require_auth
@app.route('/categories/<category_name>', methods=['DELETE'])
def delete_category(category_name):
    name = category_name.lower().strip()
    
    if category_service.delete_custom_category(name):
        return jsonify({'success': True, 'message': f'Category "{name}" deleted successfully'})
    else:
        return jsonify({'error': 'Category not found, is a default category, or delete failed'}), 400

@auth_service.require_auth
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

@auth_service.require_auth
@app.route('/cleanup', methods=['POST'])
def cleanup_null_rows():
    return cleanup_service.cleanup_null_rows()

@auth_service.require_auth
@app.route('/statements', methods=['GET'])
def list_statements():
    return statement_service.list_statements()

@auth_service.require_auth
@app.route('/statement/<int:statement_id>/reimport', methods=['POST'])
def reimport_statement(statement_id):
    return statement_service.reimport_statement(statement_id, app.config['UPLOAD_FOLDER'])

# --- Household Management Endpoints ---
@auth_service.require_auth
@app.route('/household/config', methods=['GET'])
def get_household_config():
    """Get the current household configuration"""
    config = household_service.get_household_config()
    return jsonify(config)

@auth_service.require_auth
@app.route('/household/config', methods=['POST'])
def save_household_config():
    """Save the household configuration"""
    try:
        config = request.get_json()
        if household_service.save_household_config(config):
            return jsonify({"success": True, "message": "Configuration saved"})
        else:
            return jsonify({"success": False, "message": "Failed to save configuration"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@auth_service.require_auth
@app.route('/household/member', methods=['POST'])
def add_household_member():
    """Add a new household member"""
    try:
        data = request.get_json()
        name = data.get('name')
        emoji = data.get('emoji', '👤')
        color = data.get('color', '#6cbda0')
        
        if not name:
            return jsonify({"success": False, "message": "Name is required"}), 400
        
        member = household_service.add_household_member(name, emoji, color)
        if member:
            return jsonify({"success": True, "member": member})
        else:
            return jsonify({"success": False, "message": "Failed to add member"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@auth_service.require_auth
@app.route('/household/member/<member_name>', methods=['DELETE'])
def remove_household_member(member_name):
    """Remove a household member"""
    try:
        if household_service.remove_household_member(member_name):
            return jsonify({"success": True, "message": f"Member '{member_name}' removed"})
        else:
            return jsonify({"success": False, "message": "Member not found or failed to remove"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@auth_service.require_auth
@app.route('/household/default-spender', methods=['POST'])
def update_default_spender():
    """Update the default spender"""
    try:
        data = request.get_json()
        spender_name = data.get('spender')
        
        if not spender_name:
            return jsonify({"success": False, "message": "Spender name is required"}), 400
        
        if household_service.update_default_spender(spender_name):
            return jsonify({"success": True, "message": f"Default spender set to '{spender_name}'"})
        else:
            return jsonify({"success": False, "message": "Spender not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

# --- Static Files ---
@app.route('/')
def index():
    return send_from_directory('../html', 'login.html')

@app.route('/login.html')
def login_page():
    return send_from_directory('../html', 'login.html')

@app.route('/index.html')
def main_app():
    return send_from_directory('../html', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    # Don't require auth for static assets like CSS, JS, etc.
    if filename.endswith(('.css', '.js', '.jpg', '.png', '.ico')):
        return send_from_directory('../html', filename)
    # For other HTML files, require auth
    return send_from_directory('../html', filename)

if __name__ == '__main__':
    database_service.init_db()
    # Use environment variable for port (Railway sets this)
    import os
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=False)
