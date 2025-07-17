// Main application entry point
import { setAllExpenses, setFilteredExpenses } from './config.js';
import { loadExpenses, loadStatements, uploadFile, deleteAllExpenses, recategorizeAll, textToSqlQuery } from './api.js';
import { renderCharts } from './charts.js';
import { addCategoryUI } from './categories.js';
import { applyColumnFilters, attachFilterAndSortListeners } from './filters.js';
import { exportFilteredToCSV, setupDarkModeToggle, setupAnalyticsToggle, setupNotesArea } from './helpers.js';
import { renderExpenses, renderFilters, renderStatements, renderQuickFilterChips, renderRecentLargeExpenses, renderAverages } from './render.js';
import { attachDeleteAllBtnListener, setupTabSwitching, setupUploadForm, setupTextToSql } from './dom_handlers.js';

// Register ChartDataLabels plugin globally
if (window.Chart && window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
}

// Main load function for expenses
async function loadExpensesMain() {
    const expenses = await loadExpenses();
    setAllExpenses(expenses);
    setFilteredExpenses(expenses);
    
    // Render components
    renderExpenses(expenses);
    renderFilters(expenses);
    renderCharts(expenses);
    
    // Update total spending blocks
    updateSpendingBlocks(expenses);
    
    // Render additional UI components
    renderAverages(expenses);
    renderQuickFilterChips(expenses);
    renderRecentLargeExpenses(expenses);
}

// Main load function for statements
async function loadStatementsMain() {
    const statements = await loadStatements();
    renderStatements(statements);
}

// Update spending summary blocks
function updateSpendingBlocks(expenses) {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    let gautami = 0, ameya = 0, splitTotal = 0;
    
    for (const e of expenses) {
        if (e.split_cost) {
            // Split cost: each person gets half
            gautami += Number(e.amount || 0) / 2;
            ameya += Number(e.amount || 0) / 2;
            splitTotal += Number(e.amount || 0);
        } else {
            if (e.who === 'Gautami') gautami += Number(e.amount || 0);
            if (e.who === 'Ameya') ameya += Number(e.amount || 0);
        }
    }
    
    const days = new Set(expenses.map(e => e.date)).size || 1;
    const months = new Set(expenses.map(e => (e.date||'').slice(0,7))).size || 1;
    
    // Update DOM elements
    const elements = {
        'totalSpendingValue': `$${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
        'gautamiSpendingValue': `$${gautami.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
        'ameyaSpendingValue': `$${ameya.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
        'splitSpendingValue': `$${(splitTotal/2).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
        'avgPerDay': `${(total/days).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/day`,
        'avgPerMonth': `${(total/months).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/mo`
    };
    
    Object.entries(elements).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });
}

// DOMContentLoaded handler
window.addEventListener('DOMContentLoaded', async () => {
    // Setup UI components
    setupTabSwitching();
    setupUploadForm();
    setupTextToSql();
    setupDarkModeToggle();
    setupAnalyticsToggle();
    setupNotesArea();
    
    // Setup category management
    addCategoryUI();
    
    // Attach event listeners
    attachDeleteAllBtnListener();
    attachFilterAndSortListeners();
    
    // Setup export CSV button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.onclick = () => exportFilteredToCSV(window.filteredExpenses || []);
    }
    
    // Load initial data
    await loadStatementsMain();
    await loadExpensesMain();
});

// Expose functions globally for cross-module communication
window.loadExpenses = loadExpensesMain;
window.loadStatements = loadStatementsMain;
window.renderExpenses = renderExpenses;
window.renderCharts = renderCharts;
window.renderFilters = renderFilters;
window.applyColumnFilters = applyColumnFilters;