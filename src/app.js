import { localDB } from './local-db.js';

class BudgetApp {
    constructor() {
        this.currentView = 'dashboard';
        this.initializeEventListeners();
        console.log('BudgetApp initialized');
    }

    initializeEventListeners() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Add Transaction button
        const addTransactionBtn = document.getElementById('add-transaction-btn');
        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => {
                this.showModal('add-transaction-modal');
            });
        }

        // Import CSV button
        const importCsvBtn = document.getElementById('csv-import-btn');
        if (importCsvBtn) {
            importCsvBtn.addEventListener('click', () => {
                this.showModal('csv-import-modal');
            });
        }

        // Close modal buttons
        const closeButtons = document.querySelectorAll('.modal__close');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = button.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }


    switchView(viewName) {
        console.log(`Switching to view: ${viewName}`);
        
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('view--active');
        });
        
        // Show the selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('view--active');
        } else {
            console.warn(`View '${viewName}' not found`);
            // Fallback to dashboard if view not found
            const dashboardView = document.getElementById('dashboard-view');
            if (dashboardView) {
                dashboardView.classList.add('view--active');
                viewName = 'dashboard';
            }
        }
        
        // Update active nav link
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(link => {
            const linkView = link.getAttribute('data-view');
            if (linkView === viewName) {
                link.classList.add('nav__link--active');
            } else {
                link.classList.remove('nav__link--active');
            }
        });
        
        this.currentView = viewName;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Re-enable scrolling
        }
    }
}

// Export the BudgetApp class for use in other modules
export { BudgetApp };

// Initialize the app when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new BudgetApp();
    });
} else {
    window.app = new BudgetApp();
}
