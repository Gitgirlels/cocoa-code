// ===== Updated script.js =====
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// ✅ Use environment variable for production (Netlify) and fallback for local
const API_URL = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
    ? process.env.REACT_APP_API_URL
    : 'https://cocoa-code-backend-production.up.railway.app/api'; // Default fallback

let currentApiUrl = API_URL;
let isOnlineMode = false;

// Booking availability tracking for offline mode
let monthlyBookings = {
    'July 2025': 0,
    'August 2025': 0,
    'September 2025': 0
};

const maxBookingsPerMonth = 4;

// ✅ Color Picker functionality
function updateColorPreview(colorInput, previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundColor = colorInput.value;
    }
}

// ✅ Initialize color previews
document.addEventListener('DOMContentLoaded', function () {
    const colors = ['primaryColor', 'secondaryColor', 'accentColor'];
    colors.forEach(colorId => {
        const input = document.getElementById(colorId);
        if (input) {
            input.addEventListener('input', function () {
                updateColorPreview(this, `${colorId.replace('Color', '')}Preview`);
            });
            updateColorPreview(input, `${colorId.replace('Color', '')}Preview`);
        }
    });
});

// ✅ Check API health
async function checkApiStatus() {
    try {
        const res = await fetch(`${currentApiUrl}/health`, { method: 'GET' });
        if (res.ok) {
            isOnlineMode = true;
            console.log("✅ Connected to API:", currentApiUrl);
            return true;
        }
        throw new Error("API not OK");
    } catch (err) {
        console.warn("⚠️ API unavailable, using offline mode");
        isOnlineMode = false;
        return false;
    }
}

// ✅ Availability check
async function checkAvailability(month) {
    if (!isOnlineMode) {
        return (monthlyBookings[month] || 0) < maxBookingsPerMonth;
    }
    try {
        const res = await fetch(`${currentApiUrl}/bookings/availability/${encodeURIComponent(month)}`);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        return data.available;
    } catch {
        return (monthlyBookings[month] || 0) < maxBookingsPerMonth;
    }
}

// ✅ Update booking options
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    if (!bookingSelect) return;

    const options = bookingSelect.querySelectorAll('option');
    for (const option of options) {
        if (option.value) {
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
        }
    }
}

// ✅ Initialize selections
function initializeSelectionHandlers() {
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedService = { type: this.dataset.service, price: parseInt(this.dataset.price) || 0 };
            updateTotal();
        });
    });

    document.querySelectorAll('.subscription-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedSubscription = this.dataset.subscription;
            updateTotal();
        });
    });

    document.querySelectorAll('.extra-service').forEach(service => {
        service.addEventListener('click', function () {
            const extraType = this.dataset.extra;
            const extraPrice = parseInt(this.dataset.price);
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

// ✅ Update total
function updateTotal() {
    let total = selectedService ? selectedService.price : 0;
    selectedExtras.forEach(extra => {
        if (!['management', 'fixes'].includes(extra.type)) total += extra.price;
    });
    totalAmount = total;

    const totalElement = document.getElementById('totalAmount');
    if (totalElement) totalElement.textContent = total;
}

// ✅ Initialize on load
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Initializing...');
    await checkApiStatus();
    if (isOnlineMode) {
        showNotification('✅ Connected to booking system', 'success');
    } else {
        showNotification('⚠️ Running in offline mode. Limited functionality available.', 'error');
    }
    initializeSelectionHandlers();
    await updateBookingOptions();
});

// ✅ Simple notification system
function showNotification(message, type = 'info') {
    const div = document.createElement('div');
    div.style.cssText = `
        position:fixed;top:20px;right:20px;padding:10px 15px;border-radius:5px;
        background:${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#f39c12'};
        color:white;font-size:14px;z-index:9999;
    `;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}


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
