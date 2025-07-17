import { CATEGORY_META, CATEGORY_LIST, allExpenses } from './config.js';
import { getCategoryMeta, createCategoryDropdown, handleCategorySelection } from './categories.js';
import { addExpense, updateExpense, deleteExpense, reimportStatement, bulkDeleteExpenses } from './api.js';

// Render expense table
export function renderExpenses(expenses) {
    // Update total spending blocks
    updateTotalSpending(expenses);
    
    // Render additional UI components
    renderAverages(expenses);
    renderQuickFilterChips(allExpenses);
    renderRecentLargeExpenses(expenses);
    
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Setup table header for autofill checkboxes
    setupTableHeader(tbody);
    
    // Add manual entry row
    addManualEntryRow(tbody);
    
    // Render expense rows
    expenses.forEach(exp => {
        renderExpenseRow(tbody, exp);
    });
    
    // Setup inline editing
    setupInlineEditing(tbody, expenses);
}

// Render filters dropdowns
export function renderFilters(expenses) {
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
    
    // Setup autofill button listeners
    setTimeout(() => {
        setupAutofillButtons();
    }, 0);
}

// Render statements list
export function renderStatements(statements) {
    let container = document.getElementById('statementsList');
    if (!container) return;
    
    container.innerHTML = `<h2 class="text-lg font-semibold mb-2" style="color: var(--mountbatten-pink);">Uploaded Statements</h2>`;
    
    if (!statements.length) {
        container.innerHTML += '<p class="text-gray-500">No statements uploaded yet.</p>';
        return;
    }
    
    container.innerHTML += `<ul style="border-top: 1px solid var(--champagne-pink);">${statements.map(s => `
        <li class="flex items-center justify-between py-2">
            <span class="truncate">${s.filename} <span class="text-xs" style="color: var(--mountbatten-pink); opacity: 0.7;">(${new Date(s.upload_date).toLocaleString()})</span></span>
            <button class="reimport-btn btn-pastel ml-4" data-id="${s.id}">Re-import</button>
        </li>`).join('')}</ul>`;
    
    // Attach re-import listeners
    container.querySelectorAll('.reimport-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            btn.disabled = true;
            btn.textContent = 'Importing...';
            
            try {
                const res = await reimportStatement(id);
                if (res.ok) {
                    btn.textContent = 'Imported!';
                    if (window.loadExpenses) await window.loadExpenses();
                } else {
                    btn.textContent = 'Error!';
                }
            } catch (e) {
                btn.textContent = 'Error!';
            }
            
            setTimeout(() => {
                btn.textContent = 'Re-import';
                btn.disabled = false;
            }, 2000);
        });
    });
}

