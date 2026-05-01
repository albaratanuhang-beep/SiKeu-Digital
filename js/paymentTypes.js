// Payment Types Management Module
const PaymentTypes = {
    currentTypes: [],
    editingId: null,
    isInitialized: false,

    // Default payment types data
    defaultTypes: [
        { name: 'SPP', amount: 0, description: 'Sumbangan Pembinaan Pendidikan bulanan', isSPP: true },
        { name: 'Ekskul', amount: 0, description: 'Kegiatan Ekstrakurikuler', isSPP: false },
        { name: 'Seragam', amount: 0, description: 'Pembelian seragam sekolah', isSPP: false },
        { name: 'Buku', amount: 0, description: 'Pembelian buku pelajaran', isSPP: false },
        { name: 'Ujian', amount: 0, description: 'Biaya ujian semester/kenaikan kelas', isSPP: false },
        { name: 'Komite', amount: 0, description: 'Iuran komite sekolah', isSPP: false },
    ],

    // Initialize module
    async init() {
        await this.loadPaymentTypes();
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }

        // Seed default data if empty
        if (this.currentTypes.length === 0) {
            await this.seedDefaultTypes();
        }

        this.renderTable();
        this.updatePaymentDropdown();
    },

    // Load types from DB
    async loadPaymentTypes() {
        this.currentTypes = await DB.getAllPaymentTypes();
        return this.currentTypes;
    },

    // Seed default types on first run
    async seedDefaultTypes() {
        for (const type of this.defaultTypes) {
            try {
                await DB.addPaymentType({
                    ...type,
                    createdAt: new Date().toISOString()
                });
            } catch (e) {
                console.warn('Seed type already exists:', type.name);
            }
        }
        await this.loadPaymentTypes();
    },

    // Setup event listeners
    setupEventListeners() {
        const form = document.getElementById('paymentTypeForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePaymentType();
            });

            const cancelBtn = document.getElementById('cancelPaymentTypeBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.cancelEdit();
                });
            }
        }
    },

    // Render types table
    renderTable() {
        const tbody = document.getElementById('paymentTypesTableBody');
        if (!tbody) return;

        if (this.currentTypes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada jenis pembayaran</td></tr>';
            return;
        }

        tbody.innerHTML = this.currentTypes.map(type => `
            <tr>
                <td><strong>${Utils.sanitize(type.name)}</strong> ${type.isSPP ? '<span style="background: #dbeafe; color: #1e40af; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: 600;">SPP</span>' : ''}</td>
                <td>${type.amount > 0 ? Utils.formatCurrency(type.amount) : '<span style="color: #999;">Bebas</span>'}</td>
                <td>${Utils.sanitize(type.description || '-')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-small btn-success" onclick="PaymentTypes.editPaymentType(${type.id})" title="Edit">✏️</button>
                        ${!type.isSPP ? `<button class="btn btn-small btn-danger" onclick="PaymentTypes.deletePaymentType(${type.id})" title="Hapus">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Update dropdown in payment form
    updatePaymentDropdown() {
        const select = document.getElementById('paymentTypeSelect');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Pilih Jenis Pembayaran --</option>';

        this.currentTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.id;
            opt.dataset.amount = type.amount;
            opt.dataset.name = type.name;
            opt.dataset.isSpp = type.isSPP ? '1' : '0';
            opt.textContent = type.name + (type.amount > 0 ? ` (${Utils.formatCurrency(type.amount)})` : '');
            select.appendChild(opt);
        });

        // Restore previous selection if still valid
        if (currentVal) {
            select.value = currentVal;
        }
    },

    // Get type by id (sync from current)
    getTypeById(id) {
        return this.currentTypes.find(t => t.id === parseInt(id));
    },

    // Save (add or update) payment type
    async savePaymentType() {
        const name = document.getElementById('ptName').value.trim();
        const amount = parseFloat(document.getElementById('ptAmount').value) || 0;
        const description = document.getElementById('ptDescription').value.trim();

        if (!name) {
            Utils.showToast('Nama jenis pembayaran wajib diisi', 'error');
            return;
        }

        // Check duplicate name (exclude current when editing)
        const duplicate = this.currentTypes.find(t =>
            t.name.toLowerCase() === name.toLowerCase() && t.id !== this.editingId
        );
        if (duplicate) {
            Utils.showToast('Nama jenis pembayaran sudah ada', 'error');
            return;
        }

        try {
            if (this.editingId) {
                const existing = this.getTypeById(this.editingId);
                await DB.updatePaymentType({
                    ...existing,
                    name,
                    amount,
                    description,
                    updatedAt: new Date().toISOString()
                });
                Utils.showToast('Jenis pembayaran berhasil diupdate', 'success');
            } else {
                await DB.addPaymentType({
                    name,
                    amount,
                    description,
                    isSPP: false,
                    createdAt: new Date().toISOString()
                });
                Utils.showToast('Jenis pembayaran berhasil ditambahkan', 'success');
            }

            this.cancelEdit();
            await this.loadPaymentTypes();
            this.renderTable();
            this.updatePaymentDropdown();

            // Update SPP amount in settings if SPP type is being edited
            const sppType = this.currentTypes.find(t => t.isSPP);
            if (sppType && this.editingId === sppType.id) {
                const schoolInfo = Settings.getSchoolInfo();
                schoolInfo.sppAmount = sppType.amount;
                localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));
            }
        } catch (error) {
            console.error('Error saving payment type:', error);
            Utils.showToast('Gagal menyimpan jenis pembayaran', 'error');
        }
    },

    // Edit payment type
    editPaymentType(id) {
        const type = this.getTypeById(id);
        if (!type) return;

        this.editingId = id;

        document.getElementById('ptName').value = type.name;
        document.getElementById('ptAmount').value = type.amount || '';
        document.getElementById('ptDescription').value = type.description || '';

        // Disable name field for SPP type
        document.getElementById('ptName').disabled = type.isSPP;

        document.getElementById('paymentTypeFormTitle').textContent = `Edit: ${type.name}`;
        document.getElementById('savePaymentTypeBtn').textContent = '💾 Update';
        document.getElementById('cancelPaymentTypeBtn').style.display = 'inline-block';

        // Scroll form into view
        document.getElementById('paymentTypeForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    // Cancel edit mode
    cancelEdit() {
        this.editingId = null;

        const form = document.getElementById('paymentTypeForm');
        if (form) form.reset();

        document.getElementById('ptName').disabled = false;
        document.getElementById('paymentTypeFormTitle').textContent = '➕ Tambah Jenis Pembayaran';
        document.getElementById('savePaymentTypeBtn').textContent = '💾 Simpan';
        document.getElementById('cancelPaymentTypeBtn').style.display = 'none';
    },

    // Delete payment type
    async deletePaymentType(id) {
        const type = this.getTypeById(id);
        if (!type) return;

        if (type.isSPP) {
            Utils.showToast('Jenis SPP tidak dapat dihapus', 'error');
            return;
        }

        // Check if type is used in payments
        const payments = await DB.getAllPayments();
        const used = payments.some(p => p.paymentTypeId === id);
        if (used) {
            Utils.showToast('Jenis pembayaran tidak bisa dihapus karena sudah digunakan dalam transaksi', 'error');
            return;
        }

        if (!Utils.confirm(`Hapus jenis pembayaran "${type.name}"?`)) return;

        try {
            await DB.deletePaymentType(id);
            Utils.showToast('Jenis pembayaran berhasil dihapus', 'success');
            await this.loadPaymentTypes();
            this.renderTable();
            this.updatePaymentDropdown();
        } catch (error) {
            console.error('Error deleting payment type:', error);
            Utils.showToast('Gagal menghapus jenis pembayaran', 'error');
        }
    }
};
