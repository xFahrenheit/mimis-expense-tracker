import { CATEGORY_META, CATEGORY_LIST, allExpenses } from './config.js';
import { getCategoryMeta, createCategoryDropdown, handleCategorySelection } from './categories.js';
import { addExpense, updateExpense, deleteExpense, reimportStatement, bulkDeleteExpenses } from './api.js';

// Utility: Format date as yyyy-month-dd (but keep original date for sorting)
export function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Parse the date string manually to avoid timezone issues
        // Input format: "2025-06-01" (YYYY-MM-DD)
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parseInt(parts[0]);
        const monthNum = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        if (isNaN(year) || isNaN(monthNum) || isNaN(day)) return dateStr;
        // Convert month number to short name
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const month = monthNames[monthNum - 1];
        if (!month) return dateStr;
        return `${year}-${month}-${String(day).padStart(2, '0')}`;
    } catch (error) {
        return dateStr;
    }
}

// Render expense table
export function renderExpenses(expenses) {
    // Update total spending blocks
    updateTotalSpending(expenses);
    
    // Render additional UI components
    renderAverages(expenses);
    renderQuickFilterChips(allExpenses);
    
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
    
    // Initialize selection summary (hide it initially)
    updateSelectionSummary([]);
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

// Shared utility functions
function updateLocalExpenseData(expenseId, field, value) {
    // Update in all three places consistently
    const updateExpense = (exp) => {
        if (exp && exp.id == expenseId) {
            exp[field] = value;
        }
    };
    
    // Update in passed expenses array
    const exp = window.currentExpenses?.find(e => e.id == expenseId);
    updateExpense(exp);
    
    // Update in global arrays
    updateExpense(window.allExpenses?.find(e => e.id == expenseId));
    updateExpense(window.filteredExpenses?.find(e => e.id == expenseId));
}

// Shared utility to add options to select elements
export function addOptionToSelect(select, value, text, isSelected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    if (isSelected) option.selected = true;
    select.appendChild(option);
}

// SINGLE SOURCE OF TRUTH: Update all spending displays with consistent formatting
export function updateAllSpendingDisplays(expenses) {
    const { total, gautami, ameya, splitTotal } = calculateSpendingTotals(expenses);
    
    // Calculate additional metrics
    const days = new Set(expenses.map(e => e.date)).size || 1;
    const months = new Set(expenses.map(e => (e.date||'').slice(0,7))).size || 1;
    
    // Consistent formatting function
    const formatCurrency = (amount) => `$${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Update all spending elements with consistent formatting
    const elements = {
        'totalSpendingValue': formatCurrency(total),
        'gautamiSpendingValue': formatCurrency(gautami),
        'ameyaSpendingValue': formatCurrency(ameya),
        'splitSpendingValue': formatCurrency(splitTotal / 2),
        'avgPerDay': `${formatCurrency(total / days).replace('$', '')}/day`,
        'avgPerMonth': `${formatCurrency(total / months).replace('$', '')}/mo`
    };
    
    Object.entries(elements).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });
    
    return { total, gautami, ameya, splitTotal };
}

// Shared utility to calculate spending totals with split cost logic
export function calculateSpendingTotals(expenses) {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    let gautami = 0;
    let ameya = 0;
    let splitTotal = 0;
    
    expenses.forEach(e => {
        const amount = Number(e.amount || 0);
        
        if (e.split_cost) {
            // Split cost: each person gets half
            const splitAmount = amount / 2;
            gautami += splitAmount;
            ameya += splitAmount;
            splitTotal += amount;
        } else {
            const who = (e.who || '').toString().trim().toLowerCase();
            if (who === 'gautami') {
                gautami += amount;
            } else if (who === 'ameya') {
                ameya += amount;
            }
        }
    });
    
    return { 
        total, 
        gautami, 
        ameya, 
        splitTotal,
        // Aliases for backward compatibility
        gautamiTotal: gautami,
        ameyaTotal: ameya
    };
}

function createWhoSelect(currentValue = '', className = 'w-full px-1 py-1 rounded text-xs') {
    const isCustomValue = currentValue && !['Ameya', 'Gautami'].includes(currentValue);
    return `
        <select class="${className}" data-who-select>
            <option value="Ameya" ${currentValue === 'Ameya' ? 'selected' : ''}>Ameya</option>
            <option value="Gautami" ${currentValue === 'Gautami' ? 'selected' : ''}>Gautami</option>
            <option value="__custom__" ${isCustomValue ? 'selected' : ''}>Other...</option>
        </select>
        <input type="text" class="${className} mt-1" data-who-custom 
               placeholder="Enter name" 
               style="display:${isCustomValue ? '' : 'none'};" 
               value="${isCustomValue ? currentValue : ''}" />
    `;
}

function setupWhoSelectLogic(container, onChange = null) {
    const select = container.querySelector('[data-who-select]');
    const customInput = container.querySelector('[data-who-custom]');
    
    if (!select || !customInput) return;
    
    select.addEventListener('change', () => {
        const isCustom = select.value === '__custom__';
        customInput.style.display = isCustom ? '' : 'none';
        customInput.required = isCustom;
        if (isCustom) customInput.focus();
        if (onChange) onChange();
    });
    
    return {
        getValue: () => {
            return select.value === '__custom__' ? customInput.value.trim() : select.value;
        },
        addCustomOption: (value) => {
            addOptionToSelect(select, value);
        }
    };
}

async function updateExpenseField(expenseId, field, value) {
    const { API_URL } = await import('./config.js');
    await fetch(`${API_URL}/expense/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
    });
    updateLocalExpenseData(expenseId, field, value);
    updateTotalSpending(window.filteredExpenses);
}

