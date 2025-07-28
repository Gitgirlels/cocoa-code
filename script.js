// Complete production script.js - no test dependencies
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
let apiRetryCount = 0;
const MAX_RETRIES = 3;

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
    await initializeApiConnection();
    await updateBookingOptions();
    updateTotal();
});

// Initialize API connection with retry logic
async function initializeApiConnection() {
    console.log('🔄 Checking API connection...');
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
        currentApiUrl = API_ENDPOINTS[i];
        console.log(`Trying endpoint ${i + 1}/${API_ENDPOINTS.length}: ${currentApiUrl}`);
        
        const isConnected = await checkApiStatus();
        if (isConnected) {
            console.log(`✅ Connected successfully to: ${currentApiUrl}`);
            return true;
        }
        
        if (i < API_ENDPOINTS.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.warn('⚠️ All API endpoints failed, using offline mode');
    showNotification('⚠️ Running in offline mode. Booking may be limited.', 'warning');
    return false;
}

// Enhanced API status check
async function checkApiStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${currentApiUrl}/health`, { 
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            isOnlineMode = true;
            apiRetryCount = 0;
            console.log("✅ API Health Check Passed:", data);
            showNotification('✅ Connected to booking system', 'success');
            return true;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.warn(`❌ API check failed for ${currentApiUrl}:`, error.message);
        isOnlineMode = false;
        return false;
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

// Availability checking
async function checkAvailability(month) {
    if (!isOnlineMode) return true;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`${currentApiUrl}/bookings/availability/${encodeURIComponent(month)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.available;
    } catch (error) {
        console.warn("Availability check failed:", error.message);
        return true;
    }
}

// Update booking options
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    if (!bookingSelect) return;

    const options = bookingSelect.querySelectorAll('option');
    for (const option of options) {
        if (option.value) {
            try {
                const available = await checkAvailability(option.value);
                if (!available) {
                    option.textContent = option.textContent.replace(' (FULL)', '') + ' (FULL)';
                    option.disabled = true;
                    option.style.color = '#999';
                } else {
                    option.textContent = option.textContent.replace(' (FULL)', '');
                    option.disabled = false;
                    option.style.color = '';
                }
            } catch (error) {
                console.warn(`Error checking availability for ${option.value}:`, error.message);
            }
        }
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
            showNotification(`Support plan: ${this.querySelector('h4').textContent}`, 'info');
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
                showNotification(`Removed: ${this.querySelector('h4').textContent}`, 'info');
            } else {
                this.classList.add('selected');
                selectedExtras.push({ type: extraType, price: extraPrice });
                showNotification(`Added: ${this.querySelector('h4').textContent}`, 'info');
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
    
    const monthlyServices = selectedExtras.filter(extra => ['management'].includes(extra.type));
    const subscriptionPrice = subscriptionPricing[selectedSubscription] || 0;
    
    if (monthlyServices.length > 0 || subscriptionPrice > 0) {
        breakdown += '<hr><div class="monthly-services"><h4>Monthly Services:</h4>';
        
        if (subscriptionPrice > 0) {
            breakdown += `<div class="price-item monthly">
                <span>Support (${selectedSubscription})</span>
                <span>$${subscriptionPrice}/month AUD</span>
            </div>`;
        }
        
        monthlyServices.forEach(extra => {
            breakdown += `<div class="price-item monthly">
                <span>${getExtraDisplayName(extra.type)}</span>
                <span>$${extra.price}/month AUD</span>
            </div>`;
        });
        
        breakdown += '</div>';
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

// Payment modal functions
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
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
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
    
    const emailField = document.getElementById('clientEmail');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            emailField.style.borderColor = '#e74c3c';
            emailField.style.borderWidth = '2px';
            isValid = false;
        }
    }
    
    return isValid;
}

