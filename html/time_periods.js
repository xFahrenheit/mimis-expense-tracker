// Time Period Management
import { getAllExpenses, getFilteredExpenses, setFilteredExpenses } from './config.js';
import { renderExpenses } from './render.js';
import { applyColumnFilters } from './filters.js';

let currentPeriodFilter = 'all-time';

// Get unique time periods from expenses
function getAvailableTimePeriods(expenses) {
    if (!expenses || expenses.length === 0) {
        return [];
    }

    // Get all unique year-month combinations
    const periods = new Set();
    const years = new Set();
    
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        periods.add(yearMonth);
        years.add(year);
    });

    // Convert to sorted arrays
    const sortedPeriods = Array.from(periods).sort().reverse(); // Most recent first
    const sortedYears = Array.from(years).sort((a, b) => b - a); // Most recent first

    return {
        months: sortedPeriods,
        years: sortedYears
    };
}

// Format period for display
function formatPeriodDisplay(period) {
    if (period === 'all-time') {
        return 'All Time';
    }
    
    if (period.includes('-')) {
        // Month format: 2024-07
        const [year, month] = period.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
        });
    } else {
        // Year format: 2024
        return period;
    }
}

// Create time period tabs
function createTimePeriodTabs() {
    const expenses = getAllExpenses();
    const { months, years } = getAvailableTimePeriods(expenses);
    const container = document.getElementById('periodTabsContainer');
    
    if (!container) {
        console.warn('Period tabs container not found');
        return;
    }

    // Clear existing tabs
    container.innerHTML = '';

    // Add "All Time" tab
    const allTimeTab = createPeriodTab('all-time', 'All Time', true);
    container.appendChild(allTimeTab);

    // Add year tabs
    years.forEach(year => {
        const yearTab = createPeriodTab(year.toString(), year.toString());
        container.appendChild(yearTab);
    });

    // Add month tabs (limit to recent 12 months)
    const recentMonths = months.slice(0, 12);
    recentMonths.forEach(month => {
        const monthTab = createPeriodTab(month, formatPeriodDisplay(month));
        container.appendChild(monthTab);
    });

    // Update totals for current period
    updateSpendingForPeriod(currentPeriodFilter);
}

// Create individual period tab
function createPeriodTab(period, displayText, isAllTime = false) {
    const tab = document.createElement('button');
    tab.className = `period-tab ${isAllTime ? 'all-time' : ''}`;
    tab.textContent = displayText;
    tab.dataset.period = period;
    
    if (period === currentPeriodFilter) {
        tab.classList.add('active');
    }

    tab.addEventListener('click', () => {
        selectTimePeriod(period);
    });

    return tab;
}

// Select a time period
function selectTimePeriod(period) {
    currentPeriodFilter = period;
    
    // Update active tab styling
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.period === period) {
            tab.classList.add('active');
        }
    });

    // Filter expenses by time period
    filterExpensesByPeriod(period);
    
    // Update spending totals
    updateSpendingForPeriod(period);
}

// Filter expenses by selected time period
function filterExpensesByPeriod(period) {
    const allExpenses = getAllExpenses();
    let filteredExpenses;

    if (period === 'all-time') {
        filteredExpenses = allExpenses;
    } else if (period.includes('-')) {
        // Month filter: 2024-07
        const [year, month] = period.split('-');
        filteredExpenses = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === parseInt(year) && 
                   expenseDate.getMonth() === parseInt(month) - 1;
        });
    } else {
        // Year filter: 2024
        const year = parseInt(period);
        filteredExpenses = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year;
        });
    }

    // Update filtered expenses and re-render table
    setFilteredExpenses(filteredExpenses);
    renderExpenses(filteredExpenses);
    
    // Re-apply any active column filters on the new dataset
    setTimeout(() => {
        applyColumnFilters();
    }, 50);
}

