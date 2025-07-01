import ynabBudget from '../ynab-budget.js';
import secureDB from '../secure-db.js';
import Chart from 'chart.js/auto';
import { ViewLoader } from '../utils/view-loader.js';

export class BudgetController {
    constructor() {
        this.chart = null;
        this.initialized = false;
        
        // Initialize view when the controller is created
        this.initializeView().catch(console.error);
    }
    
    // Initialize the budget view
    async initializeView() {
        try {
            // Create the budget view container if it doesn't exist
            let container = document.getElementById('budget-view');
            if (!container) {
                container = document.createElement('div');
                container.id = 'budget-view';
                container.className = 'view-content';
                document.querySelector('main').appendChild(container);
            }
            
            // Show loading state
            container.innerHTML = `
                <div class="container">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading budget data...</p>
                    </div>
                </div>
            `;
            
            // Initialize event listeners
            this.initEventListeners();
            
            // Load initial data
            await this.loadBudgetData();
            
            this.initialized = true;
            
            // Listen for view changes
            document.addEventListener('viewChanged', (event) => {
                if (event.detail.viewId === 'budget-view' && this.initialized) {
                    this.refreshView();
                }
            });
            
        } catch (error) {
            console.error('Error initializing budget view:', error);
            this.showError('Failed to initialize budget view. Please try refreshing the page.');
        }
    }

