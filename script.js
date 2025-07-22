// ===== Updated script.js =====
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// 🚀 RAILWAY-OPTIMIZED API CONFIGURATION
const API_ENDPOINTS = [
    'https://cocoa-code-backend-production.up.railway.app/api', // Replace with YOUR Railway URL
    'http://localhost:5000/api' // Local development fallback
];

let currentApiUrl = null;
let isOnlineMode = false;

// Booking availability tracking for offline mode
let monthlyBookings = {
    'July 2025': 0,
    'August 2025': 0, 
    'September 2025': 0
};

const maxBookingsPerMonth = 4;

// Color picker functionality
function updateColorPreview(colorInput, previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundColor = colorInput.value;
    }
}

// Initialize color previews
document.addEventListener('DOMContentLoaded', function() {
    const primaryColor = document.getElementById('primaryColor');
    const secondaryColor = document.getElementById('secondaryColor');
    const accentColor = document.getElementById('accentColor');

    if (primaryColor) {
        primaryColor.addEventListener('input', function() {
            updateColorPreview(this, 'primaryPreview');
        });
        updateColorPreview(primaryColor, 'primaryPreview');
    }

    if (secondaryColor) {
        secondaryColor.addEventListener('input', function() {
            updateColorPreview(this, 'secondaryPreview');
        });
        updateColorPreview(secondaryColor, 'secondaryPreview');
    }

    if (accentColor) {
        accentColor.addEventListener('input', function() {
            updateColorPreview(this, 'accentPreview');
        });
        updateColorPreview(accentColor, 'accentPreview');
    }
});

