import { allExpenses, filteredExpenses, sortState, setFilteredExpenses, setSortState } from './config.js';

// Helper function to safely parse dates
function parseDate(dateString) {
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    } catch (error) {
        return null;
    }
}

// Helper function to compare dates properly
function isDateInRange(expenseDate, dateFrom, dateTo) {
    const expDate = parseDate(expenseDate);
    if (!expDate) return true; // If we can't parse the expense date, don't filter it out
    
    let inRange = true;
    
    if (dateFrom) {
        const fromDate = parseDate(dateFrom);
        if (fromDate) {
            // Set time to start of day for from date
            fromDate.setHours(0, 0, 0, 0);
            expDate.setHours(0, 0, 0, 0);
            inRange = expDate >= fromDate;
        }
    }
    
    if (dateTo && inRange) {
        const toDate = parseDate(dateTo);
        if (toDate) {
            // Set time to end of day for to date
            toDate.setHours(23, 59, 59, 999);
            expDate.setHours(0, 0, 0, 0);
            inRange = expDate <= toDate;
        }
    }
    
    return inRange;
}

// Get filter values from DOM
function getFilterValues() {
    return {
        dateFrom: document.getElementById('filter-date-from')?.value || '',
        dateTo: document.getElementById('filter-date-to')?.value || '',
        description: document.getElementById('filter-description')?.value.toLowerCase() || '',
        amountMin: document.getElementById('filter-amount-min')?.value || '',
        amountMax: document.getElementById('filter-amount-max')?.value || '',
        category: document.getElementById('filter-category')?.value || '',
        card: document.getElementById('filter-card')?.value || '',
        who: document.getElementById('filter-who')?.value || '',
        needCategory: document.getElementById('filter-needcat')?.value || '',
        notes: document.getElementById('filter-notes')?.value.toLowerCase() || ''
    };
}

// Apply column filters and sorting
export function applyColumnFilters(baseExpenses = null) {
    try {
        // Determine source expenses
        let sourceExpenses;
        
        if (baseExpenses && Array.isArray(baseExpenses)) {
            sourceExpenses = baseExpenses;
        } else {
            // Check if we have an active time period filter
            try {
                const currentPeriod = window.getCurrentPeriodFilter && window.getCurrentPeriodFilter();
                if (currentPeriod && currentPeriod !== 'all-time') {
                    sourceExpenses = Array.isArray(filteredExpenses) ? filteredExpenses : [];
                } else {
                    sourceExpenses = Array.isArray(allExpenses) ? allExpenses : [];
                }
            } catch (error) {
                console.warn('Error getting current period filter, using allExpenses:', error);
                sourceExpenses = Array.isArray(allExpenses) ? allExpenses : [];
            }
        }
        
        // Safety check
        if (!Array.isArray(sourceExpenses)) {
            console.warn('sourceExpenses is not an array, defaulting to empty array:', sourceExpenses);
            sourceExpenses = [];
        }
        
        // Get all filter values
        const filters = getFilterValues();
        
        // Apply filters
        const filtered = sourceExpenses.filter(expense => {
            // Date range check
            if (!isDateInRange(expense.date, filters.dateFrom, filters.dateTo)) {
                return false;
            }
            
            // Amount range check
            if (filters.amountMin !== "" && expense.amount !== undefined) {
                if (Number(expense.amount) < Number(filters.amountMin)) return false;
            }
            if (filters.amountMax !== "" && expense.amount !== undefined) {
                if (Number(expense.amount) > Number(filters.amountMax)) return false;
            }
            
            // Dropdown filters
            if (filters.category && expense.category !== filters.category) return false;
            if (filters.card && expense.card !== filters.card) return false;
            if (filters.who && expense.who !== filters.who) return false;
            if (filters.needCategory && expense.need_category !== filters.needCategory) return false;
            
            // Text search filters
            if (filters.description && (!expense.description || !expense.description.toLowerCase().includes(filters.description))) {
                return false;
            }
            if (filters.notes && (!expense.notes || !expense.notes.toLowerCase().includes(filters.notes))) {
                return false;
            }
            
            return true;
        });
        
        // Apply sorting
        if (sortState.column) {
            filtered.sort((a, b) => {
                let v1 = a[sortState.column];
                let v2 = b[sortState.column];
                
                if (sortState.column === 'amount') {
                    v1 = Number(v1) || 0;
                    v2 = Number(v2) || 0;
                    return (v1 - v2) * sortState.direction;
                }
                
                if (sortState.column === 'date') {
                    const date1 = parseDate(v1 || '');
                    const date2 = parseDate(v2 || '');
                    
                    if (!date1 && !date2) return 0;
                    if (!date1) return 1;
                    if (!date2) return -1;
                    
                    return (date1.getTime() - date2.getTime()) * sortState.direction;
                }
                
                // String comparison
                v1 = (v1 || '').toString();
                v2 = (v2 || '').toString();
                return v1.localeCompare(v2) * sortState.direction;
            });
        }
        
        // Update state and UI
        setFilteredExpenses(filtered);
        
        if (window.renderExpenses) window.renderExpenses(filtered);
        if (window.renderCharts) window.renderCharts(filtered);
        if (window.updateSpendingBlocks) window.updateSpendingBlocks(filtered);
    
    } catch (error) {
        console.error('Error in applyColumnFilters:', error);
        setFilteredExpenses([]);
        if (window.renderExpenses) window.renderExpenses([]);
    }
}

