// Dashboard Module
const Dashboard = {
    // Initialize dashboard
    async init() {
        await this.updateStats();
        await this.loadRecentPayments();
    },

    // Update dashboard statistics
    async updateStats() {
        await Students.loadStudents();
        await Payments.loadPayments();

        const students = Students.currentStudents;
        const allPayments = Payments.currentPayments;
        const currentMonth = Utils.getCurrentMonth();
        const today = Utils.getCurrentDate();

        // Total students
        document.getElementById('totalStudents').textContent = students.length;

        // Payments this month
        const monthPayments = allPayments.filter(p => p.period === currentMonth);
        const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        document.getElementById('totalPaymentsMonth').textContent = Utils.formatCurrency(monthTotal);

        // Payments today
        const todayPayments = allPayments.filter(p => p.date === today);
        document.getElementById('totalPaymentsToday').textContent = todayPayments.length;

        // Total revenue
        const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
        document.getElementById('totalRevenue').textContent = Utils.formatCurrency(totalRevenue);
    },

    // Load recent payments
    async loadRecentPayments() {
        await Payments.loadPayments();
        
        const payments = Payments.currentPayments;
        const recent = Utils.sortBy(payments, 'createdAt', false).slice(0, 10);

        const tbody = document.getElementById('recentPaymentsBody');

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada pembayaran</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(p => `
            <tr>
                <td>${Utils.formatDate(p.date)}</td>
                <td>${Utils.sanitize(p.studentNIS)}</td>
                <td>${Utils.sanitize(p.studentName)}</td>
                <td>${Utils.formatPeriod(p.period)}</td>
                <td><strong>${Utils.formatCurrency(p.amount)}</strong></td>
            </tr>
        `).join('');
    }
};
