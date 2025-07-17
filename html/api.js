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

// Text to SQL query
export async function textToSqlQuery(question) {
    const res = await fetch(`${API_URL}/text_to_sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
    });
    return res.json();
}
