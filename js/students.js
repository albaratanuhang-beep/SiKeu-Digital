// Student Management Module
const Students = {
    currentStudents: [],
    currentEditId: null,
    isInitialized: false,

    // Initialize students module
    async init() {
        await this.loadStudents();
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }
        this.renderStudentsTable();
        this.updateAutocomplete();
    },

    // Load students from database
    async loadStudents() {
        this.currentStudents = await DB.getAllStudents();
        return this.currentStudents;
    },

    // Setup event listeners
    setupEventListeners() {
        // Add student button
        document.getElementById('addStudentBtn').addEventListener('click', () => {
            this.openStudentModal();
        });

        // Import button
        document.getElementById('importStudentsBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        // Download Excel Template button
        const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener('click', () => {
                this.downloadExcelTemplate();
            });
        }

        // Export button
        document.getElementById('exportStudentsBtn').addEventListener('click', () => {
            this.exportStudentsToCSV();
        });

        // File input change
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validasi tipe file
                const validTypes = [
                    'text/csv',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ];
                const validExtensions = ['.csv', '.xls', '.xlsx'];
                const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

                if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
                    Utils.showToast('❌ Format file tidak valid. Gunakan CSV atau Excel (.xlsx, .xls)', 'error');
                    e.target.value = '';
                    return;
                }

                // Validasi ukuran file (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    Utils.showToast('❌ Ukuran file terlalu besar. Maksimal 5MB', 'error');
                    e.target.value = '';
                    return;
                }

                this.importStudentsFromFile(file);
                e.target.value = ''; // Reset input
            }
        });

        // Student form submit
        document.getElementById('studentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStudent();
        });

        // Real-time validation untuk NIS
        document.getElementById('studentNIS').addEventListener('input', (e) => {
            const value = e.target.value;
            const input = e.target;
            
            // Hapus karakter non-angka
            input.value = value.replace(/[^0-9]/g, '');
            
            // Validasi real-time
            if (input.value && input.value.length < 4) {
                input.setCustomValidity('NIS minimal 4 digit');
            } else if (input.value.length > 20) {
                input.setCustomValidity('NIS maksimal 20 digit');
            } else {
                input.setCustomValidity('');
            }
        });

        // Real-time validation untuk Nama
        document.getElementById('studentName').addEventListener('input', (e) => {
            const value = e.target.value;
            const input = e.target;
            
            // Validasi karakter
            if (value && !/^[a-zA-Z\s.']*$/.test(value)) {
                input.setCustomValidity('Nama hanya boleh berisi huruf, spasi, titik, dan tanda petik');
            } else if (value.length > 0 && value.length < 3) {
                input.setCustomValidity('Nama minimal 3 karakter');
            } else if (value.length > 100) {
                input.setCustomValidity('Nama maksimal 100 karakter');
            } else {
                input.setCustomValidity('');
            }
        });

        // Real-time validation untuk Kelas
        document.getElementById('studentClass').addEventListener('input', (e) => {
            const value = e.target.value;
            const input = e.target;
            
            if (value.length > 0 && value.length < 2) {
                input.setCustomValidity('Kelas minimal 2 karakter');
            } else if (value.length > 20) {
                input.setCustomValidity('Kelas maksimal 20 karakter');
            } else {
                input.setCustomValidity('');
            }
        });

        // Real-time validation untuk Kontak
        document.getElementById('studentContact').addEventListener('input', (e) => {
            const value = e.target.value;
            const input = e.target;
            
            // Hapus karakter non-angka kecuali +
            input.value = value.replace(/[^0-9+]/g, '');
            
            if (value && !Utils.validatePhone(value)) {
                input.setCustomValidity('Format nomor tidak valid. Gunakan: 08xx atau +62xx');
            } else {
                input.setCustomValidity('');
            }
        });

        // Search students
        const searchInput = document.getElementById('studentSearch');
        searchInput.addEventListener('input', Utils.debounce((e) => {
            this.searchStudents(e.target.value);
        }, 300));

        // Modal close buttons
        document.querySelectorAll('#studentModal .modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                Utils.hideModal('studentModal');
            });
        });

        // Close modal on outside click
        document.getElementById('studentModal').addEventListener('click', (e) => {
            if (e.target.id === 'studentModal') {
                Utils.hideModal('studentModal');
            }
        });
    },

    // Open student modal for add/edit
    openStudentModal(student = null) {
        const modal = document.getElementById('studentModal');
        const form = document.getElementById('studentForm');
        const title = document.getElementById('studentModalTitle');

        form.reset();

        if (student) {
            // Edit mode
            title.textContent = 'Edit Siswa';
            document.getElementById('studentId').value = student.id;
            document.getElementById('studentNIS').value = student.nis;
            document.getElementById('studentName').value = student.name;
            document.getElementById('studentClass').value = student.class;
            document.getElementById('studentContact').value = student.contact || '';
            document.getElementById('studentNIS').readOnly = true;
            this.currentEditId = student.id;
        } else {
            // Add mode
            title.textContent = 'Tambah Siswa';
            document.getElementById('studentNIS').readOnly = false;
            this.currentEditId = null;
        }

        Utils.showModal('studentModal');
    },

    // Save student (add or update)
    // Save student (add or update)
    async saveStudent() {
        const id = this.currentEditId;
        const nis = document.getElementById('studentNIS').value.trim();
        const name = document.getElementById('studentName').value.trim();
        const studentClass = document.getElementById('studentClass').value.trim();
        const contact = document.getElementById('studentContact').value.trim();

        // Validasi minimal: setidaknya NIS atau Nama harus diisi
        if (!nis && !name) {
            Utils.showToast('❌ NIS atau Nama Lengkap wajib diisi!', 'error');
            return;
        }

        try {
            // Check duplicate NIS (only for new student)
            if (!id) {
                const existing = await DB.getStudentByNIS(nis);
                if (existing) {
                    Utils.showToast('NIS sudah terdaftar', 'error');
                    return;
                }
            }

            const studentData = {
                nis,
                name,
                class: studentClass,
                contact,
                createdAt: id ? undefined : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (id) {
                studentData.id = id;
                await DB.updateStudent(studentData);
                Utils.showToast('Data siswa berhasil diperbarui', 'success');
            } else {
                await DB.addStudent(studentData);
                Utils.showToast('Siswa berhasil ditambahkan', 'success');
            }

            Utils.hideModal('studentModal');
            await this.loadStudents();
            this.renderStudentsTable();
            this.updateAutocomplete();
            
            // Update dashboard if on dashboard page
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateStats();
            }
        } catch (error) {
            console.error('Error saving student:', error);
            Utils.showToast('Gagal menyimpan data siswa', 'error');
        }
    },

    // Delete student
    async deleteStudent(id) {
        if (!Utils.confirm('Apakah Anda yakin ingin menghapus siswa ini? Data pembayaran siswa juga akan terhapus.')) {
            return;
        }

        try {
            // Delete student
            await DB.deleteStudent(id);

            // Delete all payments for this student
            const payments = await DB.getPaymentsByStudent(id);
            for (const payment of payments) {
                await DB.deletePayment(payment.id);
            }

            Utils.showToast('Siswa berhasil dihapus', 'success');
            await this.loadStudents();
            this.renderStudentsTable();
            this.updateAutocomplete();

            // Update dashboard
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateStats();
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            Utils.showToast('Gagal menghapus siswa', 'error');
        }
    },

    // Render students table
    renderStudentsTable(students = null) {
        const tbody = document.getElementById('studentsTableBody');
        const studentsToRender = students || this.currentStudents;

        if (studentsToRender.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada data siswa</td></tr>';
            return;
        }

        tbody.innerHTML = studentsToRender.map(student => `
            <tr>
                <td>${Utils.sanitize(student.nis)}</td>
                <td>${Utils.sanitize(student.name)}</td>
                <td>${Utils.sanitize(student.class)}</td>
                <td>${Utils.sanitize(student.contact || '-')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-small btn-primary" onclick="Students.openStudentModal(${JSON.stringify(student).replace(/"/g, '&quot;')})">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="Students.deleteStudent(${student.id})">
                            🗑️ Hapus
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Search students
    searchStudents(searchTerm) {
        const filtered = Utils.filterBySearch(
            this.currentStudents,
            searchTerm,
            ['nis', 'name', 'class']
        );
        this.renderStudentsTable(filtered);
    },

    // Update autocomplete lists
    updateAutocomplete() {
        const studentsList = document.getElementById('studentsList');
        const studentsListFilter = document.getElementById('studentsListFilter');

        const options = this.currentStudents.map(s => 
            `<option value="${s.nis}">${s.nis} - ${s.name} (${s.class})</option>`
        ).join('');

        if (studentsList) studentsList.innerHTML = options;
        if (studentsListFilter) studentsListFilter.innerHTML = options;

        // Update class filter
        this.updateClassFilter();

        // Update receipt student datalist
        if (typeof Reports !== 'undefined' && typeof Reports.populateReceiptStudentSelect === 'function') {
            Reports.populateReceiptStudentSelect();
        }
    },

    // Update class filter dropdown
    updateClassFilter() {
        const filterClass = document.getElementById('filterClass');
        if (!filterClass) return;

        const classes = Utils.getUniqueClasses(this.currentStudents);
        const currentValue = filterClass.value;

        filterClass.innerHTML = '<option value="">Semua kelas</option>' +
            classes.map(c => `<option value="${c}">${c}</option>`).join('');

        if (currentValue) {
            filterClass.value = currentValue;
        }
    },

    // Get student by NIS
    getStudentByNIS(nis) {
        return this.currentStudents.find(s => s.nis === nis);
    },

    // Get student by ID
    getStudentById(id) {
        return this.currentStudents.find(s => s.id === id);
    },

    // Export students to CSV
    exportStudentsToCSV() {
        if (this.currentStudents.length === 0) {
            Utils.showToast('Tidak ada data siswa untuk diekspor', 'warning');
            return;
        }

        const csvData = this.currentStudents.map(s => ({
            'NIS': s.nis,
            'Nama': s.name,
            'Kelas': s.class,
            'Kontak': s.contact || ''
        }));

        const filename = `Data_Siswa_${new Date().toISOString().split('T')[0]}.csv`;
        Utils.exportToCSV(csvData, filename);
        Utils.showToast('✅ Data siswa berhasil diekspor ke CSV', 'success');
    },

    // Download student import template in Excel format
    downloadExcelTemplate() {
        try {
            const templateData = [
                {
                    'NIS': '12345678',
                    'Nama': 'Ahmad Suryanto',
                    'Kelas': 'X-RPL',
                    'Kontak': '081234567890'
                },
                {
                    'NIS': '87654321',
                    'Nama': 'Siti Nurhaliza',
                    'Kelas': 'XI-TKJ',
                    'Kontak': '082198765432'
                }
            ];

            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Siswa');

            XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
            Utils.showToast('✅ Template Excel berhasil didownload', 'success');
        } catch (error) {
            console.error('Error downloading template:', error);
            Utils.showToast('❌ Gagal mendownload template Excel', 'error');
        }
    },

    // Import students from Excel/CSV
    async importStudentsFromFile(file) {
        try {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Ambil sheet pertama
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                    if (jsonData.length === 0) {
                        Utils.showToast('❌ File kosong atau format tidak valid', 'error');
                        return;
                    }

                    // Validasi dan import data
                    await this.processImportData(jsonData);
                    
                } catch (error) {
                    console.error('Error parsing file:', error);
                    Utils.showToast('❌ Gagal membaca file. Pastikan format Excel/CSV valid', 'error');
                }
            };

            reader.onerror = () => {
                Utils.showToast('❌ Gagal membaca file', 'error');
            };

            reader.readAsArrayBuffer(file);
            
        } catch (error) {
            console.error('Error importing file:', error);
            Utils.showToast('❌ Gagal mengimpor file', 'error');
        }
    },

    // Process imported data
    async processImportData(data) {
        let successCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;
        const errors = [];

        Utils.showToast('⏳ Memproses data import...', 'warning');

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // +2 karena baris 1 adalah header, index mulai dari 0

            try {
                // Mapping kolom (support berbagai format header)
                const nis = String(row.NIS || row.nis || row.Nis || '').trim();
                const name = String(row.Nama || row.nama || row.Name || row.name || '').trim();
                const studentClass = String(row.Kelas || row.kelas || row.Class || row.class || '').trim();
                const contact = String(row.Kontak || row.kontak || row.Contact || row.contact || row.Telepon || row.telepon || '').trim();

                // Validasi data
                const validation = this.validateImportRow(nis, name, studentClass, contact, rowNum);
                
                if (!validation.valid) {
                    errors.push(validation.error);
                    errorCount++;
                    continue;
                }

                // Cek duplikasi NIS
                const existing = await DB.getStudentByNIS(nis);
                if (existing) {
                    errors.push(`Baris ${rowNum}: NIS ${nis} sudah terdaftar (${existing.name})`);
                    duplicateCount++;
                    continue;
                }

                // Simpan data
                const studentData = {
                    nis,
                    name,
                    class: studentClass,
                    contact: contact || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await DB.addStudent(studentData);
                successCount++;

            } catch (error) {
                console.error(`Error processing row ${rowNum}:`, error);
                errors.push(`Baris ${rowNum}: ${error.message}`);
                errorCount++;
            }
        }

        // Reload data
        await this.loadStudents();
        this.renderStudentsTable();
        this.updateAutocomplete();

        // Update dashboard
        if (typeof Dashboard !== 'undefined') {
            Dashboard.updateStats();
        }

        // Tampilkan hasil
        this.showImportResults(successCount, errorCount, duplicateCount, errors);
    },

    // Validate import row
    validateImportRow(nis, name, studentClass, contact, rowNum) {
        // Validasi NIS
        if (!nis) {
            return { valid: false, error: `Baris ${rowNum}: NIS tidak boleh kosong` };
        }
        if (!Utils.validateNIS(nis)) {
            return { valid: false, error: `Baris ${rowNum}: NIS harus berupa angka minimal 4 digit (${nis})` };
        }
        if (nis.length > 20) {
            return { valid: false, error: `Baris ${rowNum}: NIS maksimal 20 digit (${nis})` };
        }

        // Validasi Nama
        if (!name) {
            return { valid: false, error: `Baris ${rowNum}: Nama tidak boleh kosong` };
        }
        if (name.length < 3) {
            return { valid: false, error: `Baris ${rowNum}: Nama minimal 3 karakter (${name})` };
        }
        if (name.length > 100) {
            return { valid: false, error: `Baris ${rowNum}: Nama maksimal 100 karakter` };
        }
        if (!/^[a-zA-Z\s.']+$/.test(name)) {
            return { valid: false, error: `Baris ${rowNum}: Nama hanya boleh berisi huruf, spasi, titik, dan tanda petik (${name})` };
        }

        // Validasi Kelas
        if (!studentClass) {
            return { valid: false, error: `Baris ${rowNum}: Kelas tidak boleh kosong` };
        }
        if (studentClass.length < 2) {
            return { valid: false, error: `Baris ${rowNum}: Kelas minimal 2 karakter (${studentClass})` };
        }
        if (studentClass.length > 20) {
            return { valid: false, error: `Baris ${rowNum}: Kelas maksimal 20 karakter` };
        }

        // Validasi Kontak (opsional)
        if (contact && !Utils.validatePhone(contact)) {
            return { valid: false, error: `Baris ${rowNum}: Format kontak tidak valid (${contact})` };
        }

        return { valid: true };
    },

    // Show import results
    showImportResults(successCount, errorCount, duplicateCount, errors) {
        const totalProcessed = successCount + errorCount + duplicateCount;
        
        let message = `
            <div style="text-align: left; line-height: 1.8;">
                <h3 style="margin-bottom: 15px;">📊 Hasil Import Data Siswa</h3>
                <p><strong>Total data diproses:</strong> ${totalProcessed}</p>
                <p style="color: var(--success-color);"><strong>✅ Berhasil:</strong> ${successCount}</p>
                <p style="color: var(--danger-color);"><strong>❌ Gagal:</strong> ${errorCount}</p>
                <p style="color: var(--warning-color);"><strong>⚠️ Duplikat:</strong> ${duplicateCount}</p>
        `;

        if (errors.length > 0) {
            message += `
                <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
                <p><strong>Detail Error:</strong></p>
                <div style="max-height: 200px; overflow-y: auto; background: var(--bg-color); padding: 10px; border-radius: 8px; font-size: 0.9rem;">
            `;
            errors.slice(0, 20).forEach(err => {
                message += `<p style="margin: 5px 0;">• ${err}</p>`;
            });
            if (errors.length > 20) {
                message += `<p style="margin: 5px 0; color: var(--text-secondary);">... dan ${errors.length - 20} error lainnya</p>`;
            }
            message += `</div>`;
        }

        message += `</div>`;

        // Tampilkan di modal
        const modalContent = document.getElementById('paymentDetailContent');
        if (modalContent) {
            modalContent.innerHTML = message;
            Utils.showModal('paymentDetailModal');
        }

        // Toast notification
        if (successCount > 0) {
            Utils.showToast(`✅ ${successCount} siswa berhasil diimpor!`, 'success');
        } else if (errorCount > 0 || duplicateCount > 0) {
            Utils.showToast(`⚠️ Import selesai dengan ${errorCount + duplicateCount} error`, 'warning');
        }
    }
};
