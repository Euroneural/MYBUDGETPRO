/**
 * Global Error Handler for Budget Pro
 * Captures and reports client-side errors
 */

class ErrorHandler {
  constructor() {
    this.analytics = window.analytics;
    this.ignoredErrors = [
      // Add error messages to ignore (e.g., third-party scripts)
      'Script error',
      'ResizeObserver loop limit exceeded',
    ];
    
    this.init();
  }

  init() {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Set up global error handlers
    this.setupErrorHandlers();
    
    // Set up unhandled promise rejection handler
    this.setupPromiseRejectionHandler();
    
    // Set up console error monitoring
    this.setupConsoleErrorMonitoring();
    
    // Set up network error monitoring
    this.setupNetworkErrorMonitoring();
  }

  setupErrorHandlers() {
    // Window error handler
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'window_error'
      });
      // Prevent the default error handler
      return true;
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason || 'Unknown error in promise';
      this.handleError({
        message: error.message || String(error),
        stack: error.stack,
        type: 'unhandled_rejection',
        reason: error
      });
    });
  }

  setupPromiseRejectionHandler() {
    // Handle unhandled promise rejections for older browsers
    if (window.onunhandledrejection === undefined) {
      const originalThen = Promise.prototype.then;
      Promise.prototype.then = function(onFulfilled, onRejected) {
        // If no rejection handler is provided, add a default one
        if (typeof onRejected !== 'function') {
          onRejected = function(reason) {
            console.error('Unhandled Promise rejection:', reason);
            return Promise.reject(reason);
          };
        }
        return originalThen.call(this, onFulfilled, onRejected);
      };
    }
  }

  setupConsoleErrorMonitoring() {
    // Override console.error to capture errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call the original console.error
      originalConsoleError.apply(console, args);
      
      // Extract error details
      let message = '';
      let stack = '';
      
      args.forEach(arg => {
        if (arg instanceof Error) {
          message = arg.message;
          stack = arg.stack;
        } else if (typeof arg === 'string') {
          message += arg + ' ';
        }
      });
      
      if (message.trim()) {
        this.handleError({
          message: message.trim(),
          stack: stack,
          type: 'console_error',
          args: args
        });
      }
    };
  }

  setupNetworkErrorMonitoring() {
    // Listen for failed resource loads
    window.addEventListener('error', (event) => {
      const target = event.target;
      
      // Skip if not a resource loading error
      if (target === window) return;
      
      const elementType = target.tagName.toLowerCase();
      let resourceType = 'resource';
      let resourceUrl = '';
      
      switch (elementType) {
        case 'img':
        case 'image':
          resourceType = 'image';
          resourceUrl = target.src || '';
          break;
        case 'script':
          resourceType = 'script';
          resourceUrl = target.src || '';
          break;
        case 'link':
          resourceType = 'stylesheet';
          resourceUrl = target.href || '';
          break;
        default:
          resourceType = elementType;
      }
      
      this.handleError({
        message: `Failed to load ${resourceType}: ${resourceUrl}`,
        type: 'resource_error',
        resourceType,
        resourceUrl,
        element: elementType
      });
    }, true); // Use capture phase to catch more errors
  }

  handleError(errorInfo) {
    // Skip ignored errors
    if (this.shouldIgnoreError(errorInfo)) {
      return;
    }
    
    // Normalize error info
    const normalizedError = this.normalizeError(errorInfo);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorHandler]', normalizedError);
    }
    
    // Report to analytics
    this.reportError(normalizedError);
    
    // Show user-friendly error message if needed
    this.showUserError(normalizedError);
  }

  shouldIgnoreError(errorInfo) {
    // Check if this error should be ignored
    return this.ignoredErrors.some(ignoredError => 
      errorInfo.message && errorInfo.message.includes(ignoredError)
    );
  }

  normalizeError(errorInfo) {
    const { message, type, error, ...rest } = errorInfo;
    const normalized = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      type: type || 'unknown',
      message: message || 'Unknown error',
      ...rest
    };
    
    // Extract stack trace if available
    if (error && error.stack) {
      normalized.stack = error.stack;
    } else if (errorInfo.stack) {
      normalized.stack = errorInfo.stack;
    }
    
    // Add more context based on error type
    if (type === 'resource_error') {
      normalized.context = {
        resourceType: errorInfo.resourceType,
        resourceUrl: errorInfo.resourceUrl,
        element: errorInfo.element
      };
    } else if (type === 'unhandled_rejection') {
      normalized.context = {
        reason: errorInfo.reason,
        stack: errorInfo.stack
      };
    }
    
    return normalized;
  }

  reportError(errorInfo) {
    // Report to analytics if available
    if (this.analytics) {
      this.analytics.trackEvent('error_occurred', {
        error_type: errorInfo.type,
        error_message: errorInfo.message,
        error_stack: errorInfo.stack,
        url: errorInfo.url,
        timestamp: errorInfo.timestamp
      });
    }
    
    // In a real app, you would also send this to your error tracking service
    // Example: this.sendToErrorTrackingService(errorInfo);
  }

  showUserError(errorInfo) {
    // Only show user-facing errors for certain error types
    const userFacingErrors = ['network_error', 'api_error', 'validation_error'];
    if (!userFacingErrors.includes(errorInfo.type)) {
      return;
    }
    
    // Create or update error notification
    const notification = this.createErrorNotification(errorInfo);
    document.body.appendChild(notification);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      notification.remove();
    }, 10000);
  }

  createErrorNotification(errorInfo) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    
    // Customize message based on error type
    let message = 'An error occurred';
    if (errorInfo.type === 'network_error') {
      message = 'Unable to connect to the server. Please check your internet connection.';
    } else if (errorInfo.type === 'validation_error') {
      message = 'Please check your input and try again.';
    } else if (errorInfo.message) {
      message = errorInfo.message;
    }
    
    notification.innerHTML = `
      <div class="error-notification-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button class="error-dismiss" aria-label="Dismiss error">×</button>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .error-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 12px 20px;
        max-width: 350px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .error-notification-content {
        display: flex;
        align-items: center;
      }
      .error-icon {
        margin-right: 10px;
        font-size: 1.2em;
      }
      .error-message {
        flex-grow: 1;
      }
      .error-dismiss {
        background: none;
        border: none;
        font-size: 1.5em;
        color: inherit;
        cursor: pointer;
        margin-left: 10px;
        padding: 0 5px;
        line-height: 1;
      }
      .error-dismiss:hover {
        opacity: 0.8;
      }
    `;
    
    // Add dismiss button handler
    const dismissBtn = notification.querySelector('.error-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        notification.remove();
      });
    }
    
    // Add styles to the document
    if (!document.getElementById('error-notification-styles')) {
      style.id = 'error-notification-styles';
      document.head.appendChild(style);
    }
    
    return notification;
  }
  
  // Public API
  captureException(error, context = {}) {
    const errorInfo = {
      ...context,
      message: error.message || String(error),
      stack: error.stack,
      type: 'captured_exception',
      error: error
    };
    this.handleError(errorInfo);
  }
  
  captureMessage(message, level = 'error', context = {}) {
    this.handleError({
      ...context,
      message,
      type: 'captured_message',
      level
    });
  }
}

// Initialize error handler when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.errorHandler = new ErrorHandler();
  
  // Add global error handler for uncaught exceptions
  if (window.onerror === null) {
    window.onerror = (message, source, lineno, colno, error) => {
      window.errorHandler.handleError({
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        error: error,
        type: 'uncaught_exception'
      });
      return true; // Prevent default error handler
    };
  }
});

// Export for module usage
export default ErrorHandler;
