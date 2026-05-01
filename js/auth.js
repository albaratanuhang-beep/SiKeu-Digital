// Authentication Module
const Auth = {
    PIN_KEY: 'spp_pin',
    SESSION_KEY: 'spp_session',
    DEFAULT_PIN: '123456',

    // Initialize authentication
    async init() {
        // Set default PIN if not exists
        if (!localStorage.getItem(this.PIN_KEY)) {
            const hashedPin = await Utils.hashPIN(this.DEFAULT_PIN);
            localStorage.setItem(this.PIN_KEY, hashedPin);
        }

        // Check if already logged in
        return this.isLoggedIn();
    },

    // Login with PIN
    async login(pin) {
        const hashedPin = await Utils.hashPIN(pin);
        const storedPin = localStorage.getItem(this.PIN_KEY);

        if (hashedPin === storedPin) {
            // Create session
            const session = {
                loginTime: new Date().toISOString(),
                token: Utils.generateId()
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            return true;
        }
        return false;
    },

    // Logout
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    // Check if logged in
    isLoggedIn() {
        const session = localStorage.getItem(this.SESSION_KEY);
        return !!session;
    },

    // Change PIN
    async changePin(currentPin, newPin) {
        const hashedCurrent = await Utils.hashPIN(currentPin);
        const storedPin = localStorage.getItem(this.PIN_KEY);

        if (hashedCurrent !== storedPin) {
            throw new Error('PIN saat ini salah');
        }

        if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
            throw new Error('PIN baru harus 6 digit angka');
        }

        const hashedNew = await Utils.hashPIN(newPin);
        localStorage.setItem(this.PIN_KEY, hashedNew);
        return true;
    },

    // Get session info
    getSession() {
        const session = localStorage.getItem(this.SESSION_KEY);
        return session ? JSON.parse(session) : null;
    }
};
