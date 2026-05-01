// Main Application Controller
const App = {
    currentPage: 'dashboard',

    // Initialize application
    async init() {
        try {
            // Initialize database
            await DB.init();
            console.log('Database initialized');

            // Check authentication
            const isLoggedIn = await Auth.init();

            if (isLoggedIn) {
                this.showMainApp();
                await this.initializeModules();
            } else {
                this.showLoginScreen();
            }

            this.setupGlobalEventListeners();
        } catch (error) {
            console.error('Error initializing app:', error);
            alert('Gagal menginisialisasi aplikasi. Silakan refresh halaman.');
        }
    },

    // Setup global event listeners
    setupGlobalEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    // Handle login
    async handleLogin() {
        const pin = document.getElementById('pinInput').value;

        if (!pin) {
            Utils.showToast('Masukkan PIN', 'error');
            return;
        }

        try {
            const success = await Auth.login(pin);

            if (success) {
                Utils.showToast('Login berhasil', 'success');
                this.showMainApp();
                await this.initializeModules();
                document.getElementById('pinInput').value = '';
            } else {
                Utils.showToast('PIN salah', 'error');
                document.getElementById('pinInput').value = '';
                document.getElementById('pinInput').focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            Utils.showToast('Gagal login', 'error');
        }
    },

    // Handle logout
    handleLogout() {
        if (Utils.confirm('Apakah Anda yakin ingin keluar?')) {
            Auth.logout();
            this.showLoginScreen();
            Utils.showToast('Logout berhasil', 'success');
        }
    },

    // Show login screen
    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('pinInput').focus();
    },

    // Show main application
    showMainApp() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainApp').classList.add('active');
    },

    // Initialize all modules
    async initializeModules() {
        try {
            // Initialize modules in order
            await Students.init();
            await PaymentTypes.init();
            await Payments.init();
            await Dashboard.init();
            await History.init();
            await Reports.init();
            Settings.init();

            console.log('All modules initialized');
        } catch (error) {
            console.error('Error initializing modules:', error);
            Utils.showToast('Gagal menginisialisasi beberapa modul', 'error');
        }
    },

    // Navigate to page
    navigateTo(pageName) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === pageName) {
                btn.classList.add('active');
            }
        });

        // Update pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const targetPage = document.getElementById(`${pageName}Page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;

            // Refresh page data if needed
            this.refreshPageData(pageName);
        }
    },

    // Switch page (alias for navigateTo, used by other modules)
    switchPage(pageName) {
        this.navigateTo(pageName);
    },

    // Refresh page data when navigating
    async refreshPageData(pageName) {
        try {
            switch (pageName) {
                case 'dashboard':
                    await Dashboard.updateStats();
                    await Dashboard.loadRecentPayments();
                    break;
                case 'students':
                    await Students.loadStudents();
                    Students.renderStudentsTable();
                    break;
                case 'payments':
                    // Refresh payment type dropdown when opening payments page
                    if (typeof PaymentTypes !== 'undefined') {
                        await PaymentTypes.loadPaymentTypes();
                        PaymentTypes.updatePaymentDropdown();
                    }
                    break;
                case 'paymentTypes':
                    if (typeof PaymentTypes !== 'undefined') {
                        await PaymentTypes.loadPaymentTypes();
                        PaymentTypes.renderTable();
                    }
                    break;
                case 'history':
                    await History.loadAndRenderPayments();
                    // Update payment type filter dropdown
                    this.updateHistoryTypeFilter();
                    break;
                case 'reports':
                    if (typeof Reports !== 'undefined') {
                        await Reports.init();
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error refreshing ${pageName} data:`, error);
        }
    },

    // Update history page payment type filter dropdown
    updateHistoryTypeFilter() {
        const filterSelect = document.getElementById('filterPaymentType');
        if (!filterSelect || typeof PaymentTypes === 'undefined') return;

        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Semua jenis</option>';

        PaymentTypes.currentTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.name;
            opt.textContent = type.name;
            filterSelect.appendChild(opt);
        });

        if (currentVal) filterSelect.value = currentVal;
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}

// Handle page visibility change to refresh data
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Auth.isLoggedIn()) {
        App.refreshPageData(App.currentPage);
    }
});
