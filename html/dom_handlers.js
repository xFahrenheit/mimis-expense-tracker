import { setupDarkModeToggle, setupAnalyticsToggle } from './utils.js';
import { loadStatements, loadExpenses } from './api.js';
import { addCategoryUI } from './categories.js';

window.addEventListener('DOMContentLoaded', async () => {
    // ...tab switching logic...
    // ...set default tab...
    if (typeof addCategoryUI === 'function') addCategoryUI();
    if (typeof loadStatements === 'function') await loadStatements();
    if (typeof loadExpenses === 'function') await loadExpenses();
    setupDarkModeToggle();
    setupAnalyticsToggle();
});