    // Initialize event listeners
    initEventListeners() {
        // Modal open/close handlers
        document.addEventListener('click', (e) => {
            // Open add category modal
            if (e.target.closest('#add-category-btn')) {
                this.openCategoryModal();
            }
            // Open set budget modal
            else if (e.target.closest('#set-budget-btn')) {
                this.openBudgetModal();
            }
            // Close modal when clicking X or cancel
            else if (e.target.closest('.close-modal')) {
                this.closeAllModals();
            }
            // Handle edit/delete category buttons
            else if (e.target.closest('.edit-category')) {
                const categoryId = e.target.closest('.edit-category').dataset.id;
                this.openCategoryModal(categoryId);
            }
            else if (e.target.closest('.delete-category')) {
                const categoryId = e.target.closest('.delete-category').dataset.id;
                this.deleteCategory(categoryId);
            }
            // Handle add goal button
            else if (e.target.closest('.add-goal')) {
                const categoryId = e.target.closest('.add-goal').dataset.categoryId;
                this.openGoalModal(categoryId);
            }
        });

        // Form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#add-category-form')) {
                e.preventDefault();
                this.handleCategorySubmit(e);
            }
            else if (e.target.matches('#set-budget-form')) {
                e.preventDefault();
                this.handleBudgetSubmit(e);
            }
            else if (e.target.matches('#goal-form')) {
                e.preventDefault();
                this.handleGoalSubmit(e);
            }
        });

        // Close modal when clicking outside content
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }


    // Load budget data and render UI
    async loadBudgetData() {
        const container = document.getElementById('budget-view');
        if (!container) return;
        
        try {
            // Show loading state
            container.innerHTML = `
                <div class="container">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading budget data...</p>
                    </div>
                </div>
            `;
            
            // Load transactions from secureDB
            const transactions = await secureDB.getAllItems('transactions') || [];
            
            // Process transactions to update category activities
            await ynabBudget.processTransactions(transactions);
            
            // Render the budget UI
            await this.renderBudget();
            
            // Render the spending chart
            this.renderSpendingChart();
            
        } catch (error) {
            console.error('Error loading budget data:', error);
            this.showError('Failed to load budget data. Please try refreshing the page.');
        }
    }
    
    // Refresh the entire view
    async refreshView() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        await this.loadBudgetData();
    }
    
    // Show error message
    showError(message) {
        const container = document.getElementById('budget-view');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                    <button class="btn btn-primary" id="retry-loading">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
            
            // Add retry handler
            const retryBtn = document.getElementById('retry-loading');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.refreshView());
            }
        }
    }

    // Render the main budget UI
    async renderBudget() {
        const container = document.getElementById('budget-view');
        if (!container) return;
        
        const summary = ynabBudget.getBudgetSummary();
        
        // Render the budget view HTML
        container.innerHTML = `
            <div class="container">
                <div class="budget-header">
                    <h2>Budget</h2>
                    <div class="budget-summary">
                        <div class="summary-item">
                            <div class="summary-label">To Be Budgeted</div>
                            <div id="to-be-budgeted" class="summary-amount">${this.formatCurrency(summary.toBeBudgeted)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Budgeted</div>
                            <div id="budgeted-amount" class="summary-amount">${this.formatCurrency(summary.totalBudgeted)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Activity</div>
                            <div id="activity-amount" class="summary-amount">${this.formatCurrency(summary.totalActivity)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Available</div>
                            <div id="available-amount" class="summary-amount">${this.formatCurrency(summary.totalBalance)}</div>
                        </div>
                    </div>
                    <div class="budget-actions">
                        <button id="add-category-btn" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Add Category
                        </button>
                        <button id="set-budget-btn" class="btn btn-secondary">
                            <i class="fas fa-pen"></i> Set Monthly Budget
                        </button>
                    </div>
                </div>

                <div class="budget-content">
                    <!-- Categories List -->
                    <div class="categories-container">
                        <div class="categories-header">
                            <div class="category-name">Category</div>
                            <div class="category-budgeted">Budgeted</div>
                            <div class="category-activity">Activity</div>
                            <div class="category-available">Available</div>
                            <div class="category-actions">Actions</div>
                        </div>
                        <div id="categories-list" class="categories-list"></div>
                    </div>

                    <!-- Reports Section -->
                    <div class="reports-section">
                        <h3>Spending Overview</h3>
                        <div class="chart-container">
                            <canvas id="spending-chart"></canvas>
                        </div>
                        <div class="spending-breakdown">
                            <h4>Category Breakdown</h4>
                            <div id="category-breakdown" class="category-breakdown"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Modals will be rendered here -->
            ${this.renderModals()}
        `;
        
        // Re-initialize event listeners after rendering
        this.initEventListeners();
        
        // Render categories list and breakdown
        this.renderCategoriesList(summary.categories);
        this.renderCategoryBreakdown(summary.categories);
    }
    
    // Render modals HTML
    renderModals() {
        return `
            <!-- Category Modal -->
            <div id="category-modal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3 id="category-modal-title">Add Category</h3>
                    <form id="add-category-form">
                        <input type="hidden" id="edit-category-id">
                        <div class="form-group">
                            <label for="new-category-name">Category Name</label>
                            <input type="text" id="new-category-name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="category-budgeted">Budgeted Amount</label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number" id="category-budgeted" class="form-control" step="0.01" min="0" value="0" required>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Save Category</button>
                            <button type="button" class="btn btn-secondary close-modal">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Budget Modal -->
            <div id="budget-modal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Set Monthly Budget</h3>
                    <form id="set-budget-form">
                        <div class="form-group">
                            <label for="set-monthly-budget">Monthly Budget Amount</label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number" id="set-monthly-budget" class="form-control" step="0.01" min="0" required>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Update Budget</button>
                            <button type="button" class="btn btn-secondary close-modal">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Goal Modal -->
            <div id="goal-modal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Add Goal</h3>
                    <form id="goal-form">
                        <input type="hidden" id="goal-category-id">
                        <div class="form-group">
                            <label for="goal-amount">Target Amount</label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number" id="goal-amount" class="form-control" step="0.01" min="0.01" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="goal-date">Target Date</label>
                            <input type="date" id="goal-date" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="goal-description">Description (Optional)</label>
                            <textarea id="goal-description" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Save Goal</button>
                            <button type="button" class="btn btn-secondary close-modal">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // Render the categories list
    renderCategoriesList(categories) {
        const container = document.getElementById('categories-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        categories.forEach(category => {
            const spentPercentage = (Math.abs(category.activity) / category.budgeted) * 100 || 0;
            const remaining = category.budgeted + category.activity;
            const isOverBudget = remaining < 0;
            
            const categoryEl = document.createElement('div');
            categoryEl.className = 'category-item';
            categoryEl.innerHTML = `
                <div class="category-name">
                    <div>${category.name}</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${Math.min(100, spentPercentage)}%;
                            background-color: ${isOverBudget ? '#dc3545' : '#4e73df'};">
                        </div>
                    </div>
                </div>
                <div class="category-budgeted text-right">
                    ${this.formatCurrency(category.budgeted)}
                </div>
                <div class="category-activity text-right ${category.activity < 0 ? 'text-danger' : 'text-success'}">
                    ${this.formatCurrency(category.activity)}
                </div>
                <div class="category-available text-right ${isOverBudget ? 'text-danger' : ''}">
                    ${this.formatCurrency(remaining)}
                </div>
                <div class="category-actions">
                    <button class="btn-icon edit-category" data-id="${category.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-category" data-id="${category.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon add-goal" data-category-id="${category.id}" title="Add Goal">
                        <i class="fas fa-bullseye"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(categoryEl);
        });
    }

    // Render the spending chart
    renderSpendingChart() {
        const ctx = document.getElementById('spending-chart');
        if (!ctx) return;
        
        const report = ynabBudget.getSpendingReport();
        const labels = report.map(item => item.name);
        const data = report.map(item => Math.abs(item.activity));
        
        // Destroy previous chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
                        '#5a5c69', '#858796', '#3a3b45', '#1cc88a', '#36b9cc'
                    ],
                    hoverBackgroundColor: [
                        '#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617',
                        '#373840', '#6b6d7d', '#282a33', '#17a673', '#2c9faf'
                    ],
                    hoverBorderColor: 'rgba(234, 236, 244, 1)',
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgb(255,255,255)',
                        bodyColor: '#858796',
                        titleMarginBottom: 10,
                        titleFontSize: 14,
                        borderColor: '#dddfeb',
                        borderWidth: 1,
                        xPadding: 15,
                        yPadding: 15,
                        displayColors: false,
                        caretPadding: 10,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                cutout: '70%',
            }
        });
    }

    // Render the category breakdown
    renderCategoryBreakdown(categories) {
        const container = document.getElementById('category-breakdown');
        if (!container) return;
        
        container.innerHTML = '';
        
        categories.forEach(category => {
            if (category.budgeted <= 0) return;
            
            const spentPercentage = Math.min(100, (Math.abs(category.activity) / category.budgeted) * 100) || 0;
            const remaining = category.budgeted + category.activity;
            const isOverBudget = remaining < 0;
            
            const breakdownEl = document.createElement('div');
            breakdownEl.className = 'breakdown-item';
            breakdownEl.innerHTML = `
                <div class="breakdown-category">${category.name}</div>
                <div class="breakdown-amount ${isOverBudget ? 'text-danger' : ''}">
                    ${this.formatCurrency(remaining)} / ${this.formatCurrency(category.budgeted)}
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" 
                         style="width: ${spentPercentage}%;
                                background-color: ${isOverBudget ? '#e74a3b' : '#1cc88a'};">
                    </div>
                </div>
                <div class="breakdown-percentage">
                    ${spentPercentage.toFixed(1)}% ${isOverBudget ? 'over' : 'of'} budget
                </div>
            `;
            
            container.appendChild(breakdownEl);
        });
    }

    // Open category modal
    async openCategoryModal(categoryId = null) {
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('add-category-form');
        const title = document.getElementById('category-modal-title');
        
        if (categoryId) {
            // Edit mode
            const category = ynabBudget.categories.find(c => c.id === categoryId);
            if (category) {
                title.textContent = 'Edit Category';
                document.getElementById('edit-category-id').value = category.id;
                document.getElementById('new-category-name').value = category.name;
                document.getElementById('category-budgeted').value = category.budgeted;
            }
        } else {
            // Add mode
            title.textContent = 'Add Category';
            form.reset();
            document.getElementById('edit-category-id').value = '';
        }
        
        modal.style.display = 'flex';
    }

    // Open budget modal
    async openBudgetModal() {
        const modal = document.getElementById('budget-modal');
        document.getElementById('set-monthly-budget').value = ynabBudget.monthlyBudget || '';
        modal.style.display = 'flex';
    }

    // Open goal modal
    async openGoalModal(categoryId) {
        const modal = document.getElementById('goal-modal');
        document.getElementById('goal-category-id').value = categoryId;
        
        // Set default date to end of current month
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        document.getElementById('goal-date').value = lastDay.toISOString().split('T')[0];
        
        modal.style.display = 'flex';
    }

    // Close all modals
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // Handle category form submission
    async handleCategorySubmit(e) {
        const form = e.target;
        const id = form.querySelector('#edit-category-id').value;
        const name = form.querySelector('#new-category-name').value.trim();
        const budgeted = parseFloat(form.querySelector('#category-budgeted').value) || 0;
        
        try {
            if (id) {
                // Update existing category
                await ynabBudget.updateCategory(id, { name, budgeted });
            } else {
                // Add new category
                await ynabBudget.addCategory(name, budgeted);
            }
            
            this.closeAllModals();
            this.loadBudgetData();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Failed to save category. Please try again.');
        }
    }

    // Handle budget form submission
    async handleBudgetSubmit(e) {
        const form = e.target;
        const monthlyBudget = parseFloat(form.querySelector('#set-monthly-budget').value) || 0;
        
        try {
            await ynabBudget.setMonthlyBudget(monthlyBudget);
            this.closeAllModals();
            this.loadBudgetData();
        } catch (error) {
            console.error('Error setting budget:', error);
            alert('Failed to set budget. Please try again.');
        }
    }

    // Handle goal form submission
    async handleGoalSubmit(e) {
        const form = e.target;
        const categoryId = form.querySelector('#goal-category-id').value;
        const targetAmount = parseFloat(form.querySelector('#goal-amount').value) || 0;
        const targetDate = form.querySelector('#goal-date').value;
        const description = form.querySelector('#goal-description').value.trim();
        
        try {
            await ynabBudget.addGoal(categoryId, targetAmount, targetDate, description);
            this.closeAllModals();
            this.loadBudgetData();
        } catch (error) {
            console.error('Error adding goal:', error);
            alert('Failed to add goal. Please try again.');
        }
    }

    // Delete a category
    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            return;
        }
        
        try {
            await ynabBudget.deleteCategory(categoryId);
            this.loadBudgetData();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Failed to delete category. Please try again.');
        }
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

// Initialize the budget controller when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the budget page
    if (document.getElementById('budget-view')) {
        window.budgetController = new BudgetController();
        
        // Initialize view navigation
        ViewLoader.initNavigation();
    }
});

// Export the BudgetController class for direct usage if needed
export default BudgetController;