// Attach filter and sort listeners
export function attachFilterAndSortListeners() {
    const filterIds = [
        'filter-date-from', 'filter-date-to', 'filter-description',
        'filter-amount-min', 'filter-amount-max',
        'filter-category', 'filter-card', 'filter-who', 'filter-notes'
    ];
    
    filterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', applyColumnFilters);
            if (element.tagName === 'SELECT') {
                element.addEventListener('change', applyColumnFilters);
            }
        }
    });
    
    // Sorting listeners
    const sortElements = [
        { id: 'th-date', column: 'date' },
        { id: 'th-amount', column: 'amount' },
        { id: 'th-description', column: 'description' }
    ];
    
    sortElements.forEach(({ id, column }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', () => toggleSort(column));
        }
    });
    
    updateSortArrows();
    
    // Filter bar show/hide logic
    document.querySelectorAll('.filter-arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const col = arrow.getAttribute('data-filter');
            const bar = document.getElementById('filterbar-' + col);
            
            // Hide all other filter bars
            document.querySelectorAll('.filterbar').forEach(fb => {
                if (fb !== bar) fb.style.display = 'none';
            });
            
            // Toggle current bar
            if (bar) {
                bar.style.display = (bar.style.display === 'none' || bar.style.display === '') ? 'block' : 'none';
            }
        });
    });
    
    // Hide filterbars when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-arrow') && !e.target.closest('.filterbar')) {
            document.querySelectorAll('.filterbar').forEach(fb => fb.style.display = 'none');
        }
    });
}

// Toggle sort direction
export function toggleSort(column) {
    if (sortState.column === column) {
        setSortState({ ...sortState, direction: sortState.direction * -1 });
    } else {
        setSortState({ column, direction: -1 });
    }
    
    updateSortArrows();
    applyColumnFilters();
}

// Update sort arrow display
export function updateSortArrows() {
    const columns = ['date', 'amount', 'description'];
    
    columns.forEach(col => {
        const element = document.getElementById('sort-' + col);
        if (element) {
            if (sortState.column === col) {
                const direction = sortState.direction === 1 ? 'up' : 'down';
                element.innerHTML = direction === 'up'
                    ? '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M8 4l-4 4h8l-4-4z" fill="var(--mint)"/></svg>'
                    : '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M8 12l4-4H4l4 4z" fill="var(--mint)"/></svg>';
            } else {
                element.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M4 6l4 4 4-4" stroke="var(--mint)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            }
        }
    });
}