// Updated script.js - Manual booking control (no fake payments)
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// API Configuration
const API_ENDPOINTS = [
    'https://cocoa-code-backend-production.up.railway.app/api',
    '/api'
];

let currentApiUrl = API_ENDPOINTS[0];
let isOnlineMode = false;

// Service pricing configuration
const servicePricing = {
    'landing': 800,
    'business': 2500,
    'ecommerce': 2000,
    'webapp': 3000,
    'custom': 4000
};

const subscriptionPricing = {
    'basic': 0,
    'plus': 100,
    'premium': 150,
    'unlimited': 250
};

const extraServicePricing = {
    'hosting': 150,
    'management': 200,
    'fixes': 150,
    'seo': 225,
    'analytics': 125,
    'security': 175
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Cocoa Code booking system...');
    initializeColorPickers();
    initializeSelectionHandlers();
    await testApiConnection();
    updateTotal();
});

// Test API connection
async function testApiConnection() {
    console.log('🔄 Testing API connection...');
    
    try {
        const response = await fetch(`${currentApiUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Connected to backend:', data);
            isOnlineMode = true;
            showNotification('✅ Booking system connected', 'success');
            return true;
        }
    } catch (error) {
        console.warn('❌ API connection failed:', error.message);
    }
    
    isOnlineMode = false;
    showNotification('⚠️ Offline mode - bookings will be queued', 'warning');
    return false;
}

// UPDATED: Collect form data with validation
function collectFormData() {
    const clientName = document.getElementById('clientName')?.value?.trim();
    const clientEmail = document.getElementById('clientEmail')?.value?.trim();
    const projectSpecs = document.getElementById('projectSpecs')?.value?.trim();
    const bookingMonth = document.getElementById('bookingMonth')?.value;

    if (!clientName || !clientEmail || !projectSpecs || !bookingMonth) {
        throw new Error('Please fill in all required fields (Name, Email, Project Specs, Booking Month)');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
        throw new Error('Please enter a valid email address');
    }

    return {
        clientName,
        clientEmail,
        projectSpecs,
        bookingMonth,
        websiteType: document.getElementById('websiteType')?.value || 'other',
        primaryColor: document.getElementById('primaryColor')?.value || '#8B4513',
        secondaryColor: document.getElementById('secondaryColor')?.value || '#D2B48C',
        accentColor: document.getElementById('accentColor')?.value || '#CD853F',
        projectType: selectedService?.type || 'custom',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        subscription: selectedSubscription,
        extraServices: selectedExtras.map(extra => ({
            type: extra.type,
            price: extra.price
        })),
        status: 'inquiry', // Changed from 'pending' to 'inquiry'
        paymentStatus: 'not_paid' // Add payment status
    };
}

// UPDATED: Create booking inquiry (not confirmed booking)
async function createBookingInquiry(bookingData) {
    console.log('📝 Creating booking inquiry:', bookingData);
    
    try {
        const response = await fetch(`${currentApiUrl}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(bookingData),
            mode: 'cors'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return {
                success: true,
                projectId: data.projectId,
                clientId: data.clientId,
                message: data.message
            };
        } else {
            throw new Error(data.error || `Server error (${response.status})`);
        }
        
    } catch (error) {
        console.error('Booking inquiry failed:', error);
        throw error;
    }
}

