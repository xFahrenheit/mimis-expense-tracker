// Time Period Management - Clean and Improved with Debugging
import { allExpenses, filteredExpenses, setFilteredExpenses } from './config.js';
import { loadExpenses } from './api.js';
import { updateAllSpendingDisplays } from './render.js';

let currentPeriodFilter = 'all-time';

// Get fresh expenses from database/API
async function getExpensesFromDatabase() {
    try {
        if (allExpenses?.length > 0) {
            return allExpenses;
        }
        await loadExpenses();
        return allExpenses || [];
    } catch (error) {
        console.error('Error getting expenses from database:', error);
        return [];
    }
}

// Parse date safely with timezone awareness
function parseDate(dateString) {
    try {
        if (!dateString) return null;
        
        // Handle different date formats
        let date;
        
        // If it's already a Date object, return it
        if (dateString instanceof Date) {
            return isNaN(dateString.getTime()) ? null : dateString;
        }
        
        // If it's in ISO format (YYYY-MM-DD), parse as local date to avoid timezone issues
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
            const [year, month, day] = dateString.trim().split('-').map(num => parseInt(num));
            date = new Date(year, month - 1, day); // month is 0-based in Date constructor
        } else {
            // For other formats, use normal Date parsing
            date = new Date(dateString);
        }
        
        return isNaN(date.getTime()) ? null : date;
    } catch (error) {
        console.warn('Error parsing date:', dateString, error);
        return null;
    }
}

// Get unique time periods from expenses
function getAvailableTimePeriods(expenses) {
    if (!expenses?.length) {
        return { months: [], years: [] };
    }

    const periods = new Set();
    const years = new Set();
    
    expenses.forEach(expense => {
        const date = parseDate(expense.date);
        if (date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const yearMonth = `${year}-${month}`;
            
            periods.add(yearMonth);
            years.add(year);
        }
    });

    return {
        months: Array.from(periods).sort().reverse(),
        years: Array.from(years).sort((a, b) => b - a)
    };
}

// Format period for display
function formatPeriodDisplay(period) {
    if (period === 'all-time') return 'All Time';
    
    if (period.includes('-')) {
        const [year, month] = period.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
        });
    }
    return period.toString();
}

// Create time period tabs
async function createTimePeriodTabs() {
    try {
        const expenses = await getExpensesFromDatabase();
        const container = document.getElementById('periodTabsContainer');
        
        if (!container) return;

        container.innerHTML = '';

        if (!expenses.length) {
            container.innerHTML = '<span class="text-gray-500 text-sm">No expenses loaded yet</span>';
            return;
        }

        const { months, years } = getAvailableTimePeriods(expenses);
        const mainTabsRow = document.createElement('div');
        mainTabsRow.className = 'main-period-tabs';
        
        // All Time tab
        mainTabsRow.appendChild(createPeriodTab('all-time', 'All Time', 'all-time'));

        // Year tabs with month containers
        years.slice(0, 5).forEach(year => {
            mainTabsRow.appendChild(createPeriodTab(year.toString(), year.toString(), 'year'));
            
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-deck-container';
            monthContainer.id = `months-${year}`;
            monthContainer.style.display = 'none';
            
            const yearMonths = months.filter(month => month.startsWith(year.toString()));
            yearMonths.forEach(month => {
                monthContainer.appendChild(createPeriodTab(month, formatPeriodDisplay(month), 'month'));
            });
            
            mainTabsRow.appendChild(monthContainer);
        });

        container.appendChild(mainTabsRow);
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
            toggleMonthDeck(period);
        } else {
            selectTimePeriod(period);
        }
    });

    return tab;
}

// Toggle month deck expansion
function toggleMonthDeck(year) {
    const monthContainer = document.getElementById(`months-${year}`);
    const yearTab = document.querySelector(`[data-period="${year}"]`);
    
    if (!monthContainer || !yearTab) return;
    
    const isExpanded = monthContainer.classList.contains('expanded');
    
    // Close other decks
    document.querySelectorAll('.month-deck-container').forEach(container => {
        if (container !== monthContainer) {
            container.classList.remove('expanded');
            setTimeout(() => container.style.display = 'none', 300);
        }
    });
    
    document.querySelectorAll('.period-tab-year').forEach(tab => {
        tab.classList.remove('expanded');
    });
    
    if (isExpanded) {
        monthContainer.classList.remove('expanded');
        setTimeout(() => monthContainer.style.display = 'none', 300);
    } else {
        monthContainer.style.display = 'flex';
        yearTab.classList.add('expanded');
        setTimeout(() => monthContainer.classList.add('expanded'), 10);
    }
    
    selectTimePeriod(year);
}