// Update spending totals for the selected period
function updateSpendingForPeriod(period) {
    const allExpenses = getAllExpenses();
    let periodExpenses;

    if (period === 'all-time') {
        periodExpenses = allExpenses;
    } else if (period.includes('-')) {
        // Month filter
        const [year, month] = period.split('-');
        periodExpenses = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === parseInt(year) && 
                   expenseDate.getMonth() === parseInt(month) - 1;
        });
    } else {
        // Year filter
        const year = parseInt(period);
        periodExpenses = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year;
        });
    }

    // Calculate totals
    const totalSpending = periodExpenses.reduce((sum, exp) => sum + Math.abs(exp.amount), 0);
    const gautamiSpending = periodExpenses
        .filter(exp => exp.who === 'Gautami')
        .reduce((sum, exp) => sum + Math.abs(exp.amount), 0);
    const ameyaSpending = periodExpenses
        .filter(exp => exp.who === 'Ameya')
        .reduce((sum, exp) => sum + Math.abs(exp.amount), 0);

    // Update display
    const totalElement = document.getElementById('totalSpendingValue');
    const gautamiElement = document.getElementById('gautamiSpendingValue');
    const ameyaElement = document.getElementById('ameyaSpendingValue');

    if (totalElement) {
        totalElement.textContent = `$${totalSpending.toFixed(2)}`;
    }
    if (gautamiElement) {
        gautamiElement.textContent = `$${gautamiSpending.toFixed(2)}`;
    }
    if (ameyaElement) {
        ameyaElement.textContent = `$${ameyaSpending.toFixed(2)}`;
    }

    // Update averages based on period
    updateAveragesForPeriod(periodExpenses, period);
}

// Update averages display based on the time period
function updateAveragesForPeriod(expenses, period) {
    if (expenses.length === 0) {
        const avgPerDay = document.getElementById('avgPerDay');
        const avgPerMonth = document.getElementById('avgPerMonth');
        if (avgPerDay) avgPerDay.textContent = '$0/day';
        if (avgPerMonth) avgPerMonth.textContent = '$0/mo';
        return;
    }

    const totalSpending = expenses.reduce((sum, exp) => sum + Math.abs(exp.amount), 0);
    let avgDaily, avgMonthly;

    if (period === 'all-time') {
        // Calculate based on date range
        const dates = expenses.map(exp => new Date(exp.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const daysDiff = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
        const monthsDiff = Math.max(1, daysDiff / 30.44);
        
        avgDaily = totalSpending / daysDiff;
        avgMonthly = totalSpending / monthsDiff;
    } else if (period.includes('-')) {
        // Monthly period
        const [year, month] = period.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        avgDaily = totalSpending / daysInMonth;
        avgMonthly = totalSpending; // This IS the monthly total
    } else {
        // Yearly period
        avgDaily = totalSpending / 365;
        avgMonthly = totalSpending / 12;
    }

    // Update display
    const avgPerDay = document.getElementById('avgPerDay');
    const avgPerMonth = document.getElementById('avgPerMonth');
    
    if (avgPerDay) {
        avgPerDay.textContent = `$${avgDaily.toFixed(2)}/day`;
    }
    if (avgPerMonth) {
        avgPerMonth.textContent = `$${avgMonthly.toFixed(2)}/mo`;
    }
}

// Initialize time periods when expenses are loaded
function initializeTimePeriods() {
    createTimePeriodTabs();
    
    // Set up refresh button
    const refreshBtn = document.getElementById('refreshPeriodsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            createTimePeriodTabs();
        });
    }
}

// Reset to all-time view
function resetToAllTime() {
    selectTimePeriod('all-time');
}

// Get current period filter
function getCurrentPeriodFilter() {
    return currentPeriodFilter || 'all-time';
}

export {
    initializeTimePeriods,
    createTimePeriodTabs,
    selectTimePeriod,
    resetToAllTime,
    getCurrentPeriodFilter,
    updateSpendingForPeriod
};
