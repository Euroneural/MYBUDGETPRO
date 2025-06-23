import { localDB } from './local-db.js';

class SearchManager {
    constructor(app) {
        this.app = app;
        this.searchResults = [];
        this.searchStats = {
            totalAmount: 0,
            averageAmount: 0,
            minAmount: 0,
            maxAmount: 0,
            transactionCount: 0,
            firstTransactionDate: null,
            lastTransactionDate: null
        };
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('transaction-search');
        
        if (searchBtn) searchBtn.addEventListener('click', () => this.performSearch());
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }
        
        const exactMatch = document.getElementById('exact-match');
        const includeNotes = document.getElementById('include-notes');
        const timeRange = document.getElementById('time-range');
        
        if (exactMatch) exactMatch.addEventListener('change', () => this.renderSearchResults());
        if (includeNotes) includeNotes.addEventListener('change', () => this.performSearch());
        if (timeRange) timeRange.addEventListener('change', () => this.performSearch());
    }

    async performSearch() {
        const searchTerm = document.getElementById('transaction-search')?.value.trim();
        if (!searchTerm) return;

        try {
            // Show loading state
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                const originalText = searchBtn.textContent;
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<span class="spinner"></span> Searching...';
            }

            // Get search options
            const exactMatch = document.getElementById('exact-match')?.checked || false;
            const includeNotes = document.getElementById('include-notes')?.checked || false;
            const timeRange = document.getElementById('time-range')?.value || 'month';
            
            // Calculate date range
            let startDate, endDate = new Date().toISOString().split('T')[0];
            const today = new Date();
            
            switch(timeRange) {
                case 'month':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case '6months':
                    startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];
                    break;
                case 'year':
                    startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                    break;
                default: // 'all'
                    startDate = '1970-01-01';
            }
            
            // Get transactions from database
            let transactions = await this.app.db.getTransactions({
                startDate,
                endDate
            });
            
            // Filter transactions based on search term
            const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
            
            this.searchResults = transactions.filter(transaction => {
                // Build searchable text
                let searchText = [
                    transaction.description?.toLowerCase() || '',
                    transaction.merchant?.toLowerCase() || '',
                    transaction.category?.toLowerCase() || '',
                    transaction.amount?.toString() || '',
                    transaction.type?.toLowerCase() || ''
                ];
                
                if (includeNotes && transaction.notes) {
                    searchText.push(transaction.notes.toLowerCase());
                }
                
                const searchTextStr = searchText.join(' ');
                
                // Apply search logic
                if (exactMatch) {
                    return searchTerms.every(term => searchTextStr.includes(term));
                } else {
                    // Fuzzy match - at least one term matches
                    return searchTerms.some(term => searchTextStr.includes(term));
                }
            });
            
            // Calculate search statistics
            this.calculateSearchStats();
            
            // Render results
            this.renderSearchResults();
            this.renderSearchCharts();
            this.generateSearchInsights();
            
        } catch (error) {
            console.error('Error performing search:', error);
            // Show error to user
            const tbody = document.getElementById('search-results-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-error">Error performing search: ${error.message}</td>
                    </tr>`;
            }
        } finally {
            // Reset button state
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = 'Search';
            }
        }
    }
    
    calculateSearchStats() {
        if (this.searchResults.length === 0) {
            this.searchStats = {
                totalAmount: 0,
                averageAmount: 0,
                minAmount: 0,
                maxAmount: 0,
                transactionCount: 0,
                firstTransactionDate: null,
                lastTransactionDate: null
            };
            return;
        }
        
        const amounts = this.searchResults.map(t => Math.abs(t.amount));
        const dates = this.searchResults
            .map(t => new Date(t.date))
            .sort((a, b) => a - b);
            
        this.searchStats = {
            totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
            averageAmount: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
            minAmount: Math.min(...amounts),
            maxAmount: Math.max(...amounts),
            transactionCount: this.searchResults.length,
            firstTransactionDate: dates[0],
            lastTransactionDate: dates[dates.length - 1]
        };
    }
    
    renderSearchResults() {
        const tbody = document.getElementById('search-results-body');
        if (!tbody) return;
        
        if (this.searchResults.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No transactions found matching your search criteria</td>
                </tr>`;
            return;
        }
        
        // Sort by date (newest first)
        const sortedResults = [...this.searchResults].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        // Update result count and total
        const resultCount = document.getElementById('result-count');
        const resultTotal = document.getElementById('result-total');
        
        if (resultCount) resultCount.textContent = this.searchResults.length;
        if (resultTotal) resultTotal.textContent = this.app.formatCurrency(this.searchStats.totalAmount);
        
        // Render transaction rows
        tbody.innerHTML = sortedResults.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const amountClass = transaction.amount >= 0 ? 'text-success' : 'text-error';
            
            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${transaction.description || 'No description'}</td>
                    <td>${transaction.category || 'Uncategorized'}</td>
                    <td class="${amountClass}">${this.app.formatCurrency(transaction.amount)}</td>
                    <td>${this.calculateTransactionChange(transaction)}</td>
                </tr>`;
        }).join('');
    }
    
    calculateTransactionChange(transaction) {
        // This is a simplified version - you would want to implement more sophisticated
        // change detection based on similar transactions over time
        return '—'; // Placeholder
    }
    
    renderSearchCharts() {
        if (this.searchResults.length === 0) return;
        
        // Render spending trend chart
        this.renderSearchTrendChart();
        
        // Render category breakdown chart
        this.renderSearchCategoryChart();
    }
    
    renderSearchTrendChart() {
        const ctx = document.getElementById('search-trend-chart')?.getContext('2d');
        if (!ctx) return;
        
        // Group transactions by month
        const monthlyData = {};
        this.searchResults.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = 0;
            }
            monthlyData[monthYear] += Math.abs(transaction.amount);
        });
        
        const labels = Object.keys(monthlyData).sort();
        const data = labels.map(label => monthlyData[label]);
        
        if (this.app.charts.searchTrend) {
            this.app.charts.searchTrend.destroy();
        }
        
        this.app.charts.searchTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Spending',
                    data: data,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.app.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.app.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
    
    renderSearchCategoryChart() {
        const ctx = document.getElementById('search-category-chart')?.getContext('2d');
        if (!ctx) return;
        
        // Group transactions by category
        const categoryData = {};
        this.searchResults.forEach(transaction => {
            const category = transaction.category || 'Uncategorized';
            if (!categoryData[category]) {
                categoryData[category] = 0;
            }
            categoryData[category] += Math.abs(transaction.amount);
        });
        
        const labels = Object.keys(categoryData);
        const data = labels.map(label => categoryData[label]);
        
        if (this.app.charts.searchCategory) {
            this.app.charts.searchCategory.destroy();
        }
        
        // Generate colors for categories
        const backgroundColors = labels.map((_, i) => {
            const hue = (i * 137.508) % 360; // Golden angle approximation
            return `hsl(${hue}, 70%, 60%)`;
        });
        
        this.app.charts.searchCategory = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.raw;
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${this.app.formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    generateSearchInsights() {
        const insightsContainer = document.getElementById('search-insights');
        if (!insightsContainer) return;
        
        if (this.searchResults.length === 0) {
            insightsContainer.innerHTML = '<p>No insights available for this search.</p>';
            return;
        }
        
        // Generate time-based insights
        const timeInsights = [];
        if (this.searchStats.transactionCount > 1) {
            const dateRange = Math.ceil(
                (this.searchStats.lastTransactionDate - this.searchStats.firstTransactionDate) / 
                (1000 * 60 * 60 * 24)
            ) || 1;
            
            const transactionsPerMonth = (this.searchStats.transactionCount / dateRange) * 30;
            const avgMonthlySpend = (this.searchStats.totalAmount / dateRange) * 30;
            
            timeInsights.push(
                `• On average, you make <strong>${transactionsPerMonth.toFixed(1)}</strong> similar transactions per month.`,
                `• You spend an average of <strong>${this.app.formatCurrency(avgMonthlySpend)}</strong> per month on these transactions.`
            );
        }
        
        // Generate amount-based insights
        const amountInsights = [];
        if (this.searchStats.transactionCount > 1) {
            amountInsights.push(
                `• The highest single transaction was <strong>${this.app.formatCurrency(this.searchStats.maxAmount)}</strong>.`,
                `• The average transaction amount is <strong>${this.app.formatCurrency(this.searchStats.averageAmount)}</strong>.`
            );
        }
        
        // Generate category insights if available
        const categoryInsights = [];
        const categories = new Set(this.searchResults.map(t => t.category).filter(Boolean));
        if (categories.size > 0) {
            categoryInsights.push(
                `• Transactions span across <strong>${categories.size}</strong> categories.`
            );
        }
        
        // Combine all insights
        insightsContainer.innerHTML = `
            <div class="insight">
                <h4>Spending Patterns</h4>
                ${timeInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>
            <div class="insight">
                <h4>Transaction Amounts</h4>
                ${amountInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>
            ${categoryInsights.length > 0 ? `
            <div class="insight">
                <h4>Categories</h4>
                ${categoryInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>` : ''}
        `;
    }
}

class BudgetApp {
    constructor() {
        this.transactions = [];
        this.charts = {}; // Initialize charts object
        this.budgetCategories = [];
        this.accounts = [];
        this.merchantCategories = {};
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.charts = {};
        this.db = localDB;
        this.unsubscribeCallbacks = [];
        this.pendingImport = []; // Initialize pending import array
        
        // Initialize the app
        this.init();
    }

    async init() {
        try {
            await this.db.initializeDB;
            this.bindEvents();
            this.setupRealtimeListeners();
            this.renderCurrentView();
            this.updateDashboard();
            this.loadSampleData();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    async addTransaction(transaction) {
        if (!this.db) {
            console.error('Database not initialized');
            return false;
        }
        
        try {
            // Ensure we wait for DB to be ready
            await this.db.initializeDB;
            
            // Generate a unique ID if not provided
            const transactionId = transaction.id || `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Prepare the transaction data
            const transactionData = {
                id: transactionId,
                ...transaction,
                amount: parseFloat(transaction.amount),
                date: new Date(transaction.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('Adding transaction:', transactionData);
            
            // Add the transaction to the database
            await this.db.addItem('transactions', transactionData);
            
            // Update account balance if account is specified
            if (transaction.account) {
                try {
                    const accounts = await this.db.getAllItems('accounts');
                    const account = accounts.find(a => a.name === transaction.account);
                    if (account) {
                        const newBalance = (parseFloat(account.balance) || 0) + parseFloat(transaction.amount);
                        console.log(`Updating account ${account.name} balance from ${account.balance} to ${newBalance}`);
                        await this.db.updateItem('accounts', account.id, { 
                            balance: newBalance,
                            updatedAt: new Date().toISOString() 
                        });
                    }
                } catch (accountError) {
                    console.error('Error updating account balance:', accountError);
                    // Don't fail the whole transaction if account update fails
                }
            }
            
            // Refresh transactions list
            this.transactions = await this.db.getAllItems('transactions');
            this.updateDashboard();
            this.renderTransactionList();
            
            return true;
        } catch (error) {
            console.error('Error adding transaction:', error);
            return false;
        }
    }

    async addTransactions(transactions) {
        if (!this.db) return false;
        
        try {
            for (const transaction of transactions) {
                await this.addTransaction(transaction);
            }
            return true;
        } catch (error) {
            console.error('Error adding transactions:', error);
            return false;
        }
    }

    setupRealtimeListeners() {
        // Set up real-time listeners
        const unsubscribeTransactions = this.db.onTransactionsChange(transactions => {
            this.transactions = transactions;
            this.updateDashboard();
            this.renderTransactionList();
        });

        const unsubscribeCategories = this.db.onCategoriesChange(categories => {
            this.budgetCategories = categories;
            this.updateDashboard();
            this.renderCategoryList();
        });

        const unsubscribeAccounts = this.db.onAccountsChange(accounts => {
            this.accounts = accounts;
            this.updateDashboard();
            this.renderAccountList();
        });

        // Store unsubscribe callbacks
        this.unsubscribeCallbacks = [
            unsubscribeTransactions,
            unsubscribeCategories,
            unsubscribeAccounts
        ];
    }

    async updateTransaction(id, updates) {
        if (!this.db) return false;
        
        try {
            // Get the original transaction first
            const transactions = await this.db.getTransactions();
            const originalTransaction = transactions.find(t => t.id === id);
            
            if (!originalTransaction) {
                console.error('Transaction not found:', id);
                return false;
            }
            
            // Update the transaction
            if (updates.amount) updates.amount = parseFloat(updates.amount);
            if (updates.date) updates.date = new Date(updates.date).toISOString().split('T')[0];
            
            await this.db.updateTransaction(id, updates);
            
            // If amount or account changed, update account balances
            if ((updates.amount && updates.amount !== originalTransaction.amount) || 
                (updates.account && updates.account !== originalTransaction.account)) {
                
                const accounts = await this.db.getAccounts();
                
                // Revert the old transaction's effect on the old account
                if (originalTransaction.account) {
                    const oldAccount = accounts.find(a => a.name === originalTransaction.account);
                    if (oldAccount) {
                        const newBalance = (parseFloat(oldAccount.balance) || 0) - parseFloat(originalTransaction.amount);
                        await this.db.updateAccount(oldAccount.id, { balance: newBalance });
                    }
                }
                
                // Apply the new transaction to the new account
                const accountName = updates.account || originalTransaction.account;
                const amount = updates.amount !== undefined ? updates.amount : originalTransaction.amount;
                
                if (accountName) {
                    const newAccount = accounts.find(a => a.name === accountName);
                    if (newAccount) {
                        const newBalance = (parseFloat(newAccount.balance) || 0) + parseFloat(amount);
                        await this.db.updateAccount(newAccount.id, { balance: newBalance });
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error updating transaction:', error);
            return false;
        }
    }

    cleanup() {
        // Unsubscribe from all real-time listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.unsubscribeCallbacks = [];
    }

    async loadSampleData() {
        if (!this.userId) return;
        
        // Check if we already have data
        const transactions = await this.db.getTransactions();
        if (!transactions.empty) return; // Don't load sample data if we already have data
        
        // Sample data from the provided JSON
        const sampleData = {
            "sampleTransactions": [
                {
                    "id": 1,
                    "date": "2025-06-01",
                    "description": "SALARY DEPOSIT - ACME CORP",
                    "amount": 5000.00,
                    "type": "income",
                    "category": "Salary",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 2,
                    "date": "2025-06-02",
                    "description": "RENT PAYMENT",
                    "amount": -1500.00,
                    "type": "expense",
                    "category": "Housing",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 3,
                    "date": "2025-06-03",
                    "description": "STARBUCKS #1234",
                    "amount": -5.47,
                    "type": "expense",
                    "category": "Food & Dining",
                    "account": "Credit Card",
                    "recurring": false
                },
                {
                    "id": 4,
                    "date": "2025-06-04",
                    "description": "SHELL GAS STATION",
                    "amount": -45.30,
                    "type": "expense",
                    "category": "Transportation",
                    "account": "Credit Card",
                    "recurring": false
                },
                {
                    "id": 5,
                    "date": "2025-06-05",
                    "description": "GROCERY STORE",
                    "amount": -127.84,
                    "type": "expense",
                    "category": "Groceries",
                    "account": "Debit Card",
                    "recurring": false
                },
                {
                    "id": 6,
                    "date": "2025-06-10",
                    "description": "NETFLIX SUBSCRIPTION",
                    "amount": -15.99,
                    "type": "expense",
                    "category": "Entertainment",
                    "account": "Credit Card",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 7,
                    "date": "2025-06-15",
                    "description": "ELECTRIC COMPANY",
                    "amount": -89.50,
                    "type": "expense",
                    "category": "Utilities",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                }
            ],
            "budgetCategories": [
                {
                    "name": "Housing",
                    "budgeted": 1600.00,
                    "color": "#e74c3c"
                },
                {
                    "name": "Food & Dining",
                    "budgeted": 400.00,
                    "color": "#f39c12"
                },
                {
                    "name": "Groceries",
                    "budgeted": 300.00,
                    "color": "#27ae60"
                },
                {
                    "name": "Transportation",
                    "budgeted": 200.00,
                    "color": "#3498db"
                },
                {
                    "name": "Entertainment",
                    "budgeted": 150.00,
                    "color": "#9b59b6"
                },
                {
                    "name": "Utilities",
                    "budgeted": 250.00,
                    "color": "#34495e"
                },
                {
                    "name": "Savings",
                    "budgeted": 1000.00,
                    "color": "#2ecc71"
                },
                {
                    "name": "Salary",
                    "budgeted": 0.00,
                    "color": "#1abc9c"
                }
            ],
            "accounts": [
                {
                    "name": "Checking",
                    "balance": 2500.00,
                    "type": "checking"
                },
                {
                    "name": "Credit Card",
                    "balance": -450.00,
                    "type": "credit"
                },
                {
                    "name": "Debit Card",
                    "balance": 1200.00,
                    "type": "checking"
                }
            ],
            "merchantCategories": {
                "STARBUCKS": "Food & Dining",
                "MCDONALDS": "Food & Dining",
                "SHELL": "Transportation",
                "EXXON": "Transportation",
                "WALMART": "Groceries",
                "TARGET": "Shopping",
                "NETFLIX": "Entertainment",
                "SPOTIFY": "Entertainment",
                "RENT": "Housing",
                "MORTGAGE": "Housing",
                "ELECTRIC": "Utilities",
                "GAS COMPANY": "Utilities",
                "WATER": "Utilities",
                "INTERNET": "Utilities"
            }
        };

        // Only load sample data if no existing data
        if (!localStorage.getItem('budget-app-transactions')) {
            this.transactions = sampleData.sampleTransactions;
            this.budgetCategories = sampleData.budgetCategories;
            this.accounts = sampleData.accounts;
            this.merchantCategories = sampleData.merchantCategories;
            this.saveToStorage();
        }
    }

    loadFromStorage() {
        const transactions = localStorage.getItem('budget-app-transactions');
        const categories = localStorage.getItem('budget-app-categories');
        const accounts = localStorage.getItem('budget-app-accounts');
        const merchants = localStorage.getItem('budget-app-merchants');

        if (transactions) this.transactions = JSON.parse(transactions);
        if (categories) this.budgetCategories = JSON.parse(categories);
        if (accounts) this.accounts = JSON.parse(accounts);
        if (merchants) this.merchantCategories = JSON.parse(merchants);
    }

    saveToStorage() {
        localStorage.setItem('budget-app-transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budget-app-categories', JSON.stringify(this.budgetCategories));
        localStorage.setItem('budget-app-accounts', JSON.stringify(this.accounts));
        localStorage.setItem('budget-app-merchants', JSON.stringify(this.merchantCategories));
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Add transaction buttons
        document.getElementById('add-transaction-btn').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-transaction-btn-2').addEventListener('click', () => this.showTransactionModal());
        
        // Add category button
        document.getElementById('add-category-btn').addEventListener('click', () => this.showCategoryModal());

        // Import CSV button
        document.getElementById('import-csv-btn').addEventListener('click', () => this.showCSVModal());

        // Modal close buttons
        document.querySelectorAll('.modal__close, #cancel-transaction, #cancel-category, #cancel-csv').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Form submissions
        document.getElementById('transaction-form').addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        document.getElementById('category-form').addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // CSV import
        document.getElementById('select-csv-btn').addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
        document.getElementById('csv-file-input').addEventListener('change', (e) => this.handleCSVFile(e));
        document.getElementById('import-csv-confirm').addEventListener('click', () => this.confirmCSVImport());

        // Calendar navigation
        document.getElementById('prev-month').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.navigateMonth(1));

        // Search and filter
        document.getElementById('transaction-search').addEventListener('input', (e) => this.filterTransactions());
        document.getElementById('transaction-filter').addEventListener('change', (e) => this.filterTransactions());

        // CSV dropzone
        const dropzone = document.getElementById('csv-dropzone');
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('csv-upload__dropzone--dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('csv-upload__dropzone--dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('csv-upload__dropzone--dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processCSVFile(files[0]);
            }
        });
        dropzone.addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.classList.remove('nav__link--active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('nav__link--active');

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('view--active');
        });
        document.getElementById(`${view}-view`).classList.add('view--active');
        this.currentView = view;
        this.renderCurrentView();
    }

    saveToStorage() {
        localStorage.setItem('budget-app-transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budget-app-categories', JSON.stringify(this.budgetCategories));
        localStorage.setItem('budget-app-accounts', JSON.stringify(this.accounts));
        localStorage.setItem('budget-app-merchants', JSON.stringify(this.merchantCategories));
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Add transaction buttons
        document.getElementById('add-transaction-btn').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-transaction-btn-2').addEventListener('click', () => this.showTransactionModal());
        
        // Add category button
        document.getElementById('add-category-btn').addEventListener('click', () => this.showCategoryModal());

        // Import CSV button
        document.getElementById('import-csv-btn').addEventListener('click', () => this.showCSVModal());

        // Modal close buttons
        document.querySelectorAll('.modal__close, #cancel-transaction, #cancel-category, #cancel-csv').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Form submissions
        document.getElementById('transaction-form').addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        document.getElementById('category-form').addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // CSV import
        document.getElementById('select-csv-btn').addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
        document.getElementById('csv-file-input').addEventListener('change', (e) => this.handleCSVFile(e));
        document.getElementById('import-csv-confirm').addEventListener('click', () => this.confirmCSVImport());

        // Calendar navigation
        document.getElementById('prev-month').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.navigateMonth(1));

        // Search and filter
        document.getElementById('transaction-search').addEventListener('input', (e) => this.filterTransactions());
        document.getElementById('transaction-filter').addEventListener('change', (e) => this.filterTransactions());

        // CSV dropzone
        const dropzone = document.getElementById('csv-dropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('csv-upload__dropzone--dragover');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('csv-upload__dropzone--dragover');
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('csv-upload__dropzone--dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.processCSVFile(files[0]);
                }
            });
            dropzone.addEventListener('click', () => {
                document.getElementById('csv-file-input').click();
            });
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.classList.remove('nav__link--active');
        });
        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('nav__link--active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('view--active');
        });
        const viewElement = document.getElementById(`${view}-view`);
        if (viewElement) {
            viewElement.classList.add('view--active');
        }
        this.currentView = view;
        this.renderCurrentView();
    }

    renderCurrentView() {
        if (!this.currentView) return;
        
        try {
            switch (this.currentView) {
                case 'dashboard':
                    this.renderDashboard();
                    break;
                case 'transactions':
                    this.renderTransactions();
                    break;
                case 'budget':
                    this.renderBudget();
                    break;
                case 'reports':
                    this.renderReports();
                    break;
                case 'settings':
                    this.renderSettings();
                    break;
                case 'search':
                    this.renderSearch();
                    break;
                default:
                    console.warn(`No render method for view: ${this.currentView}`);
            }
        } catch (error) {
            console.error(`Error rendering view ${this.currentView}:`, error);
        }
    }

    // Show the CSV import modal
    showCSVModal() {
        document.getElementById('csv-import-modal').classList.add('modal--active');
        document.body.classList.add('modal-open');
    }

    // Handle file selection
    handleCSVFile(e) {
        const file = e.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    }
    
    // Process CSV file and extract transactions
    async processCSVFile(file) {
        if (!file) return Promise.reject(new Error('No file provided'));
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                    
                    if (lines.length < 2) {
                        throw new Error('CSV file is empty or has no data rows');
                    }
                    
                    // Parse header row to detect column indices
                    const headers = this.parseCSVLine(lines[0]);
                    const columnIndices = {
                        date: -1,
                        description: -1,
                        amount: -1,
                        type: -1,
                        category: -1,
                        account: -1
                    };
                    
                    // Map common column names to our expected format
                    headers.forEach((header, index) => {
                        const lowerHeader = header.toLowerCase().trim();
                        
                        if (lowerHeader.includes('date')) {
                            columnIndices.date = index;
                        } else if (lowerHeader.includes('desc') || lowerHeader.includes('memo') || lowerHeader.includes('note')) {
                            columnIndices.description = index;
                        } else if (lowerHeader.includes('amount') || lowerHeader.includes('value') || lowerHeader.includes('total')) {
                            columnIndices.amount = index;
                        } else if (lowerHeader.includes('type') || lowerHeader.includes('transaction type')) {
                            columnIndices.type = index;
                        } else if (lowerHeader.includes('category') || lowerHeader.includes('cat')) {
                            columnIndices.category = index;
                        } else if (lowerHeader.includes('account') || lowerHeader.includes('bank') || lowerHeader.includes('source')) {
                            columnIndices.account = index;
                        }
                    });
                    
                    console.log('Detected column indices:', columnIndices);
                    
                    // Process data rows
                    const transactions = [];
                    const skippedRows = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        try {
                            const values = this.parseCSVLine(lines[i]);
                            if (values.length === 0) continue;
                            
                            // Parse date with fallback to today
                            let transactionDate;
                            if (columnIndices.date >= 0 && values[columnIndices.date]) {
                                transactionDate = this.parseDate(values[columnIndices.date]);
                                if (!transactionDate || isNaN(new Date(transactionDate).getTime())) {
                                    console.warn(`Invalid date '${values[columnIndices.date]}' in row ${i + 1}, using today's date`);
                                    transactionDate = new Date().toISOString().split('T')[0];
                                }
                            } else {
                                console.warn(`No date column found in row ${i + 1}, using today's date`);
                                transactionDate = new Date().toISOString().split('T')[0];
                            }
                            
                            // Parse amount with validation
                            let amount = 0;
                            
                            if (columnIndices.amount >= 0 && values[columnIndices.amount]) {
                                // Clean and parse the amount
                                const amountStr = values[columnIndices.amount].toString().replace(/[^0-9.-]/g, '');
                                amount = parseFloat(amountStr) || 0;
                                
                                // Determine if this is a credit or debit
                                if (columnIndices.type >= 0 && values[columnIndices.type]) {
                                    const typeValue = (values[columnIndices.type] || '').toString().toLowerCase().trim();
                                    const isCredit = ['credit', 'deposit', 'income', 'payment', 'refund', 'cr'].some(term => 
                                        typeValue.includes(term)
                                    );
                                    
                                    // If type is 'debit' or similar, ensure amount is negative
                                    if (!isCredit && ['debit', 'withdrawal', 'purchase', 'dr'].some(term => 
                                        typeValue.includes(term)
                                    )) {
                                        amount = -Math.abs(amount);
                                    }
                                }
                                
                                // If amount is 0, skip this row
                                if (amount === 0) {
                                    console.warn(`Skipping row ${i + 1}: Amount is 0`);
                                    skippedRows.push({ line: i + 1, reason: 'Zero amount' });
                                    continue;
                                }
                                
                                // Create transaction object
                                const transaction = {
                                    id: `import-${Date.now()}-${i}`,
                                    date: transactionDate,
                                    description: columnIndices.description >= 0 && values[columnIndices.description] 
                                        ? values[columnIndices.description].trim() 
                                        : 'Imported Transaction',
                                    amount: amount,
                                    category: columnIndices.category >= 0 && values[columnIndices.category] 
                                        ? values[columnIndices.category].trim() 
                                        : 'Uncategorized',
                                    account: columnIndices.account >= 0 && values[columnIndices.account] 
                                        ? values[columnIndices.account].trim() 
                                        : 'Imported',
                                    type: amount >= 0 ? 'credit' : 'debit',
                                    status: 'cleared',
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    imported: true,
                                    originalRow: values.join(',')
                                };
                                
                                transactions.push(transaction);
                            } else {
                                console.warn(`Skipping row ${i + 1}: No amount found`);
                                skippedRows.push({ line: i + 1, reason: 'No amount found' });
                            }
                            
                        } catch (error) {
                            console.error(`Error processing row ${i + 1}:`, error);
                            skippedRows.push({ line: i + 1, reason: error.message || 'Error processing row' });
                        }
                    }
                    
                    // Show preview of transactions
                    this.showCSVPreview(transactions, skippedRows);
                    
                    // Store transactions for confirmation
                    this.pendingImport = transactions;
                    
                    // Show success message
                    alert(`Successfully parsed ${transactions.length} transactions. ${skippedRows.length} rows were skipped.`);
                    resolve(transactions);
                    
                } catch (error) {
                    console.error('Error processing CSV file:', error);
                    alert(`Error processing CSV file: ${error.message}`);
                    // Reset the file input
                    const fileInput = document.getElementById('csv-file');
                    if (fileInput) fileInput.value = '';
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                alert('Error reading file. Please try again.');
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }
    
    // Parse date string in various formats to YYYY-MM-DD
    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try parsing with Date object first
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        // Try common date formats
        const formats = [
            // MM/DD/YYYY or M/D/YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
            // YYYY-MM-DD
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
            // DD-MM-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // Month name formats (Jan 1, 2023 or January 1, 2023)
            /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{2,4})$/,
            // DD/MM/YYYY (European format)
            /^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/,
        ];
        
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                let year, month, day;
                
                if (match[1].length > 2) { // Month name format
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthIndex = monthNames.findIndex(m => 
                        m.startsWith(match[1].toLowerCase().substring(0, 3))
                    );
                    if (monthIndex === -1) continue;
                    
                    month = monthIndex + 1;
                    day = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                } else {
                    // Numeric formats
                    if (match[1].length === 4) { // YYYY-MM-DD
                        year = parseInt(match[1], 10);
                        month = parseInt(match[2], 10);
                        day = parseInt(match[3], 10);
                    } else if (match[3].length === 4) { // DD-MM-YYYY or MM-DD-YYYY
                        // Try to determine if it's DD-MM-YYYY or MM-DD-YYYY
                        const first = parseInt(match[1], 10);
                        const second = parseInt(match[2], 10);
                        
                        if (first > 12) {
                            // Must be DD-MM-YYYY
                            day = first;
                            month = second;
                        } else if (second > 12) {
                            // Must be MM-DD-YYYY
                            month = first;
                            day = second;
                        } else {
                            // Ambiguous, default to DD-MM-YYYY
                            day = first;
                            month = second;
                        }
                        year = parseInt(match[3], 10);
                    } else {
                        // Default to MM-DD-YY
                        month = parseInt(match[1], 10);
                        day = parseInt(match[2], 10);
                        year = 2000 + parseInt(match[3], 10);
                    }
                }
                
                // Handle two-digit years
                if (year < 100) {
                    year = 2000 + year;
                }
                
                // Create date object
                const parsedDate = new Date(year, month - 1, day);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            }
        }
        
        // If we get here, return today's date as fallback
        console.warn(`Could not parse date: ${dateStr}, using today's date`);
        return new Date().toISOString().split('T')[0];
    }
    
    // Helper to parse CSV line with quotes
    parseCSVLine(line) {
        const result = [];
        let inQuotes = false;
        let current = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result.map(field => field.replace(/^"/g, '').replace(/"$/g, ''));
    };
    
    // Show CSV preview before import
    showCSVPreview(transactions, skippedRows = []) {
        const preview = document.getElementById('csv-preview');
        const confirmBtn = document.getElementById('import-csv-confirm');
        
        if (!preview || !confirmBtn) {
            console.error('Preview or confirm button not found');
            return;
        }
        
        try {
            let html = `
                <div class="preview-container">
                    <h3>Preview (${transactions.length} transactions)</h3>
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th class="text-end">Amount</th>
                                    <th>Category</th>
                                    <th>Account</th>
                                </tr>
                            </thead>
                            <tbody>`;
            
            // Add up to 10 sample rows
            const sampleSize = Math.min(transactions.length, 10);
            let totalAmount = 0;
            
            for (let i = 0; i < sampleSize; i++) {
                const t = transactions[i];
                const amount = parseFloat(t.amount) || 0;
                totalAmount += amount;
                
                html += `
                    <tr>
                        <td>${this.formatDate(t.date)}</td>
                        <td>${(t.description || '').substring(0, 50)}${(t.description || '').length > 50 ? '...' : ''}</td>
                        <td class="text-end ${amount >= 0 ? 'text-success' : 'text-danger'}">
                            ${this.formatCurrency(amount)}
                        </td>
                        <td>${t.category || 'Uncategorized'}</td>
                        <td>${t.account || 'Imported'}</td>
                    </tr>`;
            }
            
            // Add total row
            html += `
                            <tr class="table-active fw-bold">
                                <td colspan="2">Total (${sampleSize} of ${transactions.length} shown)</td>
                                <td class="text-end ${totalAmount >= 0 ? 'text-success' : 'text-danger'}">
                                    ${this.formatCurrency(totalAmount)}
                                </td>
                                <td colspan="2"></td>
                            </tr>`;
            
            if (transactions.length > 10) {
                html += `
                    <tr>
                        <td colspan="5" class="text-center small text-muted">
                            ... and ${transactions.length - 10} more transactions not shown
                        </td>
                    </tr>`;
            }
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
                
            // Add skipped rows info if any
            if (skippedRows && skippedRows.length > 0) {
                const skippedList = skippedRows.slice(0, 5).map(r => 
                    `Row ${r.line}: ${r.reason || 'Unknown error'}`
                ).join('<br>');
                
                html += `
                <div class="alert alert-warning mt-3">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>
                            <strong>Note:</strong> ${skippedRows.length} row(s) were skipped due to errors.
                            ${skippedRows.length > 5 ? 'Showing first 5 errors.' : ''}
                        </div>
                    </div>
                    <div class="mt-2 small">
                        ${skippedList}
                    </div>
                </div>`;
            }
            
            preview.innerHTML = html;
            preview.classList.remove('d-none');
            confirmBtn.classList.remove('d-none');
            
            // Scroll to preview
            preview.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Error generating preview:', error);
            if (preview) {
                preview.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Error generating preview: ${error.message}
                    </div>`;
                preview.classList.remove('d-none');
            }
        }
    }
    
    // Confirm and import the CSV data
    async confirmCSVImport() {
        if (!this.pendingImport || this.pendingImport.length === 0) {
            alert('No transactions to import. Please upload a CSV file first.');
            return;
        }
        
        try {
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            
            // Add transactions to database
            for (const [index, transaction] of this.pendingImport.entries()) {
                try {
                    console.log(`Importing transaction ${index + 1}/${this.pendingImport.length}:`, transaction);
                    const success = await this.addTransaction(transaction);
                    if (success) {
                        results.success++;
                    } else {
                        results.failed++;
                        results.errors.push(`Failed to import transaction: ${JSON.stringify(transaction)}`);
                    }
                } catch (error) {
                    console.error(`Error importing transaction ${index + 1}:`, error);
                    results.failed++;
                    results.errors.push(`Error importing transaction: ${error.message}`);
                }
            }
            
            console.log('Import results:', results);
            
            // Reset form and show success
            this.resetForms();
            
            // Show results to user
            if (results.failed === 0) {
                alert(`✅ Successfully imported all ${results.success} transactions`);
            } else if (results.success > 0) {
                alert(`⚠️ Imported ${results.success} transactions, but failed to import ${results.failed}. Check console for details.`);
            } else {
                alert('❌ Failed to import any transactions. Check console for details.');
            }
            
            // Log any errors
            if (results.errors.length > 0) {
                console.error('Import errors:', results.errors);
            }
            
            // Update UI
            this.renderCurrentView();
            
        } catch (error) {
            const errorMsg = `Error during import: ${error.message}`;
            console.error(errorMsg, error);
            alert(errorMsg);
        } finally {
            this.pendingImport = [];
        }
    }
    
    // Reset all forms
    resetForms() {
        document.getElementById('transaction-form').reset();
        document.getElementById('category-form').reset();
        document.getElementById('csv-preview').innerHTML = '';
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('import-csv-confirm').classList.add('hidden');
        document.getElementById('csv-import-modal').classList.remove('modal--active');
        document.body.classList.remove('modal-open');
    }

    renderSearch() {
        try {
            const resultsBody = document.getElementById('search-results-body');
            const insights = document.getElementById('search-insights');
            
            if (resultsBody) {
                resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">Enter a search term to find transactions</td></tr>';
            }
            
            if (insights) {
                insights.innerHTML = '';
            }
            
            // Clear any existing charts
            if (this.charts.searchTrend) {
                this.charts.searchTrend.destroy();
                delete this.charts.searchTrend;
            }
            
            if (this.charts.searchCategory) {
                this.charts.searchCategory.destroy();
                delete this.charts.searchCategory;
            }
        } catch (error) {
            console.error('Error in renderSearch:', error);
        }
    }

    formatCurrency(amount) {
        if (typeof amount !== 'number') return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    parseCurrency(currencyString) {
        if (!currencyString) return 0;
        // Remove any non-numeric characters except decimal point and minus sign
        const numberString = currencyString.replace(/[^0-9.-]+/g, "");
        return parseFloat(numberString) || 0;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString; // Return original string if date parsing fails
        }
    }

    // Helper method to get category color
    getCategoryColor(categoryName) {
        if (!categoryName || !Array.isArray(this.budgetCategories)) return '#cccccc';
        const category = this.budgetCategories.find(c => c && c.name === categoryName);
        return category && category.color ? category.color : '#cccccc';
    }

    initializeApp() {
        try {
            this.init();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BudgetApp();
    window.app.initializeApp();
});