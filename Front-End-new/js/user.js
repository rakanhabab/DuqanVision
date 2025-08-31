// ===== USER PAGE JAVASCRIPT WITH DATABASE INTEGRATION =====
import { db } from './database.js'

// User account data (will be loaded from database)
let userAccount = {
    name: "",
    email: "",
    balance: "0.00 ر.س"
};

// Current user data
let currentUser = null;

// Initialize page
async function initializePage() {
    try {
        // Check if user is logged in
        const isLoggedIn = await checkUserLogin();
        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return;
        }

        // Load all user data
        await Promise.all([
            loadUserDataFromDatabase(),
            loadUserKPIsFromDatabase(),
            loadInvoicesFromDatabase(),
            loadPaymentMethodsFromDatabase()
        ]);
        
                // Setup UI components
        setupSmoothScrolling();
        setupAnimations();
        setupMap();
        setupPlotlyCharts();
        setupAccountDropdown();
        setupQRCode();
        setupContactForm();
        setupInvoices();
        setupChat();
        

    } catch (error) {
        console.error('❌ Error initializing user page:', error);
        showErrorMessage('حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
    }
}

// Check if user is logged in
async function checkUserLogin() {
    const currentUserStr = localStorage.getItem('current_user');
    if (!currentUserStr) {
        return false;
    }

    try {
        currentUser = JSON.parse(currentUserStr);

        
        // Set current user in database service
        if (currentUser && currentUser.id) {
            db.setCurrentUser(currentUser.id);

        } else {
            console.error('❌ Invalid user data - missing ID');
            return false;
        }
        
        return currentUser && currentUser.id;
    } catch (error) {
        console.error('❌ Error parsing user data:', error);
        return false;
    }
}

// Load user data from database
async function loadUserDataFromDatabase() {
    try {
        if (!currentUser) {
            throw new Error('No current user found');
        }

        // Get fresh user data from database
        const { data: user, error } = await db.supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error || !user) {
            console.error('Error fetching user data:', error);
            throw new Error('User not found in database');
        }

        // Update current user with fresh data
        currentUser = { ...currentUser, ...user };
        localStorage.setItem('current_user', JSON.stringify(currentUser));

        displayUserInfo(user);

        
    } catch (error) {
        console.error('Error loading user data:', error);
        showErrorMessage('فشل في تحميل بيانات المستخدم');
    }
}

// Load user KPIs from database
async function loadUserKPIsFromDatabase() {
    try {
        if (!currentUser) return;

        // Get user data and invoices from database
        const [userData, invoices] = await Promise.all([
            db.supabase.from('users').select('num_visits, owed_balance').eq('id', currentUser.id).single(),
            db.supabase.from('invoices').select('total_amount, branch_id, timestamp, branch_num').eq('user_id', currentUser.id)
        ]);

        if (userData.error) {
            console.error('Error fetching user data:', userData.error);
            return;
        }

        if (invoices.error) {
            console.error('Error fetching invoices:', invoices.error);
            return;
        }

        // Calculate KPIs from real data
        const visits = userData.data?.num_visits || 0;
        const totalSpend = invoices.data?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;
        const avgInvoice = invoices.data?.length > 0 ? totalSpend / invoices.data.length : 0;

        // Find most visited branch
        const branchVisits = {};
        invoices.data?.forEach(invoice => {
            if (invoice.branch_id) {
                let branchName = 'فرع غير محدد';
                
                // Map branch IDs to real names
                switch (invoice.branch_id) {
                    case '9852c8e7-0be0-4f5c-aa8d-68e289fe9552':
                        branchName = 'فرع العليا';
                        break;
                    case 'af73abd0-04f7-44bb-b0d6-396a58cbd33a':
                        branchName = 'فرع الياسمين';
                        break;
                    case '130df862-b9e2-4233-8d67-d87a3d3b8323':
                        branchName = 'فرع الملقا';
                        break;
                }
                
                branchVisits[branchName] = (branchVisits[branchName] || 0) + 1;
            }
        });

        let mostVisitedBranch = 'غير محدد';
        let maxVisits = 0;
        for (const [branchName, visits] of Object.entries(branchVisits)) {
            if (visits > maxVisits) {
                maxVisits = visits;
                mostVisitedBranch = branchName;
            }
        }

        // Calculate previous month visits
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        let previousMonthVisits = 0;
        invoices.data?.forEach(invoice => {
            const invoiceDate = new Date(invoice.timestamp);
            if (invoiceDate.getMonth() === previousMonth && invoiceDate.getFullYear() === previousYear) {
                previousMonthVisits++;
            }
        });

        // Update KPI elements
        updateKPIElements({
            visits: visits,
            totalSpend: totalSpend,
            avgInvoice: avgInvoice,
            mostVisitedBranch: mostVisitedBranch,
            previousMonthVisits: previousMonthVisits
        });


        
    } catch (error) {
        console.error('Error loading user KPIs:', error);
        // Set default values on error
        updateKPIElements({
            visits: 0,
            totalSpend: 0,
            avgInvoice: 0,
            mostVisitedBranch: 'غير محدد',
            previousMonthVisits: 0
        });
    }
}

