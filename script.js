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

function getServiceDisplayName(type) {
    const names = {
        landing: "Landing Page Website",
        business: "Business / E-commerce Website",
        ecommerce: "Blog Website",
        webapp: "Web Application",
        custom: "Custom Solution"
    };
    return names[type] || "Custom Website";
}

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
    updateBookingMonths();
    initializeColorPickers();
    initializeSelectionHandlers();
    await testApiConnection();
    updateTotal();
    
    // ✅ Add payment form formatting here
    initializePaymentFormFormatting();
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

// Collect form data with validation
function collectFormData() {
    const clientName = document.getElementById('clientName')?.value?.trim();
    const clientEmail = document.getElementById('clientEmail')?.value?.trim();
    const projectSpecs = document.getElementById('projectSpecs')?.value?.trim();
    const bookingMonth = document.getElementById('bookingMonth')?.value?.trim();

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
        projectType: selectedService?.type ?? 'custom',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        subscription: selectedSubscription,
        extraServices: selectedExtras.map(extra => ({
            type: extra.type,
            price: extra.price
        })),
        // Detailed receipt items
        items: [
            // Main service
            {
                name: getServiceDisplayName(selectedService?.type),
                price: selectedService?.price || 0,
                type: 'service'
            },
            // Add selected extras
            ...selectedExtras.map(extra => ({
                name: getExtraDisplayName(extra.type),
                price: extra.price,
                type: 'extra'
            }))
        ],
        extraServices: selectedExtras, // Keep this too for backwards compatibility
        status: 'pending',
        paymentStatus: 'pending_confirmation'
    };
}

// Main booking submission function
async function submitBookingWithPayment() {
    try {
        console.log('📝 Processing booking with payment details');
        
        // Validate form
        if (!selectedService || selectedService.price <= 0) {
            throw new Error('Please select a service package first');
        }

        // Validate payment form
        if (!validatePaymentForm()) {
            return;
        }

        // Update UI to show progress
        updatePaymentStatus('Preparing your booking request...', 20);

        // Collect form data
        let bookingData;
        try {
            bookingData = collectFormData();
            // Add payment details (encrypted/tokenized in production)
            bookingData.paymentDetails = collectPaymentData();
            bookingData.paymentStatus = 'pending_confirmation';
        } catch (error) {
            hidePaymentStatus();
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

        // Submit booking with payment details
        updatePaymentStatus('Submitting your booking request...', 70);
        const bookingResult = await createBookingWithPayment(bookingData);
        
        if (!bookingResult.success) {
            throw new Error(bookingResult.error || 'Failed to submit booking request');
        }

        console.log('✅ Booking request submitted:', bookingResult.projectId);
        
        updatePaymentStatus('Booking request submitted successfully!', 100);
        
        // Success
        setTimeout(() => {
            hidePaymentStatus();
            closeModal();
            showBookingSuccessMessage(bookingResult.projectId, bookingData);
            resetForm();
        }, 1500);

    } catch (error) {
        console.error('❌ Booking request error:', error);
        hidePaymentStatus();
        showNotification(`Booking request failed: ${error.message}`, 'error');
    }
}

// Validate payment form
function validatePaymentForm() {
    const requiredFields = [
        'cardNumber', 'expiryDate', 'cvv', 'cardName', 
        'billingAddress', 'billingCity', 'billingState', 'billingPostcode'
    ];
    
    for (let field of requiredFields) {
        const element = document.getElementById(field);
        if (!element || !element.value.trim()) {
            element?.focus();
            showNotification(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'error');
            return false;
        }
    }
    
    // Validate card number (basic)
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        document.getElementById('cardNumber').focus();
        showNotification('Please enter a valid card number', 'error');
        return false;
    }
    
    // Validate expiry
    const expiry = document.getElementById('expiryDate').value;
    const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
    if (!expiryRegex.test(expiry)) {
        document.getElementById('expiryDate').focus();
        showNotification('Please enter expiry date as MM/YY', 'error');
        return false;
    }
    
    // Validate CVV
    const cvv = document.getElementById('cvv').value;
    if (cvv.length < 3 || cvv.length > 4) {
        document.getElementById('cvv').focus();
        showNotification('Please enter a valid CVV', 'error');
        return false;
    }
    
    // Validate postcode
    const postcode = document.getElementById('billingPostcode').value;
    if (!/^\d{4}$/.test(postcode)) {
        document.getElementById('billingPostcode').focus();
        showNotification('Please enter a valid 4-digit postcode', 'error');
        return false;
    }
    
    return true;
}

// Collect payment data
function collectPaymentData() {
    return {
        cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
        expiryDate: document.getElementById('expiryDate').value,
        cvv: document.getElementById('cvv').value,
        cardName: document.getElementById('cardName').value.trim(),
        billingAddress: {
            street: document.getElementById('billingAddress').value.trim(),
            city: document.getElementById('billingCity').value.trim(),
            state: document.getElementById('billingState').value,
            postcode: document.getElementById('billingPostcode').value
        }
    };
}

