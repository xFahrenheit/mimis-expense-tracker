import { allExpenses, filteredExpenses, sortState, setFilteredExpenses, setSortState } from './config.js';

// Apply column filters and sorting
export function applyColumnFilters() {
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
    
    const filtered = allExpenses.filter(e => {
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
        filtered.sort((a, b) => {
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
    
    setFilteredExpenses(filtered);
    
    // Re-render components with filtered data
    if (window.renderExpenses) window.renderExpenses(filtered);
    if (window.renderCharts) window.renderCharts(filtered);
    if (window.updateSpendingBlocks) window.updateSpendingBlocks(filtered);
}

// Attach filter and sort listeners
export function attachFilterAndSortListeners() {
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

// Toggle sort direction
export function toggleSort(column) {
    if (sortState.column === column) {
        setSortState({ ...sortState, direction: sortState.direction * -1 });
    } else {
        setSortState({ column, direction: 1 });
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
