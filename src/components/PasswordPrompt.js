export class PasswordPrompt {
    constructor() {
        this.modal = document.createElement('div');
        this.modal.id = 'password-prompt';
        this.modal.className = 'modal';
        this.modal.innerHTML = `
            <div class="modal__content">
                <div class="modal__header">
                    <h3>Secure Access Required</h3>
                </div>
                <div class="modal__body">
                    <p>Please enter your password to unlock your secure data.</p>
                    <div class="form-group">
                        <input type="password" id="password-input" class="form-control" placeholder="Enter your password" autocomplete="current-password">
                        <div class="form-text text-muted">This password is only used locally to encrypt your data.</div>
                    </div>
                    <div id="password-error" class="text-danger mt-2" style="display: none;">
                        Incorrect password. Please try again.
                    </div>
                </div>
                <div class="modal__actions">
                    <button id="unlock-btn" class="btn btn--primary">
                        <i class="fas fa-lock-open me-2"></i>Unlock
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        this.passwordInput = document.getElementById('password-input');
        this.unlockBtn = document.getElementById('unlock-btn');
        this.errorElement = document.getElementById('password-error');
        
        this.resolvePromise = null;
        this.rejectPromise = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.unlockBtn.addEventListener('click', () => this.handleUnlock());
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUnlock();
            }
        });
    }
    
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        this.passwordInput.classList.add('is-invalid');
    }
    
    hideError() {
        this.errorElement.style.display = 'none';
        this.passwordInput.classList.remove('is-invalid');
    }
    
    async handleUnlock() {
        const password = this.passwordInput.value.trim();
        if (!password) {
            this.showError('Please enter a password');
            return;
        }
        
        this.hideError();
        this.unlockBtn.disabled = true;
        this.unlockBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Unlocking...';
        
        try {
            if (this.resolvePromise) {
                this.resolvePromise(password);
            }
        } catch (error) {
            console.error('Error during unlock:', error);
            this.showError(error.message || 'An error occurred');
            this.unlockBtn.disabled = false;
            this.unlockBtn.innerHTML = '<i class="fas fa-lock-open me-2"></i>Unlock';
        }
    }
    
    prompt() {
        this.passwordInput.value = '';
        this.hideError();
        this.modal.style.display = 'flex';
        this.passwordInput.focus();
        
        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
        });
    }
    
    close() {
        this.modal.style.display = 'none';
        this.unlockBtn.disabled = false;
        this.unlockBtn.innerHTML = '<i class="fas fa-lock-open me-2"></i>Unlock';
    }
}

export default PasswordPrompt;