function updateTotalSpending(expenses) {
    // Use provided expenses or fall back to window.filteredExpenses
    const expensesToUse = expenses || window.filteredExpenses || [];
    
    // Use the single source of truth function
    updateAllSpendingDisplays(expensesToUse);
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
        <td class="py-2 px-3" id="manual-who-container">
            ${createWhoSelect('', 'add-who w-full px-1 py-1 rounded text-xs')}
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
    
    // ...existing code...
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="py-2 px-3 text-center"><input type="checkbox" class="autofill-row-checkbox" data-id="${exp.id}" /></td>
        <td class="py-2 px-3 text-center">
            <button class="text-red-400 hover:text-red-600 font-bold text-lg delete-row-btn" data-id="${exp.id}" title="Delete">×</button>
        </td>
        <td class="py-2 px-3 editable-cell" data-field="date" data-id="${exp.id}" data-sort-value="${exp.date || ''}">${formatDate(exp.date)}</td>
        <td class="py-2 px-3 editable-cell" data-field="description" data-id="${exp.id}">${exp.description || ''}</td>
        <td class="py-2 px-3 editable-cell" data-field="amount" data-id="${exp.id}">$${Number(exp.amount).toFixed(2)}</td>
        <td class="py-2 px-3 editable-cell" data-field="category" data-id="${exp.id}" style="text-align:center;">
            <span style="font-size:1.2em;vertical-align:middle;margin-right:4px;color:${meta.color};">${meta.icon}</span>
            ${(exp.category || 'shopping').charAt(0).toUpperCase()+(exp.category || 'shopping').slice(1)}
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
    
    // Setup who select logic
    const whoContainer = addTr.querySelector('#manual-who-container');
    const whoSelectLogic = setupWhoSelectLogic(whoContainer);
    
    // Add expense button
    addTr.querySelector('.add-expense-btn').addEventListener('click', async () => {
        const date = addTr.querySelector('.add-date').value;
        const description = addTr.querySelector('.add-description').value;
        const amount = addTr.querySelector('.add-amount').value;
        const category = addTr.querySelector('.add-category').value;
        const need_category = addTr.querySelector('.add-needcat').value;
        const card = addTr.querySelector('.add-card').value;
        const who = whoSelectLogic.getValue();
        const split_cost = addTr.querySelector('.add-split').checked;
        const outlier = addTr.querySelector('.add-outlier').checked;
        const notes = addTr.querySelector('.add-notes').value;
        
        if (!date || !description || !amount) {
            alert('Date, Description, and Amount are required.');
            return;
        }
        
        if (who && !['Ameya', 'Gautami'].includes(who)) {
            whoSelectLogic.addCustomOption(who);
        }
        
        await addExpense({ date, description, amount, category, need_category, card, who, split_cost, outlier, notes });
        
        // Reload data and refresh table
        if (window.loadExpenses) {
            await window.loadExpenses();
        }
        if (window.applyColumnFilters) {
            window.applyColumnFilters();
        }
        
        // Clear the form
        addTr.querySelector('.add-date').value = '';
        addTr.querySelector('.add-description').value = '';
        addTr.querySelector('.add-amount').value = '';
        addTr.querySelector('.add-notes').value = '';
    });
}

