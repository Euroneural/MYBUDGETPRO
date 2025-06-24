/**
 * Analytics for Budget Pro
 * Handles tracking of user interactions and app usage
 */

class AnalyticsManager {
  constructor() {
    this.analyticsEnabled = true;
    this.offlineQueue = [];
    this.analyticsEndpoint = '/api/analytics';
    this.init();
  }

  init() {
    // Check if analytics should be enabled (respect user preferences)
    const analyticsConsent = localStorage.getItem('analyticsConsent');
    this.analyticsEnabled = analyticsConsent !== 'false';
    
    // Set up offline detection
    this.setupOfflineHandling();
    
    // Track page view
    this.trackPageView();
    
    // Listen for offline/online events
    window.addEventListener('online', () => this.processOfflineQueue());
  }

  setupOfflineHandling() {
    // Use IndexedDB to store events when offline
    if (!('indexedDB' in window)) return;
    
    const request = indexedDB.open('AnalyticsDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('analyticsEvents')) {
        db.createObjectStore('analyticsEvents', { keyPath: 'id', autoIncrement: true });
      }
    };
  }

  async trackEvent(eventName, eventData = {}) {
    if (!this.analyticsEnabled) return;
    
    const event = {
      name: eventName,
      data: eventData,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      url: window.location.href,
    };
    
    if (!navigator.onLine) {
      await this.queueEvent(event);
      return;
    }
    
    this.sendEvent(event);
  }

  async trackPageView() {
    this.trackEvent('page_view', {
      page_title: document.title,
      page_path: window.location.pathname,
      page_location: window.location.href,
    });
  }

  async trackButtonClick(buttonId, buttonText = '') {
    this.trackEvent('button_click', {
      button_id: buttonId,
      button_text: buttonText,
      page: window.location.pathname,
    });
  }

  async trackFormSubmission(formId, formData = {}) {
    this.trackEvent('form_submit', {
      form_id: formId,
      form_data: formData,
      page: window.location.pathname,
    });
  }

  async queueEvent(event) {
    if (!('indexedDB' in window)) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AnalyticsDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['analyticsEvents'], 'readwrite');
        const store = transaction.objectStore('analyticsEvents');
        
        const addRequest = store.add(event);
        
        addRequest.onsuccess = () => {
          console.log('Event queued for later sending');
          resolve();
        };
        
        addRequest.onerror = (error) => {
          console.error('Error queuing event:', error);
          reject(error);
        };
      };
      
      request.onerror = (error) => {
        console.error('Error opening IndexedDB:', error);
        reject(error);
      };
    });
  }

  async processOfflineQueue() {
    if (!('indexedDB' in window)) return;
    
    const request = indexedDB.open('AnalyticsDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['analyticsEvents'], 'readwrite');
      const store = transaction.objectStore('analyticsEvents');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const events = getAllRequest.result;
        
        // Process each event
        for (const event of events) {
          try {
            await this.sendEvent(event);
            // If successful, remove from queue
            const deleteRequest = store.delete(event.id);
            deleteRequest.onsuccess = () => {
              console.log(`Processed queued event: ${event.name}`);
            };
          } catch (error) {
            console.error('Error processing queued event:', error);
            // Stop processing if we encounter an error (e.g., went back offline)
            break;
          }
        }
      };
    };
  }

  async sendEvent(event) {
    return new Promise((resolve, reject) => {
      if (!navigator.onLine) {
        this.queueEvent(event);
        return resolve();
      }
      
      // In a real app, you would send this to your analytics endpoint
      console.log('Sending analytics event:', event);
      
      // Simulate API call
      fetch(this.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log('Analytics event sent successfully:', data);
        resolve(data);
      })
      .catch(error => {
        console.error('Error sending analytics event:', error);
        this.queueEvent(event);
        reject(error);
      });
    });
  }

  // User consent methods
  enableAnalytics() {
    this.analyticsEnabled = true;
    localStorage.setItem('analyticsConsent', 'true');
    this.processOfflineQueue(); // Process any queued events
  }

  disableAnalytics() {
    this.analyticsEnabled = false;
    localStorage.setItem('analyticsConsent', 'false');
    // Optionally clear any queued events
    if ('indexedDB' in window) {
      const request = indexedDB.deleteDatabase('AnalyticsDB');
      request.onsuccess = () => console.log('Analytics database deleted');
    }
  }
}

// Initialize analytics when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.analytics = new AnalyticsManager();
  
  // Example: Track button clicks
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button, [role="button"], [data-track]');
    if (button) {
      const buttonId = button.id || button.getAttribute('data-track-id') || 'unknown';
      const buttonText = button.textContent.trim();
      window.analytics.trackButtonClick(buttonId, buttonText);
    }
  });
  
  // Example: Track form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.tagName === 'FORM') {
      const formId = form.id || 'unknown-form';
      const formData = {};
      
      // Collect form data (simplified)
      Array.from(form.elements).forEach(element => {
        if (element.name) {
          formData[element.name] = element.value;
        }
      });
      
      window.analytics.trackFormSubmission(formId, formData);
    }
  });
});

// Export for module usage
export default AnalyticsManager;
