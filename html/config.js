// Configuration constants
export const API_URL = 'http://localhost:3001';

// Category metadata (will be loaded from backend)
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

// Load categories from backend
export async function loadCategoriesFromBackend() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json();
        
        CATEGORY_META = data.metadata;
        CATEGORY_LIST = data.categories;
        
        return { categories: CATEGORY_LIST, metadata: CATEGORY_META };
    } catch (error) {
        console.error('Failed to load categories from backend:', error);
        return { categories: CATEGORY_LIST, metadata: CATEGORY_META };
    }
}

// Color palette for charts
export const CHART_COLORS = [
    '#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#f472b6','#38bdf8','#facc15','#4ade80','#f472b6'
];

// Global state variables
export let allExpenses = [];
export let filteredExpenses = [];
export let sortState = { column: 'date', direction: 1 }; // 1: asc, -1: desc (default: oldest first)

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