// Test API connections and find working endpoint
async function findWorkingAPI() {
    console.log('🔍 Testing API endpoints...');
    
    for (const url of API_ENDPOINTS) {
        try {
            console.log(`🧪 Testing: ${url}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const response = await fetch(`${url}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Found working API: ${url}`, data);
                currentApiUrl = url;
                isOnlineMode = true;
                return url;
            } else {
                console.log(`❌ API responded with error: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}:`, error.message);
        }
    }
    
    console.log('📱 No API endpoints available - using offline mode');
    isOnlineMode = false;
    return null;
}

// Check availability with improved error handling
async function checkAvailability(month) {
    if (!currentApiUrl || !isOnlineMode) {
        console.log('📱 Using fallback availability check');
        const currentCount = monthlyBookings[month] || 0;
        return currentCount < maxBookingsPerMonth;
    }

    try {
        console.log(`🔍 Checking availability for: ${month}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${currentApiUrl}/bookings/availability/${encodeURIComponent(month)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ Availability response:`, data);
        
        return data.available;
    } catch (error) {
        console.error('❌ Error checking availability:', error);
        
        // Fallback to local tracking
        console.log('📱 Using fallback availability check');
        const currentCount = monthlyBookings[month] || 0;
        return currentCount < maxBookingsPerMonth;
    }
}

// Update booking options with availability
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    if (!bookingSelect) return;
    
    const options = bookingSelect.querySelectorAll('option');
    
    console.log('🔄 Updating booking options...');
    
    for (const option of options) {
        if (option.value && option.value !== '') {
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
                console.error(`Error checking ${option.value}:`, error);
            }
        }
    }
    
    console.log('✅ Booking options updated');
}

// Service selection handlers
function initializeSelectionHandlers() {
    // Service cards
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedService = {
                type: this.dataset.service,
                price: parseInt(this.dataset.price) || 0
            };
            updateTotal();
        });
    });

    // Subscription cards
    document.querySelectorAll('.subscription-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedSubscription = this.dataset.subscription;
            updateTotal();
        });
    });

    // Extra services
    document.querySelectorAll('.extra-service').forEach(service => {
        service.addEventListener('click', function() {
            const extraType = this.dataset.extra;
            const extraPrice = parseInt(this.dataset.price);
            
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedExtras = selectedExtras.filter(item => item.type !== extraType);
            } else {
                this.classList.add('selected');
                selectedExtras.push({
                    type: extraType,
                    price: extraPrice
                });
            }
            updateTotal();
        });
    });
}

// Update total calculation
function updateTotal() {
    let total = 0;
    let breakdown = '<div style="text-align: left; margin-bottom: 1rem;">';
    
    // Base service
    if (selectedService) {
        total += selectedService.price;
        breakdown += `<div>Base Project: $${selectedService.price}</div>`;
    }
    
    // Extra services (one-time)
    selectedExtras.forEach(extra => {
        if (extra.type !== 'management' && extra.type !== 'fixes') {
            total += extra.price;
            breakdown += `<div>Extra Service: $${extra.price}</div>`;
        }
    });
    
    // Monthly services note
    const monthlyServices = selectedExtras.filter(e => e.type === 'management' || e.type === 'fixes');
    const subscriptionCard = document.querySelector(`[data-subscription="${selectedSubscription}"]`);
    const subscriptionPrice = subscriptionCard?.dataset.price || 0;
    
    if (parseInt(subscriptionPrice) > 0 || monthlyServices.length > 0) {
        breakdown += '<div style="margin-top: 1rem; font-style: italic;">Monthly Services:</div>';
        
        if (parseInt(subscriptionPrice) > 0) {
            breakdown += `<div>Support: $${subscriptionPrice}/month</div>`;
        }
        
        monthlyServices.forEach(service => {
            breakdown += `<div>Extra: $${service.price}/month</div>`;
        });
    }
    
    breakdown += '</div>';
    
    totalAmount = total;
    
    const totalElement = document.getElementById('totalAmount');
    const breakdownElement = document.getElementById('priceBreakdown');
    
    if (totalElement) totalElement.textContent = total;
    if (breakdownElement) breakdownElement.innerHTML = breakdown;
}

// Proceed to payment with validation
async function proceedToPayment() {
    const hasSelectedService = selectedService !== null;
    const hasSelectedExtras = selectedExtras.length > 0;
    const hasSelectedSubscription = selectedSubscription !== 'basic';
    
    if (!hasSelectedService && !hasSelectedExtras && !hasSelectedSubscription) {
        alert('Please select at least one service, extra service, or subscription plan!');
        return;
    }
    
    const form = document.getElementById('bookingForm');
    if (!form || !form.checkValidity()) {
        alert('Please fill in all required fields!');
        return;
    }
    
    // Only require booking month for main services
    if (hasSelectedService) {
        const bookingSelect = document.getElementById('bookingMonth');
        const selectedMonth = bookingSelect?.value;
        
        if (!selectedMonth) {
            alert('Please select a booking month for your project!');
            return;
        }
        
        // Final availability check
        const available = await checkAvailability(selectedMonth);
        if (!available) {
            alert(`Sorry! ${selectedMonth} is now full. Please select a different month.`);
            return;
        }
    }
    
    const modalTotal = document.getElementById('modalTotal');
    const modal = document.getElementById('paymentModal');
    
    if (modalTotal) modalTotal.textContent = totalAmount;
    if (modal) modal.style.display = 'block';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'none';
}

// Process payment with improved error handling
async function processPayment(paymentMethod) {
    console.log('🔄 Processing payment via', paymentMethod);
    
    try {
        // Show loading state
        const paymentButtons = document.querySelectorAll('.payment-options button');
        paymentButtons.forEach(btn => {
            btn.disabled = true;
            btn.textContent = 'Processing...';
        });
        
        // Create booking
        const projectId = await createBooking();
        if (!projectId) {
            throw new Error('Failed to create booking');
        }
        
        console.log('✅ Booking created with ID:', projectId);
        
        // Update local tracking for offline mode
        if (selectedService && !isOnlineMode) {
            const bookingSelect = document.getElementById('bookingMonth');
            const selectedMonth = bookingSelect?.value;
            if (selectedMonth) {
                monthlyBookings[selectedMonth] = (monthlyBookings[selectedMonth] || 0) + 1;
                updateBookingOptions();
            }
        }
        
        // Show success message
        const paymentMethods = {
            'credit': 'Credit Card',
            'paypal': 'PayPal', 
            'afterpay': 'Afterpay'
        };
        
        let successMessage = `🎉 Booking confirmed successfully via ${paymentMethods[paymentMethod]}!\n\nThank you for choosing Cocoa Code!`;
        
        if (selectedService) {
            const bookingSelect = document.getElementById('bookingMonth');
            const selectedMonth = bookingSelect?.value;
            if (selectedMonth) {
                successMessage += `\n\nYour project is scheduled for ${selectedMonth}.`;
            }
        }
        
        if (selectedExtras.length > 0) {
            const extraTypes = selectedExtras.map(e => e.type).join(', ');
            successMessage += `\n\nExtra services: ${extraTypes}`;
        }
        
        if (selectedSubscription !== 'basic') {
            successMessage += `\n\nSupport plan: ${selectedSubscription}`;
        }
        
        if (paymentMethod === 'afterpay') {
            successMessage += `\n\n💡 With Afterpay: Pay in 4 interest-free installments!`;
        }
        
        successMessage += `\n\nYou'll receive a confirmation email with details and next steps.`;
        successMessage += `\n\nI'll be in touch within 24 hours to discuss your requirements!`;
        
        alert(successMessage);
        closeModal();
        resetForm();
        
    } catch (error) {
        console.error('❌ Payment processing error:', error);
        
        let errorMessage = 'Payment failed. Please try again.';
        if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        alert(`${errorMessage}\n\nIf the problem persists, please contact support.`);
        
        // Re-enable buttons
        const paymentButtons = document.querySelectorAll('.payment-options button');
        paymentButtons.forEach((btn, index) => {
            btn.disabled = false;
            const methods = ['💳 Credit Card', '🅿️ PayPal', '⚡ Afterpay'];
            btn.innerHTML = methods[index] || 'Payment';
        });
    }
}

// Create booking with Railway integration
async function createBooking() {
    const nameInput = document.getElementById('clientName');
    const emailInput = document.getElementById('clientEmail');
    const specsInput = document.getElementById('projectSpecs');
    const websiteTypeInput = document.getElementById('websiteType');
    const bookingMonthInput = document.getElementById('bookingMonth');
    const primaryColorInput = document.getElementById('primaryColor');
    const secondaryColorInput = document.getElementById('secondaryColor');
    const accentColorInput = document.getElementById('accentColor');
    
    const bookingData = {
        clientName: nameInput?.value || '',
        clientEmail: emailInput?.value || '',
        projectSpecs: specsInput?.value || '',
        websiteType: websiteTypeInput?.value || '',
        bookingMonth: bookingMonthInput?.value || '',
        projectType: selectedService?.type || 'service-only',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        primaryColor: primaryColorInput?.value || '#8B4513',
        secondaryColor: secondaryColorInput?.value || '#D2B48C',
        accentColor: accentColorInput?.value || '#CD853F',
        subscription: selectedSubscription,
        extraServices: selectedExtras
    };
    
    console.log('📤 Sending booking data:', bookingData);
    
    if (!currentApiUrl || !isOnlineMode) {
        console.log('📱 Offline mode - simulating booking creation');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return 'offline-' + Date.now();
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`${currentApiUrl}/bookings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📥 Booking response:', result);
        
        return result.projectId;
    } catch (error) {
        console.error('❌ Booking creation error:', error);
        
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection and try again.');
        }
        
        throw new Error(`Booking failed: ${error.message}`);
    }
}

// Reset form to initial state
function resetForm() {
    const form = document.getElementById('bookingForm');
    if (form) form.reset();
    
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.extra-service').forEach(c => c.classList.remove('selected'));
    
    const basicSubscription = document.querySelector('[data-subscription="basic"]');
    if (basicSubscription) basicSubscription.classList.add('selected');
    
    // Reset color inputs
    const primaryColor = document.getElementById('primaryColor');
    const secondaryColor = document.getElementById('secondaryColor');
    const accentColor = document.getElementById('accentColor');
    
    if (primaryColor) {
        primaryColor.value = '#8B4513';
        updateColorPreview(primaryColor, 'primaryPreview');
    }
    if (secondaryColor) {
        secondaryColor.value = '#D2B48C';
        updateColorPreview(secondaryColor, 'secondaryPreview');
    }
    if (accentColor) {
        accentColor.value = '#CD853F';
        updateColorPreview(accentColor, 'accentPreview');
    }
    
    selectedService = null;
    selectedSubscription = 'basic';
    selectedExtras = [];
    updateTotal();
}

// Show status notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#f39c12'}; 
        color: white; padding: 15px 20px; 
        border-radius: 8px; z-index: 9999;
        max-width: 350px; font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Cocoa Code booking system...');
    
    // Test API connection
    const workingApi = await findWorkingAPI();
    
    if (workingApi) {
        console.log('🌐 Online mode: Connected to', workingApi);
        showNotification('✅ Connected to booking system', 'success');
    } else {
        console.log('📱 Offline mode: Using local fallback');
        showNotification('⚠️ Running in offline mode. Limited functionality available.', 'error');
    }
    
    // Initialize event handlers
    initializeSelectionHandlers();
    
    // Set basic subscription as default
    const basicSubscription = document.querySelector('[data-subscription="basic"]');
    if (basicSubscription) basicSubscription.classList.add('selected');
    
    // Update booking availability
    await updateBookingOptions();
    
    console.log('✅ Initialization complete!');
});

// Modal click outside to close
window.addEventListener('click', function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Make functions globally available
window.proceedToPayment = proceedToPayment;
window.closeModal = closeModal;
window.processPayment = processPayment;
