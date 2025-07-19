
# --- Modular Flask App using Services ---
import os
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from flask_cors import CORS

# Import service modules
from services import database_service, expense_service, category_service, pdf_service, cleanup_service, statement_service

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'pdf'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
        expense_service.insert_expenses(df, statement_id)
        os.remove(filepath)
        cleanup_service.cleanup_null_rows()
        return jsonify({'success': True, 'count': len(df)})
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

@app.route('/recategorize', methods=['POST'])
def recategorize_all_expenses():
    return expense_service.recategorize_all_expenses()

@app.route('/recategorize_all', methods=['POST'])
def recategorize_all_expenses_new():
    return expense_service.recategorize_all_expenses()

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

@app.route('/')
def serve_index():
    return send_from_directory('../html', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('../html', filename)

if __name__ == '__main__':
    database_service.init_db()
    app.run(host='0.0.0.0', port=3001, debug=True)
