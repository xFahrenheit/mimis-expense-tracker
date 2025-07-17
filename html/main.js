// Main application entry point
import { setAllExpenses, setFilteredExpenses } from './config.js';
import { loadExpenses, loadStatements, uploadFile, deleteAllExpenses, recategorizeAll, textToSqlQuery } from './api.js';
import { renderCharts } from './charts.js';
import { initializeCategories } from './categories.js';
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
    
    // Apply initial sorting (by date, newest first)
    applyColumnFilters();
    
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
    console.log('=== updateSpendingBlocks Debug ===');
    console.log('Total expenses:', expenses.length);
    
    if (expenses.length > 0) {
        console.log('Sample expense object:', expenses[0]);
        console.log('First expense who field:', JSON.stringify(expenses[0].who));
    }
    
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    console.log('Calculated total:', total);
    let gautami = 0, ameya = 0, splitTotal = 0;
    
    // Debug: Check all unique who values
    const whoValues = expenses.map(e => e.who).filter(w => w !== null && w !== undefined);
    const uniqueWhoValues = [...new Set(whoValues)];
    console.log('All who values (first 10):', whoValues.slice(0, 10));
    console.log('Unique who values:', uniqueWhoValues);
    console.log('Total non-null who values:', whoValues.length);
    
    let processedCount = 0;
    for (const e of expenses) {
        if (processedCount < 3) { // Only log first 3 for debugging
            console.log(`Expense ${processedCount + 1}:`, {
                description: e.description,
                who: JSON.stringify(e.who),
                amount: e.amount,
                split_cost: e.split_cost
            });
        }
        
        if (e.split_cost) {
            // Split cost: each person gets half
            const splitAmount = Number(e.amount || 0) / 2;
            gautami += splitAmount;
            ameya += splitAmount;
            splitTotal += Number(e.amount || 0);
            if (processedCount < 3) console.log(`Split expense - Added ${splitAmount} to each person`);
        } else {
            const who = (e.who || '').toString().trim();
            const amount = Number(e.amount || 0);
            
            if (who.toLowerCase() === 'gautami') {
                gautami += amount;
                if (processedCount < 3) console.log(`Added ${amount} to Gautami (original: "${e.who}")`);
            } else if (who.toLowerCase() === 'ameya') {
                ameya += amount;
                if (processedCount < 3) console.log(`Added ${amount} to Ameya (original: "${e.who}")`);
            } else {
                if (processedCount < 3) console.log(`Unmatched who value: "${who}" (original: "${e.who}")`);
            }
        }
        processedCount++;
    }
    
    console.log('=== Final Calculations ===');
    console.log('Gautami total:', gautami);
    console.log('Ameya total:', ameya);
    console.log('Split total:', splitTotal);
    console.log('Grand total:', total);
    
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
    
    // Initialize categories (loads categories from backend)
    await initializeCategories();
    
    // Attach event listeners
    attachDeleteAllBtnListener();
    attachFilterAndSortListeners();
    
    // Setup export CSV button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.onclick = () => exportFilteredToCSV(window.filteredExpenses || []);
    }
    
    // Setup manage categories button
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    if (manageCategoriesBtn) {
        manageCategoriesBtn.addEventListener('click', async () => {
            const { showCategoryModal } = await import('./categories.js');
            showCategoryModal();
        });
    }
    
    // Load initial data
    await loadStatementsMain();
    await loadExpensesMain();
});

// Make functions available globally for HTML onclick handlers
window.editCategoryEmoji = async (categoryName, currentEmoji) => {
    const { editCategoryEmoji } = await import('./categories.js');
    return editCategoryEmoji(categoryName, currentEmoji);
};

window.closeCategoryModal = async () => {
    const { closeCategoryModal } = await import('./categories.js');
    return closeCategoryModal();
};

// Expose functions globally for cross-module communication
window.loadExpenses = loadExpensesMain;
window.loadStatements = loadStatementsMain;
window.renderExpenses = renderExpenses;
window.renderCharts = renderCharts;
window.renderFilters = renderFilters;
window.applyColumnFilters = applyColumnFilters;
window.updateSpendingBlocks = updateSpendingBlocks;