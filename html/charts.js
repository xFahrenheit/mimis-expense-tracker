import { genColors, getCSSColors, getPieChartOptions, getBarChartOptions } from './helpers.js';
import { CATEGORY_META } from './config.js';

// Global chart instances for cleanup
const chartInstances = {};

// Render all charts
export function renderCharts(expenses) {
    // Filter expenses based on date range
    const filteredExpenses = filterExpensesByDateRange(expenses);
    
    // Update summary cards
    updateAnalyticsSummary(filteredExpenses, expenses);
    
    // Render enhanced charts
    renderTrendChart(filteredExpenses);
    renderCategoryChart(filteredExpenses);
    renderNeedLuxuryChart(filteredExpenses);
    renderSpenderChart(filteredExpenses);
    renderDayOfWeekChart(filteredExpenses);
    renderMerchantChart(filteredExpenses);
    
    // Setup chart controls
    setupChartControls(filteredExpenses);
}

// Filter expenses by selected date range
function filterExpensesByDateRange(expenses) {
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (!dateRangeSelect) return expenses;
    
    const range = dateRangeSelect.value;
    const now = new Date();
    let startDate, endDate;
    
    switch (range) {
        case 'last30':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'last90':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'custom':
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            if (startInput?.value) startDate = new Date(startInput.value);
            if (endInput?.value) endDate = new Date(endInput.value);
            break;
        default:
            return expenses; // 'all' or unrecognized
    }
    
    return expenses.filter(expense => {
        if (!expense.date) return false;
        const expenseDate = new Date(expense.date);
        const afterStart = !startDate || expenseDate >= startDate;
        const beforeEnd = !endDate || expenseDate <= endDate;
        return afterStart && beforeEnd;
    });
}

