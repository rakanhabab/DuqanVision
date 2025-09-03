// Support Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Support page loaded');
    
    // Initialize form
    initializeForm();
});

// Initialize form functionality
function initializeForm() {
    const form = document.getElementById('supportForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const supportData = {
        email: formData.get('email'),
        phone: formData.get('phone'),
        subject: formData.get('subject'),
        message: formData.get('message'),
        timestamp: new Date().toISOString(),
        id: generateSupportId()
    };
    
    // Validate form data
    if (!validateForm(supportData)) {
        return;
    }
    
    // Save support request
    saveSupportRequest(supportData);
    
    // Show success message
    showMessage('تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.', 'success');
    
    // Clear form
    clearForm();
}

// Validate form data
function validateForm(data) {
    if (!data.email || !isValidEmail(data.email)) {
        showMessage('يرجى إدخال بريد إلكتروني صحيح', 'error');
        return false;
    }
    
    if (!data.phone || data.phone.trim().length < 8) {
        showMessage('يرجى إدخال رقم جوال صحيح', 'error');
        return false;
    }
    
    if (!data.subject) {
        showMessage('يرجى اختيار نوع الاستفسار', 'error');
        return false;
    }
    
    if (!data.message || data.message.trim().length < 10) {
        showMessage('يرجى كتابة رسالة مفصلة (10 أحرف على الأقل)', 'error');
        return false;
    }
    
    return true;
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Generate unique support ID
function generateSupportId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `SUP-${timestamp}-${random}`;
}

// Save support request to localStorage (in real app, this would go to a database)
function saveSupportRequest(data) {
    try {
        // Get existing support requests
        let supportRequests = JSON.parse(localStorage.getItem('supportRequests') || '[]');
        
        // Add new request
        supportRequests.push(data);
        
        // Save back to localStorage
        localStorage.setItem('supportRequests', JSON.stringify(supportRequests));
        
        console.log('Support request saved:', data);
        
        // In a real application, you would send this data to your server
        // sendToServer(data);
        
    } catch (error) {
        console.error('Error saving support request:', error);
        showMessage('حدث خطأ في حفظ الرسالة. يرجى المحاولة مرة أخرى.', 'error');
    }
}

// Send data to server (placeholder for real implementation)
function sendToServer(data) {
    // This would be replaced with actual API call
    console.log('Sending to server:', data);
    
    // Example API call:
    /*
    fetch('/api/support', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Success:', result);
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('حدث خطأ في إرسال الرسالة. يرجى المحاولة مرة أخرى.', 'error');
    });
    */
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Insert message before form
    const form = document.getElementById('supportForm');
    if (form) {
        form.parentNode.insertBefore(messageElement, form);
    }
    
    // Auto-remove message after 5 seconds
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.remove();
        }
    }, 5000);
}

// Clear form
function clearForm() {
    const form = document.getElementById('supportForm');
    if (form) {
        form.reset();
    }
}

// Go back function
function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        // Fallback: go to user page
        window.location.href = 'user.html';
    }
}

// Export functions for global access
window.clearForm = clearForm;
window.goBack = goBack;
