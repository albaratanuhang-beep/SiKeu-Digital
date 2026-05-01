// IndexedDB Database Management Module
const DB = {
    name: 'SPPDatabase',
    version: 2,
    db: null,

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Students store
                if (!db.objectStoreNames.contains('students')) {
                    const studentStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
                    studentStore.createIndex('nis', 'nis', { unique: true });
                    studentStore.createIndex('name', 'name', { unique: false });
                    studentStore.createIndex('class', 'class', { unique: false });
                }

                // Payments store
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentStore.createIndex('studentId', 'studentId', { unique: false });
                    paymentStore.createIndex('date', 'date', { unique: false });
                    paymentStore.createIndex('period', 'period', { unique: false });
                    paymentStore.createIndex('studentPeriod', ['studentId', 'period'], { unique: false });
                }

                // Payment Types store (new in version 2)
                if (!db.objectStoreNames.contains('paymentTypes')) {
                    const typeStore = db.createObjectStore('paymentTypes', { keyPath: 'id', autoIncrement: true });
                    typeStore.createIndex('name', 'name', { unique: true });
                }
            };
        });
    },

    // Generic CRUD operations
    async add(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAll(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async update(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getByIndex(storeName, indexName, value) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.get(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllByIndex(storeName, indexName, value) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Student-specific operations
    async getStudentByNIS(nis) {
        return this.getByIndex('students', 'nis', nis);
    },

    async getAllStudents() {
        return this.getAll('students');
    },

    async addStudent(student) {
        return this.add('students', student);
    },

    async updateStudent(student) {
        return this.update('students', student);
    },

    async deleteStudent(id) {
        return this.delete('students', id);
    },

    // Payment-specific operations
    async getAllPayments() {
        return this.getAll('payments');
    },

    async getPaymentsByStudent(studentId) {
        return this.getAllByIndex('payments', 'studentId', studentId);
    },

    async addPayment(payment) {
        return this.add('payments', payment);
    },

    async updatePayment(payment) {
        return this.update('payments', payment);
    },

    async deletePayment(id) {
        return this.delete('payments', id);
    },

    async checkDuplicatePayment(studentId, period, paymentTypeId) {
        const payments = await this.getPaymentsByStudent(studentId);
        return payments.some(p => p.period === period && p.paymentTypeId === paymentTypeId);
    },

    // Payment Types CRUD
    async getAllPaymentTypes() {
        return this.getAll('paymentTypes');
    },

    async getPaymentType(id) {
        return this.get('paymentTypes', id);
    },

    async addPaymentType(paymentType) {
        return this.add('paymentTypes', paymentType);
    },

    async updatePaymentType(paymentType) {
        return this.update('paymentTypes', paymentType);
    },

    async deletePaymentType(id) {
        return this.delete('paymentTypes', id);
    },

    // Export all data
    async exportData() {
        const students = await this.getAllStudents();
        const payments = await this.getAllPayments();
        const paymentTypes = await this.getAllPaymentTypes();
        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            students,
            payments,
            paymentTypes
        };
    },

    // Import data
    async importData(data) {
        // Clear existing data
        await this.clearAll();

        // Import students
        for (const student of data.students) {
            await this.addStudent(student);
        }

        // Import payments
        for (const payment of data.payments) {
            await this.addPayment(payment);
        }

        // Import payment types (if present)
        if (data.paymentTypes && data.paymentTypes.length > 0) {
            for (const pt of data.paymentTypes) {
                await this.addPaymentType(pt);
            }
        }
    },

    // Clear all data
    async clearAll() {
        const transaction = this.db.transaction(['students', 'payments', 'paymentTypes'], 'readwrite');
        
        return Promise.all([
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('students').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('payments').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('paymentTypes').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    }
};