// UPDATED: Process booking request with payment details (not immediate payment)
async function processPayment(method) {
    try {
        console.log('📝 Processing booking request with payment method:', method);
        
        // Validate form
        if (!selectedService || selectedService.price <= 0) {
            throw new Error('Please select a service package first');
        }

        // Update UI to show progress
        updatePaymentStatus('Preparing your booking request...', 20);

        // Collect and validate form data
        let bookingData;
        try {
            bookingData = collectFormData();
            // Add payment method to booking data
            bookingData.preferredPaymentMethod = method;
        } catch (error) {
            throw error;
        }

        // Test API connection if needed
        if (!isOnlineMode) {
            updatePaymentStatus('Connecting to booking system...', 40);
            const connected = await testApiConnection();
            if (!connected) {
                throw new Error('Unable to connect to booking system. Please try again later.');
            }
        }

        // Create booking request (payment info stored, but not charged yet)
        updatePaymentStatus('Submitting your booking request...', 70);
        const bookingResult = await createBookingRequest(bookingData);
        
        if (!bookingResult.success) {
            throw new Error(bookingResult.error || 'Failed to submit booking request');
        }

        console.log('✅ Booking request submitted:', bookingResult.projectId);
        
        updatePaymentStatus('Booking request submitted successfully!', 100);
        
        // Success - booking request submitted for admin review
        setTimeout(() => {
            hidePaymentStatus();
            closeModal();
            showBookingRequestSuccessMessage(bookingResult.projectId, bookingData);
            resetForm();
        }, 1500);

    } catch (error) {
        console.error('❌ Booking request error:', error);
        hidePaymentStatus();
        showNotification(`Booking request failed: ${error.message}`, 'error');
    }
}

