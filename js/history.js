// Payment History Module
const History = {
    currentFilters: {},
    isInitialized: false,

    // Initialize history module
    async init() {
        if (this.isInitialized) {
            return;
        }
        this.setupEventListeners();
        this.isInitialized = true;
        // Don't load payments here - let refreshPageData handle it when page is visited
    },

    // Setup event listeners
    setupEventListeners() {
        // Apply filter button
        document.getElementById('applyFilterBtn').addEventListener('click', () => {
            this.applyFilters();
        });

        // Reset filter button
        document.getElementById('resetFilterBtn').addEventListener('click', () => {
            this.resetFilters();
        });

        // Modal close
        document.querySelectorAll('#paymentDetailModal .modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                Utils.hideModal('paymentDetailModal');
            });
        });

        // Close modal on outside click
        document.getElementById('paymentDetailModal').addEventListener('click', (e) => {
            if (e.target.id === 'paymentDetailModal') {
                Utils.hideModal('paymentDetailModal');
            }
        });
    },

    // Load and render payments
    async loadAndRenderPayments(filters = null) {
        await Payments.loadPayments();

        const filtersToApply = filters || this.currentFilters;
        const payments = Payments.filterPayments(filtersToApply);

        this.renderPaymentsTable(payments);
    },

    // Apply filters
    applyFilters() {
        const studentInput = document.getElementById('filterStudent').value.trim();
        const classFilter = document.getElementById('filterClass').value;
        const periodFilter = document.getElementById('filterPeriod').value;
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const paymentTypeFilter = document.getElementById('filterPaymentType') ? document.getElementById('filterPaymentType').value : '';

        // Get student NIS from input
        let studentNIS = null;
        if (studentInput) {
            const student = Students.getStudentByNIS(studentInput);
            if (student) {
                studentNIS = student.nis;
            } else {
                // Try to find by name
                const students = Students.currentStudents.filter(s =>
                    s.name.toLowerCase().includes(studentInput.toLowerCase())
                );
                if (students.length === 1) {
                    studentNIS = students[0].nis;
                }
            }
        }

        this.currentFilters = {
            studentNIS,
            class: classFilter,
            period: periodFilter,
            dateFrom,
            dateTo,
            paymentType: paymentTypeFilter
        };

        this.loadAndRenderPayments(this.currentFilters);
    },

    // Reset filters
    resetFilters() {
        document.getElementById('filterStudent').value = '';
        document.getElementById('filterClass').value = '';
        document.getElementById('filterPeriod').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        const ftpt = document.getElementById('filterPaymentType');
        if (ftpt) ftpt.value = '';

        this.currentFilters = {};
        this.loadAndRenderPayments();
    },

    // Render payments table
    renderPaymentsTable(payments) {
        const tbody = document.getElementById('historyTableBody');

        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data pembayaran</td></tr>';
            return;
        }

        // Sort by date descending, then by ID descending to show latest transactions first
        const sortedPayments = [...payments].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.id - a.id;
        });

        tbody.innerHTML = sortedPayments.map(payment => {
            const statusColor = payment.status === 'Lunas' ? 'var(--success-color)' :
                payment.status === 'Belum Lunas' ? 'var(--warning-color)' :
                    'var(--danger-color)';
            const typeName = payment.paymentTypeName || 'SPP';

            return `
            <tr>
                <td>${Utils.formatDate(payment.date)}</td>
                <td>${Utils.sanitize(payment.studentNIS)}</td>
                <td>${Utils.sanitize(payment.studentName)}</td>
                <td>${Utils.sanitize(payment.studentClass)}</td>
                <td><span class="payment-type-badge">${Utils.sanitize(typeName)}</span></td>
                <td>${Utils.formatPeriod(payment.period)}</td>
                <td><strong>${Utils.formatCurrency(payment.amount)}</strong></td>
                <td>${Utils.sanitize(payment.method)}</td>
                <td><span style="color: ${statusColor}; font-weight: bold;">${Utils.sanitize(payment.status || '-')}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-small btn-primary" onclick="History.viewPaymentDetail(${payment.id})" title="Lihat Detail">
                            👁️
                        </button>
                        <button class="btn btn-small btn-success" onclick="History.editPayment(${payment.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="btn btn-small btn-danger" onclick="History.deletePayment(${payment.id})" title="Hapus">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    },

    // View group detail (for grouped payments)
    async viewGroupDetail(paymentIdsStr) {
        const paymentIds = paymentIdsStr.split(',').map(id => parseInt(id));
        const payments = Payments.currentPayments.filter(p => paymentIds.includes(p.id));

        if (payments.length === 0) {
            Utils.showToast('Pembayaran tidak ditemukan', 'error');
            return;
        }

        // Sort by date ascending to show chronological order
        payments.sort((a, b) => a.date.localeCompare(b.date));

        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const latestPayment = payments[payments.length - 1];
        const statusColor = latestPayment.status === 'Lunas' ? 'var(--success-color)' :
            latestPayment.status === 'Belum Lunas' ? 'var(--warning-color)' :
                'var(--danger-color)';

        const content = document.getElementById('paymentDetailContent');
        content.innerHTML = `
            <div style="line-height: 2;">
                <p><strong>NIS:</strong> ${Utils.sanitize(latestPayment.studentNIS)}</p>
                <p><strong>Nama Siswa:</strong> ${Utils.sanitize(latestPayment.studentName)}</p>
                <p><strong>Kelas:</strong> ${Utils.sanitize(latestPayment.studentClass)}</p>
                <p><strong>Periode:</strong> ${Utils.formatPeriod(latestPayment.period)}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><strong>Total Pembayaran:</strong> <span style="color: var(--success-color); font-size: 1.2em;">${Utils.formatCurrency(totalAmount)}</span></p>
                <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${Utils.sanitize(latestPayment.status || '-')}</span></p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><strong>Rincian Pembayaran (${payments.length}x):</strong></p>
                <div style="margin-left: 20px;">
                    ${payments.map((p, index) => `
                        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                            <p><strong>Pembayaran ${index + 1}</strong></p>
                            <p>Tanggal: ${Utils.formatDate(p.date)}</p>
                            <p>Jumlah: ${Utils.formatCurrency(p.amount)}</p>
                            <p>Metode: ${Utils.sanitize(p.method)}</p>
                            ${p.notes ? `<p>Keterangan: ${Utils.sanitize(p.notes)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        Utils.showModal('paymentDetailModal');
    },

    // View payment detail (single payment - kept for compatibility)
    async viewPaymentDetail(paymentId) {
        const payment = Payments.currentPayments.find(p => p.id === paymentId);
        if (!payment) {
            Utils.showToast('Pembayaran tidak ditemukan', 'error');
            return;
        }

        const statusColor = payment.status === 'Lunas' ? 'var(--success-color)' :
            payment.status === 'Belum Lunas' ? 'var(--warning-color)' :
                'var(--danger-color)';

        const content = document.getElementById('paymentDetailContent');
        content.innerHTML = `
            <div style="line-height: 2;">
                <p><strong>ID Pembayaran:</strong> ${payment.id}</p>
                <p><strong>Tanggal Pembayaran:</strong> ${Utils.formatDate(payment.date)}</p>
                <p><strong>Periode:</strong> ${Utils.formatPeriod(payment.period)}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><strong>NIS:</strong> ${Utils.sanitize(payment.studentNIS)}</p>
                <p><strong>Nama Siswa:</strong> ${Utils.sanitize(payment.studentName)}</p>
                <p><strong>Kelas:</strong> ${Utils.sanitize(payment.studentClass)}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><strong>Jumlah Pembayaran:</strong> <span style="color: var(--success-color); font-size: 1.2em;">${Utils.formatCurrency(payment.amount)}</span></p>
                <p><strong>Metode Pembayaran:</strong> ${Utils.sanitize(payment.method)}</p>
                <p><strong>Status Pembayaran:</strong> <span style="color: ${statusColor}; font-weight: bold;">${Utils.sanitize(payment.status || '-')}</span></p>
                ${payment.notes ? `<p><strong>Keterangan:</strong> ${Utils.sanitize(payment.notes)}</p>` : ''}
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><small><strong>Dibuat pada:</strong> ${Utils.formatDate(payment.createdAt)}</small></p>
            </div>
        `;

        Utils.showModal('paymentDetailModal');
    },

    // Edit latest payment in group
    async editLatestPayment(paymentIdsStr) {
        const paymentIds = paymentIdsStr.split(',').map(id => parseInt(id));
        const payments = Payments.currentPayments.filter(p => paymentIds.includes(p.id));

        if (payments.length === 0) {
            Utils.showToast('Pembayaran tidak ditemukan', 'error');
            return;
        }

        // Get the latest payment (by date)
        const latestPayment = payments.reduce((latest, p) => {
            return p.date > latest.date ? p : latest;
        });

        // Use the existing editPayment function
        this.editPayment(latestPayment.id);
    },

    // Edit payment
    async editPayment(paymentId) {
        const payment = Payments.currentPayments.find(p => p.id === paymentId);
        if (!payment) {
            Utils.showToast('Pembayaran tidak ditemukan', 'error');
            return;
        }

        // Switch to payments page and populate form
        App.switchPage('payments');

        // Wait for page to load
        setTimeout(() => {
            // Populate form with payment data
            document.getElementById('paymentNIS').value = payment.studentNIS;
            document.getElementById('paymentDate').value = payment.date;
            document.getElementById('paymentPeriod').value = payment.period;
            document.getElementById('paymentAmount').value = payment.amount;
            document.getElementById('paymentMethod').value = payment.method;
            document.getElementById('paymentNotes').value = payment.notes || '';

            // Set payment type dropdown
            const typeSelect = document.getElementById('paymentTypeSelect');
            if (typeSelect && payment.paymentTypeId) {
                typeSelect.value = payment.paymentTypeId;
                // Show hint
                const typeHint = document.getElementById('paymentTypeHint');
                if (typeHint) typeHint.textContent = `Jenis: ${payment.paymentTypeName || 'SPP'}`;
            }

            // Trigger student info display
            const event = new Event('input', { bubbles: true });
            document.getElementById('paymentNIS').dispatchEvent(event);

            // Store payment ID for update
            document.getElementById('paymentForm').dataset.editId = paymentId;

            // Change button text
            const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
            submitBtn.innerHTML = '💾 Update Pembayaran';

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            Utils.showToast('Mode edit - Ubah data dan klik Update', 'warning');
        }, 100);
    },

    // Delete payment group
    async deleteGroup(paymentIdsStr) {
        const paymentIds = paymentIdsStr.split(',').map(id => parseInt(id));
        const payments = Payments.currentPayments.filter(p => paymentIds.includes(p.id));

        if (payments.length === 0) {
            Utils.showToast('Pembayaran tidak ditemukan', 'error');
            return;
        }

        const confirmMsg = payments.length > 1
            ? `Apakah Anda yakin ingin menghapus ${payments.length} pembayaran untuk siswa ini?`
            : 'Apakah Anda yakin ingin menghapus pembayaran ini?';

        if (!Utils.confirm(confirmMsg)) {
            return;
        }

        try {
            // Delete all payments in the group
            for (const paymentId of paymentIds) {
                await DB.deletePayment(paymentId);
            }

            Utils.showToast(`${payments.length} pembayaran berhasil dihapus`, 'success');

            await this.loadAndRenderPayments(this.currentFilters);

            // Update dashboard
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateStats();
            }
        } catch (error) {
            console.error('Error deleting payments:', error);
            Utils.showToast('Gagal menghapus pembayaran', 'error');
        }
    },

    // Delete payment (single - kept for compatibility)
    async deletePayment(paymentId) {
        if (!Utils.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) {
            return;
        }

        try {
            await DB.deletePayment(paymentId);
            Utils.showToast('Pembayaran berhasil dihapus', 'success');

            await this.loadAndRenderPayments(this.currentFilters);

            // Update dashboard
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateStats();
            }
        } catch (error) {
            console.error('Error deleting payment:', error);
            Utils.showToast('Gagal menghapus pembayaran', 'error');
        }
    }
};
