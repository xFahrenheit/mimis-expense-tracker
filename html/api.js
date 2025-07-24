import { API_URL } from './config.js';

// Load statements from server
export async function loadStatements() {
    const res = await fetch(`${API_URL}/statements`);
    const statements = await res.json();
    return statements;
}

// Load expenses from server
export async function loadExpenses() {
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    return expenses;
}

// Upload file
export async function uploadFile(formData) {
    const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
    });
    return res;
}

// Delete expense
export async function deleteExpense(id) {
    await fetch(`${API_URL}/expense/${id}`, { method: 'DELETE' });
}

// Bulk delete expenses
export async function bulkDeleteExpenses(ids) {
    const res = await fetch(`${API_URL}/expenses/bulk_delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
    });
    if (!res.ok) {
        throw new Error(`Failed to delete expenses: ${res.statusText}`);
    }
    return res.json();
}

// Update expense
export async function updateExpense(id, data) {
    await fetch(`${API_URL}/expense/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

// Add new expense
export async function addExpense(expenseData) {
    await fetch(`${API_URL}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
    });
}

// Delete all expenses
export async function deleteAllExpenses() {
    const res = await fetch(`${API_URL}/delete_all_expenses`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    });
    return res;
}

// Re-import statement
export async function reimportStatement(id) {
    const res = await fetch(`${API_URL}/reimport/${id}`, { method: 'POST' });
    return res;
}

// Recategorize all expenses
export async function recategorizeAll() {
    const res = await fetch(`${API_URL}/recategorize_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return res;
}

// Get all categories and their metadata
export async function getCategories() {
    const res = await fetch(`${API_URL}/categories`);
    return res.json();
}

// Add a new category
export async function addCategory(name, icon = '🏷️', color = '#818cf8') {
    const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, color })
    });
    return res.json();
}

// Update an existing category
export async function updateCategory(name, icon, color) {
    const res = await fetch(`${API_URL}/categories/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon, color })
    });
    return res.json();
}

// Delete a category
export async function deleteCategory(name) {
    const res = await fetch(`${API_URL}/categories/${encodeURIComponent(name)}`, {
        method: 'DELETE'
    });
    return res.json();
}

// Rename a category
export async function renameCategory(oldName, newName) {
    const res = await fetch(`${API_URL}/categories/${encodeURIComponent(oldName)}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName })
    });
    return res.json();
}

// Backup and push database to git
export async function backupAndPush() {
    const res = await fetch(`${API_URL}/backup-and-push`, {
        method: 'POST'
    });
    return res.json();
}

// Perform undo operation
export async function performUndo() {
    const res = await fetch(`${API_URL}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
        throw new Error(`Undo failed: ${res.statusText}`);
    }
    return res.json();
}
