// Analytics functions for transaction search
class TransactionAnalytics {
    constructor() {
        this.trendChart = null;
        this.seasonalityChart = null;
        this.forecastChart = null;
        this.distributionChart = null;
        this.boxplotChart = null;
    }

    // Initialize analytics
    init() {
        // Initialize any required resources
    }

    // Show analytics section
    showAnalytics(show = true) {
        const analyticsEl = document.getElementById('transactions-search-analytics');
        if (analyticsEl) {
            analyticsEl.style.display = show ? 'block' : 'none';
        }
    }

    // Calculate statistics for transactions
    calculateStatistics(transactions) {
        if (!transactions || transactions.length === 0) return null;
        
        // Extract amounts and sort them
        const amounts = transactions
            .map(t => Math.abs(parseFloat(t.amount) || 0))
            .sort((a, b) => a - b);
            
        const totalCount = amounts.length;
        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
        const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
        
        // Calculate quartiles
        const q1 = this.calculatePercentile(amounts, 25);
        const median = this.calculatePercentile(amounts, 50);
        const q3 = this.calculatePercentile(amounts, 75);
        
        // Calculate interquartile range (IQR)
        const iqr = q3 - q1;
        
        // Calculate lower and upper bounds for outliers
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Find min and max non-outlier values
        const nonOutliers = amounts.filter(amount => amount >= lowerBound && amount <= upperBound);
        const min = nonOutliers.length > 0 ? Math.min(...nonOutliers) : amounts[0];
        const max = nonOutliers.length > 0 ? Math.max(...nonOutliers) : amounts[amounts.length - 1];
        
        // Calculate standard deviation
        const squaredDiffs = amounts.map(amount => Math.pow(amount - avgAmount, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (totalCount - 1);
        const stdDev = Math.sqrt(variance);
        
        return {
            totalCount,
            totalAmount,
            avgAmount,
            min,
            max,
            q1,
            median,
            q3,
            iqr,
            lowerBound,
            upperBound,
            stdDev
        };
    }
    
    // Calculate percentile (0-100) of a sorted array
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        if (percentile <= 0) return sortedArray[0];
        if (percentile >= 100) return sortedArray[sortedArray.length - 1];
        
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);
        
        if (lowerIndex === upperIndex) return sortedArray[lowerIndex];
        
        // Linear interpolation
        const lowerValue = sortedArray[lowerIndex];
        const upperValue = sortedArray[upperIndex];
        const fraction = index - lowerIndex;
        
        return lowerValue + (upperValue - lowerValue) * fraction;
    }

    // Store accumulated statistics
    accumulatedStats = {
        totalCount: 0,
        totalAmount: 0,
        amounts: [],
        transactions: []
    };
    
    // Reset accumulated stats
    resetStats() {
        this.accumulatedStats = {
            totalCount: 0,
            totalAmount: 0,
            amounts: [],
            transactions: []
        };
    }
    
    // Update search summary with chunked data
    updateSearchSummary(transactions, isChunk = false) {
        if (!transactions || transactions.length === 0) {
            if (!isChunk) {
                this.showAnalytics(false);
            }
            return null;
        }
        
        this.showAnalytics(true);
        
        try {
            // If this is a chunk, add to accumulated stats
            if (isChunk) {
                // Extract amounts and add to accumulated stats
                const chunkAmounts = transactions
                    .map(t => Math.abs(parseFloat(t.amount) || 0))
                    .filter(amount => !isNaN(amount));
                
                this.accumulatedStats.amounts.push(...chunkAmounts);
                this.accumulatedStats.transactions.push(...transactions);
                this.accumulatedStats.totalCount += transactions.length;
                this.accumulatedStats.totalAmount += chunkAmounts.reduce((sum, amount) => sum + amount, 0);
                
                // Update UI with current accumulated stats
                this.updateSummaryUI({
                    totalCount: this.accumulatedStats.totalCount,
                    totalAmount: this.accumulatedStats.totalAmount,
                    avgAmount: this.accumulatedStats.totalCount > 0 
                        ? this.accumulatedStats.totalAmount / this.accumulatedStats.totalCount 
                        : 0
                });
                
                return null;
            } else {
                // This is the first chunk, reset accumulated stats
                this.resetStats();
                
                // Process the first chunk
                const chunkAmounts = transactions
                    .map(t => Math.abs(parseFloat(t.amount) || 0))
                    .filter(amount => !isNaN(amount));
                
                this.accumulatedStats.amounts = chunkAmounts;
                this.accumulatedStats.transactions = [...transactions];
                this.accumulatedStats.totalCount = transactions.length;
                this.accumulatedStats.totalAmount = chunkAmounts.reduce((sum, amount) => sum + amount, 0);
                
                // Calculate statistics for the first chunk
                const stats = this.calculateStatistics(transactions);
                if (!stats) return null;
                
                // Update UI
                this.updateSummaryUI({
                    totalCount: stats.totalCount,
                    totalAmount: stats.totalAmount,
                    avgAmount: stats.avgAmount
                });
                
                // Render charts with first chunk
                this.renderDistributionChart(transactions, stats);
                this.renderBoxPlot(transactions, stats);
                
                return stats;
            }
        } catch (error) {
            console.error('Error updating search summary:', error);
            return null;
        }
    }
    
