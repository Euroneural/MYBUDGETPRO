// Analytics functions for transaction search
class TransactionAnalytics {
    constructor() {
        // Chart references
        this.trendChart = null;
        this.seasonalityChart = null;
        this.forecastChart = null;
        this.distributionChart = null;
        this.boxplotChart = null;
        this.priceTrendChart = null;
        this.johnsonChart = null;
        this.gammaChart = null;
        // Chart for transaction count seasonality
        this.seasonalityCountChart = null;
        // Chart for average count per season
        this.seasonalitySeasonChart = null;
        // Persist last transactions
        this._lastAnalyticsKey = null;
        // Outlier toggle (default include outliers)
        this.includeOutliers = true;
        this.currentTransactions = [];
        // Filter state – deposits (>0), debits (<0), credits (=0)
        this.filterState = { deposits: true, debits: true, credits: true };

    // Ensure outlier toggle UI once DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        this.ensureOutlierToggleControl();
    });
        this.trendChart = null;
        this.seasonalityChart = null;
        this.forecastChart = null;
        this.distributionChart = null;
        this.boxplotChart = null;
        this.priceTrendChart = null;

        // Initialize accumulated statistics
        this.accumulatedStats = {
            totalCount: 0,
            totalAmount: 0,
            amounts: [],
            transactions: []
        };
    }

    // Internal helper to reuse an existing Chart.js instance when the data hasn't changed.
    // name        – unique string key per chart type.
    // ctx         – canvas context where chart lives.
    // existing    – previously created Chart instance (or null).
    // config      – full Chart.js config for the desired state.
    // cacheKey    – deterministic string representing the data + options. When unchanged, we skip heavy re-creation.
    _updateOrCreateChart(name, ctx, existing, config, cacheKey) {
        if (!this._chartCache) this._chartCache = {};
        if (existing && this._chartCache[name] === cacheKey) {
            // Nothing changed → no work needed.
            return existing;
        }
        // Remember latest key.
        this._chartCache[name] = cacheKey;
        if (existing) {
            // Soft-update: replace data/options then call update(). Much faster than destroy()/new Chart().
            existing.data = config.data;
            existing.options = config.options;
            existing.update();
            return existing;
        }
        // First time creation.
        return new Chart(ctx, config);
    }

    // Initialize analytics
    init() {
        // Initialize any required resources
    }

    /**
     * Ensure type filter checkboxes exist and have listeners
     */
    ensureTypeFilterControls() {
    // Also make sure outlier toggle exists
    this.ensureOutlierToggleControl();
        const container = document.getElementById('txn-type-filters');
        if (container) return; // Already exists
        const parent = document.getElementById('transactions-analytics-section');
        if (!parent) return;
        const filtersDiv = document.createElement('div');
        filtersDiv.id = 'txn-type-filters';
        filtersDiv.className = 'mb-3';
        filtersDiv.innerHTML = `
            <label class="me-3"><input type="checkbox" id="filter-deposits" checked> Deposits</label>
            <label class="me-3"><input type="checkbox" id="filter-debits" checked> Debits</label>
            <label class="me-3"><input type="checkbox" id="filter-credits" checked> Credits</label>
        `;
        parent.prepend(filtersDiv);
        // Add listeners
        ['deposits','debits','credits'].forEach(key => {
            const cb = document.getElementById(`filter-${key}`);
            if (cb) {
                cb.addEventListener('change', () => {
                    this.filterState[key] = cb.checked;
                    // Rerender charts with stored transactions
                    this.updateAnalytics(this.currentTransactions);
                });
            }
        });
    }

    /**
     * Ensure Johnson & Gamma canvas elements exist
     */
    ensureDistributionCanvases() {
        const parent = document.getElementById('transactions-analytics-charts');
        // If a dedicated container not found, fall back to analytics section
        const container = parent || document.getElementById('transactions-analytics-section');
        if (!container) return;
        const addCanvas = (id, title) => {
            if (!document.getElementById(id)) {
                const wrapper = document.createElement('div');
                wrapper.className = 'mb-4';
                wrapper.innerHTML = `<h6 class="mb-2">${title}</h6><canvas id="${id}" style="width:100%;height:300px"></canvas>`;
                container.appendChild(wrapper);
            }
        };
        addCanvas('transactions-johnson-chart', 'Johnson Distribution');
        addCanvas('transactions-gamma-chart', 'Gamma Distribution');
    }

    /**
     * Ensure outlier toggle checkbox exists and has listener
     */
    ensureOutlierToggleControl() {
        const container = document.getElementById('txn-type-filters');
        if (!container) return;
        const toggleDiv = document.getElementById('outlier-toggle');
        if (toggleDiv) return; // Already exists
        const toggleHtml = `
            <label class="me-3"><input type="checkbox" id="outlier-toggle" checked> Include Outliers</label>
        `;
        container.innerHTML += toggleHtml;
        const toggleCb = document.getElementById('outlier-toggle');
        if (toggleCb) {
            toggleCb.addEventListener('change', () => {
                this.includeOutliers = toggleCb.checked;
                // Rerender charts with stored transactions
                this.updateAnalytics(this.currentTransactions);
            });
        }
    }

    /**
     * Filter transactions based on current filterState
     */
    applyTypeFilter(transactions = []) {
        return transactions.filter(t => {
            const amt = parseFloat(t.amount) || 0;
            if (amt > 0) return this.filterState.deposits;
            if (amt < 0) return this.filterState.debits;
            return this.filterState.credits; // amt === 0
        });
    }

    // Show analytics section
    showAnalytics(show = true) {
        const analyticsEl = document.getElementById('transactions-analytics-section');
        if (analyticsEl) {
            analyticsEl.classList.toggle('d-none', !show);
        }
    }
        


    // --- Price change metrics ---
    /**
     * Calculate metrics related to price change intervals.
     * @param {Array} transactions – array of transaction objects sorted by date
     * @param {number} avgChange   – average price change amount (signed)
     * @returns {Object} { daysSinceChange, avgDaysChange, nextChangeDate, estNextPrice }
     */
    calculatePriceChangeMetrics(transactions = [], avgChange = 0) {
        try {
            if (!Array.isArray(transactions) || transactions.length < 2) {
                return { daysSinceChange: null, avgDaysChange: null, nextChangeDate: null, estNextPrice: null };
            }
            // Sort by date ascending
            const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
            // Determine a dynamic threshold to ignore very small dollar amounts
            const absAmountsAll = sorted.map(t => Math.abs(parseFloat(t.amount) || 0)).filter(v => !isNaN(v));
            const medianAbs = this.calculatePercentile([...absAmountsAll].sort((a,b)=>a-b), 50);
            const MIN_STATIC = 5; // $5 absolute fallback threshold
            const minAllowed = Math.max(MIN_STATIC, medianAbs * 0.05); // ignore amounts < 5% of median or < $5

            const changeDates = [];
            const amounts = [];
            let prevAmount = parseFloat(sorted[0].amount) || 0;
            amounts.push(prevAmount);
            for (let i = 1; i < sorted.length; i++) {
                const amt = parseFloat(sorted[i].amount) || 0;
                if (Math.abs(amt) < minAllowed) continue; // skip low-dollar outliers
                if (amt !== prevAmount) {
                    changeDates.push(new Date(sorted[i].date));
                    amounts.push(amt);
                    prevAmount = amt;
                }
            }
            if (changeDates.length === 0) {
                // No changes detected
                return { daysSinceChange: null, avgDaysChange: null, nextChangeDate: null, estNextPrice: null };
            }
            // Calculate intervals in days between consecutive change points
            const intervals = [];
            for (let i = 1; i < changeDates.length; i++) {
                const diffMs = changeDates[i] - changeDates[i - 1];
                intervals.push(diffMs / (1000 * 60 * 60 * 24));
            }
            const avgDaysChange = intervals.length ? intervals.reduce((s, d) => s + d, 0) / intervals.length : null;
            const lastChangeDate = changeDates[changeDates.length - 1];
            const now = new Date();
            const daysSinceChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));
            let nextChangeDate = null;
            let lastPastPredictionDate = null;
            let lastPastPredictionPrice = null;
            if (avgDaysChange && !isNaN(avgDaysChange) && avgDaysChange > 0) {
                // Jump forward in multiples of avgDaysChange until date is in the future
                const DAY_MS = 24 * 60 * 60 * 1000;
                let offsetDays = avgDaysChange;
                while (lastChangeDate.getTime() + offsetDays * DAY_MS <= now.getTime()) {
                    lastPastPredictionDate = new Date(lastChangeDate.getTime() + offsetDays * DAY_MS);
                    offsetDays += avgDaysChange;
                }
                nextChangeDate = new Date(lastChangeDate.getTime() + offsetDays * DAY_MS);
            }

            // --- Estimate next price using linear regression of change points ---
            let estNextPrice = null;
            try {
                const xs = changeDates.map(d => d.getTime() / (1000 * 60 * 60 * 24)); // days since epoch
                const ys = amounts;
                if (xs.length >= 2) {
                    const n = xs.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
                    for (let i = 0; i < n; i++) {
                        sumX += xs[i];
                        sumY += ys[i];
                        sumXY += xs[i] * ys[i];
                        sumX2 += xs[i] * xs[i];
                    }
                    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;
                    const targetX = nextChangeDate ? nextChangeDate.getTime() / (1000 * 60 * 60 * 24) : xs[xs.length - 1] + avgDaysChange;
                    estNextPrice = intercept + slope * targetX;
                    if (lastPastPredictionDate) {
                        const pastX = lastPastPredictionDate.getTime() / (1000 * 60 * 60 * 24);
                        lastPastPredictionPrice = intercept + slope * pastX;
                    }
                }
            } catch(e) { /* ignore regression errors */ }
            // Fallback to lastAmount + avgChange
            if (estNextPrice === null || isNaN(estNextPrice)) {
                const lastAmount = amounts[amounts.length - 1];
                estNextPrice = lastAmount + avgChange;
            }
            return {
                daysSinceChange,
                avgDaysChange,
                nextChangeDate: nextChangeDate ? nextChangeDate.toISOString().split('T')[0] : null,
                estNextPrice,
                lastPastPredictionDate: lastPastPredictionDate ? lastPastPredictionDate.toISOString().split('T')[0] : null,
                lastPastPredictionPrice: lastPastPredictionPrice
            };
        } catch (err) {
            console.warn('Failed to calculate price change metrics:', err);
            return { daysSinceChange: null, avgDaysChange: null, nextChangeDate: null, estNextPrice: null };
        }
    }

    // Calculate statistics for transactions
    calculateStatistics(transactions) {
        if (!transactions || transactions.length === 0) return null;
        
        // Extract absolute amounts for robust stats (IQR etc.)
        const amountsAbs = transactions
            .map(t => Math.abs(parseFloat(t.amount) || 0))
            .filter(a => !isNaN(a))
            .sort((a, b) => a - b);
        
        // Raw signed amounts – used for highest / lowest values the user expects
        const amountsRaw = transactions
            .map(t => parseFloat(t.amount) || 0)
            .filter(a => !isNaN(a))
            .sort((a, b) => a - b);
        
        const totalCount = amountsAbs.length;
        const totalAmount = amountsRaw.reduce((sum, amount) => sum + amount, 0);
        const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
        
        // Calculate quartiles
        const q1 = this.calculatePercentile(amountsAbs, 25);
        const median = this.calculatePercentile(amountsAbs, 50);
        const q3 = this.calculatePercentile(amountsAbs, 75);
        
        // Calculate interquartile range (IQR)
        const iqr = q3 - q1;
        
        // Calculate lower and upper bounds for outliers
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Find min and max non-outlier ABSOLUTE values
        const nonOutliers = amountsAbs.filter(amount => amount >= lowerBound && amount <= upperBound);
        const min = nonOutliers.length > 0 ? Math.min(...nonOutliers) : amountsAbs[0];
        const max = nonOutliers.length > 0 ? Math.max(...nonOutliers) : amountsAbs[amountsAbs.length - 1];
        // Maintain backward-compat alias names used elsewhere in code
        const minAbs = min;
        const maxAbs = max;
        
        // Highest / lowest SIGNED values (what user perceives)
        const minRaw = amountsRaw[0];
        const maxRaw = amountsRaw[amountsRaw.length - 1];
        
        // Calculate standard deviation
        const squaredDiffs = amountsAbs.map(amount => Math.pow(amount - avgAmount, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (totalCount - 1);
        const stdDev = Math.sqrt(variance);
        
        return {
            totalCount,
            totalAmount,
            avgAmount,
            min,
            max,
            minAbs,
            maxAbs,
            minRaw,
            maxRaw,
            q1,
            median,
            q3,
            iqr,
            lowerBound,
            upperBound,
            stdDev
        };
    }
    
    
    // Update analytics stats & charts based on filtered transactions
    updateAnalytics(transactions = []) {
        // Always ensure the toggle controls exist
        this.ensureOutlierToggleControl();
        // Compute robust cache key based on transaction id set + filter state
        const ids = (transactions || []).map(t => t.id).join(',');
        const filterKey = JSON.stringify({ ...this.filterState, includeOutliers: this.includeOutliers });
        const cacheKey = `${ids}-${filterKey}`;
        if (cacheKey === this._lastAnalyticsKey) {
            // Data unchanged → skip heavy re-render
            return;
        }
        this._lastAnalyticsKey = cacheKey;
        // store original transactions
        this.currentTransactions = transactions || [];

        // ----- Filtering logic -----
        // First apply deposit/debit/credit type filter
        const baseTxns = this.applyTypeFilter(this.currentTransactions);

        // Calculate stats on base set to get IQR bounds
        const baseStats = this.calculateStatistics(baseTxns);

        // Apply outlier filtering if toggle disabled
        let dataTxns = baseTxns;
        let stats = baseStats;
        if (!this.includeOutliers && baseStats) {
            const { lowerBound, upperBound } = baseStats;
            dataTxns = baseTxns.filter(t => {
                const amt = Math.abs(parseFloat(t.amount) || 0);
                return amt >= lowerBound && amt <= upperBound;
            });
            // Re-calculate stats after removing outliers
            stats = this.calculateStatistics(dataTxns);
        }

        // Guard if stats missing
        if (!stats || dataTxns.length === 0) {
            this.showAnalytics(false);
            return;
        }

        // Ensure UI controls & canvases exist
        this.ensureTypeFilterControls();
        this.ensureDistributionCanvases();

        // Apply type filter
        const sorted = [...dataTxns].sort((a,b)=> new Date(a.date)-new Date(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length-1];
        const firstAmt = parseFloat(first?.amount)||0;
        const lastAmt = parseFloat(last?.amount)||0;
        const totalChange = lastAmt - firstAmt;
        const pctChange = firstAmt !==0 ? (totalChange/Math.abs(firstAmt))*100 : 0;
        // average change between consecutive points
        let sumDelta=0;
        for(let i=1;i<sorted.length;i++){
            const prev=parseFloat(sorted[i-1].amount)||0;
            const curr=parseFloat(sorted[i].amount)||0;
            sumDelta += (curr-prev);
        }
        const avgChange = sorted.length>1? sumDelta/(sorted.length-1):0;

        const changeMetrics = this.calculatePriceChangeMetrics(dataTxns, avgChange);

        // render stats tiles
        this.renderStatsTiles({
            highest: stats.maxRaw ?? stats.maxAbs,
            lowest: stats.minRaw ?? stats.minAbs,
            avgAmount: stats.avgAmount,
            median: stats.median,
            totalChange,
            pctChange,
            avgChange,
            ...changeMetrics
        });

        // charts
        this.renderPriceTrendChart(dataTxns);
        this.analyzeSeasonality(dataTxns);
        this.renderDistributionChart(dataTxns, stats, true);
        this.renderBoxPlot(dataTxns, stats);
        this.renderJohnsonDistributionChart(dataTxns);
        this.renderGammaDistributionChart(dataTxns);
        this.generateForecast(dataTxns);
    }

    // Render metric tiles in UI
    renderStatsTiles({ highest, lowest, avgAmount, median, totalChange, pctChange, avgChange, daysSinceChange, avgDaysChange, nextChangeDate, estNextPrice, lastPastPredictionDate, lastPastPredictionPrice }) {
        const container = document.getElementById('txn-analytics-stats');
        if (!container) return;
        // Ensure responsive grid classes for fewer scrolls
        container.className = 'row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2';
        const tile = (label,value)=>`<div class="col"><div class="card shadow-sm h-100"><div class="card-body p-2 text-center"><div class="fw-bold small text-muted">${label}</div><div class="h6 mb-0">${value}</div></div></div></div>`;
        const highestVal = this.formatCurrency(highest);
        const lowestVal  = this.formatCurrency(lowest);
        const nextChangeStr = nextChangeDate ? new Date(nextChangeDate).toLocaleDateString() : 'N/A';
        const pastPredStr = lastPastPredictionDate ? `${new Date(lastPastPredictionDate).toLocaleDateString()} • ${this.formatCurrency(lastPastPredictionPrice)}` : null;
        container.innerHTML = [
            tile('Highest', highestVal),
            tile('Lowest', lowestVal),
            tile('Average', this.formatCurrency(avgAmount)),
            tile('Median', this.formatCurrency(median)),
            tile('Total Δ', this.formatCurrency(totalChange)),
            tile('% Δ', pctChange.toFixed(2)+'%'),
            tile('Avg Δ', this.formatCurrency(avgChange)),
            tile('Days Since Change', daysSinceChange ?? 'N/A'),
            tile('Avg Days/Change', avgDaysChange ? avgDaysChange.toFixed(1) : 'N/A'),
            tile('Next Change ETA', nextChangeStr),
            tile('Est. Next Price', this.formatCurrency(estNextPrice)),
        pastPredStr ? tile('<span class="text-warning">Last Past Prediction</span>', `<span class="text-warning">${pastPredStr}</span>`) : ''
        ].join('');
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

        // Ensure canvases exist for both charts
        this.ensureSeasonalityCanvases();

        // Calculate averages and counts
        const labels = monthNames;
        const avgData = [];
        const countData = [];

        labels.forEach(month => {
            const monthData = monthlyAverages[month];
            avgData.push(monthData.count > 0 ? monthData.sum / monthData.count : 0);
            countData.push(monthData.count);
        });

        // Render monthly charts
        this.renderSeasonalityChart(labels, avgData);
        this.renderSeasonalityCountChart(labels, countData);

        // --- Seasonal average count chart ---
        const seasonGroups = {
            'Winter': ['Dec', 'Jan', 'Feb'],
            'Spring': ['Mar', 'Apr', 'May'],
            'Summer': ['Jun', 'Jul', 'Aug'],
            'Fall':   ['Sep', 'Oct', 'Nov']
        };
    }

    // Ensure seasonality canvases (avg amount & count) exist in analytics section
    ensureSeasonalityCanvases() {
        const parent = document.getElementById('transactions-analytics-section') ||
                       document.getElementById('transactions-analytics-container');
        if (!parent) return;

        // Create a flex row container once
        let row = document.getElementById('seasonality-chart-row');
        if (!row) {
            row = document.createElement('div');
            row.id = 'seasonality-chart-row';
            row.className = 'd-flex flex-row flex-wrap gap-3 mb-4';
            parent.appendChild(row);
        }

                const addCanvas = (id, title) => {
            if (!document.getElementById(id)) {
                const wrapper = document.createElement('div');
                wrapper.id = `${id}-wrapper`;
                // flex:1 so cards align side-by-side when space permits
                wrapper.className = 'analytics-card flex-fill';
                wrapper.style.minWidth = '250px';
                wrapper.innerHTML = `<h6 class="mb-2">${title}</h6><canvas id="${id}" style="width:100%;height:260px"></canvas>`;
                row.appendChild(wrapper);
            }
        };
        addCanvas('transactions-seasonality-chart', 'Seasonality – Avg Amount');
        addCanvas('transactions-seasonality-count-chart', 'Seasonality – Transaction Count');
        // Initialize drag-and-drop after canvases in place
        this.ensureSortable(row);
    }

    // Render transaction count seasonality chart
    renderSeasonalityCountChart(labels, data) {
        const ctx = document.getElementById('transactions-seasonality-count-chart');
        if (!ctx) return;

        const config = {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Transaction Count',
                    data,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Seasonality – Count by Month' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Count' }
                    }
                }
            }
        };

        this.seasonalityCountChart = this._updateOrCreateChart('seasonalityCount', ctx, this.seasonalityCountChart, config, JSON.stringify({ labels, data }));
    }

    // Render seasonality chart
    renderSeasonalityChart(labels, data) {
        const ctx = document.getElementById('transactions-seasonality-chart');
        if (!ctx) return;

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
                        display: true,
                        text: 'Seasonality – Avg Amount by Month'
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

        this.seasonalityChart = this._updateOrCreateChart('seasonality', ctx, this.seasonalityChart, config, JSON.stringify({ labels, data }));
    }

    // Render trend chart
    renderTrendChart(labels, amounts, counts) {
        const ctx = document.getElementById('transactions-trend-chart');
        if (!ctx) return;

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

        this.trendChart = this._updateOrCreateChart('trend', ctx, this.trendChart, config, JSON.stringify({ labels, amounts, counts }));
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
    
    // Render price trend chart showing individual transaction amounts over time
    renderPriceTrendChart(transactions) {
        try {
            if (!transactions || transactions.length === 0) {
                console.warn('No transactions provided for price trend chart');
                return;
            }

            // Get the container and clear any existing content
            const container = document.getElementById('price-trend-chart');
            if (!container) {
                console.error('Price trend chart container not found');
                return;
            }

            // Clear any existing chart
            if (this.priceTrendChart) {
                this.priceTrendChart.destroy();
            }

            // Create container for chart and info
            container.innerHTML = `
                <div id="selection-info" class="alert alert-info" style="display: none; margin-bottom: 15px;">
                    <strong>Selected Range:</strong> 
                    <span id="price-difference-text"></span>
                </div>
                <div class="chart-container" style="position: relative; height: 400px; width: 100%;">
                    <canvas id="price-trend-chart"></canvas>
                </div>
            `;

            // Sort transactions by date
            const sortedTransactions = [...transactions].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );

            // Prepare data points
            const dataPoints = sortedTransactions.map(t => ({
                x: new Date(t.date),
                y: Math.abs(parseFloat(t.amount) || 0),
                rawAmount: parseFloat(t.amount) || 0,
                merchant: t.merchant_name || 'Unknown',
                category: t.category || 'Uncategorized',
                date: t.date
            }));

            // Get canvas and context
            const canvas = document.getElementById('price-trend-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            // Selection state
            const selectionRect = {
                isVisible: false,
                isSelecting: false,
                startX: 0,
                startY: 0,
                x: 0,
                y: 0,
                width: 0,
                height: 0
            };

            // Event handlers will be defined once after chart creation

            // Chart configuration
            const config = {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Transaction Amount',
                        data: dataPoints,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointHitRadius: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                tooltipFormat: 'PP',
                                displayFormats: {
                                    day: 'MMM d',
                                    week: 'MMM d',
                                    month: 'MMM yyyy',
                                    year: 'yyyy'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Amount ($)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const data = context.raw;
                                    const date = new Date(data.x);
                                    const dateStr = date.toLocaleDateString();
                                    const amount = Math.abs(data.rawAmount).toFixed(2);
                                    const merchant = data.merchant || 'Unknown';
                                    const category = data.category || 'Uncategorized';
                                    return [
                                        `${merchant}`,
                                        `$${amount} • ${category}`,
                                        dateStr
                                    ];
                                }
                            }
                        },
                        legend: { display: false },
                        zoom: {
                            pan: { enabled: true, mode: 'xy' },
                            zoom: {
                                wheel: { enabled: true },
                                pinch: { enabled: true },
                                mode: 'xy',
                                onZoomComplete: ({ chart }) => {
                                    // This prevents resetting zoom level when updating the chart
                                    chart.update('none');
                                }
                            },
                            limits: {
                                x: { min: 'original', max: 'original' },
                                y: { min: 'original', max: 'original' }
                            }
                        }
                    },
                    onClick: (e) => {
                        // Handle point selection on click
                        const points = chartRef.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                        if (points.length > 0) {
                            const point = points[0];
                            const data = chartRef.data.datasets[point.datasetIndex].data[point.index];
                            // Toggle selection state
                            data.selected = !data.selected;
                            chartRef.update();
                        }
                    }
                },
                plugins: [{
                    id: 'selection',
                    beforeDraw: function(chart) {
                        if (selectionRect.isVisible) {
                            const ctx = chart.ctx;
                            ctx.save();
                            ctx.strokeStyle = 'rgba(75, 192, 192, 0.8)';
                            ctx.fillStyle = 'rgba(75, 192, 192, 0.1)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.rect(
                                selectionRect.x,
                                selectionRect.y,
                                selectionRect.width,
                                selectionRect.height
                            );
                            ctx.fill();
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                }]
            };

            // Create the chart
            const chartCtx = canvas.getContext('2d');
            this.priceTrendChart = new Chart(chartCtx, config);
            
            // Store the canvas reference
            this.chartCanvas = canvas;
            
            // Initialize selection state (moved to the beginning of the method)
            // Add event listeners
            const handleMouseDown = (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Start selection
                selectionRect.startX = x;
                selectionRect.startY = y;
                selectionRect.x = x;
                selectionRect.y = y;
                selectionRect.width = 0;
                selectionRect.height = 0;
                selectionRect.isVisible = true;
                selectionRect.isSelecting = true;
                
                // Update chart to show selection
                if (this.priceTrendChart) {
                    this.priceTrendChart.update('none');
                }
            };
            
            const handleMouseMove = (e) => {
                if (!selectionRect.isSelecting) return;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Update selection rectangle
                selectionRect.width = x - selectionRect.startX;
                selectionRect.height = y - selectionRect.startY;
                
                // Handle negative width/height for dragging in any direction
                selectionRect.x = Math.min(selectionRect.startX, x);
                selectionRect.y = Math.min(selectionRect.startY, y);
                selectionRect.width = Math.abs(selectionRect.width);
                selectionRect.height = Math.abs(selectionRect.height);
                
                // Update chart to show selection
                if (this.priceTrendChart) {
                    this.priceTrendChart.update('none');
                }
            };
            
            const handleMouseUp = () => {
                if (!selectionRect.isSelecting) return;
                
                // Process selection when mouse is released
                processSelection();
                
                // Reset selection state
                selectionRect.isSelecting = false;
                
                // Get selected points
                const selectedPoints = dataPoints.filter(p => p.selected);
                
                if (selectedPoints.length === 2) {
                    const point1 = selectedPoints[0];
                    const point2 = selectedPoints[1];
                    const amount1 = point1.rawAmount;
                    const amount2 = point2.rawAmount;
                    const date1 = new Date(point1.x);
                    const date2 = new Date(point2.x);
                    
                    const diff = amount2 - amount1;
                    const percentChange = (diff / Math.abs(amount1)) * 100;
                    
                    const selectionInfo = document.getElementById('selection-info');
                    if (selectionInfo) {
                        const absDiff = Math.abs(diff).toFixed(2);
                        const dateStr1 = date1.toLocaleDateString();
                        const dateStr2 = date2.toLocaleDateString();
                        
                        selectionInfo.innerHTML = `
                            <div class="price-diff-summary">
                                <div>${dateStr1} → ${dateStr2}</div>
                                <div class="price-diff-amount ${diff >= 0 ? 'positive' : 'negative'}">
                                    ${diff >= 0 ? '+' : '-'}$${absDiff} (${diff >= 0 ? '+' : ''}${percentChange.toFixed(2)}%)
                                </div>
                            </div>
                        `;
                        selectionInfo.style.display = 'block';
                    }
                } else if (selectedPoints.length > 0) {
                    // Update UI to show selection count
                    const selectionInfo = document.getElementById('selection-info');
                    if (selectionInfo) {
                        selectionInfo.textContent = `Selected ${selectedPoints.length} points`;
                        selectionInfo.style.display = 'block';
                    }
                } else {
                    // No points selected, hide the selection info
                    const selectionInfo = document.getElementById('selection-info');
                    if (selectionInfo) {
                        selectionInfo.style.display = 'none';
                    }
                }
                
                // Update chart to show selected points
                if (this.priceTrendChart) {
                    this.priceTrendChart.update('none');
                }
            };
            
            // Add event listeners
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('mouseout', () => {
                if (selectionRect.isSelecting) {
                    selectionRect.isSelecting = false;
                    selectionRect.isVisible = false;
                    if (this.priceTrendChart) {
                        this.priceTrendChart.update('none');
                    }
                }
            });
            
            // Clean up function
            return () => {
                canvas.removeEventListener('mousedown', handleMouseDown);
                canvas.removeEventListener('mousemove', handleMouseMove);
                canvas.removeEventListener('mouseup', handleMouseUp);
                canvas.removeEventListener('mouseout', handleMouseDown);
            };
            
            // Get chart area for hit detection
            const getChartArea = (chart) => ({
                left: chart.chartArea.left,
                right: chart.chartArea.right,
                top: chart.chartArea.top,
                bottom: chart.chartArea.bottom,
                width: chart.chartArea.width,
                height: chart.chartArea.height
            });
            
            // Process selected points in the chart
            const processSelection = () => {
                if (!selectionRect.isVisible) return;
                
                const selectedPoints = [];
                const chartArea = this.priceTrendChart.chartArea;
                const xScale = this.priceTrendChart.scales.x;
                const yScale = this.priceTrendChart.scales.y;
                
                // Convert selection rectangle to data coordinates
                const minX = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
                const maxX = Math.max(selectionRect.x, selectionRect.x + selectionRect.width);
                const minY = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
                const maxY = Math.max(selectionRect.y, selectionRect.y + selectionRect.height);
                
                // Find points within the selected area
                dataPoints.forEach(point => {
                    const pointX = xScale.getPixelForValue(point.x);
                    const pointY = yScale.getPixelForValue(point.y);
                    
                    if (pointX >= minX && pointX <= maxX && 
                        pointY >= minY && pointY <= maxY) {
                        selectedPoints.push(point);
                    }
                });
                
                if (selectedPoints.length > 0) {
                    // Find min and max points in the selection
                    selectedPoints.sort((a, b) => a.y - b.y);
                    const minPoint = selectedPoints[0];
                    const maxPoint = selectedPoints[selectedPoints.length - 1];
                    
                    // Calculate price difference
                    const priceDiff = maxPoint.y - minPoint.y;
                    const priceDiffPct = (priceDiff / minPoint.y) * 100;
                    
                    // Format the date range
                    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    
                    // Update point styles
                    if (this.priceTrendChart) {
                        this.priceTrendChart.data.datasets[0].pointBackgroundColor = 
                            dataPoints.map(point => {
                                if (point === minPoint) return 'rgba(255, 99, 132, 1)';
                                if (point === maxPoint) return 'rgba(54, 162, 235, 1)';
                                return 'rgba(75, 192, 192, 0.2)';
                            });
                        
                        this.priceTrendChart.update();
                    }
                } else if (this.priceTrendChart) {
                    // Reset point styles if no selection
                    this.priceTrendChart.data.datasets[0].pointBackgroundColor = 'rgba(75, 192, 192, 0.2)';
                    this.priceTrendChart.update();
                }
                
                return selectedPoints;
            };
            
            // Clean up function for removing event listeners
            const cleanup = () => {
                if (canvas) {
                    canvas.removeEventListener('mousedown', handleMouseDown);
                    canvas.removeEventListener('mousemove', handleMouseMove);
                    canvas.removeEventListener('mouseup', handleMouseUp);
                    canvas.removeEventListener('mouseout', handleMouseUp);
                }
            };
            
            // Store cleanup function for later use
            this.cleanupPriceTrendChart = cleanup;
            
            // Initialize chart with plugins and event listeners
            const chartConfig = {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Transaction Amounts',
                        data: dataPoints,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                tooltipFormat: 'PP',
                                displayFormats: {
                                    day: 'MMM d, yyyy'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Amount ($)'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const data = context.raw;
                                    return [
                                        `Merchant: ${data.merchant || 'N/A'}`,
                                        `Amount: $${data.y.toFixed(2)}`,
                                        `Category: ${data.category || 'Uncategorized'}`,
                                        `Date: ${new Date(data.x).toLocaleDateString()}`
                                    ];
                                }
                            }
                        },
                        zoom: {
                            zoom: {
                                wheel: {
                                    enabled: true
                                },
                                pinch: {
                                    enabled: true
                                },
                                mode: 'xy',
                                onZoomComplete: ({ chart }) => {
                                    // Update chart after zoom
                                    chart.update('none');
                                }
                            },
                            pan: {
                                enabled: true,
                                mode: 'xy',
                                onPanComplete: ({ chart }) => {
                                    // Update chart after pan
                                    chart.update('none');
                                }
                            }
                        }
                    },
                    onClick: (e) => {
                        // Handle click events if needed
                    }
                },
                plugins: [{
                    id: 'selection-rectangle',
                    beforeDraw: (chart) => {
                        if (!selectionRect.isVisible) return;
                        
                        const ctx = chart.ctx;
                        const { x, y, width, height } = selectionRect;
                        
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(x, y, width, height);
                        ctx.fillStyle = 'rgba(54, 162, 235, 0.1)';
                        ctx.fill();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = 'rgba(54, 162, 235, 0.8)';
                        ctx.stroke();
                        ctx.restore();
                    }
                }]
            };
            
            // Create the chart instance
            this.priceTrendChart = new Chart(canvas, chartConfig);
            
            // Initialize selection info display
            const selectionInfo = document.createElement('div');
            selectionInfo.id = 'selection-info';
            selectionInfo.style.display = 'none';
            selectionInfo.style.marginTop = '10px';
            selectionInfo.style.padding = '10px';
            selectionInfo.style.backgroundColor = '#f8f9fa';
            selectionInfo.style.borderRadius = '4px';
            
            const priceDiffText = document.createElement('div');
            priceDiffText.id = 'price-difference-text';
            selectionInfo.appendChild(priceDiffText);
            
            const chartContainer = document.getElementById('price-trend-chart-container');
            if (chartContainer) {
                chartContainer.appendChild(selectionInfo);
            }
            
            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.priceTrendChart) {
                    this.priceTrendChart.resize();
                }
            });
        } catch (error) {
            console.error('Error in renderPriceTrendChart:', error);
            if (this.priceTrendChart) {
                try { this.priceTrendChart.destroy(); } catch (e) {}
                this.priceTrendChart = null;
            }
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
    /**
     * Ensure given container becomes sortable (drag & drop) using SortableJS if it's loaded.
     * We guard against multiple initializations by tracking containers in a WeakSet.
     * @param {HTMLElement} container
     */
    ensureSortable(container) {
        try {
            if (!container || typeof Sortable === 'undefined') return; // SortableJS not available
            if (!this._sortables) this._sortables = new WeakSet();
            if (this._sortables.has(container)) return; // Already initialized
            Sortable.create(container, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag'
            });
            this._sortables.add(container);
        } catch (err) {
            console.warn('Failed to initialize Sortable:', err);
        }
    }

    // --- Forecast & time-series helpers ---
    /**
     * Group transactions by period (month/day). Returns object keyed by period string.
     */
    groupByTimePeriod(transactions, period = 'month') {
        const groups = {};
        (transactions || []).forEach(txn => {
            try {
                const date = new Date(txn.date);
                if (isNaN(date.getTime())) return;
                let key;
                if (period === 'day') {
                    key = date.toISOString().split('T')[0];
                } else { // default month
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                }
                if (!groups[key]) groups[key] = [];
                groups[key].push(txn);
            } catch (_) {}
        });
        return groups;
    }

    /**
     * Convert transactions into daily total time-series sorted by date.
     * Each point is {x: timestamp, y: abs(amount)}.
     */
    prepareTimeSeries(transactions) {
        const dailyTotals = {};
        (transactions || []).forEach(txn => {
            try {
                const date = new Date(txn.date);
                if (isNaN(date.getTime())) return;
                const dateStr = date.toISOString().split('T')[0];
                const amt = Math.abs(parseFloat(txn.amount) || 0);
                dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + amt;
            } catch (_) {}
        });
        return Object.entries(dailyTotals)
            .map(([d, amt]) => ({ x: new Date(d).getTime(), y: amt }))
            .sort((a, b) => a.x - b.x);
    }

    /**
     * Simple linear-regression forecast of next 3 periods.
     * Returns object with summary & array of forecast values.
     */
    calculateForecast(timeSeries) {
        if (!timeSeries || timeSeries.length < 3) {
            throw new Error('Not enough data points for forecast');
        }
        const n = timeSeries.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        timeSeries.forEach((p, i) => {
            sumX += i;
            sumY += p.y;
            sumXY += i * p.y;
            sumX2 += i * i;
        });
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const forecastPeriods = 3;
        const forecastVals = [];
        const lastDate = new Date(timeSeries[n - 1].x);
        for (let i = 0; i < forecastPeriods; i++) {
            forecastVals.push(intercept + slope * (n + i));
        }
        const lastValue = timeSeries[n - 1].y;
        const nextValue = forecastVals[0];
        const changePercent = ((nextValue - lastValue) / lastValue) * 100;
        return {
            lastValue,
            nextValue,
            changePercent,
            forecast: forecastVals,
            trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'neutral'
        };
    }

    /**
     * Public wrapper to generate forecast, update UI & chart.
     */
    generateForecast(transactions) {
        if (!transactions || transactions.length < 3) {
            this.updateForecastText('Not enough data to generate forecast');
            return;
        }
        try {
            const ts = this.prepareTimeSeries(transactions);
            const result = this.calculateForecast(ts);
            this.updateForecast(result);
        } catch (err) {
            console.error('Error generating forecast:', err);
            this.updateForecastText('Error generating forecast');
        }
    }

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
    
    
    /**
     * Render Johnson SU/SB style distribution (log-scaled) to visualise tails
     * A simple approach: log-transform absolute amounts (adding a small constant)
     * then plot histogram. This gives a long-tail friendly view without heavy stats libs.
     * @param {Array} transactions
     * @param {string} canvasId – canvas element id
     */
    renderJohnsonDistributionChart(transactions = [], canvasId = 'transactions-johnson-chart') {
        if (!transactions || transactions.length === 0) return;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy previous chart
        if (this.johnsonChart) this.johnsonChart.destroy();

        // Extract absolute positive values & log-transform
        const values = transactions.map(t => Math.log10(Math.abs(parseFloat(t.amount) || 0) + 1));
        // Build histogram buckets (20 bins)
        const bins = 20;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / bins;
        const counts = new Array(bins).fill(0);
        values.forEach(v => {
            const idx = Math.min(bins - 1, Math.floor((v - min) / binSize));
            counts[idx]++;
        });
        const labels = counts.map((_, i) => (min + i * binSize).toFixed(2));

        this.johnsonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Frequency',
                    data: counts,
                    backgroundColor: 'rgba(153, 102, 255, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'log10(Amount + 1)' } },
                    y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                }
            }
        });
    }

    /**
     * Render Gamma distribution-style histogram for absolute transaction amounts.
     * This is a simple histogram visual approximation; no complex fitting.
     * @param {Array} transactions
     * @param {string} canvasId – canvas element id
     */
    renderGammaDistributionChart(transactions = [], canvasId = 'transactions-gamma-chart') {
        if (!transactions || transactions.length === 0) return;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return; // Canvas not present in DOM – skip

        // Destroy previous instance
        if (this.gammaChart) this.gammaChart.destroy();

        // Prepare absolute amounts
        const amounts = transactions.map(t => Math.abs(parseFloat(t.amount) || 0));
        if (amounts.length === 0) return;

        // Build histogram (30 bins)
        const bins = 30;
        const minVal = Math.min(...amounts);
        const maxVal = Math.max(...amounts);
        const binSize = (maxVal - minVal) / bins || 1;
        const counts = new Array(bins).fill(0);
        amounts.forEach(val => {
            const idx = Math.min(bins - 1, Math.floor((val - minVal) / binSize));
            counts[idx]++;
        });
        const labels = counts.map((_, i) => (minVal + i * binSize).toFixed(0));

        const config = {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Frequency',
                    data: counts,
                    backgroundColor: 'rgba(255, 206, 86, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Gamma-like Distribution of Transaction Amounts'
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: 'Amount ($)' } },
                    y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                }
            }
        };

        this.gammaChart = new Chart(ctx, config);
    }

    /**
     * Render long-tail distribution with log-scale on Y axis to reveal tiny frequencies
     */
    renderLongTailDistributionChart(transactions = [], canvasId = 'transactions-longtail-chart') {
        if (!transactions || transactions.length === 0) return;
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.longTailChart) this.longTailChart.destroy();

        // Build value buckets similar to renderDistributionChart
        const amounts = transactions.map(t => Math.abs(parseFloat(t.amount) || 0));
        const numBins = 30;
        const minVal = Math.min(...amounts);
        const maxVal = Math.max(...amounts);
        const binWidth = (maxVal - minVal) / numBins;
        const freq = new Array(numBins).fill(0);
        amounts.forEach(a => {
            const idx = Math.min(numBins - 1, Math.floor((a - minVal) / binWidth));
            freq[idx]++;
        });
        const labels = freq.map((_, i) => (minVal + i * binWidth).toFixed(0));

        this.longTailChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Transactions',
                    data: freq,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Amount ($)' } },
                    y: { title: { display: true, text: 'Count (log)' }, type: 'logarithmic', beginAtZero: true }
                }
            }
        });
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
const transactionAnalytics = new TransactionAnalytics();

export { transactionAnalytics };