// Update analytics summary cards
function updateAnalyticsSummary(currentExpenses, allExpenses) {
    const total = currentExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const transactionCount = currentExpenses.length;
    const avgDaily = currentExpenses.length > 0 ? total / getDaysInRange(currentExpenses) : 0;
    
    // Calculate top category
    const categoryTotals = {};
    currentExpenses.forEach(e => {
        const cat = e.category || 'Unknown';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0);
    });
    
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => 
        categoryTotals[a] > categoryTotals[b] ? a : b, 'None');
    
    // Update DOM elements
    updateElement('analyticsTotalSpending', `$${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    updateElement('analyticsAvgDaily', `$${avgDaily.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    updateElement('analyticsTopCategory', topCategory);
    updateElement('analyticsTopCategoryAmount', `$${(categoryTotals[topCategory] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    updateElement('analyticsTransactionCount', transactionCount.toString());
    
    // Calculate changes (simple placeholder - could be enhanced with historical comparison)
    updateElement('analyticsSpendingChange', '--', 'neutral');
    updateElement('analyticsDailyChange', '--', 'neutral');
    updateElement('analyticsTransactionChange', '--', 'neutral');
}

// Enhanced trend chart with multiple time periods
function renderTrendChart(expenses) {
    destroyChart('trendChart');
    
    const mode = getActiveTrendMode();
    const data = aggregateByTimePeriod(expenses, mode);
    
    // Sort the data by date keys
    const sortedEntries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    const labels = sortedEntries.map(([key]) => key);
    const values = sortedEntries.map(([, value]) => value);
    
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (!ctx) return;
    
    chartInstances.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spending',
                data: values,
                borderColor: '#3da07f', // var(--mint) fallback
                backgroundColor: 'rgba(61, 160, 127, 0.2)', // var(--mint) with transparency
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3da07f',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value, index) {
                            const label = this.getLabelForValue(value);
                            // Format the date labels based on mode
                            if (label.includes('-')) {
                                const [year, month, day] = label.split('-');
                                if (day) {
                                    // Daily format: MM/DD
                                    return `${month}/${day}`;
                                } else {
                                    // Monthly format: MMM YYYY
                                    const date = new Date(year, month - 1);
                                    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                }
                            }
                            return label;
                        },
                        maxTicksLimit: 8,
                        font: {
                            family: "'Montserrat', 'Segoe UI', sans-serif",
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        },
                        font: {
                            family: "'Montserrat', 'Segoe UI', sans-serif",
                            size: 11
                        }
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 8
                }
            }
        }
    });
}

// Render time-based (monthly/yearly) bar chart
function renderTimeBasedChart(expenses, mode) {
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
                    backgroundColor: getCSSColors(),
                    borderRadius: 16,
                    barPercentage: 0.65,
                    categoryPercentage: 0.55,
                }]
            },
            options: getBarChartOptions(),
            plugins: [window.ChartDataLabels]
        });
    }
}

// Render category pie chart
function renderCategoryChart(expenses) {
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
                    backgroundColor: getCSSColors()
                }]
            },
            options: getPieChartOptions(),
            plugins: [window.ChartDataLabels]
        });
    }
}

// Render needs vs luxury pie chart
function renderNeedLuxuryChart(expenses) {
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
            options: getPieChartOptions(),
            plugins: [window.ChartDataLabels]
        });
    }
}

// Render spender comparison pie chart
function renderSpenderChart(expenses) {
    // Dynamic spender chart using household members
    const members = (window.householdMembers || []);
    const spenderTotals = {};
    members.forEach(m => { spenderTotals[m.name] = 0; });
    expenses.forEach(e => {
        const amount = Number(e.amount || 0);
        if (e.split_cost && members.length > 0) {
            const splitAmount = amount / members.length;
            members.forEach(m => { spenderTotals[m.name] += splitAmount; });
        } else {
            const who = (e.who || '').toString().trim();
            if (spenderTotals.hasOwnProperty(who)) {
                spenderTotals[who] += amount;
            }
        }
    });

    const spenderLabels = members.map(m => `${m.emoji || ''} ${m.name}`);
    const spenderData = members.map(m => spenderTotals[m.name]);
    const spenderColors = members.map(m => m.color || getComputedStyle(document.documentElement).getPropertyValue('--mint').trim());

    const ctxSpender = document.getElementById('spenderPieChart')?.getContext('2d');
    if (ctxSpender) {
        if (window.spenderChart) window.spenderChart.destroy();
        window.spenderChart = new Chart(ctxSpender, {
            type: 'pie',
            data: {
                labels: spenderLabels,
                datasets: [{
                    data: spenderData,
                    backgroundColor: spenderColors
                }]
            },
            options: getPieChartOptions(),
            plugins: [window.ChartDataLabels]
        });
    }
}

// Render day of week spending pattern
function renderDayOfWeekChart(expenses) {
    destroyChart('dayOfWeekChart');
    
    const dayTotals = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    expenses.forEach(expense => {
        if (expense.date) {
            const date = new Date(expense.date);
            const dayName = dayNames[date.getDay()];
            dayTotals[dayName] += Number(expense.amount || 0);
        }
    });
    
    const ctx = document.getElementById('dayOfWeekChart')?.getContext('2d');
    if (!ctx) return;
    
    chartInstances.dayOfWeekChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                data: Object.values(dayTotals),
                backgroundColor: getCSSColors(),
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value > 0 ? '$' + value.toLocaleString() : '',
                    font: { size: 10, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

// Render top merchants chart
function renderMerchantChart(expenses) {
    destroyChart('merchantChart');
    
    const merchantTotals = {};
    expenses.forEach(expense => {
        const merchant = (expense.description || 'Unknown').split(' ')[0].toUpperCase();
        merchantTotals[merchant] = (merchantTotals[merchant] || 0) + Number(expense.amount || 0);
    });
    
    // Get top 10 merchants
    const sortedMerchants = Object.entries(merchantTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const ctx = document.getElementById('merchantChart')?.getContext('2d');
    if (!ctx) return;
    
    chartInstances.merchantChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMerchants.map(([merchant]) => merchant.length > 15 ? merchant.substring(0, 15) + '...' : merchant),
            datasets: [{
                data: sortedMerchants.map(([, total]) => total),
                backgroundColor: getCSSColors(),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: (value) => '$' + value.toLocaleString(),
                    font: { size: 10, weight: 'bold' }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

// Helper functions
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

function updateElement(id, text, changeClass = null) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
        if (changeClass) {
            element.className = element.className.replace(/\b(positive|negative|neutral)\b/g, '');
            element.classList.add(changeClass);
        }
    }
}

function getDaysInRange(expenses) {
    if (expenses.length === 0) return 1;
    
    const dates = expenses.map(e => new Date(e.date)).filter(d => !isNaN(d));
    if (dates.length === 0) return 1;
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1);
}

function getActiveTrendMode() {
    const activeBtn = document.querySelector('.chart-toggle-btn.active');
    return activeBtn ? activeBtn.dataset.chart : 'monthly';
}

function aggregateByTimePeriod(expenses, mode) {
    const data = {};
    
    expenses.forEach(expense => {
        if (!expense.date) return;
        
        const date = new Date(expense.date);
        let key;
        
        switch (mode) {
            case 'daily':
                key = expense.date;
                break;
            case 'weekly':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().slice(0, 10);
                break;
            case 'monthly':
            default:
                key = expense.date.slice(0, 7);
                break;
        }
        
        data[key] = (data[key] || 0) + Number(expense.amount || 0);
    });
    
    return data;
}

function setupChartControls(expenses) {
    // Setup date range change handler
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    const customDateRange = document.getElementById('customDateRange');
    
    if (dateRangeSelect) {
        dateRangeSelect.addEventListener('change', () => {
            if (customDateRange) {
                customDateRange.classList.toggle('hidden', dateRangeSelect.value !== 'custom');
            }
            renderCharts(window.allExpenses || []);
        });
    }
    
    // Setup custom date inputs
    ['startDate', 'endDate'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', () => {
                if (dateRangeSelect?.value === 'custom') {
                    renderCharts(window.allExpenses || []);
                }
            });
        }
    });
    
    // Setup trend chart toggle buttons
    document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTrendChart(expenses);
        });
    });
}
