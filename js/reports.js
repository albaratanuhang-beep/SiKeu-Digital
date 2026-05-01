// Reports and Statistics Module
const Reports = {
    currentPeriod: null,
    currentReport: null,
    currentClassFilter: null,
    isInitialized: false,

    // Initialize reports module
    async init() {
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }
        this.setDefaultPeriod();
        await this.populateClassFilter();
    },

    // Setup event listeners
    setupEventListeners() {
        // Generate report button
        document.getElementById('generateReportBtn').addEventListener('click', () => {
            this.generateReport();
        });

        // Export CSV button
        document.getElementById('exportCSVBtn').addEventListener('click', () => {
            this.exportCSV();
        });

        // Print report button
        document.getElementById('printReportBtn').addEventListener('click', () => {
            this.printReport();
        });

        // Print detailed report button
        document.getElementById('printDetailedReportBtn').addEventListener('click', () => {
            this.printDetailedReport();
        });

        // Receipt student select / input
        const receiptInput = document.getElementById('receiptStudentNIS');
        if (receiptInput) {
            receiptInput.addEventListener('input', Utils.debounce((e) => {
                this.handleStudentSelect(e.target.value);
            }, 300));
            receiptInput.addEventListener('change', (e) => {
                this.handleStudentSelect(e.target.value);
            });
        }

        // Print receipt button
        document.getElementById('printReceiptBtn').addEventListener('click', () => {
            this.printReceipt();
        });

        // Reset receipt button
        document.getElementById('resetReceiptBtn').addEventListener('click', () => {
            this.resetReceiptForm();
        });
    },

    // Set default period to current month
    setDefaultPeriod() {
        document.getElementById('reportPeriod').value = Utils.getCurrentMonth();
    },

    // Populate class filter dropdown
    async populateClassFilter() {
        await Students.loadStudents();
        const classes = Utils.getUniqueClasses(Students.currentStudents);
        const select = document.getElementById('reportClass');
        
        select.innerHTML = '<option value="">Semua Kelas</option>';
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            select.appendChild(option);
        });

        // Also populate receipt student select
        await this.populateReceiptStudentSelect();
    },

    // Populate receipt student select
    async populateReceiptStudentSelect() {
        await Students.loadStudents();
        const datalist = document.getElementById('receiptStudentsList');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        
        // Sort students by name
        const sortedStudents = [...Students.currentStudents].sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        sortedStudents.forEach(student => {
            const option = document.createElement('option');
            option.value = student.nis;
            option.textContent = `${student.name} (${student.nis}) - ${student.class}`;
            datalist.appendChild(option);
        });
    },

    // Generate report
    async generateReport() {
        const period = document.getElementById('reportPeriod').value;
        const classFilter = document.getElementById('reportClass').value;
        
        if (!period) {
            Utils.showToast('Silakan pilih periode laporan', 'warning');
            return;
        }

        this.currentPeriod = period;
        this.currentClassFilter = classFilter;
        await Payments.loadPayments();
        await Students.loadStudents();

        let payments = Payments.getPaymentsByMonth(period);
        let students = Students.currentStudents;

        // Apply class filter if selected
        if (classFilter) {
            payments = payments.filter(p => p.studentClass === classFilter);
            students = students.filter(s => s.class === classFilter);
        }

        const stats = Utils.calculateStats(payments);

        // Update summary
        document.getElementById('reportTotalPayments').textContent = stats.count;
        document.getElementById('reportTotalAmount').textContent = Utils.formatCurrency(stats.total);
        document.getElementById('reportAvgAmount').textContent = Utils.formatCurrency(stats.average);

        // Generate report by class
        this.generateReportByClass(period, payments, students);

        this.currentReport = {
            period,
            payments,
            stats,
            students,
            classFilter
        };

        Utils.showToast('Laporan berhasil dibuat', 'success');
    },

    // Generate report by class
    generateReportByClass(period, payments, students) {
        const tbody = document.getElementById('reportByClassBody');

        // Group students by class
        const studentsByClass = Utils.groupBy(students, 'class');
        
        // Group payments by class
        const paymentsByClass = Utils.groupBy(payments, 'studentClass');

        const classes = Object.keys(studentsByClass).sort();

        if (classes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Tidak ada data siswa</td></tr>';
            return;
        }

        const rows = classes.map(className => {
            const classStudents = studentsByClass[className] || [];
            const classPayments = paymentsByClass[className] || [];
            
            const totalStudents = classStudents.length;
            const paidStudents = new Set(classPayments.map(p => p.studentId)).size;
            const unpaidStudents = totalStudents - paidStudents;
            const totalAmount = classPayments.reduce((sum, p) => sum + p.amount, 0);

            return `
                <tr>
                    <td><strong>${Utils.sanitize(className)}</strong></td>
                    <td>${totalStudents}</td>
                    <td><span class="badge badge-success">${paidStudents}</span></td>
                    <td><span class="badge badge-${unpaidStudents > 0 ? 'danger' : 'success'}">${unpaidStudents}</span></td>
                    <td><strong>${Utils.formatCurrency(totalAmount)}</strong></td>
                    <td><button class="btn btn-sm btn-secondary" onclick="Reports.printClassReport('${className.replace(/'/g, "\\'")}')">🖨️ Cetak</button></td>
                </tr>
            `;
        });

        // Add total row
        const totalRow = `
            <tr style="background: var(--bg-color); font-weight: bold;">
                <td>TOTAL</td>
                <td>${students.length}</td>
                <td>${new Set(payments.map(p => p.studentId)).size}</td>
                <td>${students.length - new Set(payments.map(p => p.studentId)).size}</td>
                <td colspan="2">${Utils.formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}</td>
            </tr>
        `;

        tbody.innerHTML = rows.join('') + totalRow;
    },

    // Export to CSV
    exportCSV() {
        if (!this.currentReport) {
            Utils.showToast('Silakan generate laporan terlebih dahulu', 'warning');
            return;
        }

        const { period, payments } = this.currentReport;

        if (payments.length === 0) {
            Utils.showToast('Tidak ada data untuk diekspor', 'warning');
            return;
        }

        const csvData = payments.map(p => ({
            'Tanggal': p.date,
            'NIS': p.studentNIS,
            'Nama': p.studentName,
            'Kelas': p.studentClass,
            'Periode': p.period,
            'Jumlah': p.amount,
            'Metode': p.method,
            'Keterangan': p.notes || ''
        }));

        const filename = `Laporan_SPP_${period.replace('-', '_')}_${Date.now()}.csv`;
        Utils.exportToCSV(csvData, filename);
        Utils.showToast('Laporan berhasil diekspor ke CSV', 'success');
    },

    // Print report
    printReport() {
        if (!this.currentReport) {
            Utils.showToast('Silakan generate laporan terlebih dahulu', 'warning');
            return;
        }

        // Create print-friendly view
        const printWindow = window.open('', '_blank');
        const { period, payments, stats, students } = this.currentReport;
        const schoolInfo = Settings.getSchoolInfo();
        
        // Filter only "Lunas" payments
        const lunasPayments = payments.filter(p => p.status === 'Lunas');
        
        // Group by class
        const paymentsByClass = Utils.groupBy(lunasPayments, 'studentClass');
        const classes = Object.keys(paymentsByClass).sort();
        
        // Calculate total statistics for Lunas only
        const totalLunas = lunasPayments.reduce((sum, p) => sum + p.amount, 0);
        const countLunas = lunasPayments.length;

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan SPP - ${Utils.formatPeriod(period)}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 2cm 2cm 2cm 2cm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 0;
                        margin: 0;
                        color: #000;
                        orphans: 3;
                        widows: 3;
                    }
                    h1 { 
                        text-align: center; 
                        margin-bottom: 8px;
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    h2 { 
                        text-align: center; 
                        margin-top: 0; 
                        margin-bottom: 8px;
                        color: #666;
                        page-break-after: avoid;
                    }
                    h3 {
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    .summary {
                        margin: 15px 0;
                        padding: 12px;
                        background: #f5f5f5;
                        border-radius: 8px;
                        page-break-inside: avoid;
                    }
                    .summary p {
                        margin: 6px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0;
                        page-break-inside: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tbody {
                        orphans: 3;
                        widows: 3;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 10px;
                        text-align: left;
                    }
                    th {
                        background: #333;
                        color: white;
                    }
                    tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .footer {
                        margin-top: 40px;
                        page-break-inside: avoid;
                    }
                    @media print {
                        @page {
                            size: A4;
                            margin: 2cm 2cm 2cm 2cm;
                        }
                        body { 
                            padding: 0;
                            margin: 0;
                            orphans: 3;
                            widows: 3;
                        }
                        .footer { 
                            margin-top: 25px;
                            page-break-inside: avoid;
                        }
                        thead { 
                            display: table-header-group;
                        }
                        tbody {
                            orphans: 3;
                            widows: 3;
                        }
                        tr { 
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        h1, h2, h3 {
                            page-break-after: avoid;
                            orphans: 3;
                            widows: 3;
                        }
                        table {
                            page-break-inside: auto;
                        }
                    }
                </style>
            </head>
            <body>
                <h1 style="font-size: 14pt; margin-bottom: 5px; text-align: center;">LAPORAN PEMBAYARAN SPP (LUNAS)</h1>
                ${schoolInfo.schoolName ? `<h2 style="font-size: 12pt; margin-top: 0; margin-bottom: 5px; text-align: center;">${Utils.sanitize(schoolInfo.schoolName)}</h2>` : ''}
                <h3 style="font-size: 11pt; margin-top: 0; text-align: center; font-weight: normal;">Periode: ${Utils.formatPeriod(period)}</h3>
                
                <div class="summary">
                    <p><strong>Total Pembayaran Lunas:</strong> ${countLunas} transaksi</p>
                    <p><strong>Total Pemasukan:</strong> ${Utils.formatCurrency(totalLunas)}</p>
                    <p><strong>Rata-rata Pembayaran:</strong> ${Utils.formatCurrency(countLunas > 0 ? totalLunas / countLunas : 0)}</p>
                    <p><strong>Tanggal Cetak:</strong> ${Utils.formatDate(new Date().toISOString())}</p>
                </div>

                ${classes.map(className => {
                    const classPayments = paymentsByClass[className] || [];
                    const classTotal = classPayments.reduce((sum, p) => sum + p.amount, 0);
                    
                    return `
                        <div style="margin-top: 25px; page-break-inside: avoid;">
                            <h3 style="background: #f0f0f0; padding: 8px; border-left: 4px solid #333; margin-bottom: 10px;">
                                Kelas: ${Utils.sanitize(className)} 
                                <span style="font-weight: normal; font-size: 11px;">(${classPayments.length} pembayaran lunas | Total: ${Utils.formatCurrency(classTotal)})</span>
                            </h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 30px;">No</th>
                                        <th style="width: 90px;">Tanggal</th>
                                        <th style="width: 80px;">NIS</th>
                                        <th>Nama</th>
                                        <th style="width: 110px;">Jumlah</th>
                                        <th style="width: 90px;">Metode</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${classPayments.map((p, i) => `
                                        <tr>
                                            <td>${i + 1}</td>
                                            <td>${Utils.formatDate(p.date)}</td>
                                            <td>${p.studentNIS}</td>
                                            <td>${p.studentName}</td>
                                            <td><strong>${Utils.formatCurrency(p.amount)}</strong></td>
                                            <td>${p.method}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                                <tfoot>
                                    <tr style="font-weight: bold; background: #f0f0f0;">
                                        <td colspan="4" style="text-align: right;">SUBTOTAL KELAS:</td>
                                        <td colspan="2">${Utils.formatCurrency(classTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    `;
                }).join('')}
                
                <div style="margin-top: 30px; padding: 15px; background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; page-break-inside: avoid;">
                    <h3 style="margin: 0 0 10px 0; color: #2e7d32; text-align: center;">TOTAL KESELURUHAN</h3>
                    <p style="text-align: center; font-size: 18px; font-weight: bold; margin: 0; color: #1b5e20;">
                        ${Utils.formatCurrency(totalLunas)}
                    </p>
                    <p style="text-align: center; font-size: 12px; margin: 5px 0 0 0; color: #666;">
                        Dari ${countLunas} pembayaran lunas
                    </p>
                </div>

                <div class="footer">
                    <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 60px;">Kepala Sekolah,</p>
                            ${schoolInfo.principalName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.principalName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 60px;">Bendahara Sekolah,</p>
                            ${schoolInfo.treasurerName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.treasurerName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },

    // Print detailed report with student lists
    printDetailedReport() {
        if (!this.currentReport) {
            Utils.showToast('Silakan generate laporan terlebih dahulu', 'warning');
            return;
        }

        const { period, payments, stats, students, classFilter } = this.currentReport;
        const printWindow = window.open('', '_blank');
        const schoolInfo = Settings.getSchoolInfo();

        // Group students by class
        const studentsByClass = Utils.groupBy(students, 'class');
        const paymentsByClass = Utils.groupBy(payments, 'studentClass');
        const classes = Object.keys(studentsByClass).sort();

        // Generate detailed report for each class
        const classReports = classes.map(className => {
            const classStudents = studentsByClass[className] || [];
            const classPayments = paymentsByClass[className] || [];
            
            // Group payments by student
            const paymentsByStudent = {};
            classPayments.forEach(payment => {
                if (!paymentsByStudent[payment.studentId]) {
                    paymentsByStudent[payment.studentId] = [];
                }
                paymentsByStudent[payment.studentId].push(payment);
            });
            
            // Calculate statistics
            const lunasCount = Object.keys(paymentsByStudent).filter(studentId => {
                const studentPayments = paymentsByStudent[studentId];
                return studentPayments.some(p => p.status === 'Lunas');
            }).length;
            const belumLunasCount = Object.keys(paymentsByStudent).filter(studentId => {
                const studentPayments = paymentsByStudent[studentId];
                return studentPayments.some(p => p.status === 'Belum Lunas') && 
                       !studentPayments.some(p => p.status === 'Lunas');
            }).length;
            const belumBayarCount = classStudents.length - Object.keys(paymentsByStudent).length;

            return `
                <div class="class-section">
                    <h3>Kelas: ${Utils.sanitize(className)} <span style="font-weight: normal; font-size: 10px;">(Total: ${classStudents.length} | Lunas: ${lunasCount} | Belum Lunas: ${belumLunasCount} | Belum Bayar: ${belumBayarCount})</span></h3>
                    
                    <table style="font-size: 10px;">
                        <thead>
                            <tr>
                                <th style="width: 30px;">No</th>
                                <th style="width: 70px;">NIS</th>
                                <th>Nama</th>
                                <th style="width: 80px;">Tanggal</th>
                                <th style="width: 85px;">Jumlah</th>
                                <th style="width: 70px;">Metode</th>
                                <th style="width: 80px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classStudents.map((student, idx) => {
                                const studentPayments = paymentsByStudent[student.id] || [];
                                
                                if (studentPayments.length === 0) {
                                    // Student has not paid
                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td>${student.nis}</td>
                                            <td>${student.name}</td>
                                            <td>-</td>
                                            <td>-</td>
                                            <td>-</td>
                                            <td style="color: #ef4444; font-weight: bold;">Belum Bayar</td>
                                        </tr>
                                    `;
                                } else if (studentPayments.length === 1) {
                                    // Student has one payment
                                    const payment = studentPayments[0];
                                    const statusColor = payment.status === 'Lunas' ? '#10b981' : 
                                                       payment.status === 'Belum Lunas' ? '#f59e0b' : '#ef4444';
                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td>${student.nis}</td>
                                            <td>${student.name}</td>
                                            <td>${Utils.formatDate(payment.date)}</td>
                                            <td>${Utils.formatCurrency(payment.amount)}</td>
                                            <td>${payment.method}</td>
                                            <td style="color: ${statusColor}; font-weight: bold;">${payment.status || '-'}</td>
                                        </tr>
                                    `;
                                } else {
                                    // Student has multiple payments
                                    return studentPayments.map((payment, payIdx) => {
                                        const statusColor = payment.status === 'Lunas' ? '#10b981' : 
                                                           payment.status === 'Belum Lunas' ? '#f59e0b' : '#ef4444';
                                        return `
                                            <tr>
                                                <td>${idx + 1}${payIdx > 0 ? '.' + payIdx : ''}</td>
                                                <td>${payIdx === 0 ? student.nis : ''}</td>
                                                <td style="font-size: ${payIdx === 0 ? '10px' : '9px'};">${payIdx === 0 ? student.name : '↳ Bayar-' + (payIdx + 1)}</td>
                                                <td>${Utils.formatDate(payment.date)}</td>
                                                <td>${Utils.formatCurrency(payment.amount)}</td>
                                                <td>${payment.method}</td>
                                                <td style="color: ${statusColor}; font-weight: bold;">${payment.status || '-'}</td>
                                            </tr>
                                        `;
                                    }).join('');
                                }
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Detail SPP - ${Utils.formatPeriod(period)}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 2cm 2cm 2cm 2cm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 0;
                        margin: 0;
                        color: #000;
                        font-size: 11px;
                        orphans: 3;
                        widows: 3;
                    }
                    h1 { 
                        text-align: center; 
                        margin-bottom: 5px; 
                        font-size: 16px;
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    h2 { 
                        text-align: center; 
                        margin-top: 0; 
                        margin-bottom: 8px;
                        color: #666; 
                        font-size: 13px;
                        page-break-after: avoid;
                    }
                    h3 { 
                        margin-top: 12px; 
                        margin-bottom: 6px;
                        padding: 6px 8px; 
                        background: #f0f0f0; 
                        border-left: 3px solid #333;
                        font-size: 12px;
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    h4 { 
                        margin-top: 10px; 
                        margin-bottom: 5px; 
                        font-size: 11px;
                    }
                    .summary {
                        margin: 10px 0;
                        padding: 8px 12px;
                        background: #f5f5f5;
                        border-radius: 4px;
                        font-size: 10px;
                    }
                    .summary p { 
                        margin: 3px 0; 
                        display: inline-block;
                        margin-right: 20px;
                    }
                    .class-section {
                        page-break-inside: auto;
                        margin-bottom: 15px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 5px 0;
                        font-size: 10px;
                        page-break-inside: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tbody {
                        orphans: 3;
                        widows: 3;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 4px 6px;
                        text-align: left;
                    }
                    th {
                        background: #333;
                        color: white;
                        font-weight: bold;
                        font-size: 10px;
                    }
                    tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .footer {
                        margin-top: 20px;
                        page-break-inside: avoid;
                    }
                    @media print {
                        @page {
                            size: A4;
                            margin: 2cm 2cm 2cm 2cm;
                        }
                        body { 
                            padding: 0;
                            margin: 0;
                            font-size: 10px;
                            orphans: 3;
                            widows: 3;
                        }
                        h1 { 
                            font-size: 14px; 
                            margin-bottom: 3px;
                            page-break-after: avoid;
                            orphans: 3;
                            widows: 3;
                        }
                        h2 { 
                            font-size: 11px; 
                            margin-bottom: 6px;
                            page-break-after: avoid;
                        }
                        h3 { 
                            font-size: 11px; 
                            margin-top: 10px; 
                            padding: 4px 6px;
                            page-break-after: avoid;
                            orphans: 3;
                            widows: 3;
                        }
                        h4 { 
                            font-size: 10px; 
                            margin-top: 6px;
                            page-break-after: avoid;
                        }
                        .summary { 
                            padding: 6px 10px; 
                            margin: 6px 0;
                            font-size: 9px;
                            page-break-inside: avoid;
                            page-break-after: avoid;
                        }
                        .summary p { margin-right: 15px; }
                        .class-section {
                            page-break-inside: auto;
                        }
                        table { 
                            font-size: 9px; 
                            margin: 3px 0;
                            page-break-inside: auto;
                        }
                        thead {
                            display: table-header-group;
                        }
                        tbody {
                            orphans: 3;
                            widows: 3;
                        }
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        th, td { padding: 3px 4px; }
                        th { font-size: 9px; }
                        .class-section { 
                            margin-bottom: 15px;
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        .paid-section, .unpaid-section { 
                            margin-bottom: 10px;
                            page-break-inside: avoid;
                        }
                        .footer { 
                            margin-top: 15px;
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <h1 style="font-size: 14pt; margin-bottom: 5px; text-align: center;">LAPORAN DETAIL PEMBAYARAN SPP</h1>
                ${schoolInfo.schoolName ? `<h2 style="font-size: 12pt; margin-top: 0; margin-bottom: 5px; text-align: center;">${Utils.sanitize(schoolInfo.schoolName)}</h2>` : ''}
                <h3 style="font-size: 11pt; margin-top: 0; text-align: center; font-weight: normal;">Periode: ${Utils.formatPeriod(period)}${classFilter ? ' - Kelas: ' + classFilter : ''}</h3>
                
                <div class="summary">
                    <p><strong>Total Siswa:</strong> ${students.length}</p>
                    <p><strong>Sudah Membayar:</strong> ${new Set(payments.map(p => p.studentId)).size} siswa</p>
                    <p><strong>Belum Membayar:</strong> ${students.length - new Set(payments.map(p => p.studentId)).size} siswa</p>
                    <p><strong>Total Transaksi:</strong> ${stats.count}</p>
                    <p><strong>Total Pemasukan:</strong> ${Utils.formatCurrency(stats.total)}</p>
                    <p><strong>Tanggal Cetak:</strong> ${Utils.formatDate(new Date().toISOString())}</p>
                </div>

                ${classReports}

                <div class="footer">
                    <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 10px;">
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 50px;">Kepala Sekolah,</p>
                            ${schoolInfo.principalName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.principalName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 50px;">Bendahara Sekolah,</p>
                            ${schoolInfo.treasurerName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.treasurerName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },

    // Print report for specific class
    printClassReport(className) {
        if (!this.currentReport) {
            Utils.showToast('Silakan generate laporan terlebih dahulu', 'warning');
            return;
        }

        const { period, payments, students } = this.currentReport;
        const printWindow = window.open('', '_blank');
        const schoolInfo = Settings.getSchoolInfo();

        // Filter data for specific class
        const classStudents = students.filter(s => s.class === className);
        const classPayments = payments.filter(p => p.studentClass === className);
        
        // Group payments by student
        const paymentsByStudent = {};
        classPayments.forEach(payment => {
            if (!paymentsByStudent[payment.studentId]) {
                paymentsByStudent[payment.studentId] = [];
            }
            paymentsByStudent[payment.studentId].push(payment);
        });
        
        // Calculate statistics
        const totalAmount = classPayments.reduce((sum, p) => sum + p.amount, 0);
        const lunasCount = Object.keys(paymentsByStudent).filter(studentId => {
            const studentPayments = paymentsByStudent[studentId];
            return studentPayments.some(p => p.status === 'Lunas');
        }).length;
        const belumLunasCount = Object.keys(paymentsByStudent).filter(studentId => {
            const studentPayments = paymentsByStudent[studentId];
            return studentPayments.some(p => p.status === 'Belum Lunas') && 
                   !studentPayments.some(p => p.status === 'Lunas');
        }).length;
        const belumBayarCount = classStudents.length - Object.keys(paymentsByStudent).length;

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Kelas ${className} - ${Utils.formatPeriod(period)}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 2cm 2cm 2cm 2cm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 0;
                        margin: 0;
                        orphans: 3;
                        widows: 3;
                        color: #000;
                    }
                    h1 { 
                        text-align: center; 
                        margin-bottom: 8px;
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    h2 { 
                        text-align: center; 
                        margin-top: 0;
                        margin-bottom: 8px;
                        color: #666;
                        page-break-after: avoid;
                    }
                    h3 { 
                        margin-top: 15px; 
                        margin-bottom: 8px;
                        page-break-after: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    .summary {
                        margin: 15px 0;
                        padding: 12px;
                        background: #f5f5f5;
                        border-radius: 8px;
                        page-break-inside: avoid;
                    }
                    .summary p { margin: 6px 0; }
                    .student-section {
                        margin-top: 20px;
                        page-break-inside: auto;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 8px 0;
                        page-break-inside: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tbody {
                        orphans: 3;
                        widows: 3;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background: #333;
                        color: white;
                    }
                    tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .footer {
                        margin-top: 40px;
                        page-break-inside: avoid;
                    }
                    @media print {
                        @page {
                            size: A4;
                            margin: 2cm 2cm 2cm 2cm;
                        }
                        body { 
                            padding: 0;
                            margin: 0;
                            orphans: 3;
                            widows: 3;
                        }
                        h1, h2, h3 {
                            page-break-after: avoid;
                            orphans: 3;
                            widows: 3;
                        }
                        .summary {
                            page-break-inside: avoid;
                            page-break-after: avoid;
                        }
                        .footer { 
                            margin-top: 25px;
                            page-break-inside: avoid;
                        }
                        thead { 
                            display: table-header-group;
                        }
                        tbody {
                            orphans: 3;
                            widows: 3;
                        }
                        tr { 
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        .student-section { 
                            page-break-inside: auto;
                        }
                        table {
                            page-break-inside: auto;
                        }
                    }
                </style>
            </head>
            <body>
                <h1 style="font-size: 14pt; margin-bottom: 5px; text-align: center;">LAPORAN PEMBAYARAN SPP</h1>
                ${schoolInfo.schoolName ? `<h2 style="font-size: 12pt; margin-top: 0; margin-bottom: 5px; text-align: center;">${Utils.sanitize(schoolInfo.schoolName)}</h2>` : ''}
                <h3 style="font-size: 11pt; margin-top: 0; text-align: center; font-weight: normal;">Kelas: ${Utils.sanitize(className)} | Periode: ${Utils.formatPeriod(period)}</h3>
                
                <div class="summary">
                    <p><strong>Total Siswa:</strong> ${classStudents.length}</p>
                    <p><strong>Lunas:</strong> ${lunasCount} siswa | <strong>Belum Lunas:</strong> ${belumLunasCount} siswa | <strong>Belum Bayar:</strong> ${belumBayarCount} siswa</p>
                    <p><strong>Total Pemasukan:</strong> ${Utils.formatCurrency(totalAmount)}</p>
                    <p><strong>Tanggal Cetak:</strong> ${Utils.formatDate(new Date().toISOString())}</p>
                </div>

                <div class="student-section">
                    <h3>📊 Data Pembayaran Siswa Kelas ${Utils.sanitize(className)}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px;">No</th>
                                <th style="width: 80px;">NIS</th>
                                <th>Nama</th>
                                <th style="width: 90px;">Tanggal</th>
                                <th style="width: 100px;">Jumlah</th>
                                <th style="width: 80px;">Metode</th>
                                <th style="width: 90px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classStudents.map((student, idx) => {
                                const studentPayments = paymentsByStudent[student.id] || [];
                                
                                if (studentPayments.length === 0) {
                                    // Student has not paid
                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td>${student.nis}</td>
                                            <td>${student.name}</td>
                                            <td>-</td>
                                            <td>-</td>
                                            <td>-</td>
                                            <td style="color: #ef4444; font-weight: bold;">Belum Bayar</td>
                                        </tr>
                                    `;
                                } else if (studentPayments.length === 1) {
                                    // Student has one payment
                                    const payment = studentPayments[0];
                                    const statusColor = payment.status === 'Lunas' ? '#10b981' : 
                                                       payment.status === 'Belum Lunas' ? '#f59e0b' : '#ef4444';
                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td>${student.nis}</td>
                                            <td>${student.name}</td>
                                            <td>${Utils.formatDate(payment.date)}</td>
                                            <td>${Utils.formatCurrency(payment.amount)}</td>
                                            <td>${payment.method}</td>
                                            <td style="color: ${statusColor}; font-weight: bold;">${payment.status || '-'}</td>
                                        </tr>
                                    `;
                                } else {
                                    // Student has multiple payments
                                    return studentPayments.map((payment, payIdx) => {
                                        const statusColor = payment.status === 'Lunas' ? '#10b981' : 
                                                           payment.status === 'Belum Lunas' ? '#f59e0b' : '#ef4444';
                                        return `
                                            <tr>
                                                <td>${idx + 1}${payIdx > 0 ? '.' + payIdx : ''}</td>
                                                <td>${payIdx === 0 ? student.nis : ''}</td>
                                                <td>${payIdx === 0 ? student.name : '<em style="color: #999;">↳ Pembayaran ke-' + (payIdx + 1) + '</em>'}</td>
                                                <td>${Utils.formatDate(payment.date)}</td>
                                                <td>${Utils.formatCurrency(payment.amount)}</td>
                                                <td>${payment.method}</td>
                                                <td style="color: ${statusColor}; font-weight: bold;">${payment.status || '-'}</td>
                                            </tr>
                                        `;
                                    }).join('');
                                }
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="footer">
                    <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 60px;">Kepala Sekolah,</p>
                            ${schoolInfo.principalName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.principalName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                        <div style="width: 45%; text-align: center;">
                            <p style="margin-bottom: 60px;">Bendahara Sekolah,</p>
                            ${schoolInfo.treasurerName ? `<p style="margin: 0; font-weight: bold;">${Utils.sanitize(schoolInfo.treasurerName)}</p>` : '<p style="margin: 0;">(...........................)</p>'}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },

    // Handle student select for receipt
    async handleStudentSelect(value) {
        const printBtn = document.getElementById('printReceiptBtn');
        const preview = document.getElementById('receiptPreview');
        const previewContent = document.getElementById('receiptPreviewContent');
        const infoDiv = document.getElementById('selectedReceiptStudentInfo');
        
        if (!value) {
            printBtn.disabled = true;
            preview.style.display = 'none';
            if (infoDiv) {
                infoDiv.innerHTML = '';
                infoDiv.classList.remove('active');
            }
            this.selectedStudentReceipt = null;
            return;
        }

        // Try to find student by NIS
        let student = Students.currentStudents.find(s => s.nis === value);

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
            this.selectedStudentReceipt = student;
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <strong>✓ Siswa ditemukan:</strong><br>
                    NIS: ${student.nis}<br>
                    Nama: ${student.name}<br>
                    Kelas: ${student.class}
                `;
                infoDiv.classList.add('active');
            }
        } else {
            this.selectedStudentReceipt = null;
            printBtn.disabled = true;
            preview.style.display = 'none';
            if (infoDiv) {
                infoDiv.innerHTML = '<span style="color: var(--danger-color);">⚠️ Siswa tidak ditemukan</span>';
                infoDiv.classList.remove('active');
            }
            return;
        }

        // Load payments for selected student
        await Payments.loadPayments();
        
        const studentPayments = Payments.currentPayments.filter(p => 
            p.studentId === student.id
        );

        if (studentPayments.length === 0) {
            printBtn.disabled = true;
            preview.style.display = 'none';
            Utils.showToast('Siswa ini belum memiliki pembayaran', 'warning');
            return;
        }

        // Sort by period ascending (oldest first)
        const sortedPayments = Utils.sortBy(studentPayments, 'period', true);
        
        // Calculate total
        const totalAmount = sortedPayments.reduce((sum, p) => sum + p.amount, 0);

        // Show preview with all payments
        previewContent.innerHTML = `
            <div style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 5px;">
                <h4 style="margin: 0 0 8px 0; color: #1976d2;">📋 Informasi Siswa</h4>
                <table style="width: 100%; font-size: 0.9rem; line-height: 1.6;">
                    <tr>
                        <td style="width: 35%; font-weight: 600;">Nama</td>
                        <td style="width: 5%;">:</td>
                        <td>${Utils.sanitize(student.name)}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 600;">NIS</td>
                        <td>:</td>
                        <td>${Utils.sanitize(student.nis)}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 600;">Kelas</td>
                        <td>:</td>
                        <td>${Utils.sanitize(student.class)}</td>
                    </tr>
                </table>
            </div>
            
            <div style="margin-bottom: 10px;">
                <h4 style="margin: 0 0 10px 0; color: #2e7d32;">💰 Riwayat Pembayaran (${sortedPayments.length} transaksi)</h4>
                <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">No</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Tanggal</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Periode</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Jumlah</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Metode</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedPayments.map((payment, idx) => {
                            const statusColor = payment.status === 'Lunas' ? '#10b981' : 
                                               payment.status === 'Belum Lunas' ? '#f59e0b' : '#ef4444';
                            return `
                                <tr>
                                    <td style="padding: 6px; border: 1px solid #ddd;">${idx + 1}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd;">${Utils.formatDate(payment.date)}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd;">${Utils.formatPeriod(payment.period)}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: 600;">${Utils.formatCurrency(payment.amount)}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd;">${Utils.sanitize(payment.method)}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">
                                        <span style="color: ${statusColor}; font-weight: bold; font-size: 0.8rem;">${Utils.sanitize(payment.status || '-')}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f0f0f0; font-weight: bold;">
                            <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;">TOTAL:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #2e7d32; font-size: 1.1rem;">${Utils.formatCurrency(totalAmount)}</td>
                            <td colspan="2" style="padding: 8px; border: 1px solid #ddd;"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        preview.style.display = 'block';
        printBtn.disabled = false;
    },


    // Print receipt
    printReceipt() {
        const student = this.selectedStudentReceipt;
        
        if (!student) {
            Utils.showToast('Silakan pilih siswa yang valid', 'warning');
            return;
        }

        // Get all payments for this student
        const studentPayments = Payments.currentPayments.filter(p => 
            p.studentId === student.id
        );

        if (studentPayments.length === 0) {
            Utils.showToast('Tidak ada pembayaran untuk dicetak', 'warning');
            return;
        }

        // Sort by period ascending
        const sortedPayments = Utils.sortBy(studentPayments, 'period', true);
        const totalAmount = sortedPayments.reduce((sum, p) => sum + p.amount, 0);

        const schoolInfo = Settings.getSchoolInfo();

        // Convert total amount to words (Terbilang)
        const amountInWords = this.numberToWords(totalAmount);

        const printWindow = window.open('', '_blank');
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Kwitansi Pembayaran SPP - ${student.name}</title>
                <style>
                    @page {
                        size: A6 portrait;
                        margin: 10mm;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Arial', sans-serif;
                        padding: 8px;
                        width: 105mm;
                        margin: 0 auto;
                        font-size: 9px;
                    }
                    .receipt-container {
                        border: 2px solid #333;
                        padding: 8px;
                        position: relative;
                    }
                    .receipt-header {
                        text-align: center;
                        border-bottom: 2px double #333;
                        padding-bottom: 6px;
                        margin-bottom: 8px;
                    }
                    .receipt-header h1 {
                        font-size: 11px;
                        margin-bottom: 2px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .receipt-header h2 {
                        font-size: 9px;
                        font-weight: normal;
                        color: #666;
                        margin-bottom: 3px;
                    }
                    .receipt-header p {
                        font-size: 7px !important;
                        color: #666;
                        margin-top: 2px !important;
                    }
                    .receipt-body {
                        margin: 8px 0;
                    }
                    .receipt-row {
                        display: flex;
                        margin-bottom: 4px;
                        font-size: 8px;
                        line-height: 1.3;
                    }
                    .receipt-label {
                        width: 60px;
                        font-weight: 600;
                        flex-shrink: 0;
                    }
                    .receipt-separator {
                        width: 8px;
                        text-align: center;
                        flex-shrink: 0;
                    }
                    .receipt-value {
                        flex: 1;
                    }
                    h3 {
                        margin: 8px 0 4px 0;
                        font-size: 8px;
                        border-bottom: 1px solid #333;
                        padding-bottom: 2px;
                    }
                    .payments-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 6px 0;
                        font-size: 7px;
                    }
                    .payments-table th,
                    .payments-table td {
                        border: 1px solid #333;
                        padding: 3px 2px;
                        text-align: left;
                    }
                    .payments-table th {
                        background: #333;
                        color: white;
                        font-weight: bold;
                        font-size: 7px;
                    }
                    .payments-table tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .payments-table tfoot td {
                        font-weight: bold;
                        background: #e8f5e9;
                        font-size: 7px;
                    }
                    .amount-box {
                        border: 1px solid #333;
                        padding: 6px;
                        margin: 8px 0;
                        background: #f9f9f9;
                    }
                    .amount-box .amount {
                        font-size: 11px;
                        font-weight: bold;
                        color: #10b981;
                        margin-bottom: 3px;
                    }
                    .amount-box .amount-words {
                        font-size: 7px;
                        font-style: italic;
                        color: #666;
                    }
                    .receipt-footer {
                        margin-top: 10px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .signature-box {
                        width: 48%;
                        text-align: center;
                    }
                    .signature-box p {
                        margin-bottom: 25px;
                        font-size: 7px;
                    }
                    .signature-box .name {
                        font-weight: bold;
                        border-bottom: 1px solid #333;
                        display: inline-block;
                        min-width: 35mm;
                        padding-bottom: 1px;
                        font-size: 7px;
                    }
                    .signature-box .nip {
                        font-size: 6px;
                        color: #666;
                        margin-top: 2px;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 1px 4px;
                        border-radius: 6px;
                        font-size: 6px;
                        font-weight: bold;
                        color: white;
                    }
                    .status-lunas { background: #10b981; }
                    .status-belum-lunas { background: #f59e0b; }
                    .status-belum-bayar { background: #ef4444; }
                    @media print {
                        @page {
                            size: A6 portrait;
                            margin: 10mm;
                        }
                        body {
                            padding: 0;
                            width: 105mm;
                        }
                        .receipt-container {
                            border: 2px solid #000;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="receipt-header">
                        <h1>${schoolInfo.schoolName || 'NAMA SEKOLAH'}</h1>
                        <h2>KWITANSI PEMBAYARAN SPP</h2>
                        <p style="font-size: 12px; color: #666; margin-top: 5px;">Tanggal Cetak: ${Utils.formatDate(new Date().toISOString())}</p>
                    </div>

                    <div class="receipt-body">
                        <div class="receipt-row">
                            <div class="receipt-label">Telah diterima dari</div>
                            <div class="receipt-separator">:</div>
                            <div class="receipt-value"><strong>${Utils.sanitize(student.name)}</strong></div>
                        </div>
                        <div class="receipt-row">
                            <div class="receipt-label">NIS</div>
                            <div class="receipt-separator">:</div>
                            <div class="receipt-value">${Utils.sanitize(student.nis)}</div>
                        </div>
                        <div class="receipt-row">
                            <div class="receipt-label">Kelas</div>
                            <div class="receipt-separator">:</div>
                            <div class="receipt-value">${Utils.sanitize(student.class)}</div>
                        </div>
                        <div class="receipt-row">
                            <div class="receipt-label">Untuk Pembayaran</div>
                            <div class="receipt-separator">:</div>
                            <div class="receipt-value"><strong>SPP (${sortedPayments.length} Transaksi)</strong></div>
                        </div>
                    </div>

                    <h3 style="margin: 8px 0 4px 0; font-size: 8px; border-bottom: 1px solid #333; padding-bottom: 2px;">Rincian Pembayaran:</h3>
                    <table class="payments-table">
                        <thead>
                            <tr>
                                <th style="width: 12px; text-align: center;">No</th>
                                <th style="width: 22mm;">Tanggal</th>
                                <th style="width: 18mm;">Periode</th>
                                <th style="width: 20mm; text-align: right;">Jumlah</th>
                                <th style="width: 15mm;">Metode</th>
                                <th style="width: 12mm; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedPayments.map((payment, idx) => {
                                const statusClass = payment.status === 'Lunas' ? 'status-lunas' : 
                                                   payment.status === 'Belum Lunas' ? 'status-belum-lunas' : 'status-belum-bayar';
                                return `
                                    <tr>
                                        <td style="text-align: center; font-size: 7px;">${idx + 1}</td>
                                        <td style="font-size: 6px;">${Utils.formatDate(payment.date)}</td>
                                        <td style="font-size: 6px;">${Utils.formatPeriod(payment.period)}</td>
                                        <td style="text-align: right; font-weight: 600; font-size: 7px;">${Utils.formatCurrency(payment.amount)}</td>
                                        <td style="font-size: 6px;">${Utils.sanitize(payment.method)}</td>
                                        <td style="text-align: center;">
                                            <span class="status-badge ${statusClass}">${Utils.sanitize(payment.status || '-')}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="text-align: right; font-size: 7px;">TOTAL:</td>
                                <td style="text-align: right; font-size: 8px; font-weight: bold; color: #10b981;">${Utils.formatCurrency(totalAmount)}</td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="amount-box">
                        <div class="amount">${Utils.formatCurrency(totalAmount)}</div>
                        <div class="amount-words"># ${amountInWords} Rupiah #</div>
                    </div>

                    <div class="receipt-footer">
                        <div class="signature-box">
                            <p>Yang Menerima,</p>
                            <div class="name">${schoolInfo.treasurerName || '(...........................)'}</div>
                            <div class="nip">Bendahara</div>
                        </div>
                        <div class="signature-box">
                            <p>Yang Menyerahkan,</p>
                            <div class="name">${Utils.sanitize(student.name)}</div>
                            <div class="nip">Siswa/Orang Tua/Wali</div>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    },

    // Reset receipt form
    resetReceiptForm() {
        const input = document.getElementById('receiptStudentNIS');
        if (input) input.value = '';
        const infoDiv = document.getElementById('selectedReceiptStudentInfo');
        if (infoDiv) {
            infoDiv.innerHTML = '';
            infoDiv.classList.remove('active');
        }
        this.selectedStudentReceipt = null;
        document.getElementById('printReceiptBtn').disabled = true;
        document.getElementById('receiptPreview').style.display = 'none';
    },

    // Convert number to words (Indonesian)
    numberToWords(num) {
        if (num === 0) return 'Nol';
        
        const ones = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
        const teens = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas', 'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];
        const tens = ['', '', 'Dua Puluh', 'Tiga Puluh', 'Empat Puluh', 'Lima Puluh', 'Enam Puluh', 'Tujuh Puluh', 'Delapan Puluh', 'Sembilan Puluh'];
        
        const convertLessThanThousand = (n) => {
            if (n === 0) return '';
            if (n < 10) return ones[n];
            if (n < 20) return teens[n - 10];
            if (n < 100) {
                const ten = Math.floor(n / 10);
                const one = n % 10;
                return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
            }
            const hundred = Math.floor(n / 100);
            const rest = n % 100;
            const hundredWord = hundred === 1 ? 'Seratus' : ones[hundred] + ' Ratus';
            return hundredWord + (rest > 0 ? ' ' + convertLessThanThousand(rest) : '');
        };
        
        if (num < 1000) {
            return convertLessThanThousand(num);
        }
        
        if (num < 1000000) {
            const thousand = Math.floor(num / 1000);
            const rest = num % 1000;
            const thousandWord = thousand === 1 ? 'Seribu' : convertLessThanThousand(thousand) + ' Ribu';
            return thousandWord + (rest > 0 ? ' ' + convertLessThanThousand(rest) : '');
        }
        
        if (num < 1000000000) {
            const million = Math.floor(num / 1000000);
            const rest = num % 1000000;
            const millionWord = convertLessThanThousand(million) + ' Juta';
            return millionWord + (rest > 0 ? ' ' + this.numberToWords(rest) : '');
        }
        
        return 'Angka terlalu besar';
    }
};
