// Dashboard JavaScript with Database Integration
import { db } from '../js/database.js';

class DashboardService {
    constructor() {
        this.initializeDashboard();
    }

    async initializeDashboard() {
        try {
            console.log('=== INITIALIZING DASHBOARD ===');

            // Debug: Show all invoices
            await this.debugShowAllInvoices();
            
            // Load branches for filter
            await this.loadBranches();
            
            // Initialize dashboard with default filters
            await this.updateDashboard();
            
            console.log('=== DASHBOARD INITIALIZATION COMPLETED ===');
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    }

    async loadBranches() {
        try {
            const branches = await db.getBranches();
            const branchFilter = document.getElementById('branchFilter');
            
            if (branchFilter && branches) {
                // Clear existing options except "all"
                branchFilter.innerHTML = '<option value="all">جميع الفروع</option>';
                
                // Add branch options
                branches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.branch_num;
                    option.textContent = branch.name || branch.branch_num;
                    branchFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    }

    async updateDashboard() {
        try {
            const timeFilter = document.getElementById('timeFilter')?.value || 'month';
            const branchFilter = document.getElementById('branchFilter')?.value || 'all';
            
            console.log('Updating dashboard with filters:', { timeFilter, branchFilter });
            
            // Get date range based on time filter
            const { fromDate, toDate } = this.getDateRange(timeFilter);
            console.log('Date range:', { fromDate, toDate });
            
            // Update all dashboard components sequentially to avoid conflicts
            console.log('Starting dashboard updates...');
            
            await this.updateStatistics(fromDate, toDate, branchFilter);
            console.log('Statistics updated');
            
            await this.updateBranchSalesChart(fromDate, toDate, branchFilter);
            console.log('Branch sales chart updated');
            
            await this.updateRevenueChart(fromDate, toDate, branchFilter);
            console.log('Revenue chart updated');
            
            await this.updateCategoryChart();
            console.log('Category chart updated');
            
            await this.updateLowStockChart();
            console.log('Low stock chart updated');
            
            await this.updateLowStockTable();
            console.log('Low stock table updated');
            
            console.log('Dashboard update completed');
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    getDateRange(timeFilter) {
        const now = new Date();
        let fromDate, toDate;
        
        switch (timeFilter) {
            case 'today':
                fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'week':
                fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                toDate = now;
                break;
            case 'month':
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                toDate = now;
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                fromDate = new Date(now.getFullYear(), quarter * 3, 1);
                toDate = now;
                break;
            case 'year':
                fromDate = new Date(now.getFullYear(), 0, 1);
                toDate = now;
                break;
            default:
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                toDate = now;
        }
        
        return {
            fromDate: fromDate.toISOString().split('T')[0],
            toDate: toDate.toISOString().split('T')[0]
        };
    }

    async updateStatistics(fromDate, toDate, branchNum) {
        try {
            // Get net sales (gross sales - refunds)
            const netSales = await this.getNetSales(fromDate, toDate, branchNum);
            
            // Get orders, AOV, and paid rate
            const { orders, aov, paidRate } = await this.getOrdersStats(fromDate, toDate, branchNum);
            
            // Get refunds
            const refunds = await this.getRefunds(fromDate, toDate, branchNum);
            
            // Update UI
            this.updateStatValue('netSalesValue', db.formatCurrency(netSales));
            this.updateStatValue('ordersValue', orders.toLocaleString('ar-SA'));
            this.updateStatValue('aovValue', db.formatCurrency(aov));
            this.updateStatValue('paidRateValue', `${paidRate.toFixed(1)}%`);
            this.updateStatValue('refundsValue', db.formatCurrency(refunds));
            
        } catch (error) {
            console.error('Error updating statistics:', error);
        }
    }

    async getNetSales(fromDate, toDate, branchNum) {
        try {
            console.log('Getting net sales with filters:', { fromDate, toDate, branchNum });
            
            // Get all invoices for the period
            const invoices = await db.getDashboardInvoices(fromDate, toDate, branchNum);
            console.log('All invoices for period:', invoices);
            
            // Filter paid and unpaid invoices and calculate gross sales
            const validInvoices = invoices.filter(invoice => invoice.status === 'paid' || invoice.status === 'unpaid');
            const grossSales = validInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount) || 0), 0);
            console.log('Gross sales:', grossSales, 'from', validInvoices.length, 'valid invoices');
            
            // Get refunds
            let refundsQuery = db.supabase
                .from('tickets')
                .select('refund_price')
                .eq('status', 'approved')
                .gte('timestamp', fromDate)
                .lte('timestamp', toDate);
            
            if (branchNum !== 'all') {
                // Get invoice numbers for the branch
                const { data: branchInvoices } = await db.supabase
                    .from('invoices')
                    .select('invoice_num')
                    .eq('branch_num', branchNum);
                
                const branchInvoiceNums = branchInvoices?.map(inv => inv.invoice_num) || [];
                if (branchInvoiceNums.length > 0) {
                    refundsQuery = refundsQuery.in('invoice_num', branchInvoiceNums);
                }
            }
            
            const { data: refundsData } = await refundsQuery;
            const refunds = refundsData?.reduce((sum, ticket) => sum + (Number(ticket.refund_price) || 0), 0) || 0;
            
            return grossSales - refunds;
        } catch (error) {
            console.error('Error getting net sales:', error);
            return 0;
        }
    }

    async getOrdersStats(fromDate, toDate, branchNum) {
        try {
            console.log('Getting orders stats with filters:', { fromDate, toDate, branchNum });
            
            // Get all invoices for the period
            const invoices = await db.getDashboardInvoices(fromDate, toDate, branchNum);
            console.log('Orders data:', invoices);
            
            if (!invoices || invoices.length === 0) {
                return { orders: 0, aov: 0, paidRate: 0 };
            }
            
            const validInvoices = invoices.filter(inv => inv.status === 'paid' || inv.status === 'unpaid');
            const orders = validInvoices.length;
            const totalAmount = validInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
            const aov = orders > 0 ? totalAmount / orders : 0;
            const paidRate = (orders / invoices.length) * 100;
            
            return { orders, aov, paidRate };
        } catch (error) {
            console.error('Error getting orders stats:', error);
            return { orders: 0, aov: 0, paidRate: 0 };
        }
    }

    async getRefunds(fromDate, toDate, branchNum) {
        try {
            let query = db.supabase
                .from('tickets')
                .select('refund_price')
                .eq('status', 'approved')
                .gte('timestamp', fromDate)
                .lte('timestamp', toDate);
            
            if (branchNum !== 'all') {
                // Get invoice numbers for the branch
                const { data: branchInvoices } = await db.supabase
                    .from('invoices')
                    .select('invoice_num')
                    .eq('branch_num', branchNum);
                
                const branchInvoiceNums = branchInvoices?.map(inv => inv.invoice_num) || [];
                if (branchInvoiceNums.length > 0) {
                    query = query.in('invoice_num', branchInvoiceNums);
                }
            }
            
            const { data: refundsData } = await query;
            return refundsData?.reduce((sum, ticket) => sum + (Number(ticket.refund_price) || 0), 0) || 0;
        } catch (error) {
            console.error('Error getting refunds:', error);
            return 0;
        }
    }

    // Helper function to convert branch codes to Arabic names
    getBranchArabicName(branchCode) {
        const branchNames = {
            'BR001': 'الملقا',
            'BR002': 'العليا',
            'BR003': 'الياسمين'
        };
        return branchNames[branchCode] || branchCode;
    }

    // Helper function to get branch colors (consistent with line chart)
    getBranchColor(branchCode) {
        const branchColors = {
            'BR001': '#ef4444', // Red - الملقا
            'BR002': '#10b981', // Green - العليا
            'BR003': '#f59e0b'  // Orange - الياسمين
        };
        return branchColors[branchCode] || '#6b7280'; // Gray for unknown branches
    }

    async updateBranchSalesChart(fromDate, toDate, branchNum) {
        try {
            console.log('Updating branch sales chart with filters:', { fromDate, toDate, branchNum });
            
            // Get all branches first
            const allBranches = await db.getBranches();
            console.log('All branches:', allBranches);
            
            // Get all invoices for the period
            const allInvoices = await db.getDashboardInvoices(fromDate, toDate, branchNum);
            console.log('All invoices for branch sales:', allInvoices);
            
            // Filter valid invoices (paid and unpaid)
            const salesData = allInvoices.filter(invoice => invoice.status === 'paid' || invoice.status === 'unpaid');
            console.log('Valid invoices for branch sales:', salesData);
            
            // Initialize sales for all branches with 0
            const branchSales = {};
            allBranches.forEach(branch => {
                branchSales[branch.branch_num] = 0;
            });
            
            // Add actual sales data
            salesData.forEach(invoice => {
                const branchName = invoice.branch_num || 'غير محدد';
                branchSales[branchName] = (branchSales[branchName] || 0) + (Number(invoice.total_amount) || 0);
            });
            
            const branches = Object.keys(branchSales);
            const sales = Object.values(branchSales);
            
            // Create separate trace for each branch with consistent colors
            const traces = branches.map((branch, index) => ({
                x: [this.getBranchArabicName(branch)],
                y: [sales[index]],
                type: 'bar',
                name: this.getBranchArabicName(branch),
                marker: {
                    color: this.getBranchColor(branch),
                    line: {
                        color: this.getBranchColor(branch),
                        width: 1
                    }
                },
                showlegend: false
            }));
            
            const layout = {
                title: {
                    text: 'المبيعات حسب الفرع',
                    font: { size: 14, family: 'Tajawal' }
                },
                xaxis: {
                    title: { text: 'الفرع', font: { family: 'Tajawal' } },
                    tickfont: { family: 'Tajawal' }
                },
                yaxis: {
                    title: { text: 'المبيعات (ر.س)', font: { family: 'Tajawal' } },
                    tickfont: { family: 'Tajawal' }
                },
                margin: { l: 60, r: 30, t: 40, b: 60 },
                height: 250,
                showlegend: false
            };
            
            // Check if Plotly is available
            if (typeof Plotly !== 'undefined') {
                Plotly.newPlot('branchSalesChart', traces, layout, { 
                    responsive: true,
                    displayModeBar: false
                });
            } else {
                console.error('Plotly is not loaded');
                this.createEmptyChart('branchSalesChart', 'خطأ في تحميل مكتبة الرسومات');
            }
        } catch (error) {
            console.error('Error updating branch sales chart:', error);
            this.createEmptyChart('branchSalesChart', 'خطأ في تحميل البيانات');
        }
    }

    async updateRevenueChart(fromDate, toDate, branchNum) {
        try {
            console.log('Updating revenue chart with filters:', { fromDate, toDate, branchNum });
            
            // Get all branches
            const allBranches = await db.getBranches();
            
            // Get ALL invoices (not filtered by date) for monthly revenue chart
            let query = db.supabase.from('invoices').select('*');
            
            // Only add branch filter if specified
            if (branchNum && branchNum !== 'all') {
                query = query.eq('branch_num', branchNum);
            }
            
            const { data: allInvoices, error } = await query;
            
            if (error) {
                console.error('Error fetching invoices for revenue chart:', error);
                this.createEmptyChart('revenueChart', 'خطأ في تحميل البيانات');
            return;
        }

            const validInvoices = allInvoices.filter(invoice => invoice.status === 'paid' || invoice.status === 'unpaid');
            
            console.log('All invoices for revenue chart:', allInvoices.length);
            console.log('Valid invoices for revenue chart:', validInvoices.length);
            
            // Group by month and branch
            const monthlyData = {};
            const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                           'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            
            // Initialize data structure
            months.forEach((month, index) => {
                monthlyData[index] = { month, total: 0 };
                allBranches.forEach(branch => {
                    monthlyData[index][branch.branch_num] = 0;
                });
            });
            
            // Fill in actual data
            validInvoices.forEach(invoice => {
                try {
                    console.log('Processing invoice:', invoice.invoice_num, 'timestamp:', invoice.timestamp);
                    
                    const date = new Date(invoice.timestamp);
                    console.log('Parsed date:', date, 'month index:', date.getMonth());
                    
                    const monthIndex = date.getMonth();
                    const amount = Number(invoice.total_amount) || 0;
                    
                    console.log(`Adding ${amount} to month ${months[monthIndex]} (index ${monthIndex})`);
                    
                    monthlyData[monthIndex].total += amount;
                    if (invoice.branch_num) {
                        monthlyData[monthIndex][invoice.branch_num] += amount;
                    }
                } catch (error) {
                    console.error('Error processing invoice date:', invoice.invoice_num, error);
                }
            });
            
            console.log('Monthly data after processing:', monthlyData);
            
            // Filter out months with no data (only show months that have invoices)
            const monthsWithData = [];
            const monthlyTotals = [];
            
            months.forEach((month, index) => {
                if (monthlyData[index].total > 0) {
                    monthsWithData.push(month);
                    monthlyTotals.push(monthlyData[index].total);
                }
            });
            
            console.log('Months with data:', monthsWithData);
            console.log('Monthly totals:', monthlyTotals);
            
            // Prepare data for plotting
            const traces = [];
            
            // Add total line
            traces.push({
                x: monthsWithData,
                y: monthlyTotals,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'إجمالي الفروع',
                line: { color: '#1f2937', width: 3 },
                marker: { size: 6 }
            });
            
            // Add branch lines
            allBranches.forEach(branch => {
                const branchData = [];
                months.forEach((month, index) => {
                    if (monthlyData[index].total > 0) {
                        branchData.push(monthlyData[index][branch.branch_num] || 0);
                    }
                });
                
                traces.push({
                    x: monthsWithData,
                    y: branchData,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: this.getBranchArabicName(branch.branch_num),
                    line: { 
                        color: this.getBranchColor(branch.branch_num),
                        width: 2 
                    },
                    marker: { 
                        color: this.getBranchColor(branch.branch_num),
                        size: 4 
                    }
                });
            });
            
            const layout = {
                title: {
                    text: 'الإيرادات الشهرية',
                    font: { size: 14, family: 'Tajawal' }
                },
                xaxis: {
                    title: { text: 'الشهر', font: { family: 'Tajawal' } },
                    tickfont: { family: 'Tajawal' }
                },
                yaxis: {
                    title: { text: 'الإيرادات (ر.س)', font: { family: 'Tajawal' } },
                    tickfont: { family: 'Tajawal' }
                },
                margin: { l: 60, r: 30, t: 40, b: 60 }, // Increased top margin for legend
                height: 250,
                showlegend: true,
                legend: {
                    font: { family: 'Tajawal', size: 9 },
                    orientation: 'h', // Horizontal legend
                    x: 0.5, // Center horizontally
                    y: 1.15, // Position above the chart
                    xanchor: 'center',
                    yanchor: 'top'
                }
            };
            
            if (typeof Plotly !== 'undefined') {
                Plotly.newPlot('revenueChart', traces, layout, { 
                    responsive: true,
                    displayModeBar: false
                });
            } else {
                this.createEmptyChart('revenueChart', 'خطأ في تحميل مكتبة الرسومات');
            }
        } catch (error) {
            console.error('Error updating revenue chart:', error);
            this.createEmptyChart('revenueChart', 'خطأ في تحميل البيانات');
        }
    }

    async updateCategoryChart() {
        try {
            console.log('Updating category chart - sales by category');

            // Get ALL invoices (not filtered by date)
            const { data: allInvoices, error } = await db.supabase
                .from('invoices')
                .select('*');

            if (error) {
                console.error('Error fetching invoices for category chart:', error);
                this.createEmptyChart('categoryChart', 'خطأ في تحميل البيانات');
                return;
            }

            console.log('All invoices for category chart:', allInvoices.length);

            // Filter valid invoices (paid and unpaid)
            const validInvoices = allInvoices.filter(invoice => invoice.status === 'paid' || invoice.status === 'unpaid');
            console.log('Valid invoices for category chart:', validInvoices.length);

            // Get all products for category mapping
            const products = await db.getProducts();
            const productMap = {};
            products.forEach(product => {
                productMap[product.name] = product; // Map by product name instead of ID
            });

            console.log('Product map:', productMap);

            // Count sold products by category
            const categoryCount = {};

            validInvoices.forEach(invoice => {
                try {
                    let productsData;
                    
                    // Handle both JSON strings and objects
                    if (typeof invoice.products_and_quantities === 'string') {
                        productsData = JSON.parse(invoice.products_and_quantities || '[]');
                    } else if (typeof invoice.products_and_quantities === 'object') {
                        productsData = invoice.products_and_quantities || [];
                    } else {
                        console.log('Unknown products_and_quantities type for invoice:', invoice.invoice_num, typeof invoice.products_and_quantities);
                        productsData = [];
                    }
                    
                    console.log('Products data for invoice:', invoice.invoice_num, productsData);

                    productsData.forEach(product => {
                        const productName = product.name;
                        const productId = product.product_id;
                        
                        // Try to find product by name first, then by ID
                        let productInfo = productMap[productName];
                        if (!productInfo && productId) {
                            productInfo = productMap[productId];
                        }
                        
                        const category = productInfo?.category || 'غير محدد';
                        const quantity = Number(product.quantity) || 1;

                        categoryCount[category] = (categoryCount[category] || 0) + quantity;
                        console.log(`Product: ${productName} (ID: ${productId}), Category: ${category}, Quantity: ${quantity}`);
                    });
                } catch (error) {
                    console.error('Error parsing products for invoice:', invoice.invoice_num, error);
                }
            });

            console.log('Category count for sold products:', categoryCount);

            const categories = Object.keys(categoryCount);
            const counts = Object.values(categoryCount);

            if (categories.length === 0) {
                this.createEmptyChart('categoryChart', 'لا توجد بيانات للمبيعات');
                return;
            }

            const data = [{
                values: counts,
                labels: categories,
                type: 'pie',
                hole: 0.35,
                marker: {
                    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
                }
            }];

            const layout = {
                title: {
                    text: 'نسبة المنتجات المباعة حسب الفئة',
                    font: { size: 14, family: 'Tajawal' }
                },
                margin: { l: 30, r: 30, t: 40, b: 80 },
                height: 300,
                showlegend: true,
                legend: {
                    font: { family: 'Tajawal', size: 9 },
                    orientation: 'h', // Horizontal legend
                    x: 0.5, // Center horizontally
                    y: -0.12, // Position below the chart
                    xanchor: 'center',
                    yanchor: 'top'
                }
            };

            if (typeof Plotly !== 'undefined') {
                Plotly.newPlot('categoryChart', data, layout, { 
                    responsive: true,
                    displayModeBar: false
                });
            } else {
                this.createEmptyChart('categoryChart', 'خطأ في تحميل مكتبة الرسومات');
            }
        } catch (error) {
            console.error('Error updating category chart:', error);
            this.createEmptyChart('categoryChart', 'خطأ في تحميل البيانات');
        }
    }

    async updateLowStockChart() {
        try {
            console.log('Updating low stock chart');
            
            // Get inventory data
            const inventoryData = await db.getInventoryQuantities();
            const products = await db.getProducts();
            
            // Create product map
            const productMap = {};
            products.forEach(product => {
                productMap[product.id] = product;
            });
            
            // Calculate total quantity per product
            const productQuantities = {};
            inventoryData.forEach(item => {
                const productId = item.product_id;
                if (!productQuantities[productId]) {
                    productQuantities[productId] = 0;
                }
                productQuantities[productId] += Number(item.quantity) || 0;
            });
            
            // Sort by quantity (ascending) and get all products, then reverse for display
            const sortedProducts = Object.entries(productQuantities)
                .sort(([,a], [,b]) => a - b)
                .reverse(); // Reverse to show lowest at top
            
            console.log('Sorted products for low stock chart:', sortedProducts);
            
            const productNames = sortedProducts.map(([productId]) => 
                productMap[productId]?.name || productId
            );
            const quantities = sortedProducts.map(([, quantity]) => quantity);
            
            console.log('Product names:', productNames);
            console.log('Quantities:', quantities);
            
            const data = [{
                x: quantities,
                y: productNames,
                type: 'bar',
                orientation: 'h',
                marker: {
                    color: 'rgba(239, 68, 68, 0.8)',
                    line: {
                        color: '#dc2626',
                        width: 1
                    }
                }
            }];
            
            const layout = {
                title: {
                    text: 'توافر المنتجات',
                    font: { size: 14, family: 'Tajawal' }
                },
                xaxis: {
                    title: { text: 'الكمية المتوفرة', font: { family: 'Tajawal' } },
                    tickfont: { family: 'Tajawal' }
                },
                yaxis: {
                    tickfont: { family: 'Tajawal' }
                },
                margin: { l: 80, r: 30, t: 40, b: 60 },
                height: 260,
                showlegend: false
            };
            
            if (typeof Plotly !== 'undefined') {
                Plotly.newPlot('lowStockChart', data, layout, { 
                    responsive: true,
                    displayModeBar: false
                });
            } else {
                this.createEmptyChart('lowStockChart', 'خطأ في تحميل مكتبة الرسومات');
            }
        } catch (error) {
            console.error('Error updating low stock chart:', error);
            this.createEmptyChart('lowStockChart', 'خطأ في تحميل البيانات');
        }
    }

    async updateLowStockTable() {
        try {
            const { data: lowStockData } = await db.supabase
                .from('inventory')
                .select(`
                    branch_num,
                    product_id,
                    quantity,
                    products!inner(name)
                `)
                .lte('quantity', 10)
                .order('quantity', { ascending: true });
            
            const tableBody = document.getElementById('lowStockTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (!lowStockData || lowStockData.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="4" style="text-align: center; color: #6b7280;">لا توجد منتجات بمخزون منخفض</td>';
                tableBody.appendChild(row);
                return;
            }
            
            lowStockData.forEach(item => {
                const row = document.createElement('tr');
                const status = this.getStockStatus(item.quantity);
                
                row.innerHTML = `
                    <td>${item.branch_num || 'غير محدد'}</td>
                    <td>${item.products?.name || 'غير محدد'}</td>
                    <td>${item.quantity}</td>
                    <td><span class="stock-status ${status.class}">${status.text}</span></td>
                `;
                
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error updating low stock table:', error);
        }
    }

    getStockStatus(quantity) {
        if (quantity === 0) {
            return { text: 'نفذ المخزون', class: 'critical' };
        } else if (quantity <= 5) {
            return { text: 'مخزون منخفض', class: 'low' };
        } else {
            return { text: 'تحذير', class: 'warning' };
        }
    }

    createEmptyChart(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280; font-family: 'Tajawal';">
                    ${message}
                </div>
            `;
        }
    }

    updateStatValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // Debug function to show all invoices
    async debugShowAllInvoices() {
        try {
            const allInvoices = await db.supabase
                .from('invoices')
                .select('*')
                .limit(10);
            
            console.log('First 10 invoices from database:', allInvoices);
        } catch (error) {
            console.error('Error debugging invoices:', error);
        }
    }
}

export default DashboardService;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('=== DASHBOARD INITIALIZATION STARTED ===');
        console.log('Creating dashboard service instance...');
        window.dashboardService = new DashboardService();
        console.log('Dashboard service created successfully');
        console.log('=== DASHBOARD INITIALIZATION COMPLETED ===');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});
