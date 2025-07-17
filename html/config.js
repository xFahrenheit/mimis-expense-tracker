// Configuration constants
export const API_URL = 'http://localhost:3001';

// Category metadata
export let CATEGORY_META = {
    food:      { color: '#a78bfa', icon: '🍔' },
    groceries: { color: '#22c55e', icon: '🛒' },
    entertainment: { color: '#f472b6', icon: '🎬' },
    travel:    { color: '#60a5fa', icon: '✈️' },
    utilities: { color: '#fbbf24', icon: '💡' },
    shopping:  { color: '#34d399', icon: '🛍️' },
    gifts:     { color: '#f87171', icon: '🎁' },
    medicines: { color: '#4ade80', icon: '💊' },
    charity:   { color: '#facc15', icon: '🤝' },
    school:    { color: '#38bdf8', icon: '🎓' },
};

export let CATEGORY_LIST = Object.keys(CATEGORY_META);

// Color palette for charts
export const CHART_COLORS = [
    '#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#f472b6','#38bdf8','#facc15','#4ade80','#f472b6'
];

// Global state variables
export let allExpenses = [];
export let filteredExpenses = [];
export let sortState = { column: null, direction: 1 }; // 1: asc, -1: desc

// State setters (these mutate the exported variables)
export const setAllExpenses = (expenses) => { 
    allExpenses.length = 0;
    allExpenses.push(...expenses);
    // Also update global window reference for compatibility
    window.allExpenses = allExpenses;
};

export const setFilteredExpenses = (expenses) => { 
    filteredExpenses.length = 0;
    filteredExpenses.push(...expenses);
    // Also update global window reference for compatibility
    window.filteredExpenses = filteredExpenses;
};

export const setSortState = (state) => { 
    Object.assign(sortState, state);
};

// Category helpers
export const addCategory = (name, meta) => {
    CATEGORY_META[name] = meta;
    CATEGORY_LIST.push(name);
};