// Create booking with payment details
async function createBookingWithPayment(bookingData) {
    console.log('📝 Creating booking with payment details');
    
    try {
        const response = await fetch(`${currentApiUrl}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                ...bookingData,
                status: 'pending',
                paymentStatus: 'card_details_saved'
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
        console.error('Booking creation failed:', error);
        throw error;
    }
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

// Discount codes system
const discountCodes = {
    'OWNER100': {
        type: 'percentage',
        value: 100,
        description: 'Owner Test - 100% Off',
        active: true
    },
    'LAUNCH50': {
        type: 'percentage', 
        value: 50,
        description: 'Launch Special - 50% Off',
        active: true
    }
};

let appliedDiscount = null;

// Update booking months to current date
function updateBookingMonths() {
    const bookingMonthSelect = document.getElementById('bookingMonth');
    if (!bookingMonthSelect) return;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    bookingMonthSelect.innerHTML = '<option value="">Select a month</option>';

    for (let i = 0; i < 6; i++) {
        const monthIndex = (currentMonth + i) % 12;
        const year = currentYear + Math.floor((currentMonth + i) / 12);
        const monthName = months[monthIndex];
        const value = `${monthName} ${year}`;
        
        const option = document.createElement('option');
        option.value = value;
        
        if (i === 0) {
            option.textContent = `This Month (${value})`;
        } else if (i === 1) {
            option.textContent = `Next Month (${value})`;
        } else {
            option.textContent = `${value}`;
        }
        
        bookingMonthSelect.appendChild(option);
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

// ✅ FIXED: Update total calculation
function updateTotal() {
    let subtotal = selectedService ? selectedService.price : 0;
    
    selectedExtras.forEach(extra => {
        if (!['management'].includes(extra.type)) {
            subtotal += extra.price;
        }
    });
    
    const discountAmount = calculateDiscount(subtotal);
    totalAmount = Math.max(0, subtotal - discountAmount);
    
    const totalElement = document.getElementById('totalAmount');
    if (totalElement) {
        totalElement.textContent = totalAmount.toLocaleString();
    }
    
    updatePriceBreakdown();
}

// Apply discount code
function applyDiscountCode() {
    const discountInput = document.getElementById('discountCode');
    const discountStatus = document.getElementById('discountStatus');
    
    if (!discountInput || !discountStatus) return;
    
    const code = discountInput.value.trim().toUpperCase();
    const discount = discountCodes[code];
    
    if (!discount) {
        discountStatus.innerHTML = '<span style="color: #721c24;">❌ Invalid discount code</span>';
        appliedDiscount = null;
        updateTotal();
        return;
    }
    
    appliedDiscount = { code, ...discount };
    discountStatus.innerHTML = `<span style="color: #155724;">✅ Discount applied: ${discount.description}</span>`;
    updateTotal();
}

// Calculate discount amount
function calculateDiscount(subtotal) {
    if (!appliedDiscount) return 0;
    
    if (appliedDiscount.type === 'percentage') {
        return Math.round((subtotal * appliedDiscount.value / 100) * 100) / 100;
    }
    return 0;
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
    
    // Add discount if applied
    if (appliedDiscount) {
        const discountAmount = calculateDiscount(selectedService ? selectedService.price : 0);
        breakdown += `<div class="price-item" style="color: #28a745;">
            <span>Discount (${appliedDiscount.code})</span>
            <span>-$${discountAmount.toLocaleString()} AUD</span>
        </div>`;
    }
    
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

// Modal functions
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
    appliedDiscount = null;
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

// ✅ Payment form formatting (moved to separate function)
function initializePaymentFormFormatting() {
    // Format card number input
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
            let formattedInputValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedInputValue;
        });
    }
    
    // Format expiry date input
    const expiryInput = document.getElementById('expiryDate');
    if (expiryInput) {
        expiryInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }
    
    // Format CVV input
    const cvvInput = document.getElementById('cvv');
    if (cvvInput) {
        cvvInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
    
    // Format postcode input
    const postcodeInput = document.getElementById('billingPostcode');
    if (postcodeInput) {
        postcodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

// Success message
function showBookingSuccessMessage(projectId, bookingData) {
    const message = `📝 Booking Request Submitted Successfully!

Request ID: ${projectId}
Service: ${getServiceDisplayName(bookingData.projectType)}
Total Amount: $${bookingData.totalPrice.toLocaleString()} AUD

🔍 What happens next:
- We'll review your project request within 24 hours
- You'll receive an email confirmation with next steps
- Once we approve your booking, we'll charge your card
- You'll get another email notification before any payment
- Work begins immediately after payment confirmation
- Expected completion: 1-2 weeks from project start

💳 Payment Status: Card details saved securely
🔒 No payment has been processed yet

Thank you for choosing Cocoa Code! ☕`;
    
    alert(message);
}

// Modal event listeners
window.addEventListener('click', function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
});

// ✅ Global function exports (make functions available to HTML)
window.applyDiscountCode = applyDiscountCode;
window.proceedToPayment = proceedToPayment;
window.closeModal = closeModal;
window.submitBookingWithPayment = submitBookingWithPayment;