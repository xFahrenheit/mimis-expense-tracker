// --- Register ChartDataLabels plugin globally ---
if (window.Chart && window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
}
// --- Unified DOMContentLoaded handler ---
// --- Make attachDeleteAllBtnListener globally accessible ---
function attachDeleteAllBtnListener() {
        const deleteAllBtn = document.getElementById('deleteAllBtn');
        if (!deleteAllBtn) {
            console.warn('[ExpenseTracker] Delete All Expenses button not found in DOM when attaching listener.');
            return;
        }
        deleteAllBtn.onclick = async () => {
            console.log('[ExpenseTracker] Delete All Expenses button clicked.');
            if (!confirm('Delete ALL expenses, statements, and overrides? This cannot be undone.')) return;
            deleteAllBtn.disabled = true;
            deleteAllBtn.textContent = 'Deleting...';
            try {
                const res = await fetch(`${API_URL}/delete_all_expenses`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    deleteAllBtn.textContent = 'Deleted!';
                    await loadStatements();
                    await loadExpenses();
                    renderFilters([]);
                    renderCharts([]);
                } else {
                    let msg = 'Error!';
                    try {
                        const data = await res.json();
                        if (data && data.error) msg = data.error;
                    } catch {}
                    deleteAllBtn.textContent = msg;
                }
            } catch (e) {
                deleteAllBtn.textContent = 'Error!';
            }
            setTimeout(() => {
                deleteAllBtn.textContent = 'Delete All Expenses';
                deleteAllBtn.disabled = false;
            }, 1200);
        };
    }