// Select a time period
async function selectTimePeriod(period) {
    try {
        currentPeriodFilter = period;
        
        // Update active styling
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.period === period);
        });

        await filterExpensesByPeriod(period);
    } catch (error) {
        console.error('Error selecting time period:', error);
    }
}

// Filter expenses by selected time period - FIXED with debugging
async function filterExpensesByPeriod(period) {
    try {
        const allExpensesData = await getExpensesFromDatabase();
        let filtered;

        console.log(`🔍 Filtering expenses for period: ${period}`);
        console.log(`📊 Total expenses to filter: ${allExpensesData.length}`);

        if (period === 'all-time') {
            filtered = allExpensesData;
        } else if (period.includes('-')) {
            // Month filter: 2025-02 for February 2025
            const [targetYear, targetMonth] = period.split('-').map(num => parseInt(num));
            console.log(`📅 Filtering for year: ${targetYear}, month: ${targetMonth}`);
            
            filtered = allExpensesData.filter(expense => {
                const date = parseDate(expense.date);
                if (!date) {
                    console.log(`❌ Invalid date for expense:`, expense.date);
                    return false;
                }
                
                const expenseYear = date.getFullYear();
                const expenseMonth = date.getMonth() + 1; // Convert to 1-based month
                
                const matches = expenseYear === targetYear && expenseMonth === targetMonth;
                
                // Debug logging for problematic dates
                if (expenseYear === targetYear && Math.abs(expenseMonth - targetMonth) <= 1) {
                    console.log(`🔍 Date check: ${expense.date} -> ${date.toISOString()} -> Year: ${expenseYear}, Month: ${expenseMonth}, Matches: ${matches}`);
                }
                
                return matches;
            });
        } else {
            // Year filter
            const targetYear = parseInt(period);
            console.log(`📅 Filtering for year: ${targetYear}`);
            
            filtered = allExpensesData.filter(expense => {
                const date = parseDate(expense.date);
                if (!date) return false;
                
                return date.getFullYear() === targetYear;
            });
        }

        console.log(`✅ Filtered to ${filtered.length} expenses`);
        
        // Log some sample dates for debugging
        if (filtered.length > 0) {
            const sampleDates = filtered.slice(0, 5).map(e => e.date);
            console.log(`📋 Sample filtered dates:`, sampleDates);
        }

        setFilteredExpenses(filtered);
        
        // Update UI components - IMPORTANT: Don't call applyColumnFilters here
        // Let it handle its own data source determination
        if (window.renderQuickFilterChips) {
            window.renderQuickFilterChips(filtered);
        }
        
        // Instead of calling applyColumnFilters, directly update the UI
        if (window.renderExpenses) {
            window.renderExpenses(filtered);
        }
        
        // Then trigger column filters to apply on top of time-period filtered data
        if (window.applyColumnFilters) {
            // Don't pass filtered data - let it determine the source
            window.applyColumnFilters();
        }
        
        updateSpendingTotals(filtered);
    } catch (error) {
        console.error('Error filtering expenses by period:', error);
    }
}

// Update spending totals
function updateSpendingTotals(expenses) {
    try {
        const safeExpenses = Array.isArray(expenses) ? expenses : [];
        updateAllSpendingDisplays(safeExpenses);
    } catch (error) {
        console.error('Error updating spending totals:', error);
    }
}

// Initialize time periods
async function initializeTimePeriods() {
    try {
        currentPeriodFilter = 'all-time';
        await createTimePeriodTabs();
        
        const refreshBtn = document.getElementById('refreshPeriodsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', createTimePeriodTabs);
        }
    } catch (error) {
        console.error('Error initializing time periods:', error);
    }
}

// Get current period filter
function getCurrentPeriodFilter() {
    return currentPeriodFilter || 'all-time';
}

// Exports
export { 
    initializeTimePeriods,
    createTimePeriodTabs, 
    selectTimePeriod, 
    getCurrentPeriodFilter 
};

// Global functions
window.selectTimePeriod = selectTimePeriod;
window.getCurrentPeriodFilter = getCurrentPeriodFilter;