// Update KPI elements with real data
function updateKPIElements(kpis) {
    const spendEl = document.getElementById('kSpend');
    const visitsEl = document.getElementById('kVisits');
    const avgEl = document.getElementById('kAvg');

    if (spendEl) {
        const spendValue = db.formatCurrency(kpis.totalSpend);
        spendEl.innerHTML = spendValue;
    }
    
    if (visitsEl) {
        const visitsValue = kpis.visits;
        
        // Calculate if current month visits are less than previous month
        let visitsIcon = '';
        let visitsText = '';
        if (kpis.previousMonthVisits !== undefined && kpis.previousMonthVisits > 0) {
            if (kpis.visits < kpis.previousMonthVisits) {
                visitsIcon = '<span class="kpi-icon down">⬇︎</span>';
            } else if (kpis.visits > kpis.previousMonthVisits) {
                visitsIcon = '<span class="kpi-icon up">⬆︎</span>';
                visitsText = '<span class="change-text">(أعلى من الشهر السابق)</span>';
            }
        }
        
        visitsEl.innerHTML = `${visitsValue} ${visitsIcon} ${visitsText}`;
    }
    
    if (avgEl) {
        const avgValue = db.formatCurrency(kpis.avgInvoice);
        avgEl.innerHTML = avgValue;
    }

    // Add animation to show data is loaded
    [spendEl, visitsEl, avgEl].forEach(el => {
        if (el) {
            el.style.animation = 'fadeInUp 0.5s ease-out';
        }
    });
}

// Display user information
function displayUserInfo(user) {
    // Update user info in dropdown
    const userNameElement = document.getElementById('dropdownName');
    const userEmailElement = document.getElementById('dropdownEmail');
    
    if (userNameElement) {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        userNameElement.textContent = fullName || 'مستخدم';
    }
    
    if (userEmailElement) {
        userEmailElement.textContent = user.email || '';
    }

    // Update user account data
    userAccount = {
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: user.email || '',
        balance: db.formatCurrency(user.owed_balance || 0)
    };
}

// Load invoices from database
async function loadInvoicesFromDatabase() {
    try {
        if (!currentUser) return;

        // Get invoices for current user
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false })
            .limit(10); // Get more invoices for recent section

        if (error) {
            console.error('Error loading invoices:', error);
            return;
        }

        // Display recent invoices (last 3)
        const recentInvoices = invoices ? invoices.slice(0, 3) : [];
        displayRecentInvoices(recentInvoices);
        
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

