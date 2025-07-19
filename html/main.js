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

// Register ChartDataLabels plugin globally
if (window.Chart && window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
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
    
    // Setup backup and push button
    const backupPushBtn = document.getElementById('backupPushBtn');
    if (backupPushBtn) {
        backupPushBtn.addEventListener('click', async () => {
            const { backupAndPush } = await import('./api.js');
            
            // Disable button and show loading state
            backupPushBtn.disabled = true;
            const originalText = backupPushBtn.textContent;
            backupPushBtn.textContent = '🔄 Backing up...';
            
            try {
                const result = await backupAndPush();
                
                if (result.success) {
                    backupPushBtn.textContent = '✅ Success!';
                    
                    // Show success notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
                    notification.innerHTML = `
                        <div class="flex">
                            <div class="py-1">
                                <svg class="fill-current h-6 w-6 text-green-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="font-bold">Backup Successful!</p>
                                <p class="text-sm">Your expenses have been backed up and pushed to GitHub.</p>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(notification);
                    
                    // Remove notification after 5 seconds
                    setTimeout(() => {
                        notification.remove();
                    }, 5000);
                    
                } else {
                    backupPushBtn.textContent = '❌ Failed';
                    
                    // Show error notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
                    notification.innerHTML = `
                        <div class="flex">
                            <div class="py-1">
                                <svg class="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="font-bold">Backup Failed</p>
                                <p class="text-sm">${result.message || 'Unknown error occurred'}</p>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(notification);
                    
                    // Remove notification after 8 seconds
                    setTimeout(() => {
                        notification.remove();
                    }, 8000);
                }
                
            } catch (error) {
                console.error('Backup failed:', error);
                backupPushBtn.textContent = '❌ Error';
                
                // Show error notification
                alert('Backup failed. Please check the console for details.');
            } finally {
                // Reset button after 3 seconds
                setTimeout(() => {
                    backupPushBtn.disabled = false;
                    backupPushBtn.textContent = originalText;
                }, 3000);
            }
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

// Expose time period functions
window.createTimePeriodTabs = createTimePeriodTabs;