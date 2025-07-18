// Legacy compatibility shim for utils.js
// The functionality has been moved to a modular structure

// Just import main.js which will handle everything
import './main.js';

// Re-export some commonly used functions for backward compatibility
export { genColors, exportFilteredToCSV } from './helpers.js';
export { renderCharts } from './charts.js';
export { renderExpenses, renderFilters } from './render.js';
export { applyColumnFilters } from './filters.js';
export { API_URL, allExpenses, filteredExpenses } from './config.js';