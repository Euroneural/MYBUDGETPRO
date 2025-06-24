/**
 * Notification System for Budget Pro
 * Handles displaying notifications to the user
 */

class NotificationSystem {
  constructor() {
    this.notificationContainer = null;
    this.notificationQueue = [];
    this.isShowing = false;
    this.init();
  }

  init() {
    // Create notification container if it doesn't exist
    this.createNotificationContainer();
    
    // Listen for custom notification events
    document.addEventListener('showNotification', (event) => {
      const { type, message, duration, action } = event.detail || {};
      this.show({
        type,
        message,
        duration,
        action
      });
    });
  }


  createNotificationContainer() {
    // Check if container already exists
    this.notificationContainer = document.getElementById('notification-container');
    
    if (!this.notificationContainer) {
      // Create container
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.id = 'notification-container';
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        #notification-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 350px;
          width: 100%;
          pointer-events: none;
        }
        
        .notification {
          position: relative;
          padding: 15px 20px;
          border-radius: 6px;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          transform: translateX(100%);
          transition: opacity 0.3s, transform 0.3s;
          pointer-events: auto;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .notification.show {
          opacity: 1;
          transform: translateX(0);
        }
        
        .notification.hide {
          opacity: 0;
          transform: translateX(100%);
        }
        
        .notification-icon {
          font-size: 20px;
          line-height: 1;
          margin-top: 2px;
          flex-shrink: 0;
        }
        
        .notification-content {
          flex-grow: 1;
        }
        
        .notification-title {
          font-weight: 600;
          margin: 0 0 4px 0;
          font-size: 15px;
        }
        
        .notification-message {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
          color: #333;
        }
        
        .notification-close {
          background: none;
          border: none;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          margin-left: 10px;
          color: #999;
          transition: color 0.2s;
        }
        
        .notification-close:hover {
          color: #666;
        }
        
        .notification-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(0, 0, 0, 0.1);
          width: 100%;
          overflow: hidden;
          border-radius: 0 0 6px 6px;
        }
        
        .notification-progress-bar {
          height: 100%;
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          transform-origin: left;
          transform: scaleX(1);
          transition: transform linear;
        }
        
        /* Notification Types */
        .notification-type-info {
          border-left: 4px solid #4a6cf7;
        }
        
        .notification-type-success {
          border-left: 4px solid #28a745;
        }
        
        .notification-type-warning {
          border-left: 4px solid #ffc107;
        }
        
        .notification-type-error {
          border-left: 4px solid #dc3545;
        }
        
        .notification-action {
          margin-top: 8px;
          display: inline-block;
          padding: 4px 12px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
          color: #4a6cf7;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .notification-action:hover {
          background: rgba(0, 0, 0, 0.1);
          text-decoration: none;
        }
        
        @media (max-width: 480px) {
          #notification-container {
            left: 10px;
            right: 10px;
            top: 10px;
            max-width: none;
          }
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(this.notificationContainer);
    }
  }

  /**
   * Show a notification
   * @param {Object} options - Notification options
   * @param {string} options.type - Type of notification (info, success, warning, error)
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {number} [options.duration=5000] - Duration in milliseconds (0 for no auto-dismiss)
   * @param {Object} [options.action] - Action button configuration
   * @param {string} options.action.text - Action button text
   * @param {Function} options.action.handler - Action button click handler
   */
  show({ type = 'info', title, message, duration = 5000, action = null }) {
    // Add to queue
    const notification = { type, title, message, duration, action };
    this.notificationQueue.push(notification);
    
    // Process queue if not already showing a notification
    if (!this.isShowing) {
      this.processQueue();
    }
  }

  processQueue() {
    if (this.notificationQueue.length === 0) {
      this.isShowing = false;
      return;
    }
    
    this.isShowing = true;
    const notification = this.notificationQueue.shift();
    this.displayNotification(notification);
  }

  displayNotification({ type, title, message, duration, action }) {
    // Create notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification notification-type-${type}`;
    
    // Set icon based on type
    let icon = 'ℹ️';
    switch (type) {
      case 'success':
        icon = '✅';
        break;
      case 'warning':
        icon = '⚠️';
        break;
      case 'error':
        icon = '❌';
        break;
    }
    
    // Create notification content
    notificationEl.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        ${title ? `<div class="notification-title">${title}</div>` : ''}
        <div class="notification-message">${message}</div>
        ${action ? `<a href="#" class="notification-action" data-action>${action.text}</a>` : ''}
      </div>
      <button class="notification-close" aria-label="Close">&times;</button>
      ${duration > 0 ? `
        <div class="notification-progress">
          <div class="notification-progress-bar" style="transition-duration: ${duration}ms"></div>
        </div>
      ` : ''}
    `;
    
    // Add to container
    this.notificationContainer.appendChild(notificationEl);
    
    // Force reflow to enable animation
    void notificationEl.offsetWidth;
    
    // Show notification
    notificationEl.classList.add('show');
    
    // Start progress bar animation if duration is set
    if (duration > 0) {
      const progressBar = notificationEl.querySelector('.notification-progress-bar');
      if (progressBar) {
        // Trigger the animation
        setTimeout(() => {
          progressBar.style.transform = 'scaleX(0)';
        }, 10);
      }
      
      // Auto-dismiss after duration
      this.autoDismissTimers.push(setTimeout(() => {
        this.dismissNotification(notificationEl);
      }, duration));
    }
    
    // Add close button handler
    const closeBtn = notificationEl.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.dismissNotification(notificationEl);
      });
    }
    
    // Add action handler
    if (action && action.handler) {
      const actionBtn = notificationEl.querySelector('[data-action]');
      if (actionBtn) {
        actionBtn.addEventListener('click', (e) => {
          e.preventDefault();
          action.handler();
          this.dismissNotification(notificationEl);
        });
      }
    }
    
    // Add to active notifications
    this.activeNotifications.add(notificationEl);
  }

  dismissNotification(notificationEl) {
    if (!notificationEl || !this.activeNotifications.has(notificationEl)) return;
    
    // Hide with animation
    notificationEl.classList.remove('show');
    notificationEl.classList.add('hide');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (notificationEl.parentNode) {
        notificationEl.parentNode.removeChild(notificationEl);
      }
      this.activeNotifications.delete(notificationEl);
      
      // Process next in queue
      this.processQueue();
    }, 300); // Match this with CSS transition duration
  }
  
  // Auto-dismiss timers
  autoDismissTimers = [];
  
  // Active notifications
  activeNotifications = new Set();
  
  // Convenience methods
  info(message, options = {}) {
    this.show({ type: 'info', message, ...options });
  }
  
  success(message, options = {}) {
    this.show({ type: 'success', message, ...options });
  }
  
  warning(message, options = {}) {
    this.show({ type: 'warning', message, ...options });
  }
  
  error(message, options = {}) {
    this.show({ type: 'error', message, ...options });
  }
  
  // Clear all notifications
  clearAll() {
    // Clear all timers
    this.autoDismissTimers.forEach(timer => clearTimeout(timer));
    this.autoDismissTimers = [];
    
    // Dismiss all active notifications
    this.activeNotifications.forEach(notification => {
      this.dismissNotification(notification);
    });
    
    // Clear queue
    this.notificationQueue = [];
    this.isShowing = false;
  }
}

// Initialize notification system when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.notifications = new NotificationSystem();
  
  // Expose global notification methods for easier access
  window.showNotification = (options) => {
    const event = new CustomEvent('showNotification', { detail: options });
    document.dispatchEvent(event);
  };
  
  // Convenience methods
  window.notify = {
    info: (message, options) => window.notifications.info(message, options),
    success: (message, options) => window.notifications.success(message, options),
    warning: (message, options) => window.notifications.warning(message, options),
    error: (message, options) => window.notifications.error(message, options),
    clearAll: () => window.notifications.clearAll()
  };
});

// Export for module usage
export default NotificationSystem;