// UPDATED: Create booking request (payment details saved but not charged)
async function createBookingRequest(bookingData) {
    console.log('📝 Creating booking request with payment details:', bookingData);
    
    try {
        const response = await fetch(`${currentApiUrl}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                ...bookingData,
                status: 'pending_review', // Waiting for admin confirmation
                paymentStatus: 'pending_confirmation' // Payment will process after admin confirms
            }),
            mode: 'cors'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return {
                success: true,
                projectId: data.projectId,
                clientId: data.clientId,
                message: data.message
            };
        } else {
            throw new Error(data.error || `Server error (${response.status})`);
        }
        
    } catch (error) {
        console.error('Booking request creation failed:', error);
        throw error;
    }
}

// UPDATED: Show booking request confirmation message
function showBookingRequestSuccessMessage(projectId, bookingData) {
    const message = `📝 Booking Request Submitted Successfully!

Request ID: ${projectId}
Service: ${getServiceDisplayName(bookingData.projectType)}
Total Amount: ${bookingData.totalPrice.toLocaleString()} AUD
Payment Method: ${bookingData.preferredPaymentMethod}

🔍 What happens next:
• We'll review your project request within 24 hours
• You'll receive an email confirmation shortly
• Once we confirm your booking, payment will be processed automatically
• Work begins immediately after payment confirmation
• Expected completion: 1-2 weeks from project start

💳 Payment Status: Saved securely, will charge after confirmation
🔒 No payment has been processed yet

Thank you for choosing Cocoa Code! ☕`;
    
    alert(message);
}

// Payment status UI helpers
function updatePaymentStatus(message, progress) {
    const statusDiv = document.getElementById('paymentStatus');
    const statusText = document.getElementById('paymentStatusText');
    const progressBar = document.getElementById('paymentProgress');
    
    if (statusDiv && statusText && progressBar) {
        statusDiv.style.display = 'block';
        statusText.textContent = message;
        progressBar.style.width = `${progress}%`;
    }
}

function hidePaymentStatus() {
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// Color Picker functionality
function initializeColorPickers() {
    const colors = ['primaryColor', 'secondaryColor', 'accentColor'];
    colors.forEach(colorId => {
        const input = document.getElementById(colorId);
        if (input) {
            input.addEventListener('input', function() {
                updateColorPreview(this, `${colorId.replace('Color', '')}Preview`);
            });
            updateColorPreview(input, `${colorId.replace('Color', '')}Preview`);
        }
    });
}

function updateColorPreview(colorInput, previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundColor = colorInput.value;
    }
}

// Selection handlers
function initializeSelectionHandlers() {
    // Service selection
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            const serviceType = this.dataset.service;
            selectedService = { 
                type: serviceType, 
                price: servicePricing[serviceType] || 0 
            };
            updateTotal();
            showNotification(`Selected: ${this.querySelector('h3').textContent}`, 'info');
        });
    });

    // Subscription selection
    document.querySelectorAll('.subscription-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedSubscription = this.dataset.subscription;
            updateTotal();
        });
    });

    // Extra services selection
    document.querySelectorAll('.extra-service').forEach(service => {
        service.addEventListener('click', function() {
            const extraType = this.dataset.extra;
            const extraPrice = extraServicePricing[extraType] || 0;
            
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedExtras = selectedExtras.filter(item => item.type !== extraType);
            } else {
                this.classList.add('selected');
                selectedExtras.push({ type: extraType, price: extraPrice });
            }
            updateTotal();
        });
    });
}

// Update total calculation
function updateTotal() {
    let total = selectedService ? selectedService.price : 0;
    
    selectedExtras.forEach(extra => {
        if (!['management'].includes(extra.type)) {
            total += extra.price;
        }
    });
    
    totalAmount = total;
    
    const totalElement = document.getElementById('totalAmount');
    if (totalElement) {
        totalElement.textContent = total.toLocaleString();
    }
    
    updatePriceBreakdown();
}

// Price breakdown display
function updatePriceBreakdown() {
    const breakdownElement = document.getElementById('priceBreakdown');
    if (!breakdownElement) return;
    
    let breakdown = '';
    
    if (selectedService) {
        breakdown += `<div class="price-item">
            <span>${getServiceDisplayName(selectedService.type)}</span>
            <span>$${selectedService.price.toLocaleString()} AUD</span>
        </div>`;
    }
    
    selectedExtras.forEach(extra => {
        if (!['management'].includes(extra.type)) {
            breakdown += `<div class="price-item">
                <span>${getExtraDisplayName(extra.type)}</span>
                <span>$${extra.price.toLocaleString()} AUD</span>
            </div>`;
        }
    });
    
    breakdownElement.innerHTML = breakdown;
}

// Helper functions
function getServiceDisplayName(type) {
    const names = {
        'landing': 'Landing Page',
        'business': 'Business Website', 
        'ecommerce': 'Blog Site',
        'webapp': 'Web Application',
        'custom': 'Custom Solution'
    };
    return names[type] || type;
}

function getExtraDisplayName(type) {
    const names = {
        'hosting': 'Live Hosting Setup',
        'management': 'Website Management',
        'fixes': 'Code Fixes',
        'seo': 'SEO Optimization',
        'analytics': 'Analytics Setup',
        'security': 'Security Package'
    };
    return names[type] || type;
}

// Form validation
function validateForm() {
    const requiredFields = ['clientName', 'clientEmail', 'projectSpecs', 'bookingMonth'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && (!field.value || field.value.trim() === '')) {
            field.style.borderColor = '#e74c3c';
            field.style.borderWidth = '2px';
            isValid = false;
        } else if (field) {
            field.style.borderColor = '';
            field.style.borderWidth = '';
        }
    });
    
    return isValid;
}

function proceedToPayment() {
    if (!selectedService) {
        showNotification('Please select a service package first', 'error');
        return;
    }
    
    if (!validateForm()) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const modal = document.getElementById('paymentModal');
    const modalTotal = document.getElementById('modalTotal');
    
    if (modal && modalTotal) {
        modalTotal.textContent = totalAmount.toLocaleString();
        modal.style.display = 'block';
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Restore body scroll when modal is closed
        document.body.style.overflow = 'auto';
    }
    hidePaymentStatus();
}
// Reset form
function resetForm() {
    document.getElementById('bookingForm')?.reset();
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    selectedService = null;
    selectedSubscription = 'basic';
    selectedExtras = [];
    updateTotal();
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    const styles = {
        info: { bg: '#3498db', color: 'white' },
        success: { bg: '#2ecc71', color: 'white' },
        warning: { bg: '#f39c12', color: 'white' },
        error: { bg: '#e74c3c', color: 'white' }
    };
    
    const style = styles[type] || styles.info;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: ${style.bg};
        color: ${style.color};
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
        cursor: pointer;
    `;
    
    notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    const autoRemoveTime = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, autoRemoveTime);
}

// Modal event listeners
window.addEventListener('click', function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Global function exports
window.proceedToPayment = proceedToPayment;
window.closeModal = closeModal;
window.processPayment = processPayment;