    // Update the summary UI elements
    updateSummaryUI({ totalCount, totalAmount, avgAmount }) {
        try {
            const totalCountEl = document.getElementById('search-total-count');
            const totalAmountEl = document.getElementById('search-total-amount');
            const avgAmountEl = document.getElementById('search-avg-amount');
            
            if (totalCountEl) totalCountEl.textContent = totalCount.toLocaleString();
            if (totalAmountEl) totalAmountEl.textContent = this.formatCurrency(totalAmount);
            if (avgAmountEl) avgAmountEl.textContent = this.formatCurrency(avgAmount);
        } catch (error) {
            console.error('Error updating summary UI:', error);
        }
    }

    // Analyze trends over time
    analyzeTrends(transactions) {
        if (!transactions || transactions.length === 0) return;

        // Group transactions by month
        const monthlyData = this.groupByTimePeriod(transactions, 'month');
        
        // Prepare data for chart
        const labels = Object.keys(monthlyData).sort();
        const amounts = labels.map(date => 
            monthlyData[date].reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)
        );
        const counts = labels.map(date => monthlyData[date].length);

        // Create or update trend chart
        this.renderTrendChart(labels, amounts, counts);
    }

    // Analyze seasonality
    analyzeSeasonality(transactions) {
        if (!transactions || transactions.length === 0) return;

        // Group by month of year
        const monthlyAverages = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Initialize monthly data
        monthNames.forEach(month => {
            monthlyAverages[month] = { sum: 0, count: 0 };
        });

        // Process transactions
        transactions.forEach(transaction => {
            try {
                const date = new Date(transaction.date);
                if (isNaN(date.getTime())) return;
                
                const month = monthNames[date.getMonth()];
                const amount = Math.abs(parseFloat(transaction.amount) || 0);
                
                monthlyAverages[month].sum += amount;
                monthlyAverages[month].count++;
            } catch (e) {
                console.error('Error processing transaction date:', e);
            }
        });

        // Calculate averages
        const labels = monthNames;
        const data = labels.map(month => {
            const monthData = monthlyAverages[month];
            return monthData.count > 0 ? monthData.sum / monthData.count : 0;
        });

        // Create or update seasonality chart
        this.renderSeasonalityChart(labels, data);
    }

    // Generate forecast
    generateForecast(transactions) {
        if (!transactions || transactions.length < 3) {
            this.updateForecastText('Not enough data to generate forecast');
            return;
        }

        try {
            // Simple linear regression for forecasting
            const timeSeries = this.prepareTimeSeries(transactions);
            const forecast = this.calculateForecast(timeSeries);
            
            // Update UI with forecast
            this.updateForecast(forecast);
        } catch (e) {
            console.error('Error generating forecast:', e);
            this.updateForecastText('Error generating forecast');
        }
    }

    // Helper methods
    groupByTimePeriod(transactions, period = 'month') {
        const groups = {};
        
        transactions.forEach(transaction => {
            try {
                const date = new Date(transaction.date);
                if (isNaN(date.getTime())) return;
                
                let key;
                if (period === 'month') {
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                } else if (period === 'day') {
                    key = date.toISOString().split('T')[0];
                } else {
                    // Default to month
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                }
                
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(transaction);
            } catch (e) {
                console.error('Error processing transaction date:', e);
            }
        });
        
        return groups;
    }

    prepareTimeSeries(transactions) {
        // Group transactions by date and sum amounts
        const dailyTotals = {};
        
        transactions.forEach(transaction => {
            try {
                const date = new Date(transaction.date);
                if (isNaN(date.getTime())) return;
                
                const dateStr = date.toISOString().split('T')[0];
                const amount = parseFloat(transaction.amount) || 0;
                
                if (!dailyTotals[dateStr]) {
                    dailyTotals[dateStr] = 0;
                }
                dailyTotals[dateStr] += amount;
            } catch (e) {
                console.error('Error processing transaction date:', e);
            }
        });
        
        // Convert to array of {x, y} points
        return Object.entries(dailyTotals)
            .map(([date, amount]) => ({
                x: new Date(date).getTime(),
                y: Math.abs(amount)
            }))
            .sort((a, b) => a.x - b.x);
    }

    calculateForecast(timeSeries) {
        if (timeSeries.length < 3) {
            throw new Error('Not enough data points for forecast');
        }

        // Simple linear regression
        const n = timeSeries.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        timeSeries.forEach((point, i) => {
            sumX += i;
            sumY += point.y;
            sumXY += i * point.y;
            sumX2 += i * i;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Generate forecast for next 3 periods
        const forecastPeriods = 3;
        const forecast = [];
        const lastDate = new Date(timeSeries[timeSeries.length - 1].x);
        
        for (let i = 0; i < forecastPeriods; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + i + 1);
            
            forecast.push({
                date: nextDate,
                value: intercept + slope * (n + i)
            });
        }
        
        // Calculate forecast change percentage
        const lastValue = timeSeries[timeSeries.length - 1].y;
        const nextValue = forecast[0].value;
        const changePercent = ((nextValue - lastValue) / lastValue) * 100;
        
        return {
            lastValue,
            nextValue,
            changePercent,
            forecast,
            trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'neutral'
        };
    }

    // Chart rendering methods
    renderTrendChart(labels, amounts, counts) {
        const ctx = document.getElementById('transactions-trend-chart');
        if (!ctx) return;
        
        // Destroy existing chart if it exists
        if (this.trendChart) {
            this.trendChart.destroy();
        }
        
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Amount',
                        data: amounts,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.3,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        label: 'Transaction Count',
                        data: counts,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 1,
                        type: 'bar',
                        yAxisID: 'y1',
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                }
            }
        };
        
        this.trendChart = new Chart(ctx, config);
    }

    renderSeasonalityChart(labels, data) {
        const ctx = document.getElementById('transactions-seasonality-chart');
        if (!ctx) return;
        
        // Destroy existing chart if it exists
        if (this.seasonalityChart) {
            this.seasonalityChart.destroy();
        }
        
        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Amount',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Amount ($)'
                        }
                    }
                }
            }
        };
        
        this.seasonalityChart = new Chart(ctx, config);
    }

    updateForecast(forecast) {
        if (!forecast) return;
        
        const { lastValue, nextValue, changePercent, trend, forecast: forecastData } = forecast;
        const forecastEl = document.getElementById('forecast-text');
        
        if (!forecastEl) return;
        
        const trendText = trend === 'up' ? 'increasing' : trend === 'down' ? 'decreasing' : 'stable';
        const changeText = Math.abs(changePercent).toFixed(2) + '%';
        const direction = changePercent >= 0 ? 'up' : 'down';
        
        forecastEl.innerHTML = `
            <p>Based on historical data, the transaction amount is <span class="forecast-${trend}">${trendText}</span>.</p>
            <p>Next month's forecast: <strong>${this.formatCurrency(nextValue)}</strong> 
            <span class="forecast-${direction} forecast-badge">${direction === 'up' ? '↑' : '↓'} ${changeText}</span></p>
            <p class="text-muted small">Last month: ${this.formatCurrency(lastValue)}</p>
        `;
        
        // Render forecast chart
        this.renderForecastChart(forecastData);
    }

    renderForecastChart(forecastData) {
        const ctx = document.getElementById('transactions-forecast-chart');
        if (!ctx) return;
        
        // Destroy existing chart if it exists
        if (this.forecastChart) {
            this.forecastChart.destroy();
        }
        
        const labels = forecastData.map((_, i) => {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const date = new Date();
            date.setMonth(date.getMonth() + i + 1);
            return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        });
        
        const data = forecastData.map(d => d.value);
        
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Forecasted Amount',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    }
                }
            }
        };
        
        this.forecastChart = new Chart(ctx, config);
    }

    updateForecastText(text) {
        const forecastEl = document.getElementById('forecast-text');
        if (forecastEl) {
            forecastEl.textContent = text;
        }
    }
    
    // Render distribution chart with optimized performance
    renderDistributionChart(transactions, stats, isUpdate = false) {
        if (!transactions || transactions.length === 0 || !stats) return;
        
        const ctx = document.getElementById('transactions-distribution-chart');
        if (!ctx) return;
        
        try {
            // Only destroy existing chart if this is not an update
            if (!isUpdate && this.distributionChart) {
                this.distributionChart.destroy();
            }
            
            // Sample transactions if there are too many for better performance
            const MAX_TRANSACTIONS = 1000;
            const sampleTransactions = transactions.length > MAX_TRANSACTIONS 
                ? this.sampleArray(transactions, MAX_TRANSACTIONS)
                : transactions;
            
            // Extract amounts
            const amounts = sampleTransactions
                .map(t => Math.abs(parseFloat(t.amount) || 0))
                .filter(amount => amount > 0);
                
            if (amounts.length === 0) return;
            
            // Create histogram data with a fixed number of bins for consistency
            const MAX_BINS = 15; // Reduced number of bins for better performance
            const min = 0;
            const max = Math.max(...amounts) * 1.1; // Add 10% padding
            const range = max - min;
            const binSize = range / MAX_BINS;
            const bins = new Array(MAX_BINS).fill(0);
            
            // Count transactions in each bin
            amounts.forEach(amount => {
                const binIndex = Math.min(Math.floor(amount / binSize), MAX_BINS - 1);
                bins[binIndex]++;
            });
            
            // Prepare chart data
            const labels = Array.from({ length: MAX_BINS }, (_, i) => {
                const start = Math.round(i * binSize);
                const end = Math.round((i + 1) * binSize);
                return `$${start.toLocaleString()} - $${end.toLocaleString()}`;
            });
            
            // If this is an update and chart exists, just update the data
            if (isUpdate && this.distributionChart) {
                this.distributionChart.data.labels = labels;
                this.distributionChart.data.datasets[0].data = bins;
                this.distributionChart.update('none'); // 'none' prevents animation which is faster
                return;
            }
            
            // Create new chart with performance optimizations
            this.distributionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Transactions',
                        data: bins,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 0.8)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 0 // Disable animations for better performance
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Transactions'
                            },
                            ticks: {
                                precision: 0 // Only show whole numbers
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Amount Range'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 10 // Limit number of x-axis labels
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Hide legend to save space
                        },
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                },
                                title: function(context) {
                                    return context[0].label;
                                }
                            }
                        },
                        decimation: {
                            enabled: true,
                            algorithm: 'lttb', // Largest Triangle Three Bucket algorithm for downsampling
                            samples: 20
                        }
                    },
                    elements: {
                        bar: {
                            borderRadius: 2 // Slight rounding for better appearance
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering distribution chart:', error);
        }
    }
    
    // Helper method to sample an array (for performance)
    sampleArray(array, size) {
        const result = [];
        const length = array.length;
        
        if (size >= length) return array.slice();
        
        // Simple random sampling
        const indices = new Set();
        while (indices.size < size) {
            const index = Math.floor(Math.random() * length);
            indices.add(index);
        }
        
        indices.forEach(index => result.push(array[index]));
        return result;
    }
    renderBoxPlot(transactions, stats) {
        if (!transactions || transactions.length === 0 || !stats) return;
        
        const ctx = document.getElementById('transactions-boxplot-chart');
        if (!ctx) return;
        
        // Destroy existing chart if it exists
        if (this.boxplotChart) {
            this.boxplotChart.destroy();
        }
        
        // Prepare data for the bar chart
        const labels = ['Min', 'Q1', 'Median', 'Q3', 'Max'];
        const values = [stats.min, stats.q1, stats.median, stats.q3, stats.max];
        const backgroundColors = [
            'rgba(255, 99, 132, 0.6)',  // Min - Red
            'rgba(54, 162, 235, 0.6)',  // Q1 - Blue
            'rgba(255, 206, 86, 0.6)',  // Median - Yellow
            'rgba(54, 162, 235, 0.6)',  // Q3 - Blue
            'rgba(255, 99, 132, 0.6)'   // Max - Red
        ];
        
        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Amount ($)',
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        },
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        };
        
        this.boxplotChart = new Chart(ctx, config);
        }
        
        // Format currency
        formatCurrency(amount) {
            if (amount === undefined || amount === null) return '$0.00';
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
}

// Export singleton instance
export const transactionAnalytics = new TransactionAnalytics();
