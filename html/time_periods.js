// Time Period Management - Database-driven and Dynamic
import { allExpenses, filteredExpenses, setFilteredExpenses } from './config.js';
import { loadExpenses } from './api.js';
import { updateAllSpendingDisplays } from './render.js';

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
            // Skip invalid dates
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
            return;
        }

        // Clear existing tabs
        container.innerHTML = '';

        if (expenses.length === 0) {
            container.innerHTML = '<span class="text-gray-500 text-sm">No expenses loaded yet</span>';
            return;
        }

        const { months, years } = getAvailableTimePeriods(expenses);

        // Create main tabs row container
        const mainTabsRow = document.createElement('div');
        mainTabsRow.className = 'main-period-tabs';
        
        // Add "All Time" tab
        const allTimeTab = createPeriodTab('all-time', 'All Time', 'all-time');
        mainTabsRow.appendChild(allTimeTab);

        // Add year tabs
        const recentYears = years.slice(0, 5);
        recentYears.forEach(year => {
            const yearTab = createPeriodTab(year.toString(), year.toString(), 'year');
            mainTabsRow.appendChild(yearTab);
            
            // Create month container for this year and add it to the main tabs row
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-deck-container';
            monthContainer.id = `months-${year}`;
            monthContainer.style.display = 'none';
            
            // Add month tabs for this year
            const yearMonths = months.filter(month => month.startsWith(year.toString()));
            yearMonths.forEach((month, index) => {
                const monthTab = createPeriodTab(month, formatPeriodDisplay(month), 'month');
                monthContainer.appendChild(monthTab);
            });
            
            mainTabsRow.appendChild(monthContainer);
        });

        container.appendChild(mainTabsRow);
        
        // Default to "All Time" and ensure it's properly selected
        await selectTimePeriod('all-time');
    } catch (error) {
        console.error('Error creating time period tabs:', error);
    }
}

// Create individual period tab
function createPeriodTab(period, displayText, tabType = 'month') {
    const tab = document.createElement('button');
    tab.className = `period-tab period-tab-${tabType}`;
    tab.textContent = displayText;
    tab.dataset.period = period;
    
    if (period === currentPeriodFilter) {
        tab.classList.add('active');
    }

    tab.addEventListener('click', () => {
        if (tabType === 'year') {
            // Toggle month deck for year tabs
            toggleMonthDeck(period);
        } else {
            // Regular filtering for non-year tabs
            selectTimePeriod(period);
        }
    });

    return tab;
}

// Toggle month deck expansion for year tabs
function toggleMonthDeck(year) {
    const monthContainer = document.getElementById(`months-${year}`);
    const yearTab = document.querySelector(`[data-period="${year}"]`);
    
    if (!monthContainer || !yearTab) return;
    
    const isExpanded = monthContainer.classList.contains('expanded');
    
    // Close all other month decks first
    document.querySelectorAll('.month-deck-container').forEach(container => {
        if (container !== monthContainer) {
            container.classList.remove('expanded');
            setTimeout(() => {
                container.style.display = 'none';
            }, 300);
        }
    });
    
    // Remove expanded class from all year tabs
    document.querySelectorAll('.period-tab-year').forEach(tab => {
        tab.classList.remove('expanded');
    });
    
    if (isExpanded) {
        // Collapse this deck
        monthContainer.classList.remove('expanded');
        setTimeout(() => {
            monthContainer.style.display = 'none';
        }, 300);
        
        // Also filter to show the full year when collapsed
        selectTimePeriod(year);
    } else {
        // Expand this deck
        monthContainer.style.display = 'flex';
        yearTab.classList.add('expanded');
        setTimeout(() => {
            monthContainer.classList.add('expanded');
        }, 10);
        
        // Filter to show the full year
        selectTimePeriod(year);
    }
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
    } catch (error) {
        console.error('Error selecting time period:', error);
    }
}

// Filter expenses by selected time period
async function filterExpensesByPeriod(period) {
    try {
        const allExpenses = await getExpensesFromDatabase();
        let filteredExpenses;

        if (period === 'all-time') {
            filteredExpenses = allExpenses;
        } else if (period.includes('-')) {
                        // Month filter: 2025-01 for January 2025
            const [targetYear, targetMonth] = period.split('-').map(num => parseInt(num));
            const adjustedTargetMonth = targetMonth - 1; // Convert to 0-based month
            
            filteredExpenses = allExpenses.filter(expense => {
                try {
                    const expenseDate = new Date(expense.date);
                    const expenseYear = expenseDate.getFullYear();
                    const expenseMonth = expenseDate.getMonth();
                    
                    return expenseYear === targetYear && expenseMonth === adjustedTargetMonth;
                } catch (error) {
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

        // Update the global filtered expenses state
        setFilteredExpenses(filteredExpenses);
        
        // Update quick filter chips based on time-period filtered data
        if (window.renderQuickFilterChips) {
            window.renderQuickFilterChips(filteredExpenses);
        }
        
        // Apply column filters to the time-period filtered expenses
        // This ensures any active column filters are maintained
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
    } catch (error) {
        console.error('Error filtering expenses by period:', error);
    }
}

// Update spending totals for the selected period
function updateSpendingTotals(expenses) {
    try {
        // Safety check for expenses array
        if (!expenses || !Array.isArray(expenses)) {
            expenses = [];
        }
        
        // Use the single source of truth function
        updateAllSpendingDisplays(expenses);
    } catch (error) {
        console.error('Error updating spending totals:', error);
    }
}

// Initialize time periods when expenses are loaded
async function initializeTimePeriods() {
    try {
        // Reset to default state on initialization
        currentPeriodFilter = 'all-time';
        
        await createTimePeriodTabs();
        
        // Set up refresh button
        const refreshBtn = document.getElementById('refreshPeriodsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await createTimePeriodTabs();
            });
        }
    } catch (error) {
        console.error('Error initializing time periods:', error);
    }
}

// Get current period filter
function getCurrentPeriodFilter() {
    return currentPeriodFilter || 'all-time';
}

// Export for use by other modules
export { 
    initializeTimePeriods,
    createTimePeriodTabs, 
    selectTimePeriod, 
    getCurrentPeriodFilter 
};

// Make functions available globally for upload handler and chips
window.selectTimePeriod = selectTimePeriod;
window.getCurrentPeriodFilter = getCurrentPeriodFilter;
