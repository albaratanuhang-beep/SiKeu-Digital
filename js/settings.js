// Settings Module
const Settings = {
    isInitialized: false,

    // Initialize settings module
    async init() {
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }
        await this.loadSchoolInfo();
        this.updateAppBranding();
    },

    updateAppBranding() {
        const info = this.getSchoolInfo();
        const appName = info.appName || 'SiKeu';
        const appLogo = info.appLogo || '🏫';

        // Update Name
        document.title = `${appName} - Sistem Keuangan Sekolah`;
        const loginNameEl = document.getElementById('loginAppName');
        const headerNameEl = document.getElementById('headerAppName');
        const aboutNameEl = document.getElementById('aboutAppName');

        if (loginNameEl) loginNameEl.textContent = appName;
        if (headerNameEl) headerNameEl.textContent = appName;
        if (aboutNameEl) aboutNameEl.textContent = `${appName} - Sistem Keuangan Sekolah`;

        // Update Logo
        const renderLogo = (el) => {
            if (!el) return;
            if (appLogo.startsWith('http') || appLogo.startsWith('data:image')) {
                el.innerHTML = `<img src="${appLogo}" alt="Logo" style="height: 100%; max-height: 48px; object-fit: contain;">`;
                el.style.background = 'transparent'; // Remove Emoji background if needed
            } else {
                el.textContent = appLogo;
                el.innerHTML = appLogo; // In case emoji text
            }
        };

        renderLogo(document.getElementById('loginAppLogo'));
        renderLogo(document.getElementById('headerAppLogo'));
    },

    // Setup event listeners
    setupEventListeners() {
        // School info form
        document.getElementById('schoolInfoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSchoolInfo();
        });

        // Logo File Input
        const uploadLogoBtn = document.getElementById('uploadLogoBtn');
        if (uploadLogoBtn) {
            uploadLogoBtn.addEventListener('click', () => {
                document.getElementById('logoFileInput').click();
            });

            document.getElementById('logoFileInput').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_HEIGHT = 100;
                            let scale = 1;
                            if (img.height > MAX_HEIGHT) {
                                scale = MAX_HEIGHT / img.height;
                            }
                            canvas.width = img.width * scale;
                            canvas.height = img.height * scale;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/png');
                            document.getElementById('appLogo').value = dataUrl;
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Change PIN form
        document.getElementById('changePinForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePin();
        });

        // Backup data button
        document.getElementById('backupDataBtn').addEventListener('click', () => {
            this.backupData();
        });

        // Restore data button
        document.getElementById('restoreDataBtn').addEventListener('click', () => {
            document.getElementById('restoreFileInput').click();
        });

        // Restore file input
        document.getElementById('restoreFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.restoreData(file);
            }
        });

        // Clear data button
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });
    },

    // Load school info from localStorage
    async loadSchoolInfo() {
        const schoolInfo = this.getSchoolInfo();

        const appNameEl = document.getElementById('appName');
        if (appNameEl) appNameEl.value = schoolInfo.appName || 'SiKeu';

        const appLogoEl = document.getElementById('appLogo');
        if (appLogoEl) appLogoEl.value = schoolInfo.appLogo || '🏫';

        document.getElementById('schoolName').value = schoolInfo.schoolName || '';
        document.getElementById('principalName').value = schoolInfo.principalName || '';
        document.getElementById('treasurerName').value = schoolInfo.treasurerName || '';
    },

    // Save school info to localStorage
    saveSchoolInfo() {
        const schoolInfo = {
            appName: document.getElementById('appName') ? document.getElementById('appName').value.trim() : 'SiKeu',
            appLogo: document.getElementById('appLogo') ? document.getElementById('appLogo').value.trim() : '🏫',
            schoolName: document.getElementById('schoolName').value.trim(),
            principalName: document.getElementById('principalName').value.trim(),
            treasurerName: document.getElementById('treasurerName').value.trim(),
            sppAmount: document.getElementById('sppAmount') ? (parseFloat(document.getElementById('sppAmount').value) || 0) : 0
        };

        const currentSettings = this.getSchoolInfo();
        schoolInfo.sppAmount = currentSettings.sppAmount || 0;

        localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));
        this.updateAppBranding(); // Apply new branding
        Utils.showToast('Informasi sekolah berhasil disimpan', 'success');
    },

    // Get school info from localStorage
    getSchoolInfo() {
        const defaultInfo = {
            appName: 'SiKeu',
            appLogo: '🏫',
            schoolName: '',
            principalName: '',
            treasurerName: '',
            sppAmount: 0
        };

        try {
            const stored = localStorage.getItem('schoolInfo');
            return stored ? JSON.parse(stored) : defaultInfo;
        } catch (error) {
            console.error('Error loading school info:', error);
            return defaultInfo;
        }
    },

    // Change PIN
    async changePin() {
        const currentPin = document.getElementById('currentPin').value;
        const newPin = document.getElementById('newPin').value;
        const confirmPin = document.getElementById('confirmPin').value;

        if (newPin !== confirmPin) {
            Utils.showToast('PIN baru tidak cocok', 'error');
            return;
        }

        try {
            await Auth.changePin(currentPin, newPin);
            Utils.showToast('PIN berhasil diubah', 'success');
            document.getElementById('changePinForm').reset();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    // Backup data to JSON
    async backupData() {
        try {
            const data = await DB.exportData();
            const filename = `SPP_Backup_${new Date().toISOString().split('T')[0]}.json`;
            Utils.exportToJSON(data, filename);
            Utils.showToast('Backup berhasil dibuat', 'success');
        } catch (error) {
            console.error('Error backing up data:', error);
            Utils.showToast('Gagal membuat backup', 'error');
        }
    },

    // Restore data from JSON
    async restoreData(file) {
        if (!Utils.confirm('Restore data akan menghapus semua data yang ada. Lanjutkan?')) {
            document.getElementById('restoreFileInput').value = '';
            return;
        }

        try {
            const data = await Utils.importFromJSON(file);

            // Validate data structure
            if (!data.students || !data.payments) {
                throw new Error('Format file backup tidak valid');
            }

            await DB.importData(data);

            Utils.showToast('Data berhasil di-restore', 'success');

            // Reload all modules
            await Students.loadStudents();
            await Payments.loadPayments();
            Students.renderStudentsTable();
            Students.updateAutocomplete();
            Dashboard.updateStats();

            document.getElementById('restoreFileInput').value = '';
        } catch (error) {
            console.error('Error restoring data:', error);
            Utils.showToast(error.message || 'Gagal restore data', 'error');
            document.getElementById('restoreFileInput').value = '';
        }
    },

    // Clear all data
    async clearAllData() {
        if (!Utils.confirm('PERINGATAN: Ini akan menghapus SEMUA data siswa dan pembayaran secara permanen!\n\nApakah Anda yakin?')) {
            return;
        }

        if (!Utils.confirm('Konfirmasi sekali lagi: Hapus semua data?')) {
            return;
        }

        try {
            await DB.clearAll();
            Utils.showToast('Semua data berhasil dihapus', 'success');

            // Reload all modules
            await Students.loadStudents();
            await Payments.loadPayments();
            Students.renderStudentsTable();
            Students.updateAutocomplete();
            Dashboard.updateStats();
        } catch (error) {
            console.error('Error clearing data:', error);
            Utils.showToast('Gagal menghapus data', 'error');
        }
    }
};
