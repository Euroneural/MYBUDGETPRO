/**
 * Performance monitoring for Budget Pro
 * Tracks various performance metrics and reports them
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.analytics = window.analytics;
    this.init();
  }

  init() {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Wait for the page to fully load
    if (document.readyState === 'complete') {
      this.setupPerformanceMonitoring();
    } else {
      window.addEventListener('load', () => this.setupPerformanceMonitoring());
    }
  }

  setupPerformanceMonitoring() {
    // Check if the Performance API is available
    if (!window.performance || !window.performance.timing) {
      console.warn('Performance timing API not supported');
      return;
    }

    // Set up performance observers
    this.setupPerformanceObservers();

    // Capture initial metrics
    this.captureInitialMetrics();

    // Set up long task monitoring
    this.setupLongTaskMonitoring();

    // Monitor memory usage if available
    if (window.performance.memory) {
      this.monitorMemoryUsage();
    }
  }

  setupPerformanceObservers() {
    // Observe navigation and resource timing
    if ('PerformanceObserver' in window) {
      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.handleNavigationTiming(entry);
        });
      });
      navigationObserver.observe({ type: 'navigation', buffered: true });

      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.handleResourceTiming(entry);
        });
      });
      resourceObserver.observe({ type: 'resource', buffered: true });
    }
  }

  captureInitialMetrics() {
    const timing = window.performance.timing;
    const now = new Date().getTime();

    // Calculate core web vitals and other important metrics
    const metrics = {
      // Navigation timing
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      ttfb: timing.responseStart - timing.requestStart,
      // ... other metrics
    };

    // Store and report metrics
    this.metrics = { ...this.metrics, ...metrics };
    this.reportMetrics('initial_load', metrics);
  }

  setupLongTaskMonitoring() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 100) { // Tasks longer than 100ms
            this.handleLongTask(entry);
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  monitorMemoryUsage() {
    // Monitor memory usage if the API is available
    if ('memory' in window.performance) {
      setInterval(() => {
        const memory = window.performance.memory;
        this.reportMetrics('memory_usage', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }, 60000); // Check every minute
    }
  }

  handleNavigationTiming(entry) {
    const metrics = {
      navigation_type: entry.type,
      dom_complete: entry.domComplete,
      dom_interactive: entry.domInteractive,
      load_event_end: entry.loadEventEnd,
      dom_content_loaded: entry.domContentLoadedEventEnd - entry.fetchStart,
      page_load_time: entry.loadEventEnd - entry.fetchStart,
    };

    this.metrics = { ...this.metrics, ...metrics };
    this.reportMetrics('navigation_timing', metrics);
  }

  handleResourceTiming(entry) {
    const resourceType = entry.initiatorType || 'other';
    const metrics = {
      [`${resourceType}_count`]: (this.metrics[`${resourceType}_count`] || 0) + 1,
      [`${resourceType}_size`]: (this.metrics[`${resourceType}_size`] || 0) + entry.transferSize,
      [`${resourceType}_duration`]: (this.metrics[`${resourceType}_duration`] || 0) + entry.duration,
    };

    this.metrics = { ...this.metrics, ...metrics };
    
    // Report slow resources
    if (entry.duration > 1000) { // Resources taking longer than 1s
      this.reportMetrics('slow_resource', {
        name: entry.name,
        type: resourceType,
        duration: entry.duration,
        size: entry.transferSize,
      });
    }
  }

  handleLongTask(entry) {
    this.reportMetrics('long_task', {
      duration: entry.duration,
      start_time: entry.startTime,
      name: entry.name || 'unknown',
    });
  }

  reportMetrics(metricType, data) {
    if (this.analytics) {
      this.analytics.trackEvent(`perf_${metricType}`, data);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metricType}:`, data);
    }
  }

  // Public API
  mark(name) {
    if (window.performance && window.performance.mark) {
      window.performance.mark(name);
    }
  }

  measure(name, startMark, endMark) {
    if (window.performance && window.performance.measure) {
      try {
        window.performance.measure(name, startMark, endMark);
        const measures = window.performance.getEntriesByName(name);
        const duration = measures[measures.length - 1]?.duration;
        
        if (duration) {
          this.reportMetrics('custom_measure', {
            name,
            duration,
            start_mark: startMark,
            end_mark: endMark
          });
        }
        
        return duration;
      } catch (e) {
        console.error('Performance measurement failed:', e);
      }
    }
    return null;
  }

  getNavigationTiming() {
    if (!window.performance || !window.performance.timing) return null;
    
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;
    
    return {
      // Navigation timing
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      ttfb: timing.responseStart - timing.requestStart,
      
      // Page load timing
      dom_loading: timing.domLoading - navigationStart,
      dom_interactive: timing.domInteractive - navigationStart,
      dom_content_loaded: timing.domContentLoadedEventStart - navigationStart,
      dom_complete: timing.domComplete - navigationStart,
      load_event: timing.loadEventEnd - navigationStart,
      
      // Other metrics
      first_paint: this.getFirstPaint(),
      first_contentful_paint: this.getFirstContentfulPaint(),
      largest_contentful_paint: this.getLargestContentfulPaint(),
      cumulative_layout_shift: this.getCumulativeLayoutShift(),
      first_input_delay: this.getFirstInputDelay(),
    };
  }

  // Core Web Vitals helpers
  getFirstPaint() {
    const entries = window.performance.getEntriesByType('paint');
    const firstPaint = entries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  getFirstContentfulPaint() {
    const entries = window.performance.getEntriesByType('paint');
    const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
  }

  getLargestContentfulPaint() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        this.reportMetrics('largest_contentful_paint', {
          value: lcp.renderTime || lcp.loadTime,
          element: lcp.element?.tagName || 'unknown',
          size: lcp.size,
          id: lcp.id || 'unknown',
          url: lcp.url || 'unknown'
        });
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    }
    return null;
  }

  getCumulativeLayoutShift() {
    if ('PerformanceObserver' in window) {
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
        this.reportMetrics('cumulative_layout_shift', { value: cls });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      return cls;
    }
    return 0;
  }

  getFirstInputDelay() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const delay = entry.processingStart - entry.startTime;
          this.reportMetrics('first_input_delay', {
            value: delay,
            name: entry.name,
            start_time: entry.startTime,
            processing_start: entry.processingStart,
            processing_end: entry.processingEnd,
            cancelable: entry.cancelable
          });
          break; // Only report the first input delay
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
    }
    return null;
  }
}

// Initialize performance monitoring when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.performanceMonitor = new PerformanceMonitor();
});

// Export for module usage
export default PerformanceMonitor;
