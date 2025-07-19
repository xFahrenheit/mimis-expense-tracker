// Main application entry point
import { setAllExpenses, setFilteredExpenses, setSortState } from './config.js';
import { loadExpenses, loadStatements } from './api.js';
import { renderCharts } from './charts.js';
import { initializeCategories } from './categories.js';
import { applyColumnFilters, attachFilterAndSortListeners, updateSortArrows } from './filters.js';
import { exportFilteredToCSV, setupDarkModeToggle, setupAnalyticsToggle, setupNotesArea } from './helpers.js';
import { renderExpenses, renderFilters, renderStatements, calculateSpendingTotals, updateAllSpendingDisplays } from './render.js';
import { attachDeleteAllBtnListener, setupTabSwitching, setupUploadForm } from './dom_handlers.js';
import { createTimePeriodTabs, initializeTimePeriods } from './time_periods.js';
import { USER_CONFIG, loadHouseholdConfig } from './user-config.js';
import { showHouseholdModal } from './household-manager.js';
// Import household setup - this executes the user's configuration
import './household-setup.js';

// Register ChartDataLabels plugin globally
if (window.Chart && window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
}

// Initialize dynamic spending blocks based on user configuration
function initializeSpendingBlocks() {
    const container = document.getElementById('spendingBlocksContainer');
    if (!container) return;
    
    container.innerHTML = USER_CONFIG.spendingBlocks.map(block => `
        <div class="flex flex-col items-center md:items-start">
            <div class="total-spending-label">${block.emoji} ${block.label}</div>
            <div id="${block.id}" class="total-spending-value">$0</div>
        </div>
    `).join('');
}

// Initialize the app title
function initializeAppTitle() {
    document.title = USER_CONFIG.appTitle;
    const titleElements = document.querySelectorAll('.app-title');
    titleElements.forEach(el => {
        el.textContent = USER_CONFIG.appTitle;
    });
}

// Main load function for expenses
async function loadExpensesMain() {
    const expenses = await loadExpenses();
    setAllExpenses(expenses);
    setFilteredExpenses(expenses);
    
    // Force sort to newest first on load
    setSortState({ column: 'date', direction: -1 });
    
    // Don't render here - let initializeTimePeriods handle the initial render
    // This ensures consistency with "All Time" behavior
    
    // Apply initial sorting (by date, newest first)
    applyColumnFilters();
    
    // Update sort arrows to reflect current state
    updateSortArrows();
    
    // Render filters and charts (but not expenses table)
    renderFilters(expenses);
    renderCharts(expenses);
}

// Main load function for statements
async function loadStatementsMain() {
    const statements = await loadStatements();
    renderStatements(statements);
}

// Update spending summary blocks
function updateSpendingBlocks(expenses) {
    // Use the single source of truth function
    updateAllSpendingDisplays(expenses);
}

// DOMContentLoaded handler
window.addEventListener('DOMContentLoaded', async () => {
    // Load household configuration from backend first
    await loadHouseholdConfig();
    
    // Initialize dynamic UI based on user configuration
    initializeSpendingBlocks();
    initializeAppTitle();
    
    // Setup UI components
    setupTabSwitching();
    setupUploadForm();
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
    
    // Setup household manager button
    const householdManagerBtn = document.getElementById('householdManagerBtn');
    if (householdManagerBtn) {
        householdManagerBtn.addEventListener('click', () => {
            showHouseholdModal();
        });
    }
    
    // Load initial data
    await loadStatementsMain();
    await loadExpensesMain();
    
    // Initialize time period tabs after data is loaded
    // This will set the default to "All Time" which should match the initial load
    await initializeTimePeriods();
});

// Make functions available globally for HTML onclick handlers
window.editCategoryEmoji = async (categoryName, currentEmoji) => {
    const { editCategoryEmoji } = await import('./categories.js');
    return editCategoryEmoji(categoryName, currentEmoji);
};

window.addNewCategoryFromModal = async () => {
    const { addNewCategoryFromModal } = await import('./categories.js');
    return addNewCategoryFromModal();
};

window.editCategoryName = async (categoryName) => {
    const { editCategoryName } = await import('./categories.js');
    return editCategoryName(categoryName);
};

window.deleteCategoryConfirm = async (categoryName) => {
    const { deleteCategoryConfirm } = await import('./categories.js');
    return deleteCategoryConfirm(categoryName);
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
window.initializeSpendingBlocks = initializeSpendingBlocks;
window.updateAllSpendingDisplays = updateAllSpendingDisplays;

// Export for household manager access
window.allExpenses = () => window.allExpenses;
window.filteredExpenses = () => window.filteredExpenses;

// Expose time period functions
window.createTimePeriodTabs = createTimePeriodTabs;