// Render quick filter chips
export function renderQuickFilterChips(expenses) {
    const chipDiv = document.getElementById('quickFilterChips');
    if (!chipDiv) return;
    
    chipDiv.innerHTML = '';
    
    // Calculate top categories, cards, spenders
    const catCounts = {};
    const cardCounts = {};
    const whoCounts = {};
    const needCounts = { 'Need': 0, 'Luxury': 0 };
    
    expenses.forEach(e => {
        if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
        if (e.card) cardCounts[e.card] = (cardCounts[e.card] || 0) + 1;
        if (e.who) whoCounts[e.who] = (whoCounts[e.who] || 0) + 1;
        if (e.need_category === 'Luxury') needCounts.Luxury++;
        else needCounts.Need++;
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
        'groceries': '🛒', 'food': '🍽️', 'shopping': '🛍️', 'travel': '✈️', 'utilities': '💡',
        'health': '🩺', 'entertainment': '🎬', 'subscriptions': '📦', 'transport': '🚗',
        'rent': '🏠', 'other': '❓', 'chase sapphire': '💳', 'venture x': '💳',
        'discover': '💳', 'Gautami': '👩', 'Ameya': '👨', 'Need': '🟢', 'Luxury': '💎',
    };
    
    chips.forEach(chip => {
        const btn = document.createElement('button');
        btn.className = 'quick-chip';
        
        let lowerLabel = chip.label?.toLowerCase();
        let emoji = emojiMap[lowerLabel] || emojiMap[chip.label] || '';
        let isCustom = ['venture x','gautami','ameya'].includes(lowerLabel);
        btn.textContent = isCustom ? chip.label : (emoji ? `${emoji}` : chip.label);
        btn.title = chip.label;
        
        // Hover effects for non-custom chips
        if (!isCustom && emoji) {
            btn.onmouseenter = () => btn.textContent = chip.label;
            btn.onmouseleave = () => btn.textContent = emoji;
        }
        
        btn.onclick = () => {
            let filterId;
            if (chip.type === 'need_category') {
                filterId = 'filter-needcat';
            } else {
                filterId = `filter-${chip.type.replace('_', '')}`;
            }
            const filterEl = document.getElementById(filterId);
            if (filterEl) {
                filterEl.value = chip.label;
                if (window.applyColumnFilters) window.applyColumnFilters();
            }
        };
        
        chipDiv.appendChild(btn);
    });
    
    // Add clear button if any filter is active
    const hasActiveFilter = ['filter-category', 'filter-card', 'filter-who', 'filter-needcat']
        .some(id => document.getElementById(id)?.value);
        
    if (hasActiveFilter) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'quick-chip clear-chip';
        clearBtn.textContent = 'Clear';
        clearBtn.onclick = () => {
            ['filter-category', 'filter-card', 'filter-who', 'filter-needcat'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (window.applyColumnFilters) window.applyColumnFilters();
        };
        chipDiv.appendChild(clearBtn);
    }
}

// Render recent large expenses
export function renderRecentLargeExpenses(expenses) {
    const block = document.getElementById('recentLargeBlock');
    if (!block) return;
    
    const sorted = [...expenses].sort((a,b)=>Number(b.amount)-Number(a.amount));
    const top3 = sorted.slice(0,3);
    
    block.innerHTML = '<div class="recent-large-title">Recent Large Expenses</div>'+
        '<ul class="recent-large-list">'+
        top3.map(e=>`<li><span class="recent-large-amt">$${Number(e.amount).toLocaleString(undefined,{maximumFractionDigits:2})}</span> <span class="recent-large-date">${e.date}</span> <span class="recent-large-desc">${e.description}</span></li>`).join('')+
        '</ul>';
}

// Render averages
export function renderAverages(expenses) {
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

// Helper functions

function updateTotalSpending(expenses) {
    const totalSpendingValue = document.getElementById('totalSpendingValue');
    if (totalSpendingValue) {
        const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        totalSpendingValue.textContent = '$' + total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}

function setupTableHeader(tbody) {
    let headerRow = tbody.parentElement.querySelector('thead tr');
    if (headerRow) {
        // Remove any existing autofill header cell to avoid duplicates
        if (headerRow.firstElementChild && headerRow.firstElementChild.querySelector('.autofill-header-checkbox')) {
            headerRow.removeChild(headerRow.firstElementChild);
        }
        // Insert autofill header cell as first column
        const th = document.createElement('th');
        th.className = 'py-2 px-3 text-center';
        th.innerHTML = '<input type="checkbox" class="autofill-header-checkbox" title="Select all rows" />';
        headerRow.insertBefore(th, headerRow.firstChild);
    }
    
    // Add event for header checkbox (select all)
    setTimeout(() => {
        const headerCb = document.querySelector('.autofill-header-checkbox');
        if (headerCb) {
            headerCb.onclick = () => {
                const cbs = tbody.querySelectorAll('.autofill-row-checkbox');
                cbs.forEach(cb => { cb.checked = headerCb.checked; });
                updateFloatingButtonVisibility(); // Update floating button after select all
            };
        }
    }, 0);
}

function addManualEntryRow(tbody) {
    const addTr = document.createElement('tr');
    addTr.innerHTML = `
        <td class="py-2 px-3 text-center"></td>
        <td class="py-2 px-3 text-center"></td>
        <td class="py-2 px-3"><input type="date" class="add-date w-full px-1 py-1 rounded text-xs" /></td>
        <td class="py-2 px-3"><input type="text" class="add-description w-full px-1 py-1 rounded text-xs" placeholder="Description" /></td>
        <td class="py-2 px-3"><input type="number" class="add-amount w-full px-1 py-1 rounded text-xs" placeholder="$" step="0.01" /></td>
        <td class="py-2 px-3" style="text-align:center;">
            <div class="add-category-container"></div>
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
    
    setupManualEntryListeners(addTr);
}

function renderExpenseRow(tbody, exp) {
    const meta = getCategoryMeta(exp.category);
    let needCat = exp.need_category || 'Need';
    let needBadgeClass = needCat === 'Luxury' ? 'luxury-badge' : 'need-badge';
    const splitChecked = exp.split_cost ? 'checked' : '';
    const outlierChecked = exp.outlier ? 'checked' : '';
    
    const tr = document.createElement('tr');
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
            ${exp.category.charAt(0).toUpperCase()+exp.category.slice(1)}
        </td>
        <td class="py-2 px-3 editable-cell" data-field="need_category" data-id="${exp.id}" style="text-align:center;"><span class="${needBadgeClass}">${needCat}</span></td>
        <td class="py-2 px-3 editable-cell" data-field="card" data-id="${exp.id}">${exp.card || ''}</td>
        <td class="py-2 px-3 editable-cell" data-field="who" data-id="${exp.id}">${(exp.who === 'Ameya' || exp.who === 'Gautami') ? exp.who : (exp.who ? `<span class='custom-who'>${exp.who}</span>` : '')}</td>
        <td class="py-2 px-3 text-center"><input type="checkbox" class="split-checkbox" data-id="${exp.id}" ${splitChecked}></td>
        <td class="py-2 px-3 text-center"><input type="checkbox" class="outlier-checkbox" data-id="${exp.id}" ${outlierChecked}></td>
        <td class="py-2 px-3 editable-cell" data-field="notes" data-id="${exp.id}">${exp.notes || ''}</td>
    `;
    tbody.appendChild(tr);
    
    setupRowListeners(tr, exp);
}

function setupManualEntryListeners(addTr) {
    // Setup category dropdown with "Add Category" option
    const categoryContainer = addTr.querySelector('.add-category-container');
    const categorySelect = createCategoryDropdown();
    categorySelect.className = 'add-category w-full px-1 py-1 rounded text-xs';
    categoryContainer.appendChild(categorySelect);
    
    // Handle category selection
    categorySelect.addEventListener('change', async () => {
        await handleCategorySelection(categorySelect, (selectedCategory) => {
            // Category was selected or added, dropdown value is already updated
        });
    });
    
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
    
    // Add expense button
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
        
        await addExpense({ date, description, amount, category, need_category, card, who, split_cost, outlier, notes });
        if (window.loadExpenses) window.loadExpenses();
    });
}

function setupRowListeners(tr, exp) {
    // Checkbox listeners
    const splitCb = tr.querySelector('.split-checkbox');
    if (splitCb) {
        splitCb.addEventListener('change', async () => {
            await updateExpense(exp.id, { split_cost: splitCb.checked });
            if (window.loadExpenses) window.loadExpenses();
        });
    }
    
    const outlierCb = tr.querySelector('.outlier-checkbox');
    if (outlierCb) {
        outlierCb.addEventListener('change', async () => {
            await updateExpense(exp.id, { outlier: outlierCb.checked });
            if (window.loadExpenses) window.loadExpenses();
        });
    }
    
    // Delete button
    const deleteBtn = tr.querySelector('.delete-row-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            if (confirm('Delete this row?')) {
                await deleteExpense(exp.id);
                if (window.loadExpenses) window.loadExpenses();
            }
            e.stopPropagation();
        });
    }
}