function setupRowListeners(tr, exp) {
    // Selection checkbox listener
    const selectionCb = tr.querySelector('.autofill-row-checkbox');
    if (selectionCb) {
        selectionCb.addEventListener('change', () => {
            updateFloatingButtonVisibility();
        });
    }
    
    // Checkbox listeners
    const splitCb = tr.querySelector('.split-checkbox');
    if (splitCb) {
        splitCb.addEventListener('change', async () => {
            await updateExpenseField(exp.id, 'split_cost', splitCb.checked);
            // Reload data to ensure consistency
            if (window.loadExpenses) {
                await window.loadExpenses();
            }
            if (window.applyColumnFilters) {
                window.applyColumnFilters();
            }
        });
    }
    
    const outlierCb = tr.querySelector('.outlier-checkbox');
    if (outlierCb) {
        outlierCb.addEventListener('change', async () => {
            await updateExpenseField(exp.id, 'outlier', outlierCb.checked);
            // Reload data to ensure consistency
            if (window.loadExpenses) {
                await window.loadExpenses();
            }
            if (window.applyColumnFilters) {
                window.applyColumnFilters();
            }
        });
    }
    
    // Delete button
    const deleteBtn = tr.querySelector('.delete-row-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            if (confirm('Delete this row?')) {
                if (window.pushUndoState) window.pushUndoState();
                await deleteExpense(exp.id);
                // Reload data from server to ensure consistency
                if (window.loadExpenses) {
                    await window.loadExpenses();
                }
                // Reapply filters to refresh the table
                if (window.applyColumnFilters) {
                    window.applyColumnFilters();
                }
            }
            e.stopPropagation();
        });
    }
}

