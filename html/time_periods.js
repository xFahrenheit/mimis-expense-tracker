// Time Period Management - Database-driven and Dynamic
import { allExpenses, filteredExpenses, setFilteredExpenses } from './config.js';
import { loadExpenses } from './api.js';

let currentPeriodFilter = 'all-time';

// Get fresh expenses from database/API
async function getExpensesFromDatabase() {
    try {
        // If we have expenses in memory, use them
        if (allExpenses && allExpenses.length > 0) {
            return allExpenses;
        }
        
        // Otherwise fetch fresh from API
        await loadExpenses();
        return allExpenses || [];
    } catch (error) {
        console.error('Error getting expenses from database:', error);
        return [];
    }
}

// Get unique time periods from expenses
function getAvailableTimePeriods(expenses) {
    if (!expenses || expenses.length === 0) {
        return { months: [], years: [] };
    }

    const periods = new Set();
    const years = new Set();
    
    expenses.forEach(expense => {
        try {
            const date = new Date(expense.date);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = date.getMonth();
                const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
                
                periods.add(yearMonth);
                years.add(year);
            }
        } catch (error) {
            console.log('Error parsing date:', expense.date);
        }
    });

    return {
        months: Array.from(periods).sort().reverse(),
        years: Array.from(years).sort((a, b) => b - a)
    };
}

// Format period for display
function formatPeriodDisplay(period) {
    if (period === 'all-time') {
        return 'All Time';
    }
    
    if (period.includes('-')) {
        try {
            const [year, month] = period.split('-');
            const date = new Date(year, month - 1);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
            });
        } catch (error) {
            return period;
        }
    } else {
        return period.toString();
    }
}

// Create time period tabs - dynamically from database
async function createTimePeriodTabs() {
    try {
        const expenses = await getExpensesFromDatabase();
        const container = document.getElementById('periodTabsContainer');
        
        if (!container) {
            console.log('Period tabs container not found');
            return;
        }

        // Clear existing tabs
        container.innerHTML = '';

        if (expenses.length === 0) {
            container.innerHTML = '<span class="text-gray-500 text-sm">No expenses loaded yet</span>';
            return;
        }

        const { months, years } = getAvailableTimePeriods(expenses);

        // Add "All Time" tab
        const allTimeTab = createPeriodTab('all-time', 'All Time', true);
        container.appendChild(allTimeTab);

        // Add year tabs (limit to recent 5 years)
        const recentYears = years.slice(0, 5);
        recentYears.forEach(year => {
            const yearTab = createPeriodTab(year.toString(), year.toString());
            container.appendChild(yearTab);
        });

        // Add month tabs (limit to recent 12 months)
        const recentMonths = months.slice(0, 12);
        recentMonths.forEach(month => {
            const monthTab = createPeriodTab(month, formatPeriodDisplay(month));
            container.appendChild(monthTab);
        });

        console.log(`Created ${1 + recentYears.length + recentMonths.length} time period tabs`);
        
        // Update spending totals after creating tabs (with all expenses for "All Time" default)
        updateSpendingTotals(expenses);
    } catch (error) {
        console.error('Error creating time period tabs:', error);
    }
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
async function selectTimePeriod(period) {
    try {
        currentPeriodFilter = period;
        
        // Update active tab styling
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.period === period) {
                tab.classList.add('active');
            }
        });

        // Filter expenses by time period
        await filterExpensesByPeriod(period);
        
        console.log('Selected time period:', period);
    } catch (error) {
        console.error('Error selecting time period:', error);
    }
}