// Display recent invoices (last 3) for user.html page
function displayRecentInvoices(invoices) {
    const recentInvoicesList = document.getElementById('recentInvoicesList');
    if (!recentInvoicesList) return;
    
    if (invoices.length === 0) {
        recentInvoicesList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6c757d;">
                <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
                <div>لا توجد فواتير حديثة</div>
                <div style="font-size: 12px; margin-top: 5px;">ستظهر آخر فواتيرك هنا</div>
            </div>
        `;
        return;
    }
    
    recentInvoicesList.innerHTML = invoices.map(invoice => `
        <div class="recent-invoice-item" style="animation: fadeInUp 0.5s ease-out;">
            <div class="recent-invoice-info">
                <div class="recent-invoice-id">#${invoice.id.slice(0, 8)}</div>
                <div class="recent-invoice-date">${db.formatDate(invoice.timestamp)}</div>
            </div>
            <div class="recent-invoice-amount">${db.formatCurrency(invoice.total_amount)}</div>
            <div class="recent-invoice-actions">
                <a href="invoice-view.html?id=${invoice.id}" class="recent-invoice-btn view">عرض</a>
                <button class="recent-invoice-btn print" onclick="printInvoice('${invoice.id}')">طباعة</button>
                <button class="recent-invoice-btn complaint" onclick="fileComplaint('${invoice.id}')">شكوى</button>
            </div>
        </div>
    `).join('');
}

// Print invoice function
function printInvoice(invoiceId) {
    // Open invoice in new window for printing
    const printWindow = window.open(`invoice-view.html?id=${invoiceId}&print=true`, '_blank');
    if (printWindow) {
        printWindow.onload = function() {
            printWindow.print();
        };
    }
}

// File complaint function
function fileComplaint(invoiceId) {
    // Redirect to complaint page with invoice ID
    window.location.href = `complaint.html?id=${invoiceId}`;
}





// Load payment methods from database
async function loadPaymentMethodsFromDatabase() {
    try {
        if (!currentUser) return;

        // Get payment methods for current user
        const { data: paymentMethods, error } = await db.supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_deleted', false)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('Error loading payment methods:', error);
            return;
        }

        displayPaymentMethods(paymentMethods || []);

        
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

// Display payment methods
function displayPaymentMethods(methods) {
    const methodsContainer = document.getElementById('payment-methods-container');
    if (!methodsContainer) return;
    
    if (methods.length === 0) {
        methodsContainer.innerHTML = '<p class="no-data">لا توجد طرق دفع محفوظة</p>';
        return;
    }
    
    methodsContainer.innerHTML = methods.map(method => `
        <div class="payment-method-card" style="animation: fadeInUp 0.5s ease-out;">
            <div class="card-info">
                <h4>**** **** **** ${method.card_number.slice(-4)}</h4>
                <p>${method.card_holder_name}</p>
                <p>${method.expiry_month}/${method.expiry_year}</p>
            </div>
            <div class="card-actions">
                ${method.is_default ? '<span class="default-badge">افتراضي</span>' : ''}
                <button onclick="deletePaymentMethod('${method.id}')">حذف</button>
            </div>
        </div>
    `).join('');
}

// Setup map with real branch data
async function setupMap() {
    if (typeof L !== 'undefined' && document.getElementById('map')) {
        try {
            const branches = await db.getBranches();
            const map = L.map('map').setView([24.7136, 46.6753], 6); // Saudi Arabia center
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Add markers for real branches
            branches.forEach(branch => {
                if (branch.lat && branch.long) {
                    L.marker([branch.lat, branch.long])
                        .addTo(map)
                        .bindPopup(branch.name);
                }
            });
            

        } catch (error) {
            console.error('Error setting up map:', error);
        }
    }
}

// Setup Plotly charts with real data
async function setupPlotlyCharts() {
    try {
        if (!currentUser) return;
        
        // Check if Plotly is loaded
        if (typeof Plotly === 'undefined') {
            console.error('❌ Plotly library not loaded');
            return;
        }

        // Get invoice data for charts with branch information
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select(`
                total_amount, 
                timestamp,
                branch_id
            `)
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('❌ Error fetching invoices:', error);
            createEmptyCharts();
            return;
        }

        if (!invoices || invoices.length === 0) {
            // Show empty charts if no data
                    createEmptyCharts();
        return;
        }

        // Generate chart data from real invoices
        const monthlyData = {};
        const branchVisits = {};
        
        invoices.forEach(invoice => {
            const month = new Date(invoice.timestamp).getMonth();
            monthlyData[month] = (monthlyData[month] || 0) + invoice.total_amount;
            
            // Count visits per branch using branch_id with real names
            if (invoice.branch_id) {
                let branchName = 'فرع غير محدد';
                
                // Map branch IDs to real names
                switch (invoice.branch_id) {
                    case '9852c8e7-0be0-4f5c-aa8d-68e289fe9552':
                        branchName = 'فرع العليا';
                        break;
                    case 'af73abd0-04f7-44bb-b0d6-396a58cbd33a':
                        branchName = 'فرع الياسمين';
                        break;
                    case '130df862-b9e2-4233-8d67-d87a3d3b8323':
                        branchName = 'فرع الملقا';
                        break;
                }
                
                branchVisits[branchName] = (branchVisits[branchName] || 0) + 1;
            }
        });

        // Month names for x-axis - January to August
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                           'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const chartMonths = monthNames.slice(0, 8); // January to August
        
        // Convert to array for charts - show all months from January to August
        const spendData = [];
        const visitsData = [];
        
        // Get data for months 0-7 (January to August)
        for (let i = 0; i < 8; i++) {
            const monthSpend = monthlyData[i] || 0;
            const monthVisits = invoices.filter(inv => new Date(inv.timestamp).getMonth() === i).length;
            
            spendData.push(monthSpend);
            visitsData.push(monthVisits);
        }
        
        // Get all branches for pie chart (not just top 3)
        const allBranches = Object.entries(branchVisits)
            .sort(([,a], [,b]) => b - a)
            .map(([name, visits]) => ({ name, visits }));

        // Clear existing charts first
        const containers = ['spendChart', 'visitsChart', 'branchVisitsChart'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
            }
        });
        
        // Create Plotly charts with delay
        setTimeout(() => {
            createSpendChart(spendData, chartMonths);
            createVisitsChart(visitsData, chartMonths);
            createBranchVisitsChart(allBranches);
            createTopProductsChart();
            createCaloriesHeatmap();
        }, 100);
        
                // Force charts to redraw after a short delay
        setTimeout(() => {
            try {
                Plotly.Plots.resize('spendChart');
                Plotly.Plots.resize('visitsChart');
                Plotly.Plots.resize('branchVisitsChart');
            } catch (error) {
                // Charts already rendered
            }
        }, 500);
        
    } catch (error) {
        console.error('Error setting up Plotly charts:', error);
        createEmptyCharts();
    }
}

// Create spend chart
function createSpendChart(data, months) {
    
    const trace = {
        x: months,
        y: data,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#8b5cf6',
            width: 3
        },
        marker: {
            color: '#8b5cf6',
            size: 6
        },
        fill: 'tonexty',
        fillcolor: 'rgba(139, 92, 246, 0.1)'
    };

    const layout = {
        margin: { l: 30, r: 20, t: 20, b: 30 },
        showlegend: false,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        autosize: true,
        xaxis: {
            title: 'الشهر',
            titlefont: { size: 12, color: '#374151', weight: 'bold' },
            showgrid: true,
            gridcolor: 'rgba(107, 114, 128, 0.2)',
            gridwidth: 1,
            showticklabels: true,
            zeroline: true,
            zerolinecolor: 'rgba(107, 114, 128, 0.3)',
            zerolinewidth: 1,
            tickfont: { size: 10, color: '#6b7280' },
            tickangle: -45
        },
        yaxis: {
            title: 'المصروفات (ريال)',
            titlefont: { size: 12, color: '#374151', weight: 'bold' },
            showgrid: true,
            gridcolor: 'rgba(107, 114, 128, 0.2)',
            gridwidth: 1,
            showticklabels: true,
            zeroline: true,
            zerolinecolor: 'rgba(107, 114, 128, 0.3)',
            zerolinewidth: 1,
            tickfont: { size: 10, color: '#6b7280' }
        }
    };

    const container = document.getElementById('spendChart');
    if (!container) {
        console.error('❌ spendChart container not found');
        return;
    }
    
    Plotly.newPlot('spendChart', [trace], layout, { displayModeBar: false, responsive: true });
}

// Create visits chart
function createVisitsChart(data, months) {
    
    // Create colors array: c4b5fd for all months except the last one which gets green
    const colors = data.map((value, index) => {
        if (index === data.length - 1) {
            // Last month: different color
            return '#4C1D95';
        } else {
            // Other months: c4b5fd
            return '#c4b5fd';
        }
    });

    const trace = {
        x: months,
        y: data,
        type: 'bar',
        marker: {
            color: colors,
            line: {
                color: '#c4b5fd',
                width: 1
            }
        }
    };

    const layout = {
        margin: { l: 30, r: 20, t: 20, b: 30 },
        showlegend: false,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            title: 'الشهر',
            titlefont: { size: 12, color: '#374151', weight: 'bold' },
            showgrid: true,
            gridcolor: 'rgba(107, 114, 128, 0.2)',
            gridwidth: 1,
            showticklabels: true,
            zeroline: true,
            zerolinecolor: 'rgba(107, 114, 128, 0.3)',
            zerolinewidth: 1,
            tickfont: { size: 10, color: '#6b7280' },
            tickangle: -45
        },
        yaxis: {
            title: 'عدد الزيارات',
            titlefont: { size: 12, color: '#374151', weight: 'bold' },
            showgrid: true,
            gridcolor: 'rgba(107, 114, 128, 0.2)',
            gridwidth: 1,
            showticklabels: true,
            zeroline: true,
            zerolinecolor: 'rgba(107, 114, 128, 0.3)',
            zerolinewidth: 1,
            tickfont: { size: 10, color: '#6b7280' }
        }
    };

    const container = document.getElementById('visitsChart');
    if (!container) {
        console.error('❌ visitsChart container not found');
        return;
    }
    
    Plotly.newPlot('visitsChart', [trace], layout, { displayModeBar: false, responsive: true });
}



// Create branch visits chart
function createBranchVisitsChart(branchData) {
    
    // If no branch data, show empty state
    if (!branchData || branchData.length === 0) {
        const emptyTrace = {
            values: [1],
            labels: ['لا توجد بيانات'],
            type: 'pie',
            marker: {
                colors: ['#e5e7eb']
            },
            textinfo: 'label',
            textfont: { size: 11, color: '#6b7280' },
            hole: 0.4
        };

        const layout = {
            margin: { l: 10, r: 10, t: 40, b: 10 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            height: 200
        };

        const container = document.getElementById('branchVisitsChart');
        if (!container) {
            console.error('❌ branchVisitsChart container not found');
            return;
        }
        
        Plotly.newPlot('branchVisitsChart', [emptyTrace], layout, { displayModeBar: false, responsive: true });
        return;
    }

    // Sort branches by visits in descending order
    const sortedBranches = branchData.sort((a, b) => b.visits - a.visits);
    
    // Calculate percentages and format labels
    const totalVisits = sortedBranches.reduce((sum, branch) => sum + branch.visits, 0);
    const values = sortedBranches.map(branch => branch.visits);
    const labels = sortedBranches.map(branch => branch.name);

    // Create pie chart trace with dynamic colors
    const colors = [
        '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff',
        '#f3e8ff', '#faf5ff', '#c4b5fd', '#fde68a', '#fbbf24'
    ];
    
    const trace = {
        values: values,
        labels: labels,
        type: 'pie',
        marker: {
            colors: colors.slice(0, values.length)
        },
        textinfo: 'percent',
        textfont: { size: 11, color: '#374151' },
        hole: 0.4,
        hoverinfo: 'label+percent+value',
        textposition: 'inside'
    };

            const layout = {
            margin: { l: 10, r: 10, t: 40, b: 10 },
            showlegend: true,
            legend: {
                x: 1.1,
                y: 0.5,
                xanchor: 'left',
                orientation: 'v',
                font: { size: 10 }
            },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            autosize: true,
            height: 200
        };

    const container = document.getElementById('branchVisitsChart');
    if (!container) {
        console.error('❌ branchVisitsChart container not found');
        return;
    }
    
    Plotly.newPlot('branchVisitsChart', [trace], layout, { displayModeBar: false, responsive: true });
    
    // Update subtitle with most visited branch name
    const subtitleElement = document.querySelector('.summary-card.purple .card-subtitle');
    if (subtitleElement && sortedBranches.length > 0) {
        const mostVisitedBranch = sortedBranches[0].name;
        subtitleElement.innerHTML = `أكثر فرع زيارة <strong>${mostVisitedBranch}</strong>`;
    }
}

// Create empty charts when no data is available
function createEmptyCharts() {
    
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس'];
    const emptyData = Array(8).fill(0);
    
    // Clear existing charts first
    const containers = ['spendChart', 'visitsChart', 'branchVisitsChart', 'topProductsChart', 'caloriesHeatmap'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '';
        }
    });
    
    // Create empty charts with zero data for all months
    setTimeout(() => {
        createSpendChart(emptyData, months);
        createVisitsChart(emptyData, months);
        createBranchVisitsChart([]); // Empty branch visits data
        createTopProductsChart(); // Create empty top products chart
        createCaloriesHeatmap(); // Create empty calories heatmap
    }, 100);
}

// Create top products horizontal bar chart
async function createTopProductsChart() {
    
    try {
        if (!currentUser) {
            console.error('❌ No current user found for top products chart');
            return;
        }
        
        // Get invoices with products_and_quantities for current user
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select('products_and_quantities')
            .eq('user_id', currentUser.id)
            .eq('status', 'paid');
        
        if (error) {
            console.error('❌ Error fetching invoices:', error);
            createEmptyTopProductsChart();
            return;
        }
        
        if (!invoices || invoices.length === 0) {
                    createEmptyTopProductsChart();
        return;
        }
        
        // Process product data from JSONB
        const productCounts = {};
        invoices.forEach(invoice => {
            if (invoice.products_and_quantities && Array.isArray(invoice.products_and_quantities)) {
                invoice.products_and_quantities.forEach(product => {
                    if (product.name && product.quantity) {
                        const productName = product.name;
                        const quantity = parseInt(product.quantity) || 1;
                        productCounts[productName] = (productCounts[productName] || 0) + quantity;
                    }
                });
            }
        });
        
        // Get top 5 products
        const topProducts = Object.entries(productCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        
        if (topProducts.length === 0) {
            createEmptyTopProductsChart();
            return;
        }
        
        // Create horizontal bar chart
        const trace = {
            x: topProducts.map(p => p.count),
            y: topProducts.map(p => p.name),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
                line: {
                    color: '#ffffff',
                    width: 1
                }
            },
            text: topProducts.map(p => p.count),
            textposition: 'auto',
            textfont: {
                color: '#ffffff',
                size: 12
            }
        };
        
        const layout = {
            margin: { l: 80, r: 20, t: 20, b: 30 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
                title: 'الكمية',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: true,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1,
                tickfont: { size: 10, color: '#6b7280' }
            },
            yaxis: {
                title: '',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: true,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1,
                tickfont: { size: 10, color: '#6b7280' },
                automargin: true
            }
        };
        
        const container = document.getElementById('topProductsChart');
        if (!container) {
            console.error('❌ topProductsChart container not found');
            return;
        }
        
        Plotly.newPlot('topProductsChart', [trace], layout, { displayModeBar: false, responsive: true });
        
        // Update KPI value
        const kTopProducts = document.getElementById('kTopProducts');
        if (kTopProducts) {
            kTopProducts.textContent = `${topProducts.length} منتجات`;
        }
        
    } catch (error) {
        console.error('❌ Error creating top products chart:', error);
        createEmptyTopProductsChart();
    }
}

// Create empty top products chart
function createEmptyTopProductsChart() {
    
    const trace = {
        x: [1],
        y: ['لا توجد بيانات'],
        type: 'bar',
        orientation: 'h',
        marker: {
            color: ['#e5e7eb']
        },
        text: ['0'],
        textposition: 'auto',
        textfont: {
            color: '#6b7280',
            size: 12
        }
    };
    
            const layout = {
            margin: { l: 80, r: 20, t: 20, b: 30 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
                title: 'الكمية',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1
            },
            yaxis: {
                title: '',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: true,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1,
                tickfont: { size: 10, color: '#6b7280' }
            }
        };
    
    const container = document.getElementById('topProductsChart');
    if (!container) {
        console.error('❌ topProductsChart container not found');
        return;
    }
    
    Plotly.newPlot('topProductsChart', [trace], layout, { displayModeBar: false, responsive: true });
    
    // Update KPI value
    const kTopProducts = document.getElementById('kTopProducts');
    if (kTopProducts) {
        kTopProducts.textContent = '0 منتجات';
    }
}

// Create calories heatmap chart
async function createCaloriesHeatmap() {
    
    try {
        if (!currentUser) {
            console.error('❌ No current user found for calories heatmap');
            return;
        }
        
        // Get invoices with products_and_quantities and timestamp for current user
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select(`
                products_and_quantities,
                timestamp
            `)
            .eq('user_id', currentUser.id)
            .eq('status', 'paid');
        
        if (error) {
            console.error('❌ Error fetching invoices for calories:', error);
            createEmptyCaloriesHeatmap();
            return;
        }
        
        if (!invoices || invoices.length === 0) {
                    createEmptyCaloriesHeatmap();
        return;
        }
        
        // Extract all unique product IDs from invoices
        const productIds = new Set();
        invoices.forEach(invoice => {
            if (invoice.products_and_quantities && Array.isArray(invoice.products_and_quantities)) {
                invoice.products_and_quantities.forEach(product => {
                    if (product.product_id) {
                        productIds.add(product.product_id);
                    }
                });
            }
        });
        
        // Fetch calories for all products
        const { data: products, error: productsError } = await db.supabase
            .from('products')
            .select('id, calories')
            .in('id', Array.from(productIds));
        
        if (productsError) {
            console.error('❌ Error fetching products for calories:', productsError);
            createEmptyCaloriesHeatmap();
            return;
        }
        
        // Create a map of product_id to calories
        const productCaloriesMap = {};
        products.forEach(product => {
            productCaloriesMap[product.id] = parseInt(product.calories) || 0;
        });
        
        // Process calories data by hour
        const hourlyCalories = {};
        let totalCalories = 0;
        let totalInvoices = 0;
        
        invoices.forEach(invoice => {
            const hour = new Date(invoice.timestamp).getHours();
            totalInvoices++;
            
            if (invoice.products_and_quantities && Array.isArray(invoice.products_and_quantities)) {
                invoice.products_and_quantities.forEach(product => {
                    if (product.product_id && product.quantity) {
                        const quantity = parseInt(product.quantity) || 1;
                        const calories = productCaloriesMap[product.product_id] || 0;
                        const totalProductCalories = quantity * calories;
                        
                        hourlyCalories[hour] = (hourlyCalories[hour] || 0) + totalProductCalories;
                        totalCalories += totalProductCalories;
                    }
                });
            }
        });
        
        // Calculate average calories
        const averageCalories = totalInvoices > 0 ? Math.round(totalCalories / totalInvoices) : 0;
        
        // Create data for heatmap (24 hours)
        const hours = Array.from({length: 24}, (_, i) => i);
        const caloriesData = hours.map(hour => hourlyCalories[hour] || 0);
        
        // Create heatmap trace
        const trace = {
            x: hours,
            y: ['السعرات الحرارية'],
            z: [caloriesData],
            type: 'heatmap',
            colorscale: [
                [0, '#fef2f2'],
                [0.2, '#fecaca'],
                [0.4, '#fca5a5'],
                [0.6, '#f87171'],
                [0.8, '#ef4444'],
                [1, '#dc2626']
            ],
            showscale: false,
            colorbar: {
                title: 'السعرات',
                titleside: 'right',
                thickness: 10,
                len: 0.5,
                x: 1.1,
                y: 0.5
            }
        };
        
        const layout = {
            margin: { l: 20, r: 20, t: 40, b: 20 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
                title: {
                    text: 'ساعة اليوم',
                    font: { size: 12, color: '#374151' },
                    standoff: 50,          // المسافة بين عنوان المحور وتكات الأرقام
                  },
                  automargin: true, 
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: true,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1,
                tickfont: { size: 10, color: '#6b7280' },
                tickmode: 'array',
                tickvals: [0, 6, 12, 18, 23],
                ticktext: ['00:00', '06:00', '12:00', '18:00', '23:00'],
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                titleoffset: 50
            },
            yaxis: {
                title: 'السعرات الحرارية',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1
            }
        };
        
        const container = document.getElementById('caloriesHeatmap');
        if (!container) {
            console.error('❌ caloriesHeatmap container not found');
            return;
        }
        
        Plotly.newPlot('caloriesHeatmap', [trace], layout, { displayModeBar: false, responsive: true });
        
        // Update KPI value
        const kCalories = document.getElementById('kCalories');
        if (kCalories) {
            kCalories.innerHTML = `${averageCalories.toLocaleString()} سعرة/يوم <span style="font-size: 14px; color: #6b7280;">(المتوسط)</span>`;
        }
        
    } catch (error) {
        console.error('❌ Error creating calories heatmap:', error);
        createEmptyCaloriesHeatmap();
    }
}

// Create empty calories heatmap
function createEmptyCaloriesHeatmap() {
    
    const hours = Array.from({length: 24}, (_, i) => i);
    const emptyData = Array(24).fill(0);
    
    const trace = {
        x: hours,
        y: ['لا توجد بيانات'],
        z: [emptyData],
        type: 'heatmap',
        colorscale: [[0, '#e5e7eb'], [1, '#e5e7eb']],
        showscale: false
    };
    
            const layout = {
            margin: { l: 20, r: 20, t: 40, b: 20 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
                title: 'ساعة اليوم',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1,
                titleoffset: 50
            },
            yaxis: {
                title: 'السعرات الحرارية',
                titlefont: { size: 12, color: '#374151', weight: 'bold' },
                showgrid: true,
                gridcolor: 'rgba(107, 114, 128, 0.2)',
                gridwidth: 1,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: 'rgba(107, 114, 128, 0.3)',
                zerolinewidth: 1
            }
        };
    
    const container = document.getElementById('caloriesHeatmap');
    if (!container) {
        console.error('❌ caloriesHeatmap container not found');
        return;
    }
    
    Plotly.newPlot('caloriesHeatmap', [trace], layout, { displayModeBar: false, responsive: true });
    
    // Update KPI value
    const kCalories = document.getElementById('kCalories');
    if (kCalories) {
        kCalories.innerHTML = '0 سعرة/يوم <span style="font-size: 14px; color: #6b7280;">(المتوسط)</span>';
    }
}

// Setup account dropdown
function setupAccountDropdown() {
    const accountBtn = document.querySelector('.account-btn');
    const dropdown = document.getElementById('accountDropdown');
    
    if (accountBtn && dropdown) {
        accountBtn.addEventListener('click', () => {
            dropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!accountBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}

// Setup QR code
function setupQRCode() {
    const qrContainer = document.getElementById('dropdownQR');
    if (qrContainer && typeof QRCode !== 'undefined' && currentUser) {
        // Generate QR code with user ID
        const qrText = `DukkanVision_User_${currentUser.id}`;
        new QRCode(qrContainer, {
            text: qrText,
            width: 80,
            height: 80,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// Setup contact form
function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('contactName').value;
            const phone = document.getElementById('contactPhone').value;
            const message = document.getElementById('contactMessage').value;
            
            try {
                // Create support ticket
                const ticketData = {
                    user_id: currentUser.id,
                    subject: `رسالة دعم من ${name}`,
                    message: message,
                    contact_phone: phone,
                    status: 'open'
                };

                const { data: ticket, error } = await db.supabase
                    .from('tickets')
                    .insert([ticketData])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                showSuccessMessage('تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.');
                form.reset();
                
            } catch (error) {
                console.error('Error creating support ticket:', error);
                showErrorMessage('فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.');
            }
        });
    }
}



// Setup invoices
function setupInvoices() {
    // This function is no longer needed as we're using direct links
    // The invoice buttons now use onclick="window.location.href='invoice.html?id=X'"
}

// Setup chat functionality
function setupChat() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');

    function addMessage(text, type) {
        if (!chatMessages) return;
        const messageDiv = document.createElement('div');
        const messageId = Date.now();
        messageDiv.id = `msg-${messageId}`;
        messageDiv.className = `msg msg-${type}`;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageId;
    }

    function removeMessage(messageId) {
        const messageDiv = document.getElementById(`msg-${messageId}`);
        if (messageDiv) {
            messageDiv.remove();
        }
    }

    async function handleSend() {
        const query = (chatInput?.value || '').trim();
        if (!query) return;
        
        // Add user message
        addMessage(query, 'user');
        if (chatInput) chatInput.value = '';

        try {
            // Show loading message
            const loadingId = addMessage('جاري البحث عن إجابة...', 'bot');
            
            // Get user name from multiple possible sources
            let userName = 'مستخدم';
            if (currentUser) {
                if (currentUser.first_name && currentUser.first_name.trim()) {
                    userName = currentUser.first_name.trim();
                } else if (currentUser.name && currentUser.name.trim()) {
                    userName = currentUser.name.trim();
                } else if (currentUser.email && currentUser.email.includes('@')) {
                    const emailName = currentUser.email.split('@')[0];
                    if (emailName && emailName.trim()) {
                        userName = emailName.trim();
                    }
                }
            }
            
            
            
            // Call RAG API
            const response = await fetch('http://localhost:8001/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify({
                    question: query,
                    user_id: currentUser?.id || null,
                    user_name: userName
                })
            });
            
            // Remove loading message
            removeMessage(loadingId);

            if (response.ok) {
                const result = await response.json();

                addMessage(result.answer, 'bot');
            } else {
                const errorText = await response.text();
                console.error('RAG API error:', response.status, response.statusText);
                console.error('Error details:', errorText);
                addMessage(`عذراً، حدث خطأ في الاتصال (${response.status}). تأكد من أن الخادم يعمل على المنفذ 8001.`, 'bot');
            }
        } catch (error) {
            console.error('Error calling RAG API:', error);
            addMessage('عذراً، حدث خطأ في الاتصال. تأكد من أن الخادم يعمل على المنفذ 8001.', 'bot');
        }
    }

    function handleClear() {
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="msg msg-bot">مرحباً، أنا صديق 👋، مساعدك الذكي في دكان فجن، كيف أقدر أساعدك اليوم؟</div>';
        }
    }

    // Add event listeners
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', handleSend);
    if (clearChatBtn) clearChatBtn.addEventListener('click', handleClear);
    
    if (chatInput) {
        // Auto-resize height to fit content
        const autoResize = () => {
            if (chatInput) {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            }
        };
        ['input','change'].forEach(evt => chatInput.addEventListener(evt, autoResize));
        autoResize();

        // Allow Enter key to send message
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
                autoResize();
            }
        });
    }


}

// Setup smooth scrolling
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Setup animations
function setupAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    });

    document.querySelectorAll('.stat-card, .content-section, .card').forEach(el => {
        observer.observe(el);
    });
}

// Utility functions
function showSuccessMessage(message) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4C1D95;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showErrorMessage(message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Global functions
function toggleAccountMenu() {
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function showAccountInfo() {
    const modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>معلومات الحساب</h3>
                <button class="close-btn" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="account-info">
                    <div class="info-item">
                        <span class="label">الاسم:</span>
                        <span class="value">${userAccount.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">البريد الإلكتروني:</span>
                        <span class="value">${userAccount.email}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">الرصيد:</span>
                        <span class="value balance">${userAccount.balance}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeModal() {
    const modal = document.querySelector('.account-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

function logoutUser() {
    // Clear user data from localStorage
    localStorage.removeItem('current_user');
    localStorage.removeItem('twq_cart');
    
    // Redirect to login page
    window.location.href = 'login.html';
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const navHeight = document.querySelector('.nav').offsetHeight;
        const sectionTop = section.offsetTop;
        const targetPosition = sectionTop - navHeight - 20;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

// Test connection to RAG API
async function testRAGConnection() {
    try {
        const response = await fetch('http://localhost:8001/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {

    
    // Test Plotly availability first
    if (typeof Plotly === 'undefined') {
        console.error('❌ Plotly library not loaded');
        alert('خطأ: مكتبة الرسوم البيانية غير محملة');
        return;
    }
    
    // Test RAG API connection first
    const isConnected = await testRAGConnection();
    if (!isConnected) {
        // Add a warning message to the chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const warningMsg = document.createElement('div');
            warningMsg.className = 'msg msg-bot';
            warningMsg.textContent = '⚠️ تحذير: خادم المساعد غير متصل. يرجى تشغيل الخادم أولاً.';
            chatMessages.appendChild(warningMsg);
        }
    }
    
    // Initialize the page
    await initializePage();
});

// Function to send example questions
function sendExample(question) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = question;
        // Trigger the send button
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        if (sendMessageBtn) {
            sendMessageBtn.click();
        }
    }
}

// Export functions for global access
window.toggleAccountMenu = toggleAccountMenu;
window.showAccountInfo = showAccountInfo;
window.closeModal = closeModal;
window.logoutUser = logoutUser;
window.scrollToSection = scrollToSection;
window.printInvoice = printInvoice;
window.fileComplaint = fileComplaint;
window.sendExample = sendExample;
