// Service worker registration is temporarily disabled for debugging
console.log('Service worker registration is currently disabled for debugging');

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister().then(() => {
        console.log('Unregistered service worker:', registration.scope);
      });
    }
  });
}

// Listen for offline/online status
function updateOnlineStatus() {
  if (!navigator.onLine) {
    console.log('You are now offline');
    // You could show a notification to the user here
  } else {
    console.log('You are now online');
    // Check for updates when coming back online
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'ONLINE' });
    }
  }

  // Listen for online/offline events
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
}