function setupInlineEditing(tbody, expenses) {
    // Only one cell in edit mode at a time
    let editingCell = null;
    let originalContent = '';
    
    // Store per-cell state to avoid conflicts when rapidly clicking
    let cellStates = new Map();

    function exitEditMode(save = false) {
        if (!editingCell) return;
        let didSave = false;
        if (save) {
            const id = editingCell.getAttribute('data-id');
            const field = editingCell.getAttribute('data-field');
            const exp = expenses.find(e => e.id == id);
            const cellKey = `${id}_${field}`;
            const cellState = cellStates.get(cellKey);
            
            let value;
            if (field === 'who') {
                const whoSelect = editingCell.querySelector('.edit-inline-who');
                const whoCustom = editingCell.querySelector('.edit-inline-who-custom');
                value = whoSelect && whoSelect.value;
                if (value === '__custom__' && whoCustom) {
                    value = whoCustom.value.trim();
                    if (whoSelect) addOptionToSelect(whoSelect, value);
                }
            } else if (field === 'category') {
                const catSelect = editingCell.querySelector('.edit-inline-category');
                value = catSelect && catSelect.value;
            } else if (field === 'description') {
                value = (cellState && cellState.lastTypedValue !== null && cellState.lastTypedValue !== undefined) ? cellState.lastTypedValue.trim() : '';
            } else {
                const input = editingCell.querySelector('input,select');
                value = input && input.value;
            }
            if (exp && value !== undefined) {
                // For all fields, only save if not empty (and valid for number/date); otherwise restore original
                let shouldRestore = false;
                if (field === 'amount') {
                    // Amount field: must not be empty and must be a valid positive number
                    const numValue = Number(value);
                    if (value === '' || value === undefined || value === null || isNaN(numValue) || String(value).trim() === '' || numValue < 0) shouldRestore = true;
                } else if (field === 'split_cost' || field === 'outlier') {
                    // Other numeric fields (if any): must not be empty and must be a valid number
                    if (value === '' || value === undefined || value === null || isNaN(value) || isNaN(Number(value)) || String(value).trim() === '') shouldRestore = true;
                } else if (field === 'date') {
                    // Date field
                    if (!value || isNaN(Date.parse(value))) shouldRestore = true;
                } else if (field === 'category' || field === 'who' || field === 'card' || field === 'notes' || field === 'description') {
                    // Text fields
                    if (!value) shouldRestore = true;
                }
                if (shouldRestore) {
                    editingCell.innerHTML = originalContent;
                    editingCell.classList.remove('editing-cell');
                    cellStates.delete(cellKey);
                    editingCell = null;
                    originalContent = '';
                    return;
                }
                didSave = true;
                saveInlineEdit(editingCell, exp, field, value, true);
                return;
            }
        }
        if (!didSave) {
            editingCell.innerHTML = originalContent;
            editingCell.classList.remove('editing-cell');
            const id = editingCell.getAttribute('data-id');
            const field = editingCell.getAttribute('data-field');
            cellStates.delete(`${id}_${field}`);
            editingCell = null;
            originalContent = '';
        }
    }

    // saveInlineEdit function
    async function saveInlineEdit(cell, exp, field, value, closeCellAfter = false) {
        if (window.pushUndoState) window.pushUndoState();
        const { API_URL } = await import('./config.js');
        
        try {
            // Validate value before saving
            if (field === 'amount') {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 0) {
                    throw new Error('Invalid amount value');
                }
                value = numValue; // Ensure it's stored as a number
            }
            
            // First, update the cell display immediately
            if (cell) {
                if (field === 'amount') {
                    cell.textContent = `$${Number(value).toFixed(2)}`;
                } else if (field === 'date') {
                    cell.textContent = formatDate(value);
                } else if (field === 'who') {
                    cell.innerHTML = (value === 'Ameya' || value === 'Gautami') ? value : (value ? `<span class='custom-who'>${value}</span>` : '');
                } else if (field === 'category') {
                    const { getCategoryMeta } = await import('./categories.js');
                    const meta = getCategoryMeta(value);
                    cell.innerHTML = `
                        <span style="font-size:1.2em;vertical-align:middle;margin-right:4px;color:${meta.color};">${meta.icon}</span>
                        ${(value || 'shopping').charAt(0).toUpperCase() + (value || 'shopping').slice(1)}
                    `;
                } else if (field === 'need_category') {
                    let needBadgeClass = value === 'Luxury' ? 'luxury-badge' : 'need-badge';
                    cell.innerHTML = `<span class="${needBadgeClass}">${value}</span>`;
                } else {
                    cell.textContent = value;
                }
            }
            
            // PATCH to backend
            const id = exp.id;
            const payload = { [field]: value };
            const response = await fetch(`${API_URL}/expense/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            // Update local data
            exp[field] = value;
            
            // Update the data in window.allExpenses and window.filteredExpenses too
            if (window.allExpenses) {
                const allExp = window.allExpenses.find(e => e.id == id);
                if (allExp) allExp[field] = value;
            }
            if (window.filteredExpenses) {
                const filteredExp = window.filteredExpenses.find(e => e.id == id);
                if (filteredExp) filteredExp[field] = value;
            }
            
            // Update spending totals and refresh displays
            if (window.applyColumnFilters) {
                window.applyColumnFilters();
            }
            
        } catch (error) {
            console.error('Failed to save inline edit:', error);
            // Restore original content on error
            if (cell && originalContent) {
                cell.innerHTML = originalContent;
            }
            alert('Failed to save changes. Please try again.');
        }
        
        // If called from inline edit, close the cell after update
        if (closeCellAfter) {
            if (cell) {
                cell.classList.remove('editing-cell');
            }
            const id = exp.id;
            const field = cell.getAttribute('data-field');
            cellStates.delete(`${id}_${field}`);
            editingCell = null;
            originalContent = '';
        }
    }

    tbody.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
            // Force exit any current editing before starting new edit
            if (editingCell && editingCell !== cell) {
                exitEditMode(true); // Save current edit
                // Small delay to ensure cleanup is complete
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            if (cell.classList.contains('editing-cell')) return;
            
            editingCell = cell;
            // Always cache the original HTML content for robust restoration
            originalContent = cell.innerHTML;
            
            const id = cell.getAttribute('data-id');
            const field = cell.getAttribute('data-field');
            const cellKey = `${id}_${field}`;
            
            // Initialize cell state
            cellStates.set(cellKey, {
                lastTypedValue: null,
                originalValue: cell.textContent
            });
            
            cell.classList.add('editing-cell');
            
            // Use == for id match, fallback to cell text if not found
            let exp = expenses.find(e => e.id == id);
            let inputValue = (exp && exp[field] !== undefined && exp[field] !== null) ? exp[field] : cell.textContent;
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
                // For amount, use the actual numeric value from the expense object
                const actualAmount = exp.amount !== undefined ? exp.amount : '';
                inputHtml = `<input type="number" class="edit-inline-amount w-full px-1 py-1 rounded text-xs" value="${actualAmount}" step="0.01" min="0" />`;
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
                inputHtml = `<input type="text" class="edit-inline-${field} w-full px-1 py-1 rounded text-xs" value="${inputValue || ''}" />`;
            }
            
            cell.innerHTML = inputHtml;
            const input = cell.querySelector('input,select');
            if (!input) return;
            
            const cellState = cellStates.get(cellKey);
            
            // Setup field-specific input tracking using per-cell state
            if (field === 'description' || field === 'amount' || field === 'notes' || field === 'card') {
                cellState.lastTypedValue = input.value;
                input.addEventListener('input', () => {
                    cellState.lastTypedValue = input.value;
                });
            }
            
            if (field === 'who') {
                const whoSelect = cell.querySelector('.edit-inline-who');
                const whoCustom = cell.querySelector('.edit-inline-who-custom');
                if (whoSelect && whoCustom) {
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
            }
            if (input) input.focus();
            
            // Enhanced blur handler
            const handleBlur = () => {
                // Only handle blur if this cell is still the active editingCell
                if (cell !== editingCell) return;
                
                const currentState = cellStates.get(cellKey);
                if (!currentState) return;
                
                if (field === 'who') {
                    const whoSelect = cell.querySelector('.edit-inline-who');
                    const whoCustom = cell.querySelector('.edit-inline-who-custom');
                    let whoVal = whoSelect ? whoSelect.value : '';
                    if (whoVal === '__custom__' && whoCustom) {
                        whoVal = whoCustom.value.trim();
                        if (whoSelect && whoVal) addOptionToSelect(whoSelect, whoVal);
                    }
                    saveInlineEdit(cell, exp, field, whoVal, true);
                } else if (field === 'description') {
                    const val = (currentState.lastTypedValue !== null && currentState.lastTypedValue !== undefined) ? currentState.lastTypedValue.trim() : input.value.trim();
                    if (!val) {
                        // If description is empty, restore from cached value and do NOT save
                        cell.innerHTML = originalContent;
                        cell.classList.remove('editing-cell');
                        cellStates.delete(cellKey);
                        editingCell = null;
                        originalContent = '';
                        return;
                    }
                    // Only save if not empty
                    saveInlineEdit(cell, exp, field, val, true);
                } else if (field === 'amount') {
                    let val = input.value;
                    const numValue = Number(val);
                    // If empty or invalid, restore original content
                    if (val === '' || isNaN(numValue) || numValue < 0) {
                        cell.innerHTML = originalContent;
                        cell.classList.remove('editing-cell');
                        cellStates.delete(cellKey);
                        editingCell = null;
                        originalContent = '';
                        return;
                    }
                    saveInlineEdit(cell, exp, field, val, true);
                } else {
                    saveInlineEdit(cell, exp, field, input.value, true);
                }
            };
            
            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBlur();
                } else if (e.key === 'Escape') {
                    exitEditMode(false);
                }
            };
            
            // Use once: true to prevent duplicate listeners
            input.addEventListener('blur', handleBlur, { once: true });
            input.addEventListener('keydown', handleKeydown);
            
            // Prevent click bubbling to tbody
            e.stopPropagation();
        });
    });

    // Exit edit mode when clicking outside any cell
    const docClickHandler = function(e) {
        if (editingCell && !editingCell.contains(e.target)) {
            // Add a small delay to handle rapid clicking
            setTimeout(() => {
                if (editingCell && !editingCell.contains(e.target)) {
                    exitEditMode(true);
                }
            }, 10);
        }
    };
    
    // Remove any existing handler and add new one
    document.removeEventListener('click', docClickHandler, { capture: true });
    document.addEventListener('click', docClickHandler, { capture: true });
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
    
    // Setup bulk delete buttons if they exist
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.onclick = async () => {
            await handleBulkDelete(bulkDeleteBtn);
        };
    }
    
    const floatingDeleteBtn = document.getElementById('floatingDeleteBtn');
    if (floatingDeleteBtn) {
        floatingDeleteBtn.onclick = async () => {
            await handleBulkDelete(floatingDeleteBtn);
        };
    }
    
    // Setup floating button visibility
    updateFloatingButtonVisibility();
}

// Shared bulk delete handler
async function handleBulkDelete(button) {
    const selectedIds = getSelectedExpenseIds(); // FIX: Call the function to get selected IDs
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
        await bulkDeleteExpenses(selectedIds);

        // Reload data from server to ensure consistency
        if (window.loadExpenses) {
            await window.loadExpenses();
        }

        // Clear all checkboxes immediately to avoid stale state
        const checkboxes = document.querySelectorAll('.autofill-row-checkbox, .autofill-header-checkbox');
        checkboxes.forEach(cb => { cb.checked = false; });

        // Hide floating button immediately
        updateFloatingButtonVisibility();

        // Apply filters to maintain current view
        if (window.applyColumnFilters) {
            window.applyColumnFilters();
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

// Update floating button visibility
function updateFloatingButtonVisibility() {
    const selectedIds = getSelectedExpenseIds(); // FIX: Call the function to get selected IDs
    const floatingBtn = document.getElementById('floatingButtonContainer');
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
    
    // Update selection summary
    updateSelectionSummary(selectedIds);
}

// Update selection summary with count and total
function updateSelectionSummary(selectedIds) {
    if (selectedIds.length === 0) {
        // No selection, show the original totals for all
        updateTotalSpending(window.filteredExpenses);
        return;
    }
    
    // Calculate totals for selected expenses using centralized function
    const filteredExpenses = window.filteredExpenses || [];
    const selectedExpenses = selectedIds.map(id => 
        filteredExpenses.find(exp => exp.id.toString() === id)
    ).filter(Boolean);
    
    // Use the single source of truth function
    updateAllSpendingDisplays(selectedExpenses);
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

// Make functions available globally for time period integration
window.renderQuickFilterChips = renderQuickFilterChips;
