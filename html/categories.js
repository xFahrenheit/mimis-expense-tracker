import { CATEGORY_META, CATEGORY_LIST, addCategory } from './config.js';

// Add new category UI functionality
export function addCategoryUI() {
    const filtersDiv = document.querySelector('.glass-block.flex.flex-wrap');
    if (!filtersDiv || document.getElementById('addCategoryInput')) return;
    
    const addDiv = document.createElement('div');
    addDiv.className = 'flex items-center gap-2';
    addDiv.innerHTML = `
        <input id="addCategoryInput" type="text" placeholder="New label..." class="rounded px-2 py-1 border text-xs" style="min-width:100px;" />
        <button id="addCategoryBtn" class="bg-green-500 text-white px-2 py-1 rounded">Add</button>
    `;
    filtersDiv.appendChild(addDiv);
    
    document.getElementById('addCategoryBtn').onclick = () => {
        const val = document.getElementById('addCategoryInput').value.trim().toLowerCase();
        if (!val || CATEGORY_LIST.includes(val)) return;
        
        addCategory(val, { color: '#818cf8', icon: '🏷️' });
        
        // Re-render components that depend on categories
        if (window.renderFilters && window.allExpenses) {
            window.renderFilters(window.allExpenses);
        }
        if (window.loadExpenses) {
            window.loadExpenses();
        }
        
        document.getElementById('addCategoryInput').value = '';
    };
}

// Get category metadata for a given category
export function getCategoryMeta(category) {
    let cat = (category || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!CATEGORY_META[cat]) cat = 'shopping';
    return CATEGORY_META[cat];
}

// Get formatted category display with icon
export function getCategoryDisplay(category) {
    const meta = getCategoryMeta(category);
    const catName = category.charAt(0).toUpperCase() + category.slice(1);
    return `<span style="font-size:1.2em;vertical-align:middle;margin-right:4px;color:${meta.color};">${meta.icon}</span>${catName}`;
}