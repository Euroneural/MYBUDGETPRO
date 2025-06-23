import { auth } from './firebase-config.js';

class AuthManager {
    constructor() {
        this.user = null;
        this.ui = null;
        this.initAuthUI();
        this.setupAuthStateListener();
    }

    initAuthUI() {
        // FirebaseUI config
        const uiConfig = {
            signInSuccessUrl: '/', // Redirect after successful sign-in
            signInOptions: [
                firebase.auth.EmailAuthProvider.PROVIDER_ID,
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            ],
            tosUrl: '/terms',
            privacyPolicyUrl: '/privacy',
            signInFlow: 'popup',
        };

        // Initialize the FirebaseUI Widget
        this.ui = new firebaseui.auth.AuthUI(auth);
        
        // Show the sign-in UI if user is not signed in
        if (!this.user) {
            this.ui.start('#auth-container', uiConfig);
        }
    }

    setupAuthStateListener() {
        auth.onAuthStateChanged((user) => {
            this.user = user;
            const appContainer = document.querySelector('.app-container');
            const authContainer = document.getElementById('auth-container');
            
            if (user) {
                // User is signed in
                if (appContainer) appContainer.style.display = 'block';
                if (authContainer) authContainer.style.display = 'none';
                console.log('User signed in:', user.uid);
                // Initialize app with user data
                if (window.app) {
                    window.app.setUserId(user.uid);
                }
            } else {
                // User is signed out
                if (appContainer) appContainer.style.display = 'none';
                if (authContainer) authContainer.style.display = 'block';
                console.log('User signed out');
            }
        });
    }

    // Sign out method
    signOut() {
        return auth.signOut();
    }
}

// Initialize auth manager
const authManager = new AuthManager();
window.authManager = authManager;

export { authManager };