function setupInlineEditing(tbody, expenses) {
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

    // saveInlineEdit function
    async function saveInlineEdit(cell, exp, field, value, closeCellAfter = false) {
        const { API_URL } = await import('./config.js');
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
        if (window.loadExpenses) await window.loadExpenses();
        // If called from inline edit, close the cell after update
        if (closeCellAfter) {
            if (cell) {
                cell.classList.remove('editing-cell');
            }
            editingCell = null;
            originalContent = '';
        }
    }

    tbody.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
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
                // Create category dropdown with "Add Category" option
                const categorySelect = createCategoryDropdown(exp.category);
                categorySelect.className = 'edit-inline-category w-full px-1 py-1 rounded text-xs';
                
                // Setup the select element
                cell.innerHTML = '';
                cell.appendChild(categorySelect);
                
                // Handle selection change
                categorySelect.addEventListener('change', async () => {
                    await handleCategorySelection(categorySelect, (selectedCategory) => {
                        saveInlineEdit(cell, exp, field, selectedCategory, true);
                    });
                });
                
                categorySelect.focus();
                return; // Skip the rest of the editing setup
            } else if (field === 'need_category') {
                // Toggle between Need and Luxury on click
                let currentValue = exp.need_category || 'Need';
                let newValue = currentValue === 'Need' ? 'Luxury' : 'Need';
                saveInlineEdit(cell, exp, field, newValue, true);
                return; // Skip the rest of the editing setup
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
}

