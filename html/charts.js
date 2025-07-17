import { genColors } from './helpers.js';

// Render all charts
export function renderCharts(expenses) {
    // Register ChartDataLabels plugin globally
    if (window.Chart && window.ChartDataLabels) {
        Chart.register(window.ChartDataLabels);
    }

    // Monthly/Yearly Toggle
    const toggle = document.getElementById('analyticsToggle');
    const mode = toggle && toggle.value === 'yearly' ? 'yearly' : 'monthly';
    
    // Monthly/Yearly Bar Chart
    renderTimeBasedChart(expenses, mode);
    
    // Category Pie Chart
    renderCategoryChart(expenses);
    
    // Needs vs Luxury Pie Chart
    renderNeedLuxuryChart(expenses);
    
    // Spender Pie Chart
    renderSpenderChart(expenses);
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
        ctxMonthlyBar.canvas.parentNode.style.maxWidth = '1100px';
        ctxMonthlyBar.canvas.parentNode.style.margin = '0 auto';
        ctxMonthlyBar.canvas.height = 520;
        ctxMonthlyBar.canvas.width = 1000;
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
        ctxCat.canvas.parentNode.style.maxWidth = '900px';
        ctxCat.canvas.parentNode.style.margin = '0 auto';
        ctxCat.canvas.height = 480;
        ctxCat.canvas.width = 800;
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
        ctxNeed.canvas.parentNode.style.maxWidth = '900px';
        ctxNeed.canvas.parentNode.style.margin = '0 auto';
        ctxNeed.canvas.height = 480;
        ctxNeed.canvas.width = 800;
    }
}

// Render spender comparison pie chart
function renderSpenderChart(expenses) {
    const spenderTotals = { Gautami: 0, Ameya: 0 };
    expenses.forEach(e => {
        if (e.split_cost) {
            // Split cost: each gets half
            spenderTotals.Gautami += Number(e.amount || 0) / 2;
            spenderTotals.Ameya += Number(e.amount || 0) / 2;
        } else {
            if (e.who === 'Gautami') spenderTotals.Gautami += Number(e.amount || 0);
            if (e.who === 'Ameya') spenderTotals.Ameya += Number(e.amount || 0);
        }
    });
    
    const spenderLabels = ['👩 Gautami', '👨 Ameya'];
    const ctxSpender = document.getElementById('spenderPieChart')?.getContext('2d');
    if (ctxSpender) {
        if (window.spenderChart) window.spenderChart.destroy();
        window.spenderChart = new Chart(ctxSpender, {
            type: 'pie',
            data: {
                labels: spenderLabels,
                datasets: [{
                    data: [spenderTotals.Gautami, spenderTotals.Ameya],
                    backgroundColor: [
                        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
                        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim()
                    ]
                }]
            },
            options: getPieChartOptions(),
            plugins: [window.ChartDataLabels]
        });
        ctxSpender.canvas.parentNode.style.maxWidth = '900px';
        ctxSpender.canvas.parentNode.style.margin = '0 auto';
        ctxSpender.canvas.height = 480;
        ctxSpender.canvas.width = 800;
    }
}

// Get CSS color values
function getCSSColors() {
    return [
        getComputedStyle(document.documentElement).getPropertyValue('--mint').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--rosy-brown').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--zomp').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--champagne-pink').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--mountbatten-pink').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--pink').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--cherry-blossom-pink').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--platinum').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--davys-gray').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--dim-gray').trim()
    ];
}

// Common pie chart options
function getPieChartOptions() {
    return {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                        return `$${value.toLocaleString()} (${percent}%)`;
                    }
                }
            },
            datalabels: getPieDatalabelsConfig()
        },
        layout: { padding: 24 },
    };
}

// Common bar chart options
function getBarChartOptions() {
    return {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const value = context.parsed.y;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                        return `$${value.toLocaleString()} (${percent}%)`;
                    }
                }
            },
            datalabels: {
                color: '#222',
                font: { size: 16, family: 'Montserrat', weight: '700' },
                anchor: 'end',
                align: 'end',
                formatter: function(value, context) {
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
                    return percent + '%';
                }
            }
        },
        layout: { padding: 32 },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'var(--mountbatten-pink)', font: { size: 20, family: 'Montserrat', weight: '700' } }
            },
            y: {
                grid: { color: 'rgba(157,129,137,0.08)' },
                ticks: { color: 'var(--mountbatten-pink)', font: { size: 20, family: 'Montserrat', weight: '700' }, beginAtZero: true }
            }
        }
    };
}

// Pie chart datalabels configuration
function getPieDatalabelsConfig() {
    return {
        color: '#222',
        font: { size: 18, family: 'Montserrat', weight: '700' },
        formatter: function(value, context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? ((value / total) * 100).toFixed(1) : '0.0';
            return percent + '%';
        },
        display: true,
        align: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 'end' : 'center';
        },
        anchor: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 'end' : 'center';
        },
        backgroundColor: null,
        borderColor: '#222',
        borderWidth: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            return percent < 6 ? 1.5 : 0;
        },
        borderRadius: 4,
        clamp: false,
        clip: false,
        offset: function(context) {
            // Stagger small labels vertically to avoid overlap
            const value = context.dataset.data[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total ? (value / total) * 100 : 0;
            if (percent < 6) {
                // Alternate up/down and increase offset for each small slice
                const idx = context.dataIndex;
                return 36 + (idx % 2 === 0 ? 1 : -1) * (12 + 6 * Math.floor(idx / 2));
            }
            return 0;
        },
        callout: {
            display: function(context) {
                const value = context.dataset.data[context.dataIndex];
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total ? (value / total) * 100 : 0;
                return percent < 6;
            },
            side: 'border',
            start: '120%',
            length: 64,
            borderColor: '#222',
            borderWidth: 2,
        }
    };
}