// PRODUCTION PAYMENT PROCESSING
async function processPayment(method) {
    try {
        showNotification('Preparing payment...', 'info');
        
        // Ensure API is connected
        if (!isOnlineMode) {
            throw new Error('Unable to connect to payment service. Please try again later.');
        }

        // Validate form data
        if (!validateForm()) {
            throw new Error('Please fill in all required fields correctly.');
        }

        // Collect booking data
        const bookingData = collectFormData();
        
        if (!selectedService || selectedService.price <= 0) {
            throw new Error('Please select a valid service package.');
        }

        showNotification('Creating booking...', 'info');

        // Step 1: Create the booking first
        const bookingResponse = await createBooking(bookingData);
        
        if (!bookingResponse.success) {
            throw new Error(bookingResponse.error || 'Failed to create booking');
        }

        const projectId = bookingResponse.projectId;
        console.log('✅ Booking created:', projectId);

        // Step 2: Create payment intent
        showNotification('Processing payment...', 'info');
        
        const paymentIntent = await createPaymentIntent({
            amount: totalAmount,
            projectId: projectId,
            paymentMethod: method,
            currency: 'aud'
        });

        if (!paymentIntent.success) {
            throw new Error(paymentIntent.error || 'Failed to create payment');
        }

        console.log('💳 Payment intent created:', paymentIntent.paymentIntentId);

        // Step 3: Process payment (simplified for demo)
        showNotification('Finalizing payment...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4: Confirm payment
        await confirmPayment({
            paymentIntentId: paymentIntent.paymentIntentId,
            projectId: projectId
        });

        // Success!
        showNotification('✅ Payment successful! Booking confirmed.', 'success');
        closeModal();
        resetForm();
        
        setTimeout(() => {
            showSuccessMessage(projectId, paymentIntent.paymentIntentId);
        }, 1000);

    } catch (error) {
        console.error('❌ Payment processing error:', error);
        showNotification(`Payment failed: ${error.message}`, 'error');
    }
}

// Create payment intent on the backend
async function createPaymentIntent(paymentData) {
    try {
        const response = await fetch(`${currentApiUrl}/payments/create-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(paymentData),
            mode: 'cors',
            credentials: 'omit'
        });

        const data = await response.json();

        if (response.ok) {
            return {
                success: true,
                clientSecret: data.clientSecret,
                paymentIntentId: data.paymentIntentId,
                paymentId: data.paymentId
            };
        } else {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Payment intent creation failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Confirm payment on the backend
async function confirmPayment(confirmationData) {
    try {
        const response = await fetch(`${currentApiUrl}/payments/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(confirmationData),
            mode: 'cors',
            credentials: 'omit'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        console.log('✅ Payment confirmed:', data);
        return data;

    } catch (error) {
        console.error('Payment confirmation failed:', error);
        throw error;
    }
}

// Show success message with booking details
function showSuccessMessage(projectId, paymentId) {
    const message = `
🎉 Booking Confirmed Successfully!

Project ID: ${projectId}
Payment ID: ${paymentId}

What happens next:
• You'll receive a confirmation email within 5 minutes
• We'll start working on your project within 1-2 business days
• You'll get progress updates throughout development
• Expected completion: 1-2 weeks

Thank you for choosing Cocoa Code! ☕
    `;
    
    alert(message);
}

// Enhanced booking creation with better error handling
async function createBooking(bookingData) {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📝 Creating booking (attempt ${attempt}/${maxRetries})`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${currentApiUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(bookingData),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (response.ok) {
                return {
                    success: true,
                    projectId: data.projectId,
                    message: data.message
                };
            } else {
                // Handle specific error cases
                if (response.status === 400 && data.error?.includes('fully booked')) {
                    throw new Error(`${bookingData.bookingMonth} is fully booked. Please select a different month.`);
                }
                throw new Error(data.error || `Booking failed (HTTP ${response.status})`);
            }
            
        } catch (error) {
            console.error(`Booking attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                return {
                    success: false,
                    error: `Failed to create booking after ${maxRetries} attempts: ${error.message}`
                };
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }
}

// Collect form data
function collectFormData() {
    return {
        clientName: document.getElementById('clientName')?.value || '',
        clientEmail: document.getElementById('clientEmail')?.value || '',
        projectSpecs: document.getElementById('projectSpecs')?.value || '',
        bookingMonth: document.getElementById('bookingMonth')?.value || '',
        websiteType: document.getElementById('websiteType')?.value || '',
        primaryColor: document.getElementById('primaryColor')?.value || '#8B4513',
        secondaryColor: document.getElementById('secondaryColor')?.value || '#D2B48C',
        accentColor: document.getElementById('accentColor')?.value || '#CD853F',
        projectType: selectedService?.type || '',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        subscription: selectedSubscription,
        extraServices: selectedExtras
    };
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
    
    // Click to dismiss
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
    
    // Auto remove
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