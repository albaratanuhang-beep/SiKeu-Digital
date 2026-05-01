// Utility Functions Module
const Utils = {
    // Format currency to Indonesian Rupiah
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    // Format date to Indonesian format
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(d);
    },

    // Format date for input fields
    formatDateInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    // Format month-year
    formatPeriod(period) {
        if (!period) return '';
        const [year, month] = period.split('-');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${months[parseInt(month) - 1]} ${year}`;
    },

    // Get current date in YYYY-MM-DD format
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },

    // Get current month in YYYY-MM format
    getCurrentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Show modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    // Hide modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // Confirm dialog
    confirm(message) {
        return window.confirm(message);
    },

    // Hash PIN for security
    async hashPIN(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Export to CSV
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            this.showToast('Tidak ada data untuk diekspor', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    },

    // Export to JSON
    exportToJSON(data, filename) {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    },

    // Import from JSON file
    async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('File JSON tidak valid'));
                }
            };
            reader.onerror = () => reject(new Error('Gagal membaca file'));
            reader.readAsText(file);
        });
    },

    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Sanitize input
    sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Get unique classes from students
    getUniqueClasses(students) {
        const classes = students.map(s => s.class).filter(Boolean);
        return [...new Set(classes)].sort();
    },

    // Filter array by search term
    filterBySearch(items, searchTerm, fields) {
        if (!searchTerm) return items;
        
        const term = searchTerm.toLowerCase();
        return items.filter(item => 
            fields.some(field => {
                const value = item[field];
                return value && value.toString().toLowerCase().includes(term);
            })
        );
    },

    // Sort array by field
    sortBy(items, field, ascending = true) {
        return [...items].sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        });
    },

    // Group by field
    groupBy(items, field) {
        return items.reduce((groups, item) => {
            const key = item[field];
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    },

    // Calculate statistics
    calculateStats(payments) {
        const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const count = payments.length;
        const average = count > 0 ? total / count : 0;

        return {
            total,
            count,
            average
        };
    },

    // Get date range
    isDateInRange(date, startDate, endDate) {
        const d = new Date(date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    },

    // Validate NIS format
    validateNIS(nis) {
        return /^\d+$/.test(nis) && nis.length >= 4;
    },

    // Validate phone number
    validatePhone(phone) {
        if (!phone) return true; // Optional field
        return /^(\+62|62|0)[0-9]{9,12}$/.test(phone.replace(/[\s-]/g, ''));
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};