// Filter expenses by selected time period
async function filterExpensesByPeriod(period) {
    try {
        const allExpenses = await getExpensesFromDatabase();
        let filteredExpenses;

        console.log(`Filtering by period: ${period}, total expenses available: ${allExpenses.length}`);

        if (period === 'all-time') {
            filteredExpenses = allExpenses;
            console.log(`All Time: showing all ${filteredExpenses.length} expenses`);
        } else if (period.includes('-')) {
            // Month filter: 2025-01 for January 2025
            const [year, month] = period.split('-');
            const targetYear = parseInt(year);
            const targetMonth = parseInt(month) - 1; // JavaScript months are 0-indexed
            
            console.log(`Filtering for period: ${period}, target year: ${targetYear}, target month: ${targetMonth}`);
            
            filteredExpenses = allExpenses.filter(expense => {
                try {
                    const expenseDate = new Date(expense.date);
                    const expenseYear = expenseDate.getFullYear();
                    const expenseMonth = expenseDate.getMonth();
                    
                    const matches = expenseYear === targetYear && expenseMonth === targetMonth;
                    if (matches) {
                        console.log(`Expense ${expense.date} (${expenseYear}-${expenseMonth+1}) matches period ${period}`);
                    }
                    return matches;
                } catch (error) {
                    console.error('Error parsing expense date:', expense.date, error);
                    return false;
                }
            });
        } else {
            // Year filter: 2024
            const year = parseInt(period);
            filteredExpenses = allExpenses.filter(expense => {
                try {
                    const expenseDate = new Date(expense.date);
                    return expenseDate.getFullYear() === year;
                } catch (error) {
                    return false;
                }
            });
        }

        // Update filtered expenses and re-render table
        setFilteredExpenses(filteredExpenses);
        
        // Apply sorting and other filters to the time-period filtered expenses
        if (window.applyColumnFilters) {
            window.applyColumnFilters(filteredExpenses);
        } else {
            // Fallback to direct rendering if applyColumnFilters not available
            if (window.renderExpenses) {
                window.renderExpenses(filteredExpenses);
            }
        }
        
        // Update spending totals
        updateSpendingTotals(filteredExpenses);
        
        console.log(`Filtered to ${filteredExpenses.length} expenses for period: ${period}`);
    } catch (error) {
        console.error('Error filtering expenses by period:', error);
    }
}

// Update spending totals for the selected period
function updateSpendingTotals(expenses) {
    try {
        // Safety check for expenses array
        if (!expenses || !Array.isArray(expenses)) {
            console.log('No expenses provided to updateSpendingTotals, using empty array');
            expenses = [];
        }
        
        const totalSpending = expenses.reduce((sum, exp) => sum + Math.abs(exp.amount || 0), 0);
        const gautamiSpending = expenses
            .filter(exp => (exp.who || '').toLowerCase() === 'gautami')
            .reduce((sum, exp) => sum + Math.abs(exp.amount || 0), 0);
        const ameyaSpending = expenses
            .filter(exp => (exp.who || '').toLowerCase() === 'ameya')
            .reduce((sum, exp) => sum + Math.abs(exp.amount || 0), 0);

        // Update display elements
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

        console.log(`Updated totals - Total: $${totalSpending.toFixed(2)}, Gautami: $${gautamiSpending.toFixed(2)}, Ameya: $${ameyaSpending.toFixed(2)}`);
    } catch (error) {
        console.error('Error updating spending totals:', error);
    }
}

// Initialize time periods when expenses are loaded
async function initializeTimePeriods() {
    try {
        await createTimePeriodTabs();
        
        // Set up refresh button
        const refreshBtn = document.getElementById('refreshPeriodsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await createTimePeriodTabs();
            });
        }
        
        console.log('Time periods initialized successfully');
    } catch (error) {
        console.error('Error initializing time periods:', error);
    }
}

// Get current period filter
function getCurrentPeriodFilter() {
    return currentPeriodFilter || 'all-time';
}

// Make functions available globally for upload handler
window.createTimePeriodTabs = createTimePeriodTabs;
window.selectTimePeriod = selectTimePeriod;

export {
    initializeTimePeriods,
    createTimePeriodTabs,
    selectTimePeriod,
    getCurrentPeriodFilter
};
