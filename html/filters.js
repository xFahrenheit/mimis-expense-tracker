import { allExpenses, filteredExpenses, sortState, setFilteredExpenses, setSortState } from './config.js';

// Apply column filters and sorting
export function applyColumnFilters(baseExpenses = null) {
    try {
        // Use provided baseExpenses, or if no time period is active, use allExpenses
        // If a time period is active and no baseExpenses provided, get time-period filtered expenses
        let sourceExpenses;
        
        if (baseExpenses && Array.isArray(baseExpenses)) {
            sourceExpenses = baseExpenses;
        } else {
            // Check if we have an active time period filter
            try {
                const currentPeriod = window.getCurrentPeriodFilter && window.getCurrentPeriodFilter();
                if (currentPeriod && currentPeriod !== 'all-time') {
                    // Use the current filteredExpenses which should be time-period filtered
                    sourceExpenses = Array.isArray(filteredExpenses) ? filteredExpenses : [];
                } else {
                    sourceExpenses = Array.isArray(allExpenses) ? allExpenses : [];
                }
            } catch (error) {
                console.warn('Error getting current period filter, using allExpenses:', error);
                sourceExpenses = Array.isArray(allExpenses) ? allExpenses : [];
            }
        }
        
        // Safety check: ensure sourceExpenses is always an array
        if (!Array.isArray(sourceExpenses)) {
            console.warn('sourceExpenses is not an array, defaulting to empty array:', sourceExpenses);
            sourceExpenses = [];
        }
        
        // Get all filter values once (outside the loop)
        const dateFromEl = document.getElementById('filter-date-from');
        const dateToEl = document.getElementById('filter-date-to');
        const dateFrom = dateFromEl ? dateFromEl.value : '';
        const dateTo = dateToEl ? dateToEl.value : '';
        
        const descEl = document.getElementById('filter-description');
        const descVal = descEl ? descEl.value.toLowerCase() : '';
        
        const amtMinEl = document.getElementById('filter-amount-min');
        const amtMaxEl = document.getElementById('filter-amount-max');
        const amtMin = amtMinEl ? amtMinEl.value : '';
        const amtMax = amtMaxEl ? amtMaxEl.value : '';
        
        const catEl = document.getElementById('filter-category');
        const cardEl = document.getElementById('filter-card');
        const whoEl = document.getElementById('filter-who');
        const needEl = document.getElementById('filter-needcat');
        const catVal = catEl ? catEl.value : '';
        const cardVal = cardEl ? cardEl.value : '';
        const whoVal = whoEl ? whoEl.value : '';
        const needVal = needEl ? needEl.value : '';
        
        const notesEl = document.getElementById('filter-notes');
        const notesVal = notesEl ? notesEl.value.toLowerCase() : '';
        
        const filtered = sourceExpenses.filter(expense => {
            let dateOk = true;
            if (dateFrom && expense.date) dateOk = expense.date >= dateFrom;
            if (dateTo && expense.date) dateOk = dateOk && expense.date <= dateTo;
            
            // Amount min/max
            let amtOk = true;
            if (amtMin !== "" && expense.amount !== undefined) amtOk = Number(expense.amount) >= Number(amtMin);
            if (amtMax !== "" && expense.amount !== undefined) amtOk = amtOk && Number(expense.amount) <= Number(amtMax);
            
            // Category, Card, Who, Need
            let catOk = !catVal || (expense.category === catVal);
            let cardOk = !cardVal || (expense.card === cardVal);
            let whoOk = !whoVal || (expense.who === whoVal);
            let needOk = !needVal || (expense.need_category === needVal);
            
            // Description, Notes
            let descOk = !descVal || (expense.description && expense.description.toLowerCase().includes(descVal));
            let notesOk = !notesVal || (expense.notes && expense.notes.toLowerCase().includes(notesVal));
            
            return dateOk && amtOk && catOk && cardOk && whoOk && needOk && descOk && notesOk;
        });
        
        // Sorting
        if (sortState.column) {
            filtered.sort((a, b) => {
                let v1 = a[sortState.column], v2 = b[sortState.column];
                if (sortState.column === 'amount') {
                    v1 = Number(v1); v2 = Number(v2);
                }
                if (sortState.column === 'date') {
                    v1 = v1 || '';
                    v2 = v2 || '';
                    // Convert dates to actual Date objects for proper sorting
                    const date1 = new Date(v1);
                    const date2 = new Date(v2);
                    
                    // Handle invalid dates
                    if (isNaN(date1.getTime()) && isNaN(date2.getTime())) return 0;
                    if (isNaN(date1.getTime())) return 1;
                    if (isNaN(date2.getTime())) return -1;
                    // Sort by actual date values
                    return (date1.getTime() - date2.getTime()) * sortState.direction;
                }
                if (v1 === undefined) v1 = '';
                if (v2 === undefined) v2 = '';
                if (typeof v1 === 'number' && typeof v2 === 'number') return (v1 - v2) * sortState.direction;
                return v1.toString().localeCompare(v2.toString()) * sortState.direction;
            });
        }
        
        setFilteredExpenses(filtered);
        
        // Re-render components with filtered data
        if (window.renderExpenses) window.renderExpenses(filtered);
        if (window.renderCharts) window.renderCharts(filtered);
        if (window.updateSpendingBlocks) window.updateSpendingBlocks(filtered);
    
    } catch (error) {
        console.error('Error in applyColumnFilters:', error);
        // Fallback to rendering empty state
        setFilteredExpenses([]);
        if (window.renderExpenses) window.renderExpenses([]);
    }
}

// Attach filter and sort listeners
export function attachFilterAndSortListeners() {
    
    [
        'filter-date-from', 'filter-date-to', 'filter-description',
        'filter-amount-min', 'filter-amount-max',
        'filter-category', 'filter-card', 'filter-who', 'filter-notes'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', applyColumnFilters);
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', applyColumnFilters);
            }
        }
    });
    
    // Sorting listeners
    const thDate = document.getElementById('th-date');
    const thAmount = document.getElementById('th-amount');
    const thDescription = document.getElementById('th-description');
    if (thDate) thDate.addEventListener('click', () => toggleSort('date'));
    if (thAmount) thAmount.addEventListener('click', () => toggleSort('amount'));
    if (thDescription) thDescription.addEventListener('click', () => toggleSort('description'));
    
    // Initialize sort arrows display
    updateSortArrows();
    
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

// Toggle sort direction
export function toggleSort(column) {
    if (sortState.column === column) {
        setSortState({ ...sortState, direction: sortState.direction * -1 });
    } else {
        setSortState({ column, direction: -1 }); // Default to descending (newest first for dates)
    }
    
    updateSortArrows();
    applyColumnFilters();
}

// Update sort arrow display
export function updateSortArrows() {
    ['date','amount','description'].forEach(col => {
        const el = document.getElementById('sort-' + col);
        if (el) {
            if (sortState.column === col) {
                el.innerHTML = sortState.direction === 1 
                    ? '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M8 4l-4 4h8l-4-4z" fill="var(--mint)"/></svg>' 
                    : '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M8 12l4-4H4l4 4z" fill="var(--mint)"/></svg>';
            } else {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" style="display:inline;vertical-align:middle;"><path d="M4 6l4 4 4-4" stroke="var(--mint)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            }
        }
    });
}


