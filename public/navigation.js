/**
 * Navigation Manager for Budget Pro
 * Handles navigation between different views in the application
 */

// Create a global navigation manager if it doesn't exist
if (typeof window.NavigationManager === 'undefined') {
  class NavigationManager {
    constructor() {
        this.currentView = 'dashboard';
        this.views = ['dashboard', 'budget', 'transactions', 'calendar', 'analytics', 'search'];
        this.initialized = false;
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        // Set up navigation links
        this.setupNavigationLinks();
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view) {
                this.navigateTo(event.state.view, false);
            }
        });
        
        // Initialize the current view from the URL
        this.initializeFromUrl();
        
        this.initialized = true;
    }

    setupNavigationLinks() {
        // Add click event listeners to all navigation links
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                if (view) {
                    this.navigateTo(view);
                }
            });
        });
    }

    initializeFromUrl() {
        // Get the view from the URL hash or default to dashboard
        const hash = window.location.hash.substring(1);
        const view = this.views.includes(hash) ? hash : 'dashboard';
        
        // Navigate to the view without adding to history
        this.navigateTo(view, false);
    }

    navigateTo(view, updateHistory = true) {
        // Validate the view
        if (!this.views.includes(view)) {
            console.warn(`Invalid view: ${view}`);
            return;
        }

        // Update the current view
        this.currentView = view;

        // Update active state of navigation links
        document.querySelectorAll('.nav__link').forEach(link => {
            const linkView = link.getAttribute('data-view');
            if (linkView === view) {
                link.classList.add('nav__link--active');
            } else {
                link.classList.remove('nav__link--active');
            }
        });

        // Show/hide views
        document.querySelectorAll('.view').forEach(viewEl => {
            viewEl.classList.remove('view--active');
        });

        const activeView = document.getElementById(`${view}-view`);
        if (activeView) {
            activeView.classList.add('view--active');
        }

        // Update URL and history
        if (updateHistory) {
            window.history.pushState({ view }, '', `#${view}`);
        }

        // Trigger any view-specific initialization
        this.initializeView(view);

        // Dispatch a custom event for other components to listen to
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: { view } }));
    }

    initializeView(view) {
        // Initialize any view-specific functionality
        switch (view) {
            case 'dashboard':
                this.initializeDashboard();
                break;
            case 'budget':
                this.initializeBudget();
                break;
            case 'transactions':
                this.initializeTransactions();
                break;
            case 'calendar':
                this.initializeCalendar();
                break;
            case 'analytics':
                this.initializeAnalytics();
                break;
            case 'search':
                this.initializeSearch();
                break;
        }
    }

    // View initialization methods
    initializeDashboard() {
        console.log('Initializing dashboard view');
        // Add any dashboard-specific initialization here
        if (window.app && typeof window.app.renderDashboard === 'function') {
            window.app.renderDashboard();
        }
    }

    initializeBudget() {
        console.log('Initializing budget view');
        // Add any budget-specific initialization here
        if (window.app && typeof window.app.renderBudget === 'function') {
            window.app.renderBudget();
        }
    }

    initializeTransactions() {
        console.log('Initializing transactions view');
        // Add any transactions-specific initialization here
        if (window.app && typeof window.app.renderTransactions === 'function') {
            window.app.renderTransactions();
        }
    }

    initializeCalendar() {
        console.log('Initializing calendar view');
        // Add any calendar-specific initialization here
        if (window.app && typeof window.app.renderCalendar === 'function') {
            const today = new Date();
            window.app.renderCalendar(today);
        }
    }

    initializeAnalytics() {
        console.log('Initializing analytics view');
        // Add any analytics-specific initialization here
    }

    initializeSearch() {
        console.log('Initializing search view');
        // Add any search-specific initialization here
    }
}

  // Export the class
  window.NavigationManager = NavigationManager;
}

// Self-executing function to handle initialization
(function() {
  // Create a single instance if it doesn't exist
  if (!window.navigationManager && window.NavigationManager) {
    window.navigationManager = new window.NavigationManager();
    
    // Add global navigation function
    window.navigateTo = function(view) {
      if (window.navigationManager && typeof window.navigationManager.navigateTo === 'function') {
        window.navigationManager.navigateTo(view);
      } else {
        console.error('Navigation manager not properly initialized');
      }
    };
    
    // Initialize the navigation manager
    if (window.navigationManager.init) {
      try {
        window.navigationManager.init();
        console.log('Navigation manager initialized successfully');
      } catch (e) {
        console.error('Error initializing navigation manager:', e);
      }
    } else {
      console.warn('Navigation manager does not have an init method');
    }
  } else if (!window.NavigationManager) {
    console.error('NavigationManager class not found');
  } else if (window.navigationManager) {
    console.log('Navigation manager already initialized');
  }
})();

// Export for module usage
export default window.NavigationManager || {};
