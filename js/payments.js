// Payment Management Module
const Payments = {
    currentPayments: [],
    selectedStudent: null,
    isInitialized: false,

    // Initialize payments module
    async init() {
        await this.loadPayments();
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }
        this.setDefaultDates();
    },

    // Load payments from database
    async loadPayments() {
        this.currentPayments = await DB.getAllPayments();
        return this.currentPayments;
    },

    // Setup event listeners
    setupEventListeners() {
        // Payment form submit
        document.getElementById('paymentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePayment();
        });

        // Student NIS input with autocomplete
        const nisInput = document.getElementById('paymentNIS');
        nisInput.addEventListener('input', Utils.debounce((e) => {
            this.handleStudentInput(e.target.value);
        }, 300));

        nisInput.addEventListener('change', (e) => {
            this.handleStudentInput(e.target.value);
        });

        // Payment amount input - auto detect status
        const amountInput = document.getElementById('paymentAmount');
        amountInput.addEventListener('input', () => {
            this.updatePaymentStatus();
        });

        // Payment period input - recalculate when period changes
        const periodInput = document.getElementById('paymentPeriod');
        periodInput.addEventListener('change', () => {
            this.updatePaymentStatus();
        });

        // Payment type dropdown - auto fill amount and update status
        const typeSelect = document.getElementById('paymentTypeSelect');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this.handlePaymentTypeChange();
            });
        }

        // Form reset
        document.getElementById('paymentForm').addEventListener('reset', () => {
            this.selectedStudent = null;
            document.getElementById('selectedStudentInfo').innerHTML = '';
            document.getElementById('selectedStudentInfo').classList.remove('active');
            document.getElementById('paymentStatus').value = '';
            document.getElementById('statusInfo').textContent = 'Status akan otomatis terdeteksi berdasarkan jumlah pembayaran';
            const typeHint = document.getElementById('paymentTypeHint');
            if (typeHint) typeHint.textContent = '';

            // Clear edit mode if active
            const form = document.getElementById('paymentForm');
            if (form.dataset.editId) {
                delete form.dataset.editId;
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '💾 Simpan Pembayaran';
            }
        });
    },

    // Handle payment type change - auto fill amount
    handlePaymentTypeChange() {
        const typeSelect = document.getElementById('paymentTypeSelect');
        const amountInput = document.getElementById('paymentAmount');
        const typeHint = document.getElementById('paymentTypeHint');

        if (!typeSelect || !typeSelect.value) {
            if (typeHint) typeHint.textContent = '';
            return;
        }

        const selectedOpt = typeSelect.options[typeSelect.selectedIndex];
        const typeAmount = parseFloat(selectedOpt.dataset.amount) || 0;
        const typeName = selectedOpt.dataset.name || '';

        if (typeAmount > 0) {
            amountInput.value = typeAmount;
            if (typeHint) typeHint.textContent = `💡 Nominal default ${typeName}: ${Utils.formatCurrency(typeAmount)}`;
        } else {
            if (typeHint) typeHint.textContent = `💡 ${typeName}: nominal bebas (tidak ada nominal default)`;
        }

        this.updatePaymentStatus();
    },

    // Update payment status based on amount
    async updatePaymentStatus() {
        const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
        const period = document.getElementById('paymentPeriod').value;
        const statusSelect = document.getElementById('paymentStatus');
        const statusInfo = document.getElementById('statusInfo');

        // Determine required amount from selected payment type
        const typeSelect = document.getElementById('paymentTypeSelect');
        let requiredAmount = 0;
        let typeName = 'Pembayaran';
        if (typeSelect && typeSelect.value) {
            const selectedOpt = typeSelect.options[typeSelect.selectedIndex];
            requiredAmount = parseFloat(selectedOpt.dataset.amount) || 0;
            typeName = selectedOpt.dataset.name || 'Pembayaran';
        }

        // Fallback to SPP amount from settings if SPP type selected or no type amount
        if (requiredAmount === 0) {
            const schoolInfo = Settings.getSchoolInfo();
            requiredAmount = schoolInfo.sppAmount || 0;
        }

        if (amount === 0) {
            statusSelect.value = '';
            statusInfo.textContent = 'Status akan otomatis terdeteksi berdasarkan jumlah pembayaran';
            statusInfo.style.color = '#666';
            return;
        }

        if (requiredAmount === 0) {
            statusSelect.value = 'Lunas';
            statusInfo.textContent = 'Tidak ada nominal wajib. Status default: Lunas';
            statusInfo.style.color = '#f59e0b';
            return;
        }

        // Get previous payments for this student in this period and payment type
        let previousTotal = 0;
        if (this.selectedStudent && period) {
            const form = document.getElementById('paymentForm');
            const editId = form.dataset.editId ? parseInt(form.dataset.editId) : null;
            const paymentTypeId = typeSelect && typeSelect.value ? parseInt(typeSelect.value) : null;

            const previousPayments = this.currentPayments.filter(p =>
                p.studentId === this.selectedStudent.id &&
                p.period === period &&
                p.id !== editId &&
                (!paymentTypeId || p.paymentTypeId === paymentTypeId)
            );
            previousTotal = previousPayments.reduce((sum, p) => sum + p.amount, 0);
        }

        const totalPayment = previousTotal + amount;

        if (totalPayment >= requiredAmount) {
            statusSelect.value = 'Lunas';
            if (previousTotal > 0) {
                statusInfo.textContent = `✓ Total: ${Utils.formatCurrency(totalPayment)} (Sebelumnya: ${Utils.formatCurrency(previousTotal)} + Sekarang: ${Utils.formatCurrency(amount)}) - LUNAS`;
            } else {
                statusInfo.textContent = `✓ Pembayaran sesuai/lebih dari nominal ${typeName} (${Utils.formatCurrency(requiredAmount)})`;
            }
            statusInfo.style.color = '#10b981';
        } else if (totalPayment > 0 && totalPayment < requiredAmount) {
            statusSelect.value = 'Belum Lunas';
            const shortage = requiredAmount - totalPayment;
            if (previousTotal > 0) {
                statusInfo.textContent = `⚠ Total: ${Utils.formatCurrency(totalPayment)} (Sebelumnya: ${Utils.formatCurrency(previousTotal)} + Sekarang: ${Utils.formatCurrency(amount)}). Kekurangan: ${Utils.formatCurrency(shortage)}`;
            } else {
                statusInfo.textContent = `⚠ Pembayaran kurang dari nominal ${typeName} (${Utils.formatCurrency(requiredAmount)}). Kekurangan: ${Utils.formatCurrency(shortage)}`;
            }
            statusInfo.style.color = '#f59e0b';
        } else {
            statusSelect.value = 'Belum Bayar';
            statusInfo.textContent = '✗ Belum ada pembayaran';
            statusInfo.style.color = '#ef4444';
        }
    },

    // Set default dates
    setDefaultDates() {
        document.getElementById('paymentDate').value = Utils.getCurrentDate();
        document.getElementById('paymentPeriod').value = Utils.getCurrentMonth();
    },

    // Handle student input (NIS or name)
    async handleStudentInput(value) {
        const infoDiv = document.getElementById('selectedStudentInfo');

        if (!value) {
            this.selectedStudent = null;
            infoDiv.innerHTML = '';
            infoDiv.classList.remove('active');
            return;
        }

        // Try to find student by NIS
        let student = Students.getStudentByNIS(value);

        // If not found, try to find by name
        if (!student) {
            const students = Students.currentStudents.filter(s =>
                s.name.toLowerCase().includes(value.toLowerCase())
            );
            if (students.length === 1) {
                student = students[0];
            }
        }

        if (student) {
            this.selectedStudent = student;
            infoDiv.innerHTML = `
                <strong>✓ Siswa ditemukan:</strong><br>
                NIS: ${student.nis}<br>
                Nama: ${student.name}<br>
                Kelas: ${student.class}
            `;
            infoDiv.classList.add('active');

            // Recalculate status when student is selected
            this.updatePaymentStatus();
        } else {
            this.selectedStudent = null;
            infoDiv.innerHTML = '<span style="color: var(--danger-color);">⚠️ Siswa tidak ditemukan</span>';
            infoDiv.classList.remove('active');
        }
    },

    // Save payment
    async savePayment() {
        if (!this.selectedStudent) {
            Utils.showToast('Silakan pilih siswa yang valid', 'error');
            return;
        }

        const form = document.getElementById('paymentForm');
        const editId = form.dataset.editId;
        const isEdit = !!editId;

        const date = document.getElementById('paymentDate').value;
        const period = document.getElementById('paymentPeriod').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.getElementById('paymentMethod').value;
        const status = document.getElementById('paymentStatus').value;
        const notes = document.getElementById('paymentNotes').value.trim();

        // Payment type
        const typeSelect = document.getElementById('paymentTypeSelect');
        const paymentTypeId = typeSelect && typeSelect.value ? parseInt(typeSelect.value) : null;
        const paymentTypeName = typeSelect && typeSelect.value
            ? typeSelect.options[typeSelect.selectedIndex].dataset.name
            : null;

        // Validation
        if (!date || !period || !amount || !method || !status) {
            Utils.showToast('Mohon lengkapi semua field yang wajib diisi', 'error');
            return;
        }

        if (!paymentTypeId) {
            Utils.showToast('Mohon pilih jenis pembayaran', 'error');
            return;
        }

        if (amount <= 0) {
            Utils.showToast('Jumlah pembayaran harus lebih dari 0', 'error');
            return;
        }

        try {
            // Check duplicate payment for the same period (skip if editing the same payment)
            if (!isEdit) {
                const isDuplicate = await DB.checkDuplicatePayment(this.selectedStudent.id, period, paymentTypeId);
                if (isDuplicate) {
                    if (!Utils.confirm(`Siswa ini sudah memiliki pembayaran ${paymentTypeName || ''} untuk periode ${Utils.formatPeriod(period)}. Lanjutkan?`)) {
                        return;
                    }
                }
            }

            const paymentData = {
                studentId: this.selectedStudent.id,
                studentNIS: this.selectedStudent.nis,
                studentName: this.selectedStudent.name,
                studentClass: this.selectedStudent.class,
                date,
                period,
                amount,
                method,
                status,
                notes,
                paymentTypeId,
                paymentTypeName: paymentTypeName || 'SPP'
            };

            if (isEdit) {
                // Update existing payment
                paymentData.id = parseInt(editId);
                const existingPayment = this.currentPayments.find(p => p.id === paymentData.id);
                if (existingPayment) {
                    paymentData.createdAt = existingPayment.createdAt;
                }
                paymentData.updatedAt = new Date().toISOString();

                await DB.updatePayment(paymentData);
                Utils.showToast('Pembayaran berhasil diupdate', 'success');

                // Clear edit mode
                delete form.dataset.editId;
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '💾 Simpan Pembayaran';
            } else {
                // Add new payment
                paymentData.createdAt = new Date().toISOString();
                await DB.addPayment(paymentData);
                Utils.showToast('Pembayaran berhasil disimpan', 'success');
            }

            // Reset form
            form.reset();
            this.selectedStudent = null;
            document.getElementById('selectedStudentInfo').innerHTML = '';
            document.getElementById('selectedStudentInfo').classList.remove('active');
            this.setDefaultDates();

            // Reload payments
            await this.loadPayments();

            // Update dashboard
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateStats();
            }

            // Update history if on history page
            if (typeof History !== 'undefined') {
                History.loadAndRenderPayments();
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            Utils.showToast('Gagal menyimpan pembayaran', 'error');
        }
    },

    // Get payments by filters
    filterPayments(filters) {
        let filtered = [...this.currentPayments];

        // Filter by student
        if (filters.studentNIS) {
            filtered = filtered.filter(p => p.studentNIS === filters.studentNIS);
        }

        // Filter by class
        if (filters.class) {
            filtered = filtered.filter(p => p.studentClass === filters.class);
        }

        // Filter by period
        if (filters.period) {
            filtered = filtered.filter(p => p.period === filters.period);
        }

        // Filter by date range
        if (filters.dateFrom || filters.dateTo) {
            filtered = filtered.filter(p =>
                Utils.isDateInRange(p.date, filters.dateFrom, filters.dateTo)
            );
        }

        // Filter by payment type
        if (filters.paymentType) {
            filtered = filtered.filter(p =>
                (p.paymentTypeName || 'SPP').toLowerCase() === filters.paymentType.toLowerCase()
            );
        }

        return filtered;
    },

    // Get payments for specific month
    getPaymentsByMonth(yearMonth) {
        return this.currentPayments.filter(p => p.period === yearMonth);
    },

    // Get payments for today
    getPaymentsToday() {
        const today = Utils.getCurrentDate();
        return this.currentPayments.filter(p => p.date === today);
    },

    // Get total amount
    getTotalAmount(payments = null) {
        const paymentsToCalc = payments || this.currentPayments;
        return paymentsToCalc.reduce((sum, p) => sum + (p.amount || 0), 0);
    }
};
