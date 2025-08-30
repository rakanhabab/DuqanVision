// ===== USER PAGE JAVASCRIPT WITH DATABASE INTEGRATION =====
import { db } from './database.js'

// Page content for language toggle
const pageContent = {
    ar: {
        title: "صفحة المستخدم",
        welcome: "مرحباً بك في صفحة المستخدم",
        description: "هذه صفحة المستخدم لتصميم دكان فيجين. يمكنك إضافة المحتوى الخاص بك هنا.",
        statsTitle: "إحصائيات المستخدم",
        contentTitle: "قسم المحتوى",
        contentText: "أضف المحتوى الخاص بك في هذا القسم."
    },
    en: {
        title: "User Page",
        welcome: "Welcome to the User Page",
        description: "This is the user page for Dukkan Vision design. You can add your content here.",
        statsTitle: "User Statistics",
        contentTitle: "Content Section",
        contentText: "Add your content in this section."
    }
};

// User account data (will be loaded from database)
let userAccount = {
    name: "",
    email: "",
    phone: "",
    balance: "0.00 ر.س",
    lastLogin: ""
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
        setupProductSearch();
        setupInvoices();
        setupChat();
        
        console.log('✅ User page initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing user page:', error);
        showErrorMessage('حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
    }
}

// Check if user is logged in
async function checkUserLogin() {
    const currentUserStr = localStorage.getItem('current_user');
    if (!currentUserStr) {
        console.log('❌ No user data found in localStorage');
        return false;
    }

    try {
        currentUser = JSON.parse(currentUserStr);
        console.log('🔍 Parsed user data:', currentUser);
        
        // Set current user in database service
        if (currentUser && currentUser.id) {
            db.setCurrentUser(currentUser.id);
            console.log('✅ Current user set in database service:', currentUser.id);
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
        console.log('✅ User data loaded successfully');
        
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

        // Update KPI elements
        updateKPIElements({
            visits: visits,
            totalSpend: totalSpend,
            avgInvoice: avgInvoice,
            mostVisitedBranch: mostVisitedBranch
        });

        console.log('✅ User KPIs loaded successfully');
        
    } catch (error) {
        console.error('Error loading user KPIs:', error);
        // Set default values on error
        updateKPIElements({
            visits: 0,
            totalSpend: 0,
            avgInvoice: 0,
            mostVisitedBranch: 'غير محدد'
        });
    }
}

// Update KPI elements with real data
function updateKPIElements(kpis) {
    const spendEl = document.getElementById('kSpend');
    const visitsEl = document.getElementById('kVisits');
    const avgEl = document.getElementById('kAvg');
    const topEl = document.getElementById('kTop');

    if (spendEl) spendEl.textContent = db.formatCurrency(kpis.totalSpend);
    if (visitsEl) visitsEl.textContent = kpis.visits;
    if (avgEl) avgEl.textContent = db.formatCurrency(kpis.avgInvoice);
    if (topEl) topEl.textContent = kpis.mostVisitedBranch;

    // Add animation to show data is loaded
    [spendEl, visitsEl, avgEl, topEl].forEach(el => {
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
        phone: user.phone || '',
        balance: db.formatCurrency(user.owed_balance || 0),
        lastLogin: new Date().toLocaleDateString('ar-SA')
    };
}

// Load invoices from database
async function loadInvoicesFromDatabase() {
    try {
        if (!currentUser) return;

        // Get invoices for current user with branch information
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select(`
                *,
                branches!inner(name, address, lat, long)
            `)
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false })
            .limit(5); // Limit to latest 5 invoices

        if (error) {
            console.error('Error loading invoices:', error);
            return;
        }

        displayInvoices(invoices || []);
        console.log('✅ Invoices loaded successfully');
        
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

// Display invoices for user.html page
function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');
    if (!invoicesList) return;
    
    if (invoices.length === 0) {
        invoicesList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6c757d;">
                <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
                <div>لا توجد فواتير حتى الآن</div>
                <div style="font-size: 12px; margin-top: 5px;">ستظهر فواتيرك هنا بعد الشراء</div>
            </div>
        `;
        return;
    }
    
    // Show only the latest 3 invoices
    const recentInvoices = invoices.slice(0, 3);
    
    invoicesList.innerHTML = recentInvoices.map(invoice => `
        <div class="invoice-item" style="animation: fadeInUp 0.5s ease-out;">
            <div class="invoice-info">
                <div class="invoice-id">#${invoice.id.slice(0, 8)}</div>
                <div class="invoice-date">${db.formatDate(invoice.timestamp)}</div>
                ${invoice.branches ? `<div class="invoice-branch" style="font-size: 12px; color: #8b5cf6;">${invoice.branches.name}</div>` : ''}
            </div>
            <div class="invoice-amount">${db.formatCurrency(invoice.total_amount)}</div>
            <button class="btn btn-purple btn-sm" onclick="window.location.href='invoice-view.html?id=${invoice.id}'">استعراض</button>
        </div>
    `).join('');
}

// Get status text in Arabic
function getStatusText(status) {
    const statusMap = {
        'pending': 'في الانتظار',
        'paid': 'مدفوع',
        'cancelled': 'ملغي',
        'refunded': 'مسترد'
    };
    return statusMap[status] || status;
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
        console.log('✅ Payment methods loaded successfully');
        
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
            
            console.log('✅ Map setup successfully');
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
        
        console.log('✅ Plotly library is available');

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
            console.log('📊 No invoices found in database for user:', currentUser.id);
            createEmptyCharts();
            return;
        }

        // Generate chart data from real invoices
        const monthlyData = {};
        const branchVisits = {};
        
        console.log('📊 Processing invoices for charts:', invoices.length, 'invoices from database');
        
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
        
        console.log('📊 Raw monthly data:', monthlyData);
        console.log('🏢 Raw branch visits:', branchVisits);
        console.log('📅 Available months in data:', Object.keys(monthlyData).map(m => parseInt(m) + 1));

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
        
        console.log('📊 Chart data for January-August:');
        console.log('  - Spend data:', spendData);
        console.log('  - Visits data:', visitsData);
        console.log('  - Months:', chartMonths);

        // Get all branches for pie chart (not just top 3)
        const allBranches = Object.entries(branchVisits)
            .sort(([,a], [,b]) => b - a)
            .map(([name, visits]) => ({ name, visits }));
            
        console.log('🥧 All branches for pie chart from database:', allBranches);
        
        // Use real data from database
        console.log('📊 Using real data from database');
        
        // If no branch data from database, show empty state
        if (allBranches.length === 0) {
            console.log('🏢 No branch visits found in database');
        }
        
        // If no spend/visits data, show empty charts
        if (spendData.every(val => val === 0) && visitsData.every(val => val === 0)) {
            console.log('📊 No spend/visits data found in database');
        }
        
        // Log final processed data
        console.log('📊 Final processed data from database:');
        console.log('  - Spend data:', spendData);
        console.log('  - Visits data:', visitsData);
        console.log('  - Chart months:', chartMonths);
        console.log('  - Branch visits:', branchVisits);
        console.log('  - All branches for pie chart:', allBranches);
        
        console.log('🏢 Final branch data for pie chart:', allBranches);
        console.log('📊 Total invoices processed:', invoices.length);

        // Clear existing charts first
        const containers = ['spendChart', 'visitsChart', 'topChart', 'avgChart'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
            }
        });
        
        // Create Plotly charts with delay
        setTimeout(() => {
            console.log('🎨 Creating charts with data...');
            createSpendChart(spendData, chartMonths);
            createVisitsChart(visitsData, chartMonths);
            createTopChart(allBranches); // Pass all branch data for pie chart
            createAvgChart(spendData.map((spend, i) => 
                visitsData[i] > 0 ? spend / visitsData[i] : 0
            ), chartMonths);
        }, 100);
        
        console.log('✅ All charts created successfully');

        console.log('✅ Plotly charts setup successfully with real database data');
        console.log('📈 Final spend data:', spendData);
        console.log('📊 Final visits data:', visitsData);
        console.log('🏢 Final branch data:', allBranches);
        console.log('📅 Final months:', chartMonths);
        
        // Force charts to redraw after a short delay
        setTimeout(() => {
            try {
                Plotly.Plots.resize('spendChart');
                Plotly.Plots.resize('visitsChart');
                Plotly.Plots.resize('topChart');
                Plotly.Plots.resize('avgChart');
            } catch (error) {
                console.log('Charts already rendered');
            }
        }, 500);
        
    } catch (error) {
        console.error('Error setting up Plotly charts:', error);
        createEmptyCharts();
    }
}

// Create spend chart
function createSpendChart(data, months) {
    console.log('📈 Creating spend chart with data:', data, 'months:', months);
    
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
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' },
            tickangle: -45
        },
        yaxis: {
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' }
        }
    };

    const container = document.getElementById('spendChart');
    if (!container) {
        console.error('❌ spendChart container not found');
        return;
    }
    
    Plotly.newPlot('spendChart', [trace], layout, { displayModeBar: false, responsive: true });
    console.log('✅ Spend chart created successfully');
}

// Create visits chart
function createVisitsChart(data, months) {
    console.log('📊 Creating visits chart with data:', data, 'months:', months);
    
    const trace = {
        x: months,
        y: data,
        type: 'bar',
        marker: {
            color: '#10b981',
            line: {
                color: '#059669',
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
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' },
            tickangle: -45
        },
        yaxis: {
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' }
        }
    };

    const container = document.getElementById('visitsChart');
    if (!container) {
        console.error('❌ visitsChart container not found');
        return;
    }
    
    Plotly.newPlot('visitsChart', [trace], layout, { displayModeBar: false, responsive: true });
    console.log('✅ Visits chart created successfully');
}

// Create branch visits pie chart
function createTopChart(branchData) {
    console.log('🥧 Creating branch visits pie chart with data:', branchData);
    
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
            textfont: { size: 14, color: '#6b7280' },
            hole: 0.4
        };

        const layout = {
            margin: { l: 10, r: 10, t: 10, b: 10 },
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
        };

        const container = document.getElementById('topChart');
        if (!container) {
            console.error('❌ topChart container not found');
            return;
        }
        
        Plotly.newPlot('topChart', [emptyTrace], layout, { displayModeBar: false, responsive: true });
        console.log('✅ Empty top chart created successfully');
        return;
    }

    // Calculate percentages and format labels
    const totalVisits = branchData.reduce((sum, branch) => sum + branch.visits, 0);
    const values = branchData.map(branch => branch.visits);
    const labels = branchData.map(branch => {
        const percentage = ((branch.visits / totalVisits) * 100).toFixed(1);
        return `${branch.name} (${percentage}%)`;
    });

    // Create pie chart trace with dynamic colors
    const colors = [
        '#f97316', '#fb923c', '#fdba74', '#fbbf24', '#f59e0b',
        '#d97706', '#92400e', '#78350f', '#451a03', '#7c2d12'
    ];
    
    const trace = {
        values: values,
        labels: branchData.map(branch => branch.name), // Use original names for legend
        type: 'pie',
        marker: {
            colors: colors.slice(0, values.length)
        },
        textinfo: 'percent',
        textfont: { size: 11, color: '#ffffff' },
        hole: 0.4,
        textposition: 'inside',
        hoverinfo: 'label+percent+value'
    };

    const layout = {
        margin: { l: 10, r: 10, t: 10, b: 10 },
        showlegend: true,
        legend: {
            x: 0.5,
            y: -0.1,
            xanchor: 'center',
            orientation: 'h',
            font: { size: 10 }
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        autosize: true,
        height: 150
    };

    const container = document.getElementById('topChart');
    if (!container) {
        console.error('❌ topChart container not found');
        return;
    }
    
    Plotly.newPlot('topChart', [trace], layout, { displayModeBar: false, responsive: true });
    console.log('✅ Top chart created successfully');
}

// Create average chart
function createAvgChart(data, months) {
    console.log('📊 Creating average chart with data:', data, 'months:', months);
    
    const trace = {
        x: months,
        y: data,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#06b6d4',
            width: 3
        },
        marker: {
            color: '#06b6d4',
            size: 6
        },
        fill: 'tonexty',
        fillcolor: 'rgba(6, 182, 212, 0.1)'
    };

    const layout = {
        margin: { l: 30, r: 20, t: 20, b: 30 },
        showlegend: false,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' },
            tickangle: -45
        },
        yaxis: {
            showgrid: false,
            showticklabels: true,
            zeroline: false,
            tickfont: { size: 10, color: '#6b7280' }
        }
    };

    const container = document.getElementById('avgChart');
    if (!container) {
        console.error('❌ avgChart container not found');
        return;
    }
    
    Plotly.newPlot('avgChart', [trace], layout, { displayModeBar: false, responsive: true });
    console.log('✅ Average chart created successfully');
}

// Create empty charts when no data is available
function createEmptyCharts() {
    console.log('📊 No invoice data found in database, creating empty charts');
    
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس'];
    const emptyData = Array(8).fill(0);
    
    // Clear existing charts first
    const containers = ['spendChart', 'visitsChart', 'topChart', 'avgChart'];
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
        createTopChart([]); // Empty branch data
        createAvgChart(emptyData, months);
    }, 100);
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

// Setup product search
function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchProducts();
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
            
            console.log('Sending request to RAG API:', {
                question: query,
                user_id: currentUser?.id || null,
                user_name: userName
            });
            
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
                console.log('RAG API response:', result);
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

    console.log('✅ Chat functionality setup successfully');
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
        background: #10b981;
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
                        <span class="label">رقم الهاتف:</span>
                        <span class="value">${userAccount.phone}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">الرصيد:</span>
                        <span class="value balance">${userAccount.balance}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">آخر تسجيل دخول:</span>
                        <span class="value">${userAccount.lastLogin}</span>
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
        console.log('Testing RAG API connection...');
        const response = await fetch('http://localhost:8001/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ RAG API is running:', data);
            return true;
        } else {
            console.error('❌ RAG API is not responding properly');
            return false;
        }
    } catch (error) {
        console.error('❌ Cannot connect to RAG API:', error);
        return false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing user page...');
    
    // Test Plotly availability first
    if (typeof Plotly === 'undefined') {
        console.error('❌ Plotly library not loaded');
        alert('خطأ: مكتبة الرسوم البيانية غير محملة');
        return;
    }
    console.log('✅ Plotly library is available');
    
    // Test RAG API connection first
    const isConnected = await testRAGConnection();
    if (!isConnected) {
        console.warn('⚠️ RAG API is not available. Chat functionality may not work.');
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

// Export functions for global access
window.toggleAccountMenu = toggleAccountMenu;
window.showAccountInfo = showAccountInfo;
window.closeModal = closeModal;
window.logoutUser = logoutUser;
window.scrollToSection = scrollToSection;

