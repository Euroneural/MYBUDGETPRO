/**
 * Offline functionality for Budget Pro
 * Handles offline state detection and provides a seamless offline experience
 */

class OfflineManager {
  constructor() {
    this.offlineBanner = null;
    this.init();
  }

  init() {
    this.createOfflineBanner();
    this.setupEventListeners();
    this.checkConnection();
  }

  createOfflineBanner() {
    // Create the offline banner element
    this.offlineBanner = document.createElement('div');
    this.offlineBanner.id = 'offline-banner';
    this.offlineBanner.className = 'offline-banner hidden';
    this.offlineBanner.innerHTML = `
      <div class="offline-content">
        <span class="offline-icon">📶</span>
        <span class="offline-message">You are currently offline. Some features may be limited.</span>
        <button class="offline-dismiss" aria-label="Dismiss">×</button>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .offline-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: #fff3cd;
        color: #856404;
        padding: 12px 20px;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transition: transform 0.3s ease-in-out;
      }
      .offline-banner.hidden {
        transform: translateY(100%);
      }
      .offline-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .offline-icon {
        margin-right: 10px;
        font-size: 1.2em;
      }
      .offline-message {
        flex-grow: 1;
      }
      .offline-dismiss {
        background: none;
        border: none;
        font-size: 1.5em;
        color: inherit;
        cursor: pointer;
        padding: 0 10px;
        line-height: 1;
      }
      @media (max-width: 600px) {
        .offline-content {
          flex-direction: column;
          text-align: center;
        }
        .offline-icon {
          margin-bottom: 5px;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.offlineBanner);
  }

  setupEventListeners() {
    // Online/offline events
    window.addEventListener('online', () => this.handleConnectionChange(true));
    window.addEventListener('offline', () => this.handleConnectionChange(false));
    
    // Dismiss button
    const dismissBtn = this.offlineBanner.querySelector('.offline-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.offlineBanner.classList.add('hidden');
      });
    }
  }

  checkConnection() {
    this.handleConnectionChange(navigator.onLine);
  }

  handleConnectionChange(isOnline) {
    if (!isOnline) {
      this.showOfflineBanner();
      this.queueFailedRequests();
    } else {
      this.hideOfflineBanner();
      this.retryFailedRequests();
    }
  }

  showOfflineBanner() {
    this.offlineBanner.classList.remove('hidden');
  }

  hideOfflineBanner() {
    this.offlineBanner.classList.add('hidden');
  }

  queueFailedRequests() {
    // Store failed requests for retry when back online
    // This is a simplified example - in a real app, you'd want to use a more robust solution
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register('failed-requests');
      });
    }
  }

  retryFailedRequests() {
    // Retry any queued requests
    // This would be implemented based on your specific needs
    console.log('Retrying any failed requests...');
  }
}

// Initialize the offline manager when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.offlineManager = new OfflineManager();
});

// Export for module usage
export default OfflineManager;
