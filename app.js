class BudgetApp {
    constructor() {
        this.transactions = [];
        this.budgetCategories = [];
        this.accounts = [];
        this.merchantCategories = {};
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.charts = {};
        
        this.init();
    }

    init() {
        this.loadSampleData();
        this.loadFromStorage();
        this.bindEvents();
        this.renderCurrentView();
        this.updateDashboard();
    }

    loadSampleData() {
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

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'budget':
                this.renderBudget();
                break;
            case 'transactions':
                this.renderTransactions();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
        }
    }

    renderDashboard() {
        this.updateDashboard();
        this.renderRecentTransactions();
        this.renderBudgetOverviewChart();
    }

    updateDashboard() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const totalIncome = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const totalSpent = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const totalBudgeted = this.budgetCategories
            .filter(c => c.name !== 'Salary') // Exclude income categories
            .reduce((sum, c) => sum + c.budgeted, 0);

        const availableBudget = totalIncome - totalBudgeted;

        document.getElementById('available-budget').textContent = this.formatCurrency(availableBudget);
        document.getElementById('total-budgeted').textContent = this.formatCurrency(totalBudgeted);
        document.getElementById('total-spent').textContent = this.formatCurrency(totalSpent);
        document.getElementById('total-income').textContent = this.formatCurrency(totalIncome);
    }

    renderRecentTransactions() {
        const container = document.getElementById('recent-transactions');
        const recentTransactions = this.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recentTransactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No transactions yet</h3><p>Add your first transaction to get started.</p></div>';
            return;
        }

        const html = recentTransactions.map(transaction => `
            <div class="recent-transaction">
                <div class="recent-transaction__info">
                    <div class="recent-transaction__description">${transaction.description}</div>
                    <div class="recent-transaction__category">${transaction.category}</div>
                </div>
                <div>
                    <div class="recent-transaction__amount ${transaction.type === 'income' ? 'text-success' : 'text-error'}">
                        ${this.formatCurrency(transaction.amount)}
                    </div>
                    <div class="recent-transaction__date">${this.formatDate(transaction.date)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderBudgetOverviewChart() {
        const ctx = document.getElementById('budget-overview-chart').getContext('2d');
        
        if (this.charts.budgetOverview) {
            this.charts.budgetOverview.destroy();
        }

        const categoryData = this.budgetCategories
            .filter(c => c.name !== 'Salary') // Exclude income categories
            .map(category => {
                const spent = this.getSpentByCategory(category.name);
                return {
                    name: category.name,
                    budgeted: category.budgeted,
                    spent: Math.abs(spent),
                    color: category.color
                };
            });

        this.charts.budgetOverview = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categoryData.map(c => c.name),
                datasets: [{
                    label: 'Budgeted',
                    data: categoryData.map(c => c.budgeted),
                    backgroundColor: '#1FB8CD',
                    borderRadius: 4
                }, {
                    label: 'Spent',
                    data: categoryData.map(c => c.spent),
                    backgroundColor: '#FFC185',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    }

    renderBudget() {
        this.updateBudgetSummary();
        this.renderBudgetCategories();
        this.populateCategoryDropdowns();
    }

    updateBudgetSummary() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income' && this.isCurrentMonth(t.date))
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const totalBudgeted = this.budgetCategories
            .filter(c => c.name !== 'Salary')
            .reduce((sum, c) => sum + c.budgeted, 0);

        const availableBudget = totalIncome - totalBudgeted;
        document.getElementById('budget-available').textContent = this.formatCurrency(availableBudget);
    }

    renderBudgetCategories() {
        const container = document.getElementById('budget-categories');
        
        const html = this.budgetCategories
            .filter(c => c.name !== 'Salary') // Don't show income categories in budget view
            .map(category => {
                const spent = Math.abs(this.getSpentByCategory(category.name));
                const remaining = category.budgeted - spent;
                const percentage = category.budgeted > 0 ? (spent / category.budgeted) * 100 : 0;
                
                let progressClass = 'budget-category__progress-bar--success';
                if (percentage > 100) progressClass = 'budget-category__progress-bar--error';
                else if (percentage > 80) progressClass = 'budget-category__progress-bar--warning';

                return `
                    <div class="budget-category">
                        <div class="budget-category__header">
                            <div class="budget-category__name">
                                <span class="category-color" style="background-color: ${category.color}"></span>
                                ${category.name}
                            </div>
                            <div class="budget-category__amounts">
                                <span class="budget-category__amount">Budgeted: ${this.formatCurrency(category.budgeted)}</span>
                                <span class="budget-category__amount">Spent: ${this.formatCurrency(spent)}</span>
                                <span class="budget-category__amount">Remaining: ${this.formatCurrency(remaining)}</span>
                            </div>
                        </div>
                        <div class="budget-category__progress">
                            <div class="budget-category__progress-bar ${progressClass}" 
                                 style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

        container.innerHTML = html;
    }

    renderTransactions() {
        this.populateTransactionFilter();
        this.renderTransactionsTable();
    }

    populateTransactionFilter() {
        const select = document.getElementById('transaction-filter');
        const categories = [...new Set(this.budgetCategories.map(c => c.name))];
        
        select.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    renderTransactionsTable() {
        const container = document.getElementById('transactions-table');
        const searchTerm = document.getElementById('transaction-search').value.toLowerCase();
        const categoryFilter = document.getElementById('transaction-filter').value;

        let filteredTransactions = this.transactions.filter(t => {
            const matchesSearch = t.description.toLowerCase().includes(searchTerm) ||
                                t.category.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || t.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredTransactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No transactions found</h3></div>';
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredTransactions.map(transaction => `
                        <tr>
                            <td>${this.formatDate(transaction.date)}</td>
                            <td>${transaction.description}</td>
                            <td>
                                <span class="category-color" style="background-color: ${this.getCategoryColor(transaction.category)}"></span>
                                ${transaction.category}
                            </td>
                            <td>${transaction.account}</td>
                            <td class="${transaction.type === 'income' ? 'transaction-amount--income' : 'transaction-amount--expense'}">
                                ${this.formatCurrency(transaction.amount)}
                            </td>
                            <td>
                                <div class="transaction-actions">
                                    <button class="btn btn--sm btn--secondary" onclick="app.editTransaction(${transaction.id})">Edit</button>
                                    <button class="btn btn--sm btn--outline" onclick="app.deleteTransaction(${transaction.id})">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderCalendar() {
        this.updateCalendarHeader();
        this.renderCalendarGrid();
        this.renderRecurringTransactions();
    }

    updateCalendarHeader() {
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        document.getElementById('calendar-month-year').textContent = 
            `${monthNames[this.currentMonth]} ${this.currentYear}`;
    }

    renderCalendarGrid() {
        const container = document.getElementById('calendar');
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Create calendar header
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = dayNames.map(day => `<div class="calendar__header">${day}</div>`).join('');

        // Create calendar days
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
            const isToday = currentDate.toDateString() === today.toDateString();
            
            const dayTransactions = this.getTransactionsForDate(currentDate);
            const forecastedTransactions = this.getForecastedTransactionsForDate(currentDate);
            const dayTotal = [...dayTransactions, ...forecastedTransactions]
                .reduce((sum, t) => sum + t.amount, 0);

            let dayClass = 'calendar__day';
            if (!isCurrentMonth) dayClass += ' calendar__day--other-month';
            if (isToday) dayClass += ' calendar__day--today';

            const transactionsHtml = [...dayTransactions, ...forecastedTransactions]
                .slice(0, 3) // Show max 3 transactions
                .map(t => `
                    <div class="calendar__transaction ${t.forecasted ? 'calendar__transaction--forecasted' : ''}">
                        ${t.description.substring(0, 15)}${t.description.length > 15 ? '...' : ''}
                    </div>
                `).join('');

            html += `
                <div class="${dayClass}" onclick="app.showDayTransactions('${currentDate.toISOString().split('T')[0]}')">
                    <div class="calendar__day-number">${currentDate.getDate()}</div>
                    <div class="calendar__transactions">${transactionsHtml}</div>
                    ${dayTotal !== 0 ? `<div class="calendar__total ${dayTotal > 0 ? 'calendar__total--positive' : 'calendar__total--negative'}">${this.formatCurrency(dayTotal)}</div>` : ''}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderRecurringTransactions() {
        const container = document.getElementById('recurring-transactions');
        const recurring = this.detectRecurringTransactions();

        if (recurring.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No recurring patterns detected</h3></div>';
            return;
        }

        const html = recurring.map(pattern => `
            <div class="recurring-transaction">
                <div class="recurring-transaction__info">
                    <div class="recurring-transaction__name">${pattern.description}</div>
                    <div class="recurring-transaction__details">
                        ${pattern.frequency} • ${pattern.category}
                        <span class="recurring-transaction__confidence">${pattern.confidence}% confidence</span>
                    </div>
                </div>
                <div class="recurring-transaction__amount ${pattern.amount > 0 ? 'text-success' : 'text-error'}">
                    ${this.formatCurrency(pattern.amount)}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderAnalytics() {
        this.renderSpendingTrendsChart();
        this.renderCategoryBreakdownChart();
        this.renderIncomeExpensesChart();
        this.renderBudgetPerformanceChart();
    }

    renderSpendingTrendsChart() {
        const ctx = document.getElementById('spending-trends-chart').getContext('2d');
        
        if (this.charts.spendingTrends) {
            this.charts.spendingTrends.destroy();
        }

        // Get last 6 months of data
        const months = [];
        const currentDate = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            months.push(date);
        }

        const datasets = this.budgetCategories
            .filter(c => c.name !== 'Salary')
            .slice(0, 5) // Show top 5 categories
            .map((category, index) => ({
                label: category.name,
                data: months.map(month => {
                    const spent = this.transactions
                        .filter(t => {
                            const tDate = new Date(t.date);
                            return t.category === category.name && 
                                   t.type === 'expense' &&
                                   tDate.getMonth() === month.getMonth() &&
                                   tDate.getFullYear() === month.getFullYear();
                        })
                        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    return spent;
                }),
                borderColor: category.color,
                backgroundColor: category.color + '20',
                tension: 0.1
            }));

        this.charts.spendingTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    }

    renderCategoryBreakdownChart() {
        const ctx = document.getElementById('category-breakdown-chart').getContext('2d');
        
        if (this.charts.categoryBreakdown) {
            this.charts.categoryBreakdown.destroy();
        }

        const categoryData = this.budgetCategories
            .filter(c => c.name !== 'Salary')
            .map(category => ({
                name: category.name,
                spent: Math.abs(this.getSpentByCategory(category.name)),
                color: category.color
            }))
            .filter(c => c.spent > 0)
            .sort((a, b) => b.spent - a.spent);

        this.charts.categoryBreakdown = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.map(c => c.name),
                datasets: [{
                    data: categoryData.map(c => c.spent),
                    backgroundColor: categoryData.map(c => c.color),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    renderIncomeExpensesChart() {
        const ctx = document.getElementById('income-expenses-chart').getContext('2d');
        
        if (this.charts.incomeExpenses) {
            this.charts.incomeExpenses.destroy();
        }

        // Get last 6 months
        const months = [];
        const currentDate = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            months.push(date);
        }

        const incomeData = months.map(month => {
            return this.transactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return t.type === 'income' &&
                           tDate.getMonth() === month.getMonth() &&
                           tDate.getFullYear() === month.getFullYear();
                })
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        });

        const expenseData = months.map(month => {
            return this.transactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return t.type === 'expense' &&
                           tDate.getMonth() === month.getMonth() &&
                           tDate.getFullYear() === month.getFullYear();
                })
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        });

        this.charts.incomeExpenses = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months.map(m => m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
                datasets: [{
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: '#2ecc71',
                    borderRadius: 4
                }, {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: '#e74c3c',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    }

    renderBudgetPerformanceChart() {
        const ctx = document.getElementById('budget-performance-chart').getContext('2d');
        
        if (this.charts.budgetPerformance) {
            this.charts.budgetPerformance.destroy();
        }

        const categoryData = this.budgetCategories
            .filter(c => c.name !== 'Salary')
            .map(category => {
                const spent = Math.abs(this.getSpentByCategory(category.name));
                const performance = category.budgeted > 0 ? (spent / category.budgeted) * 100 : 0;
                return {
                    name: category.name,
                    performance: performance,
                    color: category.color
                };
            });

        this.charts.budgetPerformance = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: categoryData.map(c => c.name),
                datasets: [{
                    label: 'Budget Performance (%)',
                    data: categoryData.map(c => c.performance),
                    backgroundColor: categoryData.map(c => 
                        c.performance > 100 ? '#e74c3c' : 
                        c.performance > 80 ? '#f39c12' : '#27ae60'
                    ),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 120,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Modal functions
    showTransactionModal() {
        document.getElementById('add-transaction-modal').classList.add('modal--active');
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        this.populateCategoryDropdowns();
    }

    showCategoryModal() {
        document.getElementById('add-category-modal').classList.add('modal--active');
    }

    showCSVModal() {
        document.getElementById('csv-import-modal').classList.add('modal--active');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('modal--active');
        });
        this.resetForms();
    }

    resetForms() {
        document.getElementById('transaction-form').reset();
        document.getElementById('category-form').reset();
        document.getElementById('csv-preview').innerHTML = '';
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('import-csv-confirm').classList.add('hidden');
    }

    populateCategoryDropdowns() {
        const transactionCategory = document.getElementById('transaction-category');
        const categories = this.budgetCategories.map(c => c.name);
        
        transactionCategory.innerHTML = categories.map(cat => 
            `<option value="${cat}">${cat}</option>`
        ).join('');
    }

    // Form handlers
    handleTransactionSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const transaction = {
            id: Date.now(),
            date: document.getElementById('transaction-date').value,
            description: document.getElementById('transaction-description').value,
            amount: parseFloat(document.getElementById('transaction-amount').value),
            type: document.getElementById('transaction-type').value,
            category: document.getElementById('transaction-category').value,
            account: document.getElementById('transaction-account').value,
            recurring: document.getElementById('transaction-recurring').checked,
            frequency: document.getElementById('transaction-recurring').checked ? 'monthly' : null
        };

        // Ensure expenses are negative
        if (transaction.type === 'expense' && transaction.amount > 0) {
            transaction.amount = -transaction.amount;
        }

        this.transactions.push(transaction);
        this.saveToStorage();
        this.closeModals();
        this.renderCurrentView();
        this.updateDashboard();
    }

    handleCategorySubmit(e) {
        e.preventDefault();
        
        const category = {
            name: document.getElementById('category-name').value,
            budgeted: parseFloat(document.getElementById('category-budget').value),
            color: document.getElementById('category-color').value
        };

        this.budgetCategories.push(category);
        this.saveToStorage();
        this.closeModals();
        this.renderCurrentView();
        this.updateDashboard();
    }

    // CSV handling
    handleCSVFile(e) {
        const file = e.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    }

    processCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const csv = e.target.result;
            this.parseCSV(csv);
        };
        reader.readAsText(file);
    }

    parseCSV(csv) {
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).filter(line => line.trim()).map(line => {
            return line.split(',').map(cell => cell.trim().replace(/"/g, ''));
        });

        // Show preview
        this.showCSVPreview(headers, rows.slice(0, 5)); // Show first 5 rows
        this.csvData = { headers, rows };
    }

    showCSVPreview(headers, rows) {
        const preview = document.getElementById('csv-preview');
        
        const html = `
            <h4>CSV Preview</h4>
            <table class="csv-preview__table">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
            <p>Found ${this.csvData?.rows.length || 0} transactions. Click Import to continue.</p>
        `;
        
        preview.innerHTML = html;
        preview.classList.remove('hidden');
        document.getElementById('import-csv-confirm').classList.remove('hidden');
    }

    confirmCSVImport() {
        if (!this.csvData) return;

        const { headers, rows } = this.csvData;
        
        // Auto-detect column mappings
        const dateCol = this.findColumn(headers, ['date', 'transaction date', 'posted date']);
        const descCol = this.findColumn(headers, ['description', 'memo', 'payee']);
        const amountCol = this.findColumn(headers, ['amount', 'transaction amount']);
        const accountCol = this.findColumn(headers, ['account', 'card']);

        const newTransactions = rows.map((row, index) => {
            const amount = parseFloat(row[amountCol] || 0);
            const description = row[descCol] || `Transaction ${index + 1}`;
            const category = this.categorizeTransaction(description);
            
            return {
                id: Date.now() + index,
                date: this.parseDate(row[dateCol]),
                description: description,
                amount: amount,
                type: amount > 0 ? 'income' : 'expense',
                category: category,
                account: row[accountCol] || 'Checking',
                recurring: false
            };
        }).filter(t => t.amount !== 0);

        this.transactions.push(...newTransactions);
        this.saveToStorage();
        this.closeModals();
        this.renderCurrentView();
        this.updateDashboard();
        
        alert(`Imported ${newTransactions.length} transactions successfully!`);
    }

    findColumn(headers, possibleNames) {
        for (let name of possibleNames) {
            const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
            if (index !== -1) return index;
        }
        return 0; // Default to first column
    }

    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return new Date().toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    }

    categorizeTransaction(description) {
        const desc = description.toUpperCase();
        
        for (let [merchant, category] of Object.entries(this.merchantCategories)) {
            if (desc.includes(merchant)) {
                return category;
            }
        }
        
        return 'Miscellaneous';
    }

    // Calendar navigation
    navigateMonth(direction) {
        this.currentMonth += direction;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
    }

    // Transaction management
    editTransaction(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) return;

        // Pre-fill the form with existing data
        document.getElementById('transaction-date').value = transaction.date;
        document.getElementById('transaction-description').value = transaction.description;
        document.getElementById('transaction-amount').value = Math.abs(transaction.amount);
        document.getElementById('transaction-type').value = transaction.type;
        document.getElementById('transaction-category').value = transaction.category;
        document.getElementById('transaction-account').value = transaction.account;
        document.getElementById('transaction-recurring').checked = transaction.recurring || false;

        // Remove the old transaction
        this.deleteTransaction(id);
        
        this.showTransactionModal();
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveToStorage();
        this.renderCurrentView();
        this.updateDashboard();
    }

    filterTransactions() {
        this.renderTransactionsTable();
    }

    showDayTransactions(date) {
        const transactions = this.getTransactionsForDate(new Date(date));
        const forecasted = this.getForecastedTransactionsForDate(new Date(date));
        
        if (transactions.length === 0 && forecasted.length === 0) {
            alert('No transactions for this date.');
            return;
        }

        let message = `Transactions for ${this.formatDate(date)}:\n\n`;
        
        transactions.forEach(t => {
            message += `• ${t.description}: ${this.formatCurrency(t.amount)}\n`;
        });
        
        if (forecasted.length > 0) {
            message += '\nForecasted:\n';
            forecasted.forEach(t => {
                message += `• ${t.description}: ${this.formatCurrency(t.amount)} (predicted)\n`;
            });
        }
        
        alert(message);
    }

    // Helper functions
    getTransactionsForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.transactions.filter(t => t.date === dateStr);
    }

    getForecastedTransactionsForDate(date) {
        const recurring = this.detectRecurringTransactions();
        const forecasted = [];
        
        recurring.forEach(pattern => {
            // Simple monthly prediction
            if (pattern.frequency === 'monthly' && date.getDate() === pattern.dayOfMonth) {
                forecasted.push({
                    ...pattern,
                    forecasted: true,
                    date: date.toISOString().split('T')[0]
                });
            }
        });
        
        return forecasted;
    }

    detectRecurringTransactions() {
        const patterns = [];
        const groupedTransactions = {};

        // Group similar transactions
        this.transactions.forEach(transaction => {
            const key = this.getTransactionKey(transaction);
            if (!groupedTransactions[key]) {
                groupedTransactions[key] = [];
            }
            groupedTransactions[key].push(transaction);
        });

        // Analyze patterns
        Object.entries(groupedTransactions).forEach(([key, transactions]) => {
            if (transactions.length >= 2) {
                const pattern = this.analyzePattern(transactions);
                if (pattern && pattern.confidence >= 70) {
                    patterns.push(pattern);
                }
            }
        });

        return patterns;
    }

    getTransactionKey(transaction) {
        // Create a key based on similar description and amount
        const desc = transaction.description.toLowerCase()
            .replace(/\d+/g, '') // Remove numbers
            .replace(/[^\w\s]/g, '') // Remove special chars
            .trim();
        const amount = Math.round(Math.abs(transaction.amount));
        return `${desc}_${amount}`;
    }

    analyzePattern(transactions) {
        if (transactions.length < 2) return null;

        const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        const intervals = [];
        
        for (let i = 1; i < sortedTransactions.length; i++) {
            const prevDate = new Date(sortedTransactions[i - 1].date);
            const currDate = new Date(sortedTransactions[i].date);
            const daysDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
            intervals.push(daysDiff);
        }

        // Check if intervals are consistent (monthly ~30 days, weekly ~7 days)
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const isMonthly = avgInterval >= 25 && avgInterval <= 35;
        const isWeekly = avgInterval >= 5 && avgInterval <= 9;

        if (!isMonthly && !isWeekly) return null;

        const frequency = isMonthly ? 'monthly' : 'weekly';
        const confidence = this.calculateConfidence(intervals, avgInterval);
        const representative = sortedTransactions[0];

        return {
            id: `pattern_${Date.now()}_${Math.random()}`,
            description: representative.description,
            amount: representative.amount,
            category: representative.category,
            frequency: frequency,
            confidence: Math.round(confidence),
            dayOfMonth: new Date(representative.date).getDate(),
            transactions: sortedTransactions.length
        };
    }

    calculateConfidence(intervals, avgInterval) {
        if (intervals.length === 0) return 0;
        
        const variance = intervals.reduce((sum, interval) => {
            return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / intervals.length;
        
        const standardDeviation = Math.sqrt(variance);
        const confidenceScore = Math.max(0, 100 - (standardDeviation * 10));
        
        return Math.min(100, confidenceScore);
    }

    getSpentByCategory(categoryName) {
        return this.transactions
            .filter(t => t.category === categoryName && t.type === 'expense' && this.isCurrentMonth(t.date))
            .reduce((sum, t) => sum + t.amount, 0);
    }

    getCategoryColor(categoryName) {
        const category = this.budgetCategories.find(c => c.name === categoryName);
        return category ? category.color : '#3498db';
    }

    isCurrentMonth(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Initialize the app
const app = new BudgetApp();