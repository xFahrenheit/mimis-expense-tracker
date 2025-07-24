// Main application entry point

// === Undo/Redo Stack ===
const undoStack = [];
const redoStack = [];
let isRestoringState = false; // Prevent infinite loops during restoration

function getAppStateSnapshot() {
    // Capture all relevant state: expenses, statements, filters, sort, etc.
    const state = {
        expenses: JSON.parse(JSON.stringify(window.allExpenses || [])),
        filteredExpenses: JSON.parse(JSON.stringify(window.filteredExpenses || [])),
        statements: JSON.parse(JSON.stringify(window.statementsList || [])),
        filters: {
            category: document.getElementById('filter-category')?.value || '',
            card: document.getElementById('filter-card')?.value || '',
            who: document.getElementById('filter-who')?.value || '',
            needcat: document.getElementById('filter-needcat')?.value || ''
        },
        sortState: JSON.parse(JSON.stringify(window.sortState || { column: 'date', direction: -1 })),
        timestamp: Date.now() // Add timestamp for debugging
    };
    
    console.log('📸 Capturing state snapshot:', {
        expensesCount: state.expenses.length,
        filtersActive: Object.values(state.filters).some(v => v !== ''),
        sortColumn: state.sortState.column,
        timestamp: new Date(state.timestamp).toLocaleTimeString()
    });
    
    return state;
}

function restoreAppState(state) {
    if (!state) {
        console.warn('⚠️ No state to restore');
        return;
    }
    
    console.log('🔄 Restoring state:', {
        expensesCount: state.expenses?.length || 0,
        timestamp: new Date(state.timestamp).toLocaleTimeString()
    });
    
    // Set flag to prevent triggering new undo states during restoration
    isRestoringState = true;
    
    try {
        // Restore expenses (most important)
        if (state.expenses) {
            window.allExpenses = state.expenses;
            if (window.setAllExpenses) {
                window.setAllExpenses(state.expenses);
            }
        }
        
        if (state.filteredExpenses) {
            window.filteredExpenses = state.filteredExpenses;
            if (window.setFilteredExpenses) {
                window.setFilteredExpenses(state.filteredExpenses);
            }
        }
        
        // Restore statements (if available)
        if (state.statements) {
            window.statementsList = state.statements;
            if (window.renderStatements) {
                window.renderStatements(state.statements);
            }
        }
        
        // Restore filters
        if (state.filters) {
            const filterElements = {
                'filter-category': state.filters.category,
                'filter-card': state.filters.card,
                'filter-who': state.filters.who,
                'filter-needcat': state.filters.needcat
            };
            
            Object.entries(filterElements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element && element.value !== value) {
                    element.value = value;
                }
            });
        }
        
        // Restore sort state
        if (state.sortState) {
            window.sortState = state.sortState;
            if (window.setSortState) {
                window.setSortState(state.sortState);
            }
        }
        
        // Re-render UI components
        const expensesToRender = state.filteredExpenses || state.expenses || [];
        
        // Update sort arrows
        if (window.updateSortArrows) {
            window.updateSortArrows();
        }
        
        // Apply filters (this should update filteredExpenses based on current filters)
        if (window.applyColumnFilters) {
            window.applyColumnFilters();
        }
        
        // Re-render components with the restored data
        if (window.renderExpenses) {
            window.renderExpenses(window.filteredExpenses || expensesToRender);
        }
        
        if (window.renderCharts) {
            window.renderCharts(expensesToRender);
        }
        
        if (window.renderFilters) {
            window.renderFilters(state.expenses || []);
        }
        
        if (window.updateSpendingBlocks) {
            window.updateSpendingBlocks(expensesToRender);
        }
        
        // Restore time period tabs
        if (window.createTimePeriodTabs) {
            window.createTimePeriodTabs();
        }
        
        console.log('✅ State restored successfully');
        
    } catch (error) {
        console.error('❌ Error restoring state:', error);
    } finally {
        // Always reset the flag
        isRestoringState = false;
    }
}

function pushUndoState() {
    // Don't capture state if we're in the middle of restoring
    if (isRestoringState) {
        console.log('🚫 Skipping undo state capture (currently restoring)');
        return;
    }
    
    const currentState = getAppStateSnapshot();
    
    // Don't push identical states
    if (undoStack.length > 0) {
        const lastState = undoStack[undoStack.length - 1];
        if (JSON.stringify(lastState.expenses) === JSON.stringify(currentState.expenses) &&
            JSON.stringify(lastState.filters) === JSON.stringify(currentState.filters) &&
            JSON.stringify(lastState.sortState) === JSON.stringify(currentState.sortState)) {
            console.log('🚫 Skipping identical state');
            return;
        }
    }
    
    undoStack.push(currentState);
    
    // Limit undo stack size to prevent memory issues
    if (undoStack.length > 50) {
        undoStack.shift();
    }
    
    // Clear redo stack on new action
    redoStack.length = 0;
    
    console.log(`📚 Undo stack size: ${undoStack.length}, Redo stack size: ${redoStack.length}`);
    
    // Update undo/redo button states
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) {
        console.log('🚫 No states to undo');
        return;
    }
    
    console.log('⏪ Performing undo');
    
    // Save current state to redo stack before undoing
    const currentState = getAppStateSnapshot();
    redoStack.push(currentState);
    
    // Get and restore previous state
    const previousState = undoStack.pop();
    restoreAppState(previousState);
    
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) {
        console.log('🚫 No states to redo');
        return;
    }
    
    console.log('⏩ Performing redo');
    
    // Save current state to undo stack before redoing
    const currentState = getAppStateSnapshot();
    undoStack.push(currentState);
    
    // Get and restore next state
    const nextState = redoStack.pop();
    restoreAppState(nextState);
    
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    // Update button states if they exist
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.title = undoStack.length === 0 ? 'Nothing to undo' : `Undo (${undoStack.length} actions available)`;
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.title = redoStack.length === 0 ? 'Nothing to redo' : `Redo (${redoStack.length} actions available)`;
    }
}

