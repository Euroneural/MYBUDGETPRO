import { localDB } from './local-db.js';
import { SearchManager } from './src/SearchManager.js';

class BudgetApp {
    constructor() {
        this.transactions = [];
        this.charts = {};
        this.budgetCategories = [];
        this.accounts = [];
        this.merchantCategories = {};
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.db = localDB;
        this.dbInitialized = false;
        this.unsubscribeCallbacks = [];
        this.pendingImport = [];
        
        // Initialize search manager
        this.searchManager = new SearchManager(this);
        
        // Initialize the app
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Initialize database
            await this.db.init();
            this.dbInitialized = true;
            
            // Load initial data
            await this.loadInitialData();
            
            // Set up event listeners
            this.bindEvents();
            
            // Render the current view
            this.renderCurrentView();
            
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    async loadInitialData() {
        // Load transactions, categories, accounts, etc.
        this.transactions = await this.db.getAllItems('transactions');
        this.budgetCategories = await this.db.getAllItems('categories');
        this.accounts = await this.db.getAllItems('accounts');
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.target.getAttribute('data-view');
                if (view) this.switchView(view);
            });
        });

        // Add other event bindings here
    }

    switchView(view) {
        if (view === this.currentView) return;
        
        // Update active state
        document.querySelectorAll('.nav__link').forEach(link => {
            link.classList.toggle('nav__link--active', link.getAttribute('data-view') === view);
        });
        
        // Hide all views
        document.querySelectorAll('.view').forEach(viewEl => {
            viewEl.classList.remove('view--active');
        });
        
        // Show selected view
        const targetView = document.getElementById(`${view}-view`);
        if (targetView) {
            targetView.classList.add('view--active');
            this.currentView = view;
            this.renderCurrentView();
        }
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'search':
                this.renderSearch();
                break;
            // Add other views as needed
        }
    }

    renderDashboard() {
        // Dashboard rendering logic
    }

    renderSearch() {
        // Search view is now handled by SearchManager
        if (this.searchManager) {
            this.searchManager.performSearch();
        }
    }

    // Add other methods as needed
    formatCurrency(amount) {
        if (amount === undefined || amount === null) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BudgetApp();
});
