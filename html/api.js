```javascript
// api.js

export const API_URL = 'http://localhost:3001';

export async function loadStatements() {
    const res = await fetch(`${API_URL}/statements`);
    const statements = await res.json();
    renderStatements(statements);
}

export async function loadExpenses() {
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    allExpenses = expenses;
    renderExpenses(expenses);
    renderFilters(expenses);
    renderCharts(expenses);
    // Update total spending blocks
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    let gautami = 0, ameya = 0, splitTotal = 0;
    for (const e of expenses) {
        if (e.split_cost) {
            splitTotal += Number(e.amount || 0);
            // Each gets half of split expense
            if (e.who === 'Gautami') {
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            } else if (e.who === 'Ameya') {
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            } else {
                // If neither, just split between both
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            }
        } else {
            if (e.who === 'Gautami') gautami += Number(e.amount || 0);
            if (e.who === 'Ameya') ameya += Number(e.amount || 0);
        }
    }
    const days = new Set(expenses.map(e => e.date)).size || 1;
    const months = new Set(expenses.map(e => (e.date||'').slice(0,7))).size || 1;
    document.getElementById('totalSpendingValue').textContent = `$${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('gautamiSpendingValue').textContent = `$${gautami.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('ameyaSpendingValue').textContent = `$${ameya.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('splitSpendingValue').textContent = `$${(splitTotal/2).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('avgPerDay').textContent = `${(total/days).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/day`;
    document.getElementById('avgPerMonth').textContent = `${(total/months).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/mo`;
}

// ...other API functions (file upload, delete all, etc.)...
```