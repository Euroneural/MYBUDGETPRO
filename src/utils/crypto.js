// Encryption utilities using Web Crypto API
class SecureStorage {
    constructor() {
        this.key = null;
        this.initialized = false;
    }

    // Initialize with a password
    async initialize(password) {
        try {
            // Import password as a key
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            // Create a key from the password
            const importedKey = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            // Derive a secure key using PBKDF2
            this.key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new TextEncoder().encode('secure-salt'), // Should be unique per user in production
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                importedKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize secure storage:', error);
            this.initialized = false;
            return false;
        }
    }

    // Encrypt data
    async encrypt(data) {
        if (!this.initialized || !this.key) {
            throw new Error('SecureStorage not initialized');
        }
        
        try {
            const text = typeof data === 'string' ? data : JSON.stringify(data);
            const encoded = new TextEncoder().encode(text);
            
            // Generate a random IV for each encryption
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt the data
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                this.key,
                encoded
            );
            
            // Combine IV and encrypted data for storage
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);
            
            // Convert to base64 for storage
            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }

    // Decrypt data
    async decrypt(encryptedData) {
        if (!this.initialized || !this.key) {
            throw new Error('SecureStorage not initialized');
        }
        
        try {
            // Convert from base64 to Uint8Array
            const binaryString = atob(encryptedData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Extract IV and encrypted data
            const iv = bytes.slice(0, 12);
            const encrypted = bytes.slice(12);
            
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                this.key,
                encrypted
            );
            
            // Convert back to string
            const decoded = new TextDecoder().decode(decrypted);
            
            // Try to parse as JSON, return as is if not JSON
            try {
                return JSON.parse(decoded);
            } catch (e) {
                return decoded;
            }
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }
}

export const secureStorage = new SecureStorage();