function setupAutofillButtons() {
    const autofillWhoAllBtn = document.getElementById('autofillWhoAllBtn');
    if (autofillWhoAllBtn) {
        autofillWhoAllBtn.onclick = () => {
            const bar = document.getElementById('filterbar-who');
            if (bar) {
                bar.style.display = 'block';
                let existing = bar.querySelector('.autofill-inline-input');
                if (existing) existing.remove();
                showAutofillInput('all');
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
                showAutofillInput('selected');
            }
        };
    }
    
    // Floating bulk delete button
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.onclick = async () => {
            await handleBulkDelete(bulkDeleteBtn);
        };
    }
    
    // Setup checkbox listeners for floating button visibility
    setupFloatingButtonVisibility();
}

// Shared bulk delete handler
async function handleBulkDelete(button) {
    const selectedIds = getSelectedExpenseIds();
    if (selectedIds.length === 0) {
        alert('Please select at least one expense to delete.');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} selected expense(s)? This action cannot be undone.`);
    if (!confirmed) return;
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Deleting...';
    
    try {
        console.log('Deleting expenses with IDs:', selectedIds);
        await bulkDeleteExpenses(selectedIds);
        console.log('Bulk delete completed, reloading expenses...');
        
        // Clear all checkboxes immediately to avoid stale state
        const checkboxes = document.querySelectorAll('.autofill-row-checkbox, .autofill-header-checkbox');
        checkboxes.forEach(cb => { cb.checked = false; });
        
        // Hide floating button immediately
        updateFloatingButtonVisibility();
        
        // Reload expenses and wait for completion
        if (window.loadExpenses) {
            await window.loadExpenses();
            console.log('Expenses reloaded successfully');
        }
        
        alert(`Successfully deleted ${selectedIds.length} expense(s).`);
    } catch (error) {
        console.error('Bulk delete failed:', error);
        alert('Failed to delete some expenses. Please try again.');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Setup floating button visibility management
function setupFloatingButtonVisibility() {
    // Set up event listeners for checkbox changes
    document.addEventListener('change', function(event) {
        if (event.target.classList.contains('autofill-row-checkbox') || 
            event.target.classList.contains('autofill-header-checkbox')) {
            updateFloatingButtonVisibility();
        }
    });
    
    // Initial visibility check
    updateFloatingButtonVisibility();
}

// Update floating button visibility based on selected checkboxes
function updateFloatingButtonVisibility() {
    const selectedIds = getSelectedExpenseIds();
    const floatingBtn = document.getElementById('floatingDeleteBtn');
    const selectedCount = document.getElementById('selectedCount');
    
    if (!floatingBtn) return;
    
    if (selectedIds.length > 0) {
        floatingBtn.style.display = 'block';
        if (selectedCount) {
            selectedCount.textContent = selectedIds.length;
        }
    } else {
        floatingBtn.style.display = 'none';
    }
}

// Helper function to show autofill input
function showAutofillInput(mode) {
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
    
    // Hide the who filter dropdown while autofill input is open
    const whoFilter = document.getElementById('filter-who');
    if (whoFilter) whoFilter.style.display = 'none';
    
    // Confirm logic
    const confirm = async () => {
        const value = input.value.trim();
        if (!value) { 
            input.focus(); 
            return; 
        }
        
        div.querySelectorAll('button').forEach(btn => btn.disabled = true);
        let success = true;
        
        // Get expense IDs to update
        let ids;
        if (mode === 'all') {
            const { allExpenses, filteredExpenses } = await import('./config.js');
            ids = allExpenses.filter(e => filteredExpenses.some(f => f.id === e.id)).map(e => e.id);
        } else if (mode === 'selected') {
            ids = getSelectedExpenseIds();
            if (!ids.length) { 
                alert('Select at least one row.'); 
                div.remove(); 
                if (whoFilter) whoFilter.style.display = '';
                return; 
            }
        }
        
        // Update expenses
        const { API_URL } = await import('./config.js');
        for (const id of ids) {
            const res = await fetch(`${API_URL}/expense/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ who: value })
            });
            if (!res.ok) success = false;
        }
        
        // Reload expenses
        if (window.loadExpenses) await window.loadExpenses();
        
        if (!success) {
            alert('Some updates failed. Please check your connection or try again.');
        }
        
        div.remove();
        if (whoFilter) whoFilter.style.display = '';
    };
    
    div.querySelector('.autofill-confirm-btn').onclick = confirm;
    input.addEventListener('keydown', e => { 
        if (e.key === 'Enter') confirm();
    });
    div.querySelector('.autofill-cancel-btn').onclick = () => {
        div.remove();
        if (whoFilter) whoFilter.style.display = '';
    };
}

// Helper function to get selected expense IDs
function getSelectedExpenseIds() {
    const checkboxes = document.querySelectorAll('.autofill-row-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
}
