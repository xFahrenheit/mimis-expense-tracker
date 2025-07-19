// Main application entry point - Pure Client-Side Version
import { LocalAuth } from './local-auth.js';
import { LocalDatabase } from './local-database.js';
import { setAllExpenses, setFilteredExpenses, setSortState } from './config.js';
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

// Global auth and database instances
let auth = null;
let db = null;

// Register ChartDataLabels plugin globally
if (window.Chart && window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
}

// Initialize authentication system
async function initializeAuth() {
    auth = new LocalAuth();
    await auth.init();
    db = auth.db;

    // Setup login form
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const logoutBtn = document.getElementById('logoutBtn');

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const result = await auth.login(email, password);
        if (result.success) {
            showMainApp();
            await loadExpensesMain();
        } else {
            showMessage(result.error, 'error');
        }
    });

    // Registration form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        const result = await auth.register(email, password, name);
        if (result.success) {
            showMessage(result.message, 'success');
            // Switch back to login form
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        } else {
            showMessage(result.error, 'error');
        }
    });

    // Show register form
    showRegister.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    // Show login form
    showLogin.addEventListener('click', () => {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        auth.logout();
    });

    // Check if user is already logged in
    if (auth.isLoggedIn()) {
        showMainApp();
        await loadExpensesMain();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Update user info
    const user = auth.getCurrentUser();
    document.getElementById('userName').textContent = user.fullName;
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `mt-4 p-3 rounded-lg text-center ${
        type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Export/Import Data functionality
function initializeDataManagement() {
    const exportBtn = document.getElementById('exportDataBtn');
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');

    exportBtn.addEventListener('click', async () => {
        try {
            const data = await auth.exportUserData();
            if (data) {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showMessage('Data exported successfully!', 'success');
            }
        } catch (error) {
            showMessage('Export failed: ' + error.message, 'error');
        }
    });

    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const success = await auth.importUserData(data);
            
            if (success) {
                showMessage('Data imported successfully! Refreshing...', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showMessage('Import failed. Please check the file format.', 'error');
            }
        } catch (error) {
            showMessage('Import failed: ' + error.message, 'error');
        }
    });
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

// Updated initialize function
async function initialize() {
    // Initialize authentication first
    await initializeAuth();
    
    // Only initialize the rest if user is logged in
    if (auth.isLoggedIn()) {
        initializeSpendingBlocks();
        initializeAppTitle();
        initializeDataManagement();
        
        await loadHouseholdConfig();
        
        initializeCategories();
        
        renderFilters();
        attachFilterAndSortListeners();
        updateSortArrows();
        setupDarkModeToggle();
        setupAnalyticsToggle();
        
        setupTabSwitching();
        setupNotesArea();
        
        // Modified handlers for client-side
        setupUploadFormClientSide();
        attachDeleteAllBtnListener();
        
        // Initialize time periods
        initializeTimePeriods();
        createTimePeriodTabs();
        
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
            import('./category-modal.js').then(module => {
                module.showCategoryModal();
            });
        });
        
        document.getElementById('householdManagerBtn').addEventListener('click', showHouseholdModal);
        
        document.getElementById('exportCsvBtn').addEventListener('click', exportFilteredToCSV);
    }
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

// Modified upload form for client-side processing
function setupUploadFormClientSide() {
    const uploadForm = document.getElementById('uploadForm');
    if (!uploadForm) return;
    
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('statement');
        const cardSelect = document.getElementById('cardSelect');
        const customCardInput = document.getElementById('customCardInput');
        
        if (!fileInput.files[0]) {
            showMessage('Please select a file', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const cardType = cardSelect.value === 'other' ? customCardInput.value : cardSelect.value;
        
        try {
            showMessage('Processing file...', 'success');
            
            // Import the statement parser
            const { StatementParser } = await import('./statement-parser.js');
            
            // Parse the file
            const parsedExpenses = await StatementParser.parseFile(file, cardType);
            
            if (parsedExpenses.length === 0) {
                showMessage('No expenses found in the file', 'error');
                return;
            }
            
            // Add expenses to database
            const currentUser = auth.getCurrentUser();
            await db.addExpenses(parsedExpenses, currentUser.id);
            
            // Record the statement upload
            await db.addStatement({
                filename: file.name,
                cardType: cardType,
                expenseCount: parsedExpenses.length,
                totalAmount: parsedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            }, currentUser.id);
            
            // Reload expenses
            await loadExpensesMain();
            
            showMessage(`Successfully imported ${parsedExpenses.length} expenses!`, 'success');
            
            // Reset form
            uploadForm.reset();
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Upload failed: ' + error.message, 'error');
        }
    });
}

// Start the application
initialize();

// Initialize the app title
function initializeAppTitle() {
    document.title = USER_CONFIG.appTitle;
    const titleElements = document.querySelectorAll('.app-title');
    titleElements.forEach(el => {
        el.textContent = USER_CONFIG.appTitle;
    });
}

// Main load function for expenses (updated for client-side)
async function loadExpensesMain() {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) return;
    
    const expenses = await db.getExpenses(currentUser.id);
    setAllExpenses(expenses);
    setFilteredExpenses(expenses);
    
    // Force sort to newest first on load
    setSortState({ column: 'date', direction: -1 });
    
    renderExpenses();
    updateAllSpendingDisplays();
    calculateSpendingTotals();

    // Load statements for the statements table (client-side version)
    const statements = await db.getStatements(currentUser.id);
    renderStatements(statements);
    
    // Apply initial sorting and filters
    applyColumnFilters();
    updateSortArrows();
    
    // Render filters and charts
    renderFilters(expenses);
    renderCharts(expenses);
}

// Update spending summary blocks (client-side version)
function updateSpendingBlocks(expenses) {
    // Use the single source of truth function
    updateAllSpendingDisplays(expenses);
}
    
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

// Update spending summary blocks (client-side version)
function updateSpendingBlocks(expenses) {
    // Use the single source of truth function
    updateAllSpendingDisplays(expenses);
}

// Make category functions available globally for HTML onclick handlers
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