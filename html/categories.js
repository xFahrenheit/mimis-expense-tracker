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

// Add new category UI
export function addCategoryUI() {
    const filtersDiv = document.querySelector('.glass-block.flex.flex-wrap');
    if (!filtersDiv || document.getElementById('addCategoryInput')) return;
    const addDiv = document.createElement('div');
    addDiv.className = 'flex items-center gap-2';
    addDiv.innerHTML = `
        <input id="addCategoryInput" type="text" placeholder="New label..." class="rounded px-2 py-1 border text-sm" style="min-width:100px;" />
        <button id="addCategoryBtn" class="bg-green-500 text-white px-2 py-1 rounded">Add</button>
    `;
    filtersDiv.appendChild(addDiv);
    document.getElementById('addCategoryBtn').onclick = () => {
        const val = document.getElementById('addCategoryInput').value.trim().toLowerCase();
        if (!val || CATEGORY_LIST.includes(val)) return;
        CATEGORY_META[val] = { color: '#818cf8', icon: '🏷️' };
        CATEGORY_LIST.push(val);
        renderFilters(allExpenses);
        loadExpenses();
        document.getElementById('addCategoryInput').value = '';
    };
}