// Enhanced keyboard shortcuts for undo/redo
window.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        console.log('⌨️ Undo keyboard shortcut triggered');
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        console.log('⌨️ Redo keyboard shortcut triggered');
        redo();
    }
});

// Create undo/redo buttons if they don't exist
function createUndoRedoButtons() {
    // Check if buttons already exist
    if (document.getElementById('undoBtn') || document.getElementById('redoBtn')) {
        return;
    }
    
    // Find a good place to add the buttons (e.g., near other control buttons)
    const targetContainer = document.querySelector('.controls') || 
                           document.querySelector('.buttons') || 
                           document.querySelector('.header') ||
                           document.body;
    
    if (targetContainer) {
        const undoRedoContainer = document.createElement('div');
        undoRedoContainer.className = 'undo-redo-controls inline-flex gap-2 ml-4';
        undoRedoContainer.innerHTML = `
            <button id="undoBtn" class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Undo">
                ⏪ Undo
            </button>
            <button id="redoBtn" class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Redo">
                ⏩ Redo
            </button>
        `;
        
        targetContainer.appendChild(undoRedoContainer);
        
        // Attach event listeners
        document.getElementById('undoBtn').addEventListener('click', undo);
        document.getElementById('redoBtn').addEventListener('click', redo);
        
        console.log('✅ Undo/Redo buttons created');
    }
}

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

// Enhanced function to trigger undo state capture
function triggerUndoCapture(actionName = 'unknown') {
    console.log(`🎯 Triggering undo capture for action: ${actionName}`);
    // Small delay to ensure all state changes are complete
    setTimeout(() => {
        pushUndoState();
    }, 100);
}

// Main load function for expenses
async function loadExpensesMain() {
    console.log('📥 Loading expenses...');
    const expenses = await loadExpenses();
    setAllExpenses(expenses);
    setFilteredExpenses(expenses);
    // Force sort to newest first on load
    setSortState({ column: 'date', direction: -1 });
    // Apply initial sorting (by date, newest first)
    applyColumnFilters();
    updateSortArrows();
    renderFilters(expenses);
    renderCharts(expenses);
    // Save state after loading
    window.allExpenses = expenses;
    
    // Capture initial state after everything is loaded
    setTimeout(() => {
        pushUndoState();
        console.log('📸 Initial state captured after expense loading');
    }, 500);
}

// Main load function for statements
async function loadStatementsMain() {
    console.log('📥 Loading statements...');
    const statements = await loadStatements();
    window.statementsList = statements;
    renderStatements(statements);
    
    // Don't capture state here as it will be captured after expenses load
}

// Update spending summary blocks
function updateSpendingBlocks(expenses) {
    // Use the single source of truth function
    updateAllSpendingDisplays(expenses);
}

// DOMContentLoaded handler
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded - Initializing app...');
    
    // Setup UI components
    setupTabSwitching();
    setupUploadForm();
    setupDarkModeToggle();
    setupAnalyticsToggle();
    setupNotesArea();
    
    // Create undo/redo buttons
    createUndoRedoButtons();
    
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
    
    console.log('✅ App initialization complete');
});

// Make functions available globally for HTML onclick handlers
window.editCategoryEmoji = async (categoryName, currentEmoji) => {
    const { editCategoryEmoji } = await import('./categories.js');
    const result = await editCategoryEmoji(categoryName, currentEmoji);
    if (result) triggerUndoCapture('edit-category-emoji');
    return result;
};

window.addNewCategoryFromModal = async () => {
    const { addNewCategoryFromModal } = await import('./categories.js');
    const result = await addNewCategoryFromModal();
    if (result) triggerUndoCapture('add-category');
    return result;
};

window.editCategoryName = async (categoryName) => {
    const { editCategoryName } = await import('./categories.js');
    const result = await editCategoryName(categoryName);
    if (result) triggerUndoCapture('edit-category-name');
    return result;
};

window.deleteCategoryConfirm = async (categoryName) => {
    const { deleteCategoryConfirm } = await import('./categories.js');
    const result = await deleteCategoryConfirm(categoryName);
    if (result) triggerUndoCapture('delete-category');
    return result;
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
window.pushUndoState = pushUndoState;
window.triggerUndoCapture = triggerUndoCapture;
window.undo = undo;
window.redo = redo;

// Expose time period functions
window.createTimePeriodTabs = createTimePeriodTabs;