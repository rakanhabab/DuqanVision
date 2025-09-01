// ===== INVOICES MANAGEMENT WITH DATABASE INTEGRATION =====
import { db } from './database.js'

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Invoices management page loaded');
    
    // Check if user is authenticated
    const currentUserStr = localStorage.getItem('current_user');
    if (!currentUserStr) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize page functionality
    await loadInvoicesFromDatabase();
    setupPrintButtons();
    setupComplaintButtons();
});



// Load invoices from database
async function loadInvoicesFromDatabase() {
    try {
        console.log('Loading invoices from database...');
        
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem('current_user');
        if (!currentUserStr) {
            console.error('No user found in localStorage');
            showError('يرجى تسجيل الدخول أولاً');
            return;
        }

        const currentUser = JSON.parse(currentUserStr);
        console.log('Current user:', currentUser);
        
        // Get invoices for current user
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error loading invoices:', error);
            showError(`خطأ في تحميل الفواتير: ${error.message}`);
            return;
        }

        console.log('Invoices loaded:', invoices);
        displayInvoicesTable(invoices || []);
        
    } catch (error) {
        console.error('Error loading invoices:', error);
        showError(`خطأ في تحميل الفواتير: ${error.message}`);
    }
}

// Display invoices in table
function displayInvoicesTable(invoices) {
    const invoicesTable = document.querySelector('.invoices-table');
    if (!invoicesTable) return;
    
    // Keep the header row
    const headerRow = invoicesTable.querySelector('.invoice-row.header');
    invoicesTable.innerHTML = '';
    if (headerRow) {
        invoicesTable.appendChild(headerRow);
    }
    
    if (invoices.length === 0) {
        const noDataRow = document.createElement('div');
        noDataRow.className = 'invoice-row no-data';
        noDataRow.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d; grid-column: 1 / -1;">
                <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
                <div>لا توجد فواتير حتى الآن</div>
                <div style="font-size: 12px; margin-top: 5px;">ستظهر فواتيرك هنا بعد الشراء</div>
            </div>
        `;
        invoicesTable.appendChild(noDataRow);
        return;
    }
    
    // Add invoice rows
    invoices.forEach(invoice => {
        const invoiceRow = document.createElement('div');
        invoiceRow.className = 'invoice-row';
        // Get branch name based on branch_id
        let branchName = 'غير محدد';
        if (invoice.branch_id) {
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
        }
        
        invoiceRow.innerHTML = `
            <div class="invoice-id">#${invoice.invoice_num || invoice.id}</div>
            <div class="invoice-date">${db.formatDate(invoice.timestamp)}</div>
            <div class="invoice-branch">${branchName}</div>
            <div class="invoice-actions">
                <button class="btn btn-view" onclick="window.location.href='invoice-view.html?id=${invoice.id}'">عرض</button>
                <button class="btn btn-print" onclick="printInvoice('${invoice.id}')">طباعة</button>
                <button class="btn btn-complaint" onclick="fileComplaint('${invoice.id}')">شكوى</button>
            </div>
        `;
        invoicesTable.appendChild(invoiceRow);
    });
}

// Show error message
function showError(message) {
    const mainCard = document.querySelector('.main-card');
    if (mainCard) {
        // Remove any existing error messages
        const existingError = mainCard.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #ef4444;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            margin: 20px 0;
        `;
        errorDiv.innerHTML = `
            <div>${message}</div>
            <button onclick="location.reload()" style="
                margin-top: 10px;
                padding: 8px 16px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">إعادة المحاولة</button>
        `;
        mainCard.appendChild(errorDiv);
    }
}

// Setup print functionality
function setupPrintButtons() {
    const printButtons = document.querySelectorAll('.btn-print');
    printButtons.forEach(button => {
        button.addEventListener('click', function() {
            const invoiceId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            printInvoice(invoiceId);
        });
    });
}

// Setup complaint functionality
function setupComplaintButtons() {
    const complaintButtons = document.querySelectorAll('.btn-complaint');
    complaintButtons.forEach(button => {
        button.addEventListener('click', function() {
            const invoiceId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            fileComplaint(invoiceId);
        });
    });
}

// Print invoice function
function printInvoice(invoiceId) {
    console.log('Printing invoice:', invoiceId);
    
    // Open the new invoice view page in a new window for printing
    const printWindow = window.open(`invoice-view.html?id=${invoiceId}`, '_blank');
    
    // Wait for the page to load, then print
    if (printWindow) {
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 1000);
        };
    }
}

// File complaint function
function fileComplaint(invoiceId) {
    console.log('Filing complaint for invoice:', invoiceId);
    
    // Get invoice date from the table row
    const row = event.target.closest('.invoice-row');
    const dateCell = row.querySelector('.invoice-date');
    const invoiceDate = dateCell ? dateCell.textContent : '';
    
    // Redirect to complaint page with invoice data
    window.location.href = `complaint.html?id=${invoiceId}&date=${encodeURIComponent(invoiceDate)}`;
}

// Refresh invoices function
async function refreshInvoices() {
    await loadInvoicesFromDatabase();
}

// Export functions for global access
window.printInvoice = printInvoice;
window.fileComplaint = fileComplaint;
window.refreshInvoices = refreshInvoices;
