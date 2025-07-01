/**
 * Utility for loading and managing view templates
 */

export class ViewLoader {
    /**
     * Load a view template into the specified container
     * @param {string} viewId - The ID of the view container
     * @param {string} templateUrl - The URL of the template to load
     * @returns {Promise<void>}
     */
    static async loadView(viewId, templateUrl) {
        try {
            const response = await fetch(templateUrl);
            if (!response.ok) {
                throw new Error(`Failed to load view: ${response.statusText}`);
            }
            
            const html = await response.text();
            const container = document.getElementById(viewId);
            if (container) {
                container.innerHTML = html;
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error loading view ${viewId}:`, error);
            return false;
        }
    }

    /**
     * Show a specific view and hide all others
     * @param {string} viewId - The ID of the view to show
     */
    static showView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });

        // Show the requested view
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.style.display = 'block';
            
            // Dispatch a custom event when a view is shown
            const event = new CustomEvent('viewChanged', {
                detail: { viewId }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Initialize view navigation
     */
    static initNavigation() {
        // Handle navigation links
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('[data-view]');
            if (navLink) {
                e.preventDefault();
                const viewKey = navLink.getAttribute('data-view');
                const viewId = `${viewKey}-view`;
                this.showView(viewId);

                // Update the URL hash without triggering a page reload
                if (window.location.hash !== `#${viewKey}`) {
                    history.pushState({}, '', `#${viewKey}`);
                }
                
                // Update active state
                document.querySelectorAll('.nav__link').forEach(link => {
                    link.classList.remove('nav__link--active');
                });
                navLink.classList.add('nav__link--active');
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            const viewId = window.location.hash.replace('#', '') + '-view';
            this.showView(viewId);
        });

        // Show initial view based on URL hash
        const initialViewId = (window.location.hash || '#dashboard').replace('#', '') + '-view';
        this.showView(initialViewId);
    }
}