window.addEventListener('DOMContentLoaded', async () => {
    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
            document.getElementById('tab-' + tab).style.display = '';
        });
    });
    // Set default tab
    const defaultTabBtn = document.querySelector('.tab-btn[data-tab="expenses"]');
    if (defaultTabBtn) defaultTabBtn.classList.add('active');
    const defaultTab = document.getElementById('tab-expenses');
    if (defaultTab) defaultTab.style.display = '';

    // Load statements and expenses
    if (typeof addCategoryUI === 'function') addCategoryUI();
    if (typeof loadStatements === 'function') await loadStatements();
    if (typeof loadExpenses === 'function') await loadExpenses();

    // Attach listeners for filters and sorting
    [
        'filter-date-from', 'filter-date-to', 'filter-description',
        'filter-amount-min', 'filter-amount-max',
        'filter-category', 'filter-card', 'filter-who', 'filter-notes'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', applyColumnFilters);
        if (el && el.tagName === 'SELECT') el.addEventListener('change', applyColumnFilters);
    });
    ['th-date','th-amount','th-description'].forEach(id => {
        const th = document.getElementById(id);
        if (th) th.addEventListener('click', () => toggleSort(id.replace('th-','')));
    });
    // Helper to show inline autofill input (move to top-level scope)
    window.showAutofillInput = function(mode) {
        const bar = document.getElementById('filterbar-who');
        if (!bar) return;
        // Remove any existing autofill input
        let existing = bar.querySelector('.autofill-inline-input');
        if (existing) existing.remove();
        // Create input group
        const div = document.createElement('div');
        div.className = 'autofill-inline-input flex gap-2 mt-2';
        div.innerHTML = `
            <input type="text" id="autofill-who-input" name="autofill-who-input" class="autofill-who-input rounded px-2 py-1 text-xs border" placeholder="Enter spender name..." style="min-width:120px;" />
            <button class="autofill-confirm-btn btn-pastel">OK</button>
            <button class="autofill-cancel-btn btn-pastel bg-gray-200 text-gray-700">Cancel</button>
        `;
        bar.appendChild(div);
        const input = div.querySelector('.autofill-who-input');
        input.focus();
        // Decouple autofill from Who filter dropdown: hide dropdown while autofill input is open
        const whoFilter = document.getElementById('filter-who');
        if (whoFilter) whoFilter.style.display = 'none';
        // Confirm logic
        const confirm = async () => {
            const value = input.value.trim();
            if (!value) { input.focus(); return; }
            div.querySelectorAll('button').forEach(btn => btn.disabled = true);
            let success = true;
            // Patch: always use all visible rows, regardless of Who filter dropdown
            let ids;
            if (mode === 'all') {
                ids = allExpenses.filter(e => filteredExpenses.some(f => f.id === e.id)).map(e => e.id);
            } else if (mode === 'selected') {
                ids = (typeof getSelectedExpenseIds === 'function') ? getSelectedExpenseIds() : [];
                if (!ids.length) { alert('Select at least one row.'); div.remove(); return; }
            }
            for (const id of ids) {
                const res = await fetch(`${API_URL}/expense/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ who: value })
                });
                if (!res.ok) success = false;
            }
            await loadExpenses();
            if (!success) {
                alert('Some updates failed. Please check your connection or try again.');
            }
            div.remove();
        };
        div.querySelector('.autofill-confirm-btn').onclick = () => {
            confirm();
            if (whoFilter) whoFilter.style.display = '';
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') {
            confirm();
            if (whoFilter) whoFilter.style.display = '';
        }});
        div.querySelector('.autofill-cancel-btn').onclick = () => {
            div.remove();
            if (whoFilter) whoFilter.style.display = '';
        };
    };

    // Filter bar show/hide logic
    document.querySelectorAll('.filter-arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const col = arrow.getAttribute('data-filter');
            const bar = document.getElementById('filterbar-' + col);
            document.querySelectorAll('.filterbar').forEach(fb => {
                if (fb !== bar) fb.style.display = 'none';
            });
            if (bar) {
                bar.style.display = (bar.style.display === 'none' || bar.style.display === '') ? 'block' : 'none';
            }
        });
    });
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.filterbar').forEach(fb => {
            if (!fb.contains(e.target)) fb.style.display = 'none';
        });
    });

    // Initial load of allExpenses, filteredExpenses, and charts
    const res = await fetch(`${API_URL}/expenses`);
    allExpenses = await res.json();
    filteredExpenses = allExpenses;
    renderExpenses(allExpenses);
    renderFilters(allExpenses);
    renderCharts(allExpenses);

    // --- Autofill Spender (Who) Column ---
    // Helper: get selected row IDs
    function getSelectedExpenseIds() {
        const checkboxes = document.querySelectorAll('.autofill-row-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
    }

    // Autofill All
    // (Removed duplicate autofill button event listeners; handled in filter-arrow logic)
});

// --- Statement List & Re-import UI ---
async function loadStatements() {
    const res = await fetch(`${API_URL}/statements`);
    const statements = await res.json();
    renderStatements(statements);
}

// --- Make attachDeleteAllBtnListener globally accessible ---
function attachDeleteAllBtnListener() {
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    if (!deleteAllBtn) {
        console.warn('[ExpenseTracker] Delete All Expenses button not found in DOM when attaching listener.');
        return;
    }
    deleteAllBtn.onclick = async () => {
        console.log('[ExpenseTracker] Delete All Expenses button clicked.');
        if (!confirm('Delete ALL expenses, statements, and overrides? This cannot be undone.')) return;
        deleteAllBtn.disabled = true;
        deleteAllBtn.textContent = 'Deleting...';
        try {
            const res = await fetch(`${API_URL}/delete_all_expenses`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                deleteAllBtn.textContent = 'Deleted!';
                await loadStatements();
                await loadExpenses();
                renderFilters([]);
                renderCharts([]);
            } else {
                let msg = 'Error!';
                try {
                    const data = await res.json();
                    if (data && data.error) msg = data.error;
                } catch {}
                deleteAllBtn.textContent = msg;
            }
        } catch (e) {
            deleteAllBtn.textContent = 'Error!';
        }
        setTimeout(() => {
            deleteAllBtn.textContent = 'Delete All Expenses';
            deleteAllBtn.disabled = false;
        }, 1200);
    };
}

function renderStatements(statements) {
    let container = document.getElementById('statementsList');
    if (!container) {
        container = document.createElement('div');
        container.id = 'statementsList';
        container.className = 'glass-block p-4 mb-6';
        const parent = document.getElementById('tab-expenses');
        parent.insertBefore(container, parent.firstChild.nextSibling); // after upload form
    }
    container.innerHTML = `<h2 class="text-lg font-semibold mb-2" style="color: var(--mountbatten-pink);">Uploaded Statements</h2>`;
    attachDeleteAllBtnListener();
    if (!statements.length) {
        container.innerHTML += `<div style="color: var(--mountbatten-pink);">No statements uploaded yet.</div>`;
        return;
    }
    container.innerHTML += `<ul style="border-top: 1px solid var(--champagne-pink);">${statements.map(s => `
        <li class="flex items-center justify-between py-2">
            <span class="truncate">${s.filename} <span class="text-xs" style="color: var(--mountbatten-pink); opacity: 0.7;">(${new Date(s.upload_date).toLocaleString()})</span></span>
            <button class="reimport-btn btn-pastel ml-4" data-id="${s.id}">Re-import</button>
        </li>`).join('')}</ul>`;
    container.querySelectorAll('.reimport-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Re-importing...';
            const id = btn.getAttribute('data-id');
            const res = await fetch(`${API_URL}/statement/${id}/reimport`, { method: 'POST' });
            if (res.ok) {
                btn.textContent = 'Done!';
                loadExpenses();
                await loadStatements();
            } else {
                btn.textContent = 'Error!';
            }
            setTimeout(() => {
                btn.textContent = 'Re-import';
                btn.disabled = false;
            }, 1200);
        });
    });
    // Delete statement button logic
    container.querySelectorAll('.delete-statement-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this statement and all its expenses?')) return;
            btn.disabled = true;
            btn.textContent = 'Deleting...';
            const id = btn.getAttribute('data-id');
            const res = await fetch(`${API_URL}/statement/${id}`, { method: 'DELETE' });
            if (res.ok) {
                btn.textContent = 'Deleted!';
                await loadStatements();
                await loadExpenses();
            } else {
                btn.textContent = 'Error!';
            }
            setTimeout(() => {
                btn.textContent = 'Delete';
                btn.disabled = false;
            }, 1200);
        });
    });

}

// (Removed duplicate DOMContentLoaded handler above)
// Re-categorize All button logic
const recategorizeBtn = document.getElementById('recategorizeBtn');
if (recategorizeBtn) {
    recategorizeBtn.addEventListener('click', async () => {
        recategorizeBtn.disabled = true;
        recategorizeBtn.textContent = 'Re-categorizing...';
        try {
            const res = await fetch(`${API_URL}/recategorize`, { method: 'POST' });
            if (res.ok) {
                await loadExpenses();
                recategorizeBtn.textContent = 'Done!';
            } else {
                recategorizeBtn.textContent = 'Error!';
            }
        } catch (e) {
            recategorizeBtn.textContent = 'Error!';
        }
        setTimeout(() => {
            recategorizeBtn.textContent = 'Re-categorize All';
            recategorizeBtn.disabled = false;
        }, 1200);
    });
}
// Expense Tracker Frontend Logic

const API_URL = 'http://localhost:3001';

// Handle file upload
const uploadForm = document.getElementById('uploadForm');
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
    });
    if (res.ok) {
        alert('Statement uploaded and processed!');
        loadExpenses();
    } else {
        let msg = 'Upload failed.';
        try {
            const data = await res.json();
            if (data.duplicate) {
                msg = `Duplicate file detected: "${data.filename}" has already been uploaded.\nPlease upload a different statement.`;
            } else if (data.error) {
                msg = data.error;
            }
        } catch (e) {}
        alert(msg);
    }
});

// Load and render expenses
async function loadExpenses() {
    const res = await fetch(`${API_URL}/expenses`);
    const expenses = await res.json();
    allExpenses = expenses;
    renderExpenses(expenses);
    renderFilters(expenses);
    renderCharts(expenses);
    // Update total spending blocks
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    let gautami = 0, ameya = 0, splitTotal = 0;
    for (const e of expenses) {
        if (e.split_cost) {
            splitTotal += Number(e.amount || 0);
            // Each gets half of split expense
            if (e.who === 'Gautami') {
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            } else if (e.who === 'Ameya') {
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            } else {
                // If neither, just split between both
                gautami += Number(e.amount || 0) / 2;
                ameya += Number(e.amount || 0) / 2;
            }
        } else {
            if (e.who === 'Gautami') gautami += Number(e.amount || 0);
            if (e.who === 'Ameya') ameya += Number(e.amount || 0);
        }
    }
    const days = new Set(expenses.map(e => e.date)).size || 1;
    const months = new Set(expenses.map(e => (e.date||'').slice(0,7))).size || 1;
    document.getElementById('totalSpendingValue').textContent = `$${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('gautamiSpendingValue').textContent = `$${gautami.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('ameyaSpendingValue').textContent = `$${ameya.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('splitSpendingValue').textContent = `$${(splitTotal/2).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    document.getElementById('avgPerDay').textContent = `${(total/days).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/day`;
    document.getElementById('avgPerMonth').textContent = `${(total/months).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/mo`;
}

// --- Helper: Get last N months as YYYY-MM strings ---
function getLastNMonths(n) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
        months.push(d.toISOString().slice(0, 7));
    }
    return months;
}

// --- Helper: Export filtered table to CSV ---
function exportFilteredToCSV() {
    if (!filteredExpenses.length) return;
    const headers = ["Date","Description","Amount","Category","Need","Card","Who","Split","Outlier","Notes"];
    const rows = filteredExpenses.map(e => [
        e.date, e.description, e.amount, e.category, e.need_category, e.card, e.who, e.split_cost ? 'Yes' : '', e.outlier ? 'Yes' : '', e.notes
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
        csv += r.map(x => '"' + (x ? (''+x).replace(/"/g,'""') : '') + '"').join(',') + '\n';
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// --- Helper: Render quick filter chips ---
function renderQuickFilterChips(expenses) {
    const chipDiv = document.getElementById('quickFilterChips');
    if (!chipDiv) return;
    chipDiv.innerHTML = '';
    // Top 4 categories, 2 cards, 2 spenders, need/luxury
    const catCounts = {};
    const cardCounts = {};
    const whoCounts = {};
    const needCounts = { 'Need': 0, 'Luxury': 0 };
    expenses.forEach(e => {
        if (e.category) catCounts[e.category] = (catCounts[e.category]||0)+1;
        if (e.card) cardCounts[e.card] = (cardCounts[e.card]||0)+1;
        if (e.who) whoCounts[e.who] = (whoCounts[e.who]||0)+1;
        if (e.need_category === 'Luxury') needCounts['Luxury']++;
        else needCounts['Need']++;
    });
    function topN(obj, n) {
        return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0]);
    }
    const chips = [];
    topN(catCounts,4).forEach(c=>chips.push({type:'category',label:c}));
    topN(cardCounts,2).forEach(c=>chips.push({type:'card',label:c}));
    topN(whoCounts,2).forEach(c=>chips.push({type:'who',label:c}));
    ['Need','Luxury'].forEach(n=>chips.push({type:'need_category',label:n}));
    // Emoji map for chips
    const emojiMap = {
        // Categories (add/adjust as needed)
        'groceries': '🛒',
        'food': '🍽️',
        'shopping': '🛍️',
        'travel': '✈️',
        'utilities': '💡',
        'health': '🩺',
        'entertainment': '🎬',
        'subscriptions': '📦',
        'transport': '🚗',
        'rent': '🏠',
        'other': '❓',
        // Cards
        'chase sapphire': '💳',
        'venture x': '💳',
        'discover': '💳',
        // Spenders
        'Gautami': '👩',
        'Ameya': '👨',
        // Need/Luxury
        'Need': '🟢',
        'Luxury': '💎',
    };
    chips.forEach(chip => {
        const btn = document.createElement('button');
        btn.className = 'quick-chip';
        // Always show emoji for known types, but for custom (like Gautami, Ameya, Venture X), show text
        let lowerLabel = chip.label?.toLowerCase();
        let emoji = emojiMap[lowerLabel] || emojiMap[chip.label] || '';
        let isCustom = ['venture x','gautami','ameya'].includes(lowerLabel);
        btn.textContent = isCustom ? chip.label : (emoji ? `${emoji}` : chip.label);
        btn.title = chip.label;
        // On hover: switch to text, on mouseout: switch back to emoji (unless custom)
        if (!isCustom && emoji) {
            btn.addEventListener('mouseenter', () => { btn.textContent = chip.label; });
            btn.addEventListener('mouseleave', () => { btn.textContent = emoji; });
        }
        btn.onclick = () => {
            if (chip.type==='category') document.getElementById('filter-category').value = chip.label;
            if (chip.type==='card') document.getElementById('filter-card').value = chip.label;
            if (chip.type==='who') document.getElementById('filter-who').value = chip.label;
            if (chip.type==='need_category') document.getElementById('filter-needcat').value = chip.label;
            applyColumnFilters();
            renderQuickFilterChips(allExpenses);
        };
        chipDiv.appendChild(btn);
    });
    // Add clear button if any filter is active
    const categoryVal = document.getElementById('filter-category').value;
    const cardVal = document.getElementById('filter-card').value;
    const whoVal = document.getElementById('filter-who').value;
    const needVal = document.getElementById('filter-needcat')?.value;
    if (categoryVal || cardVal || whoVal || needVal) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'quick-chip clear-chip';
        clearBtn.textContent = 'Clear';
        clearBtn.onclick = () => {
            document.getElementById('filter-category').value = '';
            document.getElementById('filter-card').value = '';
            document.getElementById('filter-who').value = '';
            if (document.getElementById('filter-needcat')) document.getElementById('filter-needcat').value = '';
            applyColumnFilters();
            renderQuickFilterChips(allExpenses);
        };
        chipDiv.appendChild(clearBtn);
    }
}

// --- Helper: Render recent large expenses ---
function renderRecentLargeExpenses(expenses) {
    const block = document.getElementById('recentLargeBlock');
    if (!block) return;
    const sorted = [...expenses].sort((a,b)=>Number(b.amount)-Number(a.amount));
    const top3 = sorted.slice(0,3);
    block.innerHTML = '<div class="recent-large-title">Recent Large Expenses</div>'+
        '<ul class="recent-large-list">'+
        top3.map(e=>`<li><span class="recent-large-amt">$${Number(e.amount).toLocaleString(undefined,{maximumFractionDigits:2})}</span> <span class="recent-large-date">${e.date}</span> <span class="recent-large-desc">${e.description}</span></li>`).join('')+
        '</ul>';
}

// --- Helper: Render sparkline ---
// 12mo trend sparkline feature removed

// --- Helper: Render per-day/per-month average ---
function renderAverages(expenses) {
    const avgDay = document.getElementById('avgPerDay');
    const avgMonth = document.getElementById('avgPerMonth');
    if (!avgDay || !avgMonth || !expenses.length) return;
    const dates = expenses.map(e=>e.date).filter(Boolean).sort();
    const total = expenses.reduce((sum,e)=>sum+Number(e.amount||0),0);
    const first = dates[0], last = dates[dates.length-1];
    const days = first && last ? ( (new Date(last) - new Date(first)) / (1000*60*60*24) + 1 ) : 1;
    const months = first && last ? ( (new Date(last).getFullYear() - new Date(first).getFullYear())*12 + (new Date(last).getMonth() - new Date(first).getMonth()) + 1 ) : 1;
    avgDay.textContent = `$${(total/days).toLocaleString(undefined,{maximumFractionDigits:2})}/day`;
    avgMonth.textContent = `$${(total/months).toLocaleString(undefined,{maximumFractionDigits:2})}/mo`;
}

// --- Dark mode toggle ---
function setupDarkModeToggle() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    function setDark(dark) {
        document.documentElement.classList.toggle('dark-mode', dark);
        localStorage.setItem('darkMode', dark ? '1' : '0');
        btn.textContent = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
    btn.onclick = () => setDark(!document.documentElement.classList.contains('dark-mode'));
    // On load
    setDark(localStorage.getItem('darkMode')==='1');
}

// --- Monthly/Yearly toggle for analytics ---
function setupAnalyticsToggle() {
    const toggle = document.getElementById('analyticsToggle');
    if (!toggle) return;
    toggle.onchange = () => renderCharts(filteredExpenses);
}

// --- Patch: Export CSV button ---
document.addEventListener('DOMContentLoaded',()=>{
    const btn = document.getElementById('exportCsvBtn');
    if (btn) btn.onclick = exportFilteredToCSV;
    setupDarkModeToggle();
    setupAnalyticsToggle();
});

// Category color/icon map
let CATEGORY_META = {
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
let CATEGORY_LIST = Object.keys(CATEGORY_META);

// Add new category UI
function addCategoryUI() {
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

function renderExpenses(expenses) {
    // --- Update Total Spending Block ---
    const totalSpendingBlock = document.getElementById('totalSpendingBlock');
    const totalSpendingValue = document.getElementById('totalSpendingValue');
    if (totalSpendingBlock && totalSpendingValue) {
        const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        totalSpendingValue.textContent = '$' + total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    // --- Render averages ---
    renderAverages(expenses);
    // --- Render quick filter chips ---
    renderQuickFilterChips(allExpenses);
    // --- Render recent large expenses ---
    renderRecentLargeExpenses(expenses);
    const tbody = document.getElementById('expensesTableBody');
    tbody.innerHTML = '';
    // --- Ensure autofill selection checkboxes column is always present in header ---
    let headerRow = tbody.parentElement.querySelector('thead tr');
    if (headerRow) {
        // Remove any existing autofill header cell to avoid duplicates
        if (headerRow.firstElementChild && headerRow.firstElementChild.querySelector('.autofill-header-checkbox')) {
            headerRow.removeChild(headerRow.firstElementChild);
        }
        // Insert autofill header cell as first column
        const th = document.createElement('th');
        th.className = 'py-2 px-3 text-center';
        th.innerHTML = '<input type="checkbox" class="autofill-header-checkbox" title="Select all rows for autofill" />';
        headerRow.insertBefore(th, headerRow.firstChild);
    }
    // Add event for header checkbox (select all)
    setTimeout(() => {
        const headerCb = document.querySelector('.autofill-header-checkbox');
        if (headerCb) {
            headerCb.onclick = () => {
                const cbs = tbody.querySelectorAll('.autofill-row-checkbox');
                cbs.forEach(cb => { cb.checked = headerCb.checked; });
            };
        }
    }, 0);
    // Add row for manual entry at the top
    const addTr = document.createElement('tr');
    addTr.innerHTML = `
        <td class="py-2 px-3 text-center"></td> <!-- Autofill selection column -->
        <td class="py-2 px-3 text-center"></td> <!-- Delete button column (empty for add row) -->
        <td class="py-2 px-3"><input type="date" class="add-date w-full px-1 py-1 rounded text-xs" /></td>
        <td class="py-2 px-3"><input type="text" class="add-description w-full px-1 py-1 rounded text-xs" placeholder="Description" /></td>
        <td class="py-2 px-3"><input type="number" class="add-amount w-full px-1 py-1 rounded text-xs" placeholder="$" step="0.01" /></td>
        <td class="py-2 px-3" style="text-align:center;">
            <select class="add-category w-full px-1 py-1 rounded text-xs">
                ${CATEGORY_LIST.map(c => `<option value="${c}">${CATEGORY_META[c].icon} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
            </select>
        </td>
        <td class="py-2 px-3" style="text-align:center;">
            <select class="add-needcat w-full px-1 py-1 rounded text-xs">
                <option value="Need">Need</option>
                <option value="Luxury">Luxury</option>
            </select>
        </td>
        <td class="py-2 px-3"><input type="text" class="add-card w-full px-1 py-1 rounded text-xs" placeholder="Card" /></td>
        <td class="py-2 px-3">
            <select class="add-who w-full px-1 py-1 rounded text-xs">
                <option value="Ameya">Ameya</option>
                <option value="Gautami">Gautami</option>
                <option value="__custom__">Other...</option>
            </select>
            <input type="text" class="add-who-custom w-full px-1 py-1 rounded text-xs mt-1" placeholder="Enter name" style="display:none;" />
        </td>
        <td class="py-2 px-3 text-center"><input type="checkbox" class="add-split" /></td>
        <td class="py-2 px-3 text-center"><input type="checkbox" class="add-outlier" /></td>
        <td class="py-2 px-3"><input type="text" class="add-notes w-full px-1 py-1 rounded text-xs" placeholder="Notes" /></td>
        <td class="py-2 px-3 text-center"><button class="add-expense-btn bg-green-500 text-white px-2 py-1 rounded">＋</button></td>
    `;
    tbody.appendChild(addTr);

    // Spender custom input logic
    const whoSelect = addTr.querySelector('.add-who');
    const whoCustom = addTr.querySelector('.add-who-custom');
    whoSelect.addEventListener('change', () => {
        if (whoSelect.value === '__custom__') {
            whoCustom.style.display = '';
            whoCustom.required = true;
            whoCustom.focus();
        } else {
            whoCustom.style.display = 'none';
            whoCustom.required = false;
        }
    });

    // Add event for manual add
    addTr.querySelector('.add-expense-btn').addEventListener('click', async () => {
        const date = addTr.querySelector('.add-date').value;
        const description = addTr.querySelector('.add-description').value;
        const amount = addTr.querySelector('.add-amount').value;
        const category = addTr.querySelector('.add-category').value;
        const need_category = addTr.querySelector('.add-needcat').value;
        const card = addTr.querySelector('.add-card').value;
        let who = addTr.querySelector('.add-who').value;
        const whoCustom = addTr.querySelector('.add-who-custom').value.trim();
        if (who === '__custom__' && whoCustom) {
            who = whoCustom;
            // Add to dropdown for future use
            if (![...whoSelect.options].some(opt => opt.value === who)) {
                const opt = document.createElement('option');
                opt.value = who;
                opt.textContent = who;
                whoSelect.appendChild(opt);
            }
        }
        const split_cost = addTr.querySelector('.add-split').checked;
        const outlier = addTr.querySelector('.add-outlier').checked;
        const notes = addTr.querySelector('.add-notes').value;
        if (!date || !description || !amount) {
            alert('Date, Description, and Amount are required.');
            return;
        }
        await fetch(`${API_URL}/expense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, description, amount, category, need_category, card, who, split_cost, outlier, notes })
        });
        loadExpenses();
    });

    // --- Render all expenses rows (each cell editable on click) ---
    expenses.forEach(exp => {
        let cat = (exp.category || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!CATEGORY_META[cat]) cat = 'shopping';
        const meta = CATEGORY_META[cat];
        let needCat = exp.need_category || 'Need';
        let needBadgeClass = needCat === 'Luxury' ? 'luxury-badge' : 'need-badge';
        const splitChecked = exp.split_cost ? 'checked' : '';
        const outlierChecked = exp.outlier ? 'checked' : '';
        const tr = document.createElement('tr');
        // Autofill selection checkbox
        tr.innerHTML = `
            <td class="py-2 px-3 text-center"><input type="checkbox" class="autofill-row-checkbox" data-id="${exp.id}" /></td>
            <td class="py-2 px-3 text-center">
                <button class="text-red-400 hover:text-red-600 font-bold text-lg delete-row-btn" data-id="${exp.id}" title="Delete">×</button>
            </td>
            <td class="py-2 px-3 editable-cell" data-field="date" data-id="${exp.id}">${exp.date || ''}</td>
            <td class="py-2 px-3 editable-cell" data-field="description" data-id="${exp.id}">${exp.description || ''}</td>
            <td class="py-2 px-3 editable-cell" data-field="amount" data-id="${exp.id}">$${Number(exp.amount).toFixed(2)}</td>
            <td class="py-2 px-3 editable-cell" data-field="category" data-id="${exp.id}" style="text-align:center;">
                <span style="font-size:1.2em;vertical-align:middle;margin-right:4px;color:${meta.color};">${meta.icon}</span>
                ${cat.charAt(0).toUpperCase()+cat.slice(1)}
            </td>
            <td class="py-2 px-3 editable-cell" data-field="need_category" data-id="${exp.id}" style="text-align:center;"><span class="${needBadgeClass}">${needCat}</span></td>
            <td class="py-2 px-3 editable-cell" data-field="card" data-id="${exp.id}">${exp.card || ''}</td>
            <td class="py-2 px-3 editable-cell" data-field="who" data-id="${exp.id}">${(exp.who === 'Ameya' || exp.who === 'Gautami') ? exp.who : (exp.who ? `<span class='custom-who'>${exp.who}</span>` : '')}</td>
            <td class="py-2 px-3 text-center"><input type="checkbox" class="split-checkbox" data-id="${exp.id}" ${splitChecked}></td>
            <td class="py-2 px-3 text-center"><input type="checkbox" class="outlier-checkbox" data-id="${exp.id}" ${outlierChecked}></td>
            <td class="py-2 px-3 editable-cell" data-field="notes" data-id="${exp.id}">${exp.notes || ''}</td>
        `;
        tbody.appendChild(tr);
        // Attach split checkbox event listener
        const splitCb = tr.querySelector('.split-checkbox');
        if (splitCb) {
            splitCb.addEventListener('change', async (e) => {
                const checked = splitCb.checked;
                await fetch(`${API_URL}/expense/${exp.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ split_cost: checked })
                });
                loadExpenses();
            });
        }
        // Attach outlier checkbox event listener
        const outlierCb = tr.querySelector('.outlier-checkbox');
        if (outlierCb) {
            outlierCb.addEventListener('change', async (e) => {
                const checked = outlierCb.checked;
                await fetch(`${API_URL}/expense/${exp.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ outlier: checked })
                });
                loadExpenses();
            });
        }
        // Attach notes edit event listener
        const notesCell = tr.querySelector('[data-field="notes"]');
        if (notesCell) {
            notesCell.addEventListener('blur', async (e) => {
                const value = notesCell.textContent;
                await fetch(`${API_URL}/expense/${exp.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: value })
                });
                loadExpenses();
            });
        }
    });
    // Attach cell click event listeners for inline editing
    setTimeout(() => {
        // Only one cell in edit mode at a time
        let editingCell = null;
        let originalContent = '';

        function exitEditMode(save = false) {
            if (!editingCell) return;
            let didSave = false;
            if (save) {
                const id = editingCell.getAttribute('data-id');
                const field = editingCell.getAttribute('data-field');
                const exp = expenses.find(e => e.id == id);
                let value;
                if (field === 'who') {
                    const whoSelect = editingCell.querySelector('.edit-inline-who');
                    const whoCustom = editingCell.querySelector('.edit-inline-who-custom');
                    value = whoSelect.value;
                    if (value === '__custom__') {
                        value = whoCustom.value.trim();
                        // Add to dropdown for future use
                        if (value && ![...whoSelect.options].some(opt => opt.value === value)) {
                            const opt = document.createElement('option');
                            opt.value = value;
                            opt.textContent = value;
                            whoSelect.appendChild(opt);
                        }
                    }
                } else if (field === 'category') {
                    const catSelect = editingCell.querySelector('.edit-inline-category');
                    value = catSelect.value;
                } else {
                    const input = editingCell.querySelector('input,select');
                    value = input.value;
                }
                if (exp) {
                    didSave = true;
                    // Don't immediately re-render the cell, just leave it in edit mode until the backend confirms
                    saveInlineEdit(editingCell, exp, field, value, true);
                    return; // Don't exit edit mode yet
                }
            }
            // Only re-render cell if not saving (to avoid flicker/old value overwrite)
            if (!didSave) {
                editingCell.innerHTML = originalContent;
                editingCell.classList.remove('editing-cell');
                editingCell = null;
                originalContent = '';
            }
            // If didSave, do not exit edit mode here; let saveInlineEdit handle it after backend update
        }

        // --- PATCH: Replace saveInlineEdit to support closeCellAfter --- //
        // Find the original saveInlineEdit definition and replace it:
        renderExpenses.saveInlineEdit = async function saveInlineEdit(cell, exp, field, value, closeCellAfter = false) {
            // PATCH to backend
            const id = exp.id;
            const payload = { [field]: value };
            await fetch(`${API_URL}/expense/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // Update local data
            exp[field] = value;
            // Re-render the table row (just reload all for simplicity)
            await loadExpenses();
            // If called from inline edit, close the cell after update
            if (closeCellAfter) {
                if (cell) {
                    cell.classList.remove('editing-cell');
                }
                editingCell = null;
                originalContent = '';
            }
        }

        // Patch all calls to saveInlineEdit to use the new one
        window.saveInlineEdit = renderExpenses.saveInlineEdit;

        tbody.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (editingCell && editingCell !== cell) {
                    exitEditMode();
                }
                if (cell.classList.contains('editing-cell')) return;
                editingCell = cell;
                originalContent = cell.innerHTML;
                cell.classList.add('editing-cell');
                const id = cell.getAttribute('data-id');
                const field = cell.getAttribute('data-field');
                const exp = expenses.find(e => e.id == id);
                let inputHtml = '';
                if (field === 'category') {
                    let cat = (exp.category || '').toLowerCase().replace(/[^a-z]/g, '');
                    let catOptions = CATEGORY_LIST.map(c => {
                        const m = CATEGORY_META[c];
                        return `<option value="${c}" ${c===cat?'selected':''} data-icon="${m.icon}" data-color="${m.color}">${m.icon} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`;
                    }).join('');
                    inputHtml = `<select class="edit-inline-category">${catOptions}</select>`;
                } else if (field === 'need_category') {
                    let needCat = exp.need_category || 'Need';
                    inputHtml = `<select class="edit-inline-needcat"><option value="Need" ${needCat==='Need'?'selected':''}>Need</option><option value="Luxury" ${needCat==='Luxury'?'selected':''}>Luxury</option></select>`;
                } else if (field === 'amount') {
                    inputHtml = `<input type="number" class="edit-inline-amount w-full px-1 py-1 rounded text-xs" value="${exp.amount || ''}" step="0.01" />`;
                } else if (field === 'date') {
                    inputHtml = `<input type="date" class="edit-inline-date w-full px-1 py-1 rounded text-xs" value="${exp.date || ''}" />`;
                } else if (field === 'who') {
                    // Spender edit: dropdown with Ameya, Gautami, or custom
                    let whoVal = exp.who || '';
                    inputHtml = `<select class="edit-inline-who w-full px-1 py-1 rounded text-xs">
                        <option value="Ameya" ${whoVal==='Ameya'?'selected':''}>Ameya</option>
                        <option value="Gautami" ${whoVal==='Gautami'?'selected':''}>Gautami</option>
                        <option value="__custom__" ${(whoVal!=='Ameya'&&whoVal!=='Gautami')?'selected':''}>Other...</option>
                    </select>
                    <input type="text" class="edit-inline-who-custom w-full px-1 py-1 rounded text-xs mt-1" placeholder="Enter name" style="display:${(whoVal!=='Ameya'&&whoVal!=='Gautami')?'':'none'};" value="${(whoVal!=='Ameya'&&whoVal!=='Gautami')?whoVal:''}" />`;
                } else {
                    inputHtml = `<input type="text" class="edit-inline-${field} w-full px-1 py-1 rounded text-xs" value="${exp[field] || ''}" />`;
                }
                cell.innerHTML = inputHtml;
                const input = cell.querySelector('input,select');
                if (field === 'who') {
                    const whoSelect = cell.querySelector('.edit-inline-who');
                    const whoCustom = cell.querySelector('.edit-inline-who-custom');
                    whoSelect.addEventListener('change', () => {
                        if (whoSelect.value === '__custom__') {
                            whoCustom.style.display = '';
                            whoCustom.required = true;
                            whoCustom.focus();
                        } else {
                            whoCustom.style.display = 'none';
                            whoCustom.required = false;
                        }
                    });
                }
                if (input) input.focus();
                // Save on blur or enter
                input.addEventListener('blur', () => {
                    if (field === 'who') {
                        const whoSelect = cell.querySelector('.edit-inline-who');
                        const whoCustom = cell.querySelector('.edit-inline-who-custom');
                        let whoVal = whoSelect.value;
                        if (whoVal === '__custom__') {
                            whoVal = whoCustom.value.trim();
                            // Add to dropdown for future use
                            if (whoVal && ![...whoSelect.options].some(opt => opt.value === whoVal)) {
                                const opt = document.createElement('option');
                                opt.value = whoVal;
                                opt.textContent = whoVal;
                                whoSelect.appendChild(opt);
                            }
                        }
                        saveInlineEdit(cell, exp, field, whoVal);
                    } else {
                        saveInlineEdit(cell, exp, field, input.value);
                    }
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        if (field === 'who') {
                            const whoSelect = cell.querySelector('.edit-inline-who');
                            const whoCustom = cell.querySelector('.edit-inline-who-custom');
                            let whoVal = whoSelect.value;
                            if (whoVal === '__custom__') {
                                whoVal = whoCustom.value.trim();
                                if (whoVal && ![...whoSelect.options].some(opt => opt.value === whoVal)) {
                                    const opt = document.createElement('option');
                                    opt.value = whoVal;
                                    opt.textContent = whoVal;
                                    whoSelect.appendChild(opt);
                                }
                            }
                            saveInlineEdit(cell, exp, field, whoVal);
                        } else {
                            saveInlineEdit(cell, exp, field, input.value);
                        }
                    } else if (e.key === 'Escape') {
                        exitEditMode(false);
                    }
                });
                // Prevent click bubbling to tbody
                e.stopPropagation();
            });
        });

        // Exit edit mode when clicking outside any cell
        document.addEventListener('click', function docClick(e) {
            if (editingCell && !editingCell.contains(e.target)) {
                exitEditMode();
            }
        }, { capture: true });

        // Attach delete event listeners
        tbody.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                if (confirm('Delete this row?')) {
                    await fetch(`${API_URL}/expense/${id}`, { method: 'DELETE' });
                    loadExpenses();
                }
                e.stopPropagation();
            });
        });
    }, 0);
}
// (Removed duplicate tab switching DOMContentLoaded handler above)

// Render filters
function renderFilters(expenses) {
    // Populate dropdowns for category, card, who
    const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];
    const cards = [...new Set(expenses.map(e => e.card).filter(Boolean))];
    // Always show Gautami, Ameya, Other in Who filter, plus any others present
    const defaultWhos = ['Gautami', 'Ameya', 'Other'];
    const whos = Array.from(new Set([...defaultWhos, ...expenses.map(e => e.who).filter(Boolean)]));
    const categoryFilter = document.getElementById('filter-category');
    const cardFilter = document.getElementById('filter-card');
    const whoFilter = document.getElementById('filter-who');
    if (categoryFilter) categoryFilter.innerHTML = '<option value="">All</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (cardFilter) cardFilter.innerHTML = '<option value="">All</option>' + cards.map(c => `<option value="${c}">${c}</option>`).join('');
    if (whoFilter) whoFilter.innerHTML = '<option value="">All</option>' + whos.map(w => `<option value="${w}">${w}</option>`).join('');

    // Always attach autofill button listeners after rendering Who filter bar
    setTimeout(() => {
        const autofillWhoAllBtn = document.getElementById('autofillWhoAllBtn');
        if (autofillWhoAllBtn) {
            autofillWhoAllBtn.onclick = () => {
                const bar = document.getElementById('filterbar-who');
                if (bar) {
                    bar.style.display = 'block';
                    let existing = bar.querySelector('.autofill-inline-input');
                    if (existing) existing.remove();
                    if (typeof showAutofillInput === 'function') showAutofillInput('all');
                }
            };
        }
        const autofillWhoSelectedBtn = document.getElementById('autofillWhoSelectedBtn');
        if (autofillWhoSelectedBtn) {
            autofillWhoSelectedBtn.onclick = () => {
                const bar = document.getElementById('filterbar-who');
                if (bar) {
                    bar.style.display = 'block';
                    let existing = bar.querySelector('.autofill-inline-input');
                    if (existing) existing.remove();
                    if (typeof showAutofillInput === 'function') showAutofillInput('selected');
                }
            };
        }
    }, 0);
}


let allExpenses = [];
let filteredExpenses = [];
let sortState = { column: null, direction: 1 }; // 1: asc, -1: desc

function applyColumnFilters() {
    // Date range
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    // Description
    const descVal = document.getElementById('filter-description').value.toLowerCase();
    // Amount min/max
    const amtMin = document.getElementById('filter-amount-min').value;
    const amtMax = document.getElementById('filter-amount-max').value;
    // Dropdowns
    const catVal = document.getElementById('filter-category').value;
    const cardVal = document.getElementById('filter-card').value;
    const whoVal = document.getElementById('filter-who').value;
    const needVal = document.getElementById('filter-needcat')?.value;
    // Notes
    const notesVal = document.getElementById('filter-notes').value.toLowerCase();
    filteredExpenses = allExpenses.filter(e => {
        // Date range filter
        let dateOk = true;
        if (dateFrom && e.date) dateOk = e.date >= dateFrom;
        if (dateTo && e.date) dateOk = dateOk && e.date <= dateTo;
        // Amount min/max
        let amtOk = true;
        if (amtMin !== "" && e.amount !== undefined) amtOk = Number(e.amount) >= Number(amtMin);
        if (amtMax !== "" && e.amount !== undefined) amtOk = amtOk && Number(e.amount) <= Number(amtMax);
        // Category, Card, Who, Need
        let catOk = !catVal || (e.category === catVal);
        let cardOk = !cardVal || (e.card === cardVal);
        let whoOk = !whoVal || (e.who === whoVal);
        let needOk = !needVal || (e.need_category === needVal);
        // Description, Notes
        let descOk = !descVal || (e.description && e.description.toLowerCase().includes(descVal));
        let notesOk = !notesVal || (e.notes && e.notes.toLowerCase().includes(notesVal));
        return dateOk && amtOk && catOk && cardOk && whoOk && needOk && descOk && notesOk;
    });
    // Sorting
    if (sortState.column) {
        filteredExpenses.sort((a, b) => {
            let v1 = a[sortState.column], v2 = b[sortState.column];
            if (sortState.column === 'amount') {
                v1 = Number(v1); v2 = Number(v2);
            }
            if (sortState.column === 'date') {
                v1 = v1 || '';
                v2 = v2 || '';
                return (v1.localeCompare(v2)) * sortState.direction;
            }
            if (v1 === undefined) v1 = '';
            if (v2 === undefined) v2 = '';
            if (typeof v1 === 'number' && typeof v2 === 'number') return (v1 - v2) * sortState.direction;
            return v1.toString().localeCompare(v2.toString()) * sortState.direction;
        });
    }
    renderExpenses(filteredExpenses);
    renderCharts(filteredExpenses);
}


// Attach filter and sort listeners after filters are rendered
function attachFilterAndSortListeners() {
    [
        'filter-date-from', 'filter-date-to', 'filter-description',
        'filter-amount-min', 'filter-amount-max',
        'filter-category', 'filter-card', 'filter-who', 'filter-notes'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', applyColumnFilters);
        if (el && el.tagName === 'SELECT') el.addEventListener('change', applyColumnFilters);
    });
    // Sorting listeners
    const thDate = document.getElementById('th-date');
    const thAmount = document.getElementById('th-amount');
    const thDescription = document.getElementById('th-description');
    if (thDate) thDate.addEventListener('click', () => toggleSort('date'));
    if (thAmount) thAmount.addEventListener('click', () => toggleSort('amount'));
    if (thDescription) thDescription.addEventListener('click', () => toggleSort('description'));
    // Filter bar show/hide logic
    document.querySelectorAll('.filter-arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const col = arrow.getAttribute('data-filter');
            const bar = document.getElementById('filterbar-' + col);
            document.querySelectorAll('.filterbar').forEach(fb => {
                if (fb !== bar) fb.style.display = 'none';
            });
            if (bar) {
                bar.style.display = (bar.style.display === 'none' || bar.style.display === '') ? 'block' : 'none';
            }
        });
    });
    // Hide filterbars if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-arrow') && !e.target.closest('.filterbar')) {
            document.querySelectorAll('.filterbar').forEach(fb => fb.style.display = 'none');
        }
    });
}

// Patch renderFilters to always attach listeners after rendering
const origRenderFilters = renderFilters;
renderFilters = function(expenses) {
    origRenderFilters(expenses);
    attachFilterAndSortListeners();
}

function toggleSort(column) {
    if (sortState.column === column) {
        sortState.direction *= -1;
    } else {
        sortState.column = column;
    }
    // Update sort arrows
    ['date','amount','description'].forEach(col => {
        const el = document.getElementById('sort-' + col);
        if (el) el.textContent = (sortState.column === col)
            ? (sortState.direction === 1 ? '↑' : '↓')
            : '⇅';
    });
    applyColumnFilters();
}

// Render charts
function renderCharts(expenses) {
    // --- Monthly/Yearly Toggle ---
    const toggle = document.getElementById('analyticsToggle');
    const mode = toggle && toggle.value === 'yearly' ? 'yearly' : 'monthly';
    // --- Monthly/Yearly Bar Chart ---
    const group = {};
    expenses.forEach(e => {
        if (!e.date) return;
        const key = mode === 'yearly' ? e.date.slice(0,4) : e.date.slice(0,7);
        group[key] = (group[key]||0) + Number(e.amount);
    });
    const ctxMonthlyBar = document.getElementById('monthlyBarChart')?.getContext('2d');
    if (ctxMonthlyBar) {
        if (window.monthlyBarChart && typeof window.monthlyBarChart.destroy === 'function') {
            window.monthlyBarChart.destroy();
        }
        window.monthlyBarChart = new Chart(ctxMonthlyBar, {
            type: 'bar',
            data: {
                labels: Object.keys(group),
                datasets: [{
                    data: Object.values(group),
                    backgroundColor: [
                        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--zomp').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--champagne-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--mountbatten-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--cherry-blossom-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--platinum').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--davys-gray').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--dim-gray').trim()
                    ],
                    borderRadius: 16,
                    barPercentage: 0.65,
                    categoryPercentage: 0.55,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `$${value.toLocaleString()} (${percent}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#222',
                        font: { size: 16, family: 'Montserrat', weight: '700' },
                        anchor: 'end',
                        align: 'end',
                        formatter: function(value, context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                            return percent + '%';
                        }
                    }
                },
                layout: { padding: 32 },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: 'var(--mountbatten-pink)', font: { size: 20, family: 'Montserrat', weight: '700' } }
                    },
                    y: {
                        grid: { color: 'rgba(157,129,137,0.08)' },
                        ticks: { color: 'var(--mountbatten-pink)', font: { size: 20, family: 'Montserrat', weight: '700' }, beginAtZero: true }
                    }
                }
            },
            plugins: [window.ChartDataLabels]
        });
        ctxMonthlyBar.canvas.parentNode.style.maxWidth = '1100px';
        ctxMonthlyBar.canvas.parentNode.style.margin = '0 auto';
        ctxMonthlyBar.canvas.height = 520;
        ctxMonthlyBar.canvas.width = 1000;
    }

    // --- Category Pie Chart with Emoji Legends ---
    // --- Pie Chart Datalabels Config ---
    const pieDatalabelsConfig = {
        color: '#222',
        font: { size: 18, family: 'Montserrat', weight: '700' },
        formatter: function(value, context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
            return percent + '%';
        },
        display: true,
        align: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 'end' : 'center';
        },
        anchor: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 'end' : 'center';
        },
        backgroundColor: null,
        borderColor: '#222',
        borderWidth: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 1.5 : 0;
        },
        borderRadius: 4,
        clamp: false,
        clip: false,
        offset: function(context) {
            // Stagger small labels vertically to avoid overlap
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            if (percent < 6) {
                // Alternate up/down and increase offset for each small slice
                const idx = context.dataIndex;
                return 36 + (idx % 2 === 0 ? 1 : -1) * (12 + 6 * Math.floor(idx / 2));
            }
            return 0;
        },
        callout: {
            display: function(context) {
                const value = context.dataset.data[context.dataIndex];
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total ? (value / total) * 100 : 0;
                return percent < 6;
            },
            side: 'border',
            start: '120%',
            length: 64,
            borderColor: '#222',
            borderWidth: 2,
        }
    };

    // --- Category Pie Chart with Emoji Legends ---
    const byCategory = {};
    expenses.forEach(e => {
        const cat = (e.category || 'Unknown').toLowerCase();
        byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    });
    // Emoji map for common categories
    const catEmojis = {
        groceries: '🛒', food: '🍽️', dining: '🍽️', restaurant: '🍽️',
        travel: '✈️', transport: '🚗', gas: '⛽', fuel: '⛽',
        shopping: '🛍️', clothes: '👗', utilities: '💡',
        rent: '🏠', mortgage: '🏠', health: '💊', medical: '💊',
        entertainment: '🎬', fun: '🎉', subscription: '📺',
        kids: '🧒', baby: '🍼', pets: '🐾',
        gifts: '🎁', charity: '🤝', tax: '💸', insurance: '🛡️',
        other: '📦', unknown: '❓'
    };
    const catLabels = Object.keys(byCategory).map(cat => {
        let base = cat.replace(/_/g,' ');
        let emoji = catEmojis[cat] || '';
        return emoji ? `${emoji} ${base.charAt(0).toUpperCase()+base.slice(1)}` : base.charAt(0).toUpperCase()+base.slice(1);
    });
    const ctxCat = document.getElementById('categoryPieChart')?.getContext('2d');
    if (ctxCat) {
        if (window.categoryChart) window.categoryChart.destroy();
        window.categoryChart = new Chart(ctxCat, {
            type: 'pie',
            data: {
                labels: catLabels,
                datasets: [{
                    data: Object.values(byCategory),
                    backgroundColor: [
                        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--zomp').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--champagne-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--mountbatten-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--cherry-blossom-pink').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--platinum').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--davys-gray').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--dim-gray').trim()
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `$${value.toLocaleString()} (${percent}%)`;
                            }
                        }
                    },
                    datalabels: pieDatalabelsConfig
                },
                layout: { padding: 24 },
            },
            plugins: [window.ChartDataLabels]
        });
        ctxCat.canvas.parentNode.style.maxWidth = '900px';
        ctxCat.canvas.parentNode.style.margin = '0 auto';
        ctxCat.canvas.height = 480;
        ctxCat.canvas.width = 800;
    }

    // --- Needs vs Luxury Pie Chart with Emoji Legends ---
    // --- Needs vs Luxury Pie Chart with Emoji Legends ---
    const needLuxury = { Need: 0, Luxury: 0 };
    expenses.forEach(e => {
        const n = (e.need_category || 'Need');
        needLuxury[n] = (needLuxury[n] || 0) + Number(e.amount);
    });
    const needLuxuryEmojis = { Need: '🛒', Luxury: '💎' };
    const needLuxuryLabels = Object.keys(needLuxury).map(k => `${needLuxuryEmojis[k]||''} ${k}`);
    const ctxNeed = document.getElementById('needLuxuryPieChart')?.getContext('2d');
    if (ctxNeed) {
        if (window.needLuxuryChart) window.needLuxuryChart.destroy();
        window.needLuxuryChart = new Chart(ctxNeed, {
            type: 'pie',
            data: {
                labels: needLuxuryLabels,
                datasets: [{
                    data: Object.values(needLuxury),
                    backgroundColor: [
                        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim()
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `$${value.toLocaleString()} (${percent}%)`;
                            }
                        }
                    },
                    datalabels: pieDatalabelsConfig
                },
                layout: { padding: 24 },
            },
            plugins: [window.ChartDataLabels]
        });
        ctxNeed.canvas.parentNode.style.maxWidth = '900px';
        ctxNeed.canvas.parentNode.style.margin = '0 auto';
        ctxNeed.canvas.height = 480;
        ctxNeed.canvas.width = 800;
    }

    // --- Gautami vs Ameya Pie Chart with Emoji Legends ---
    // --- Gautami vs Ameya Pie Chart with Emoji Legends ---
    const spender = { Gautami: 0, Ameya: 0, Other: 0 };
    expenses.forEach(e => {
        if (e.who === 'Gautami') spender.Gautami += Number(e.amount);
        else if (e.who === 'Ameya') spender.Ameya += Number(e.amount);
        else spender.Other += Number(e.amount);
    });
    const spenderEmojis = { Gautami: '👩‍💼', Ameya: '👨‍💼', Other: '👥' };
    const spenderLabels = Object.keys(spender).map(k => `${spenderEmojis[k]||''} ${k}`);
    const ctxSpender = document.getElementById('spenderPieChart')?.getContext('2d');
    if (ctxSpender) {
        if (window.spenderChart) window.spenderChart.destroy();
        window.spenderChart = new Chart(ctxSpender, {
            type: 'pie',
            data: {
                labels: spenderLabels,
                datasets: [{
                    data: Object.values(spender),
                    backgroundColor: [
                        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--zomp').trim()
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `$${value.toLocaleString()} (${percent}%)`;
                            }
                        }
                    },
                    datalabels: pieDatalabelsConfig
                },
                layout: { padding: 24 },
            },
            plugins: [window.ChartDataLabels]
        });
        ctxSpender.canvas.parentNode.style.maxWidth = '900px';
        ctxSpender.canvas.parentNode.style.margin = '0 auto';
        ctxSpender.canvas.height = 480;
        ctxSpender.canvas.width = 800;
    }
}
// --- Text to SQL Analytics ---
const textToSqlForm = document.getElementById('textToSqlForm');
if (textToSqlForm) {
    textToSqlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('textToSqlInput');
        const resultDiv = document.getElementById('textToSqlResult');
        const question = input.value.trim();
        if (!question) return;
        resultDiv.innerHTML = '<span class="text-purple-300">Analyzing...</span>';
        try {
            const res = await fetch(`${API_URL}/text_to_sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
            const data = await res.json();
            if (data.error) {
                resultDiv.innerHTML = `<span class="text-red-400">${data.error}</span>`;
                return;
            }
            // Render chart or table based on response
            if (data.chartType && data.labels && data.values) {
                const chartId = 'textToSqlChart';
                resultDiv.innerHTML = `<div style="max-width:800px;margin:0 auto;"><canvas id="${chartId}" width="800" height="480"></canvas></div>`;
                const ctx = document.getElementById(chartId).getContext('2d');
                if (window.textToSqlChart) window.textToSqlChart.destroy();
                window.textToSqlChart = new Chart(ctx, {
                    type: data.chartType,
                    data: {
                        labels: data.labels,
                        datasets: [{ data: data.values, backgroundColor: genColors(data.labels.length) }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: { color: '#fff', font: { size: 16, family: 'Inter, Segoe UI, Arial, sans-serif', weight: '500' } }
                            },
                            title: {
                                color: '#fff', display: false, font: { family: 'Inter, Segoe UI, Arial, sans-serif', weight: '600' }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.chart._metasets[0].total || context.dataset.data.reduce((a,b)=>a+b,0);
                                        const percent = total ? ((value/total)*100).toFixed(1) : '0.0';
                                        return `${label}: $${value.toLocaleString()} (${percent}%)`;
                                    }
                                }
                            },
                            datalabels: {
                                color: '#fff',
                                font: { size: 16, family: 'Inter, Segoe UI, Arial, sans-serif', weight: '600' },
                                formatter: function(value, context) {
                                    const total = context.chart._metasets[0].total || context.dataset.data.reduce((a,b)=>a+b,0);
                                    const percent = total ? ((value/total)*100).toFixed(1) : '0.0';
                                    return percent + '%';
                                }
                            }
                        },
                        layout: { padding: 0 },
                    }
                });
            } else if (data.rows && data.columns) {
                // Render as table
                let html = '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr>';
                data.columns.forEach(col => { html += `<th class="px-2 py-1 border-b">${col}</th>`; });
                html += '</tr></thead><tbody>';
                data.rows.forEach(row => {
                    html += '<tr>' + row.map(cell => `<td class="px-2 py-1">${cell}</td>`).join('') + '</tr>';
                });
                html += '</tbody></table></div>';
                resultDiv.innerHTML = html;
            } else {
                resultDiv.innerHTML = '<span class="text-purple-300">No data.</span>';
            }
        } catch (err) {
            resultDiv.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
        }
    });
}

function genColors(n) {
    const palette = [
        '#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#f472b6','#38bdf8','#facc15','#4ade80','#f472b6'
    ];
    return Array.from({length: n}, (_,i) => palette[i%palette.length]);
}

// Notes area (localStorage for now)
const notesArea = document.getElementById('notesArea');
const saveNotesBtn = document.getElementById('saveNotesBtn');
if (notesArea) {
    notesArea.value = localStorage.getItem('expenseNotes') || '';
}
if (saveNotesBtn && notesArea) {
    saveNotesBtn.addEventListener('click', () => {
        localStorage.setItem('expenseNotes', notesArea.value);
        saveNotesBtn.textContent = 'Saved!';
        setTimeout(() => saveNotesBtn.textContent = 'Save Notes', 1000);
    });
}

// (Removed duplicate initial load DOMContentLoaded handler above)
