// Configuration
const API_BASE_URL = 'http://localhost:8000';
let currentSessionId = null;
let selectedTime = null;

// DOM Elements
const sections = {
    chat: document.getElementById('chat-section'),
    reservation: document.getElementById('reservation-section'),
    menu: document.getElementById('menu-section'),
    info: document.getElementById('info-section')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeChat();
    initializeReservationForm();
    loadMenuItems();
    loadRestaurantInfo();
    checkAPIStatus();
    
    // Set minimum date for reservation
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;
    
    // Set default time to next hour
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const nextHourStr = nextHour.getHours().toString().padStart(2, '0') + ':00';
    
    // Initialize chat with welcome message
    setTimeout(() => {
        addBotMessage("Hi! I'm your dining assistant. I can help you book a table, view our menu, or answer any questions about Epicurean Delights. How can I assist you today?");
        showSuggestions(['Book a table', 'View menu', 'Check opening hours', 'Ask about dietary options']);
    }, 500);
});

// Navigation
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            
            // Update active button
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected section
            Object.values(sections).forEach(sec => sec.classList.remove('active'));
            sections[section].classList.add('active');
            
            // Load data if needed
            if (section === 'menu') {
                loadMenuItems();
            } else if (section === 'info') {
                loadRestaurantInfo();
            }
        });
    });
}

// Chat Functionality
function initializeChat() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const micButton = document.getElementById('mic-btn');
    
    // Send message on button click
    sendButton.addEventListener('click', sendChatMessage);
    
    // Send message on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Initialize voice recognition (if supported)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        micButton.addEventListener('click', startVoiceRecognition);
    } else {
        micButton.style.display = 'none';
    }
    
    // Initialize suggestion buttons
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const suggestion = btn.textContent;
            addUserMessage(suggestion);
            processChatMessage(suggestion);
        });
    });
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    chatInput.value = '';
    
    await processChatMessage(message);
}

function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
            <p>${message}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addBotMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <p>${message}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function showSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('quick-suggestions');
    suggestionsContainer.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion-btn';
        button.textContent = suggestion;
        button.addEventListener('click', () => {
            addUserMessage(suggestion);
            processChatMessage(suggestion);
        });
        suggestionsContainer.appendChild(button);
    });
}

async function processChatMessage(message) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: currentSessionId
            })
        });
        
        const data = await response.json();
        currentSessionId = data.session_id;
        
        // Handle bot response
        const botResponse = data.response;
        addBotMessage(botResponse.response);
        
        if (botResponse.suggestions && botResponse.suggestions.length > 0) {
            showSuggestions(botResponse.suggestions);
        }
        
        // Handle special actions
        if (botResponse.menu_items) {
            displayMenuInChat(botResponse.menu_items);
        }
        
        if (botResponse.requires_confirmation) {
            // Switch to reservation section
            document.querySelector('[data-section="reservation"]').click();
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        addBotMessage("I apologize, but I'm having trouble connecting right now. Please try again or use the reservation form.");
    } finally {
        showLoading(false);
    }
}

function displayMenuInChat(menuItems) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    let menuHTML = '<div class="chat-menu">';
    menuHTML += '<h4>Popular Dishes:</h4>';
    
    menuItems.slice(0, 3).forEach(item => {
        menuHTML += `
            <div class="chat-menu-item">
                <strong>${item.name}</strong> - $${item.price.toFixed(2)}
                <br>
                <small>${item.description}</small>
            </div>
        `;
    });
    
    menuHTML += '</div>';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            ${menuHTML}
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Reservation Form
function initializeReservationForm() {
    const form = document.getElementById('reservation-form');
    const steps = document.querySelectorAll('.form-step');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    const editButtons = document.querySelectorAll('.btn-edit');
    const dateInput = document.getElementById('date');
    const partySizeSelect = document.getElementById('party-size');
    
    // Step navigation
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            const currentStep = button.closest('.form-step');
            const nextStepNum = button.dataset.next;
            
            if (validateStep(currentStep.dataset.step)) {
                if (nextStepNum === '2') {
                    loadTimeSlots();
                } else if (nextStepNum === '3') {
                    updateReservationSummary();
                }
                
                showStep(nextStepNum);
            }
        });
    });
    
    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prevStepNum = button.dataset.prev;
            showStep(prevStepNum);
        });
    });
    
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const editStepNum = button.dataset.edit;
            showStep(editStepNum);
        });
    });
    
    // Load time slots when date changes
    dateInput.addEventListener('change', loadTimeSlots);
    partySizeSelect.addEventListener('change', loadTimeSlots);
    
    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitReservation();
    });
}

function showStep(stepNum) {
    const steps = document.querySelectorAll('.form-step');
    const stepIndicators = document.querySelectorAll('.step');
    
    // Hide all steps
    steps.forEach(step => step.classList.remove('active'));
    stepIndicators.forEach(step => step.classList.remove('active'));
    
    // Show selected step
    document.querySelector(`.form-step[data-step="${stepNum}"]`).classList.add('active');
    document.querySelector(`.step[data-step="${stepNum}"]`).classList.add('active');
}

function validateStep(stepNum) {
    if (stepNum === '1') {
        const requiredFields = ['name', 'email', 'phone', 'party-size', 'date'];
        let isValid = true;
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                field.style.borderColor = 'var(--danger-color)';
                isValid = false;
            } else {
                field.style.borderColor = 'var(--light-gray)';
            }
        });
        
        if (!isValid) {
            alert('Please fill in all required fields.');
            return false;
        }
        
        // Validate email
        const email = document.getElementById('email').value;
        if (!isValidEmail(email)) {
            alert('Please enter a valid email address.');
            return false;
        }
        
        // Validate phone
        const phone = document.getElementById('phone').value;
        if (!isValidPhone(phone)) {
            alert('Please enter a valid phone number.');
            return false;
        }
        
        return true;
    }
    
    if (stepNum === '2') {
        if (!selectedTime) {
            alert('Please select a time slot.');
            return false;
        }
        return true;
    }
    
    return true;
}

async function loadTimeSlots() {
    const dateInput = document.getElementById('date');
    const timeSlotsContainer = document.getElementById('time-slots');
    const recommendedContainer = document.getElementById('recommended-times');
    
    if (!dateInput.value) return;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/availability/${dateInput.value}`);
        const data = await response.json();
        
        // Clear previous slots
        timeSlotsContainer.innerHTML = '';
        recommendedContainer.innerHTML = '';
        
        // Display time slots
        data.time_slots.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = `time-slot ${slot.available ? '' : 'unavailable'}`;
            slotDiv.textContent = formatTime(slot.time);
            
            if (slot.available) {
                slotDiv.addEventListener('click', () => selectTimeSlot(slotDiv, slot.time));
                
                // Add table type indicators
                if (slot.table_types && slot.table_types.length > 0) {
                    const tableTypes = document.createElement('div');
                    tableTypes.className = 'table-types';
                    tableTypes.innerHTML = slot.table_types.map(type => 
                        `<span class="table-type-tag">${type.charAt(0)}</span>`
                    ).join('');
                    slotDiv.appendChild(tableTypes);
                }
            }
            
            timeSlotsContainer.appendChild(slotDiv);
        });
        
        // Display recommended times
        if (data.recommended_times && data.recommended_times.length > 0) {
            data.recommended_times.forEach(time => {
                const recDiv = document.createElement('div');
                recDiv.className = 'recommended-time';
                recDiv.textContent = formatTime(time);
                recDiv.addEventListener('click', () => {
                    const slotDiv = [...timeSlotsContainer.children].find(
                        div => div.textContent.includes(formatTime(time))
                    );
                    if (slotDiv && !slotDiv.classList.contains('unavailable')) {
                        selectTimeSlot(slotDiv, time);
                    }
                });
                recommendedContainer.appendChild(recDiv);
            });
        }
        
    } catch (error) {
        console.error('Error loading time slots:', error);
        timeSlotsContainer.innerHTML = '<p>Unable to load availability. Please try again.</p>';
    } finally {
        showLoading(false);
    }
}

function selectTimeSlot(slotDiv, time) {
    // Remove selection from all slots
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    // Select this slot
    slotDiv.classList.add('selected');
    selectedTime = time;
}

function updateReservationSummary() {
    const summaryContainer = document.getElementById('summary-details');
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const partySize = document.getElementById('party-size').value;
    const date = document.getElementById('date').value;
    const requests = document.getElementById('requests').value;
    
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const formattedTime = selectedTime ? formatTime(selectedTime) : 'Not selected';
    
    summaryContainer.innerHTML = `
        <div class="summary-item">
            <strong>Name:</strong> ${name}
        </div>
        <div class="summary-item">
            <strong>Contact:</strong> ${email} | ${phone}
        </div>
        <div class="summary-item">
            <strong>Party Size:</strong> ${partySize} ${partySize === '1' ? 'person' : 'people'}
        </div>
        <div class="summary-item">
            <strong>Date:</strong> ${formattedDate}
        </div>
        <div class="summary-item">
            <strong>Time:</strong> ${formattedTime}
        </div>
        ${requests ? `
        <div class="summary-item">
            <strong>Special Requests:</strong> ${requests}
        </div>
        ` : ''}
    `;
}

async function submitReservation() {
    showLoading(true);
    
    const reservationData = {
        customer_name: document.getElementById('name').value,
        customer_email: document.getElementById('email').value,
        customer_phone: document.getElementById('phone').value,
        party_size: parseInt(document.getElementById('party-size').value),
        reservation_date: document.getElementById('date').value,
        reservation_time: selectedTime + ':00',
        special_requests: document.getElementById('requests').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/reserve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reservationData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showConfirmationModal(result.reservation);
            resetReservationForm();
        } else {
            alert('Reservation failed: ' + result.message);
        }
        
    } catch (error) {
        console.error('Reservation error:', error);
        alert('Unable to make reservation. Please try again.');
    } finally {
        showLoading(false);
    }
}

function resetReservationForm() {
    document.getElementById('reservation-form').reset();
    selectedTime = null;
    showStep('1');
    
    // Reset time slots
    const timeSlotsContainer = document.getElementById('time-slots');
    timeSlotsContainer.innerHTML = '';
}

// Menu Functionality
async function loadMenuItems(category = 'all') {
    showLoading(true);
    
    try {
        const url = category === 'all' 
            ? `${API_BASE_URL}/api/menu`
            : `${API_BASE_URL}/api/menu?category=${category}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        displayMenuItems(data.items);
        
        // Update active category button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
    } catch (error) {
        console.error('Error loading menu:', error);
        document.getElementById('menu-items').innerHTML = 
            '<p>Unable to load menu. Please try again.</p>';
    } finally {
        showLoading(false);
    }
}

function displayMenuItems(items) {
    const container = document.getElementById('menu-items');
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p>No menu items found.</p>';
        return;
    }
    
    container.innerHTML = items.map(item => `
        <div class="menu-item">
            <div class="menu-item-image">
                ${item.image_url ? 
                    `<img src="${item.image_url}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;">` :
                    `<i class="fas fa-utensils fa-3x"></i>`
                }
            </div>
            <div class="menu-item-content">
                <div class="menu-item-header">
                    <h3 class="menu-item-name">${item.name}</h3>
                    <div class="menu-item-price">$${item.price.toFixed(2)}</div>
                </div>
                <p class="menu-item-desc">${item.description}</p>
                <div class="menu-item-tags">
                    <span class="tag">${item.category}</span>
                    ${item.dietary_tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    ${item.popular ? '<span class="tag popular"><i class="fas fa-star"></i> Popular</span>' : ''}
                </div>
                ${item.preparation_time ? 
                    `<div class="prep-time"><i class="fas fa-clock"></i> ${item.preparation_time} min prep</div>` : 
                    ''
                }
            </div>
        </div>
    `).join('');
    
    // Add category filter event listeners
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            loadMenuItems(btn.dataset.category);
        });
    });
}

// Restaurant Information
async function loadRestaurantInfo() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/restaurant`);
        const data = await response.json();
        
        // Update DOM with restaurant info
        document.getElementById('restaurant-address').textContent = data.address;
        document.getElementById('restaurant-phone').textContent = data.phone;
        document.getElementById('restaurant-email').textContent = data.email;
        document.getElementById('restaurant-description').textContent = data.description;
        
        // Update hours
        const hoursList = document.getElementById('hours-list');
        hoursList.innerHTML = Object.entries(data.opening_hours).map(([day, hours]) => `
            <div class="hour-item">
                <strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong>
                ${formatTime(hours.open)} - ${formatTime(hours.close)}
            </div>
        `).join('');
        
        // Update features
        const featuresList = document.getElementById('restaurant-features');
        featuresList.innerHTML = data.features.map(feature => 
            `<li><i class="fas fa-check"></i> ${feature}</li>`
        ).join('');
        
        // Add map button functionality
        document.querySelector('.btn-map').addEventListener('click', () => {
            const address = encodeURIComponent(data.address);
            window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
        });
        
    } catch (error) {
        console.error('Error loading restaurant info:', error);
    } finally {
        showLoading(false);
    }
}

// Utility Functions
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTime(timeString) {
    if (!timeString) return '';
    
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPhone(phone) {
    const re = /^[\+]?[1-9][\d]{9,14}$/;
    return re.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showConfirmationModal(reservation) {
    const modal = document.getElementById('success-modal');
    const details = document.getElementById('confirmation-details');
    
    const formattedDate = new Date(reservation.reservation_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    details.innerHTML = `
        <p><strong>Confirmation Code:</strong> ${reservation.confirmation_code}</p>
        <p><strong>Reservation ID:</strong> ${reservation.reservation_id}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formatTime(reservation.reservation_time)}</p>
        <p><strong>Table for:</strong> ${reservation.party_size} people</p>
        <p><strong>Table Type:</strong> ${reservation.table_type}</p>
        ${reservation.estimated_wait_time ? 
            `<p><strong>Estimated Wait:</strong> ${reservation.estimated_wait_time} minutes</p>` : 
            ''
        }
        <div class="confirmation-note">
            <p><i class="fas fa-info-circle"></i> A confirmation email has been sent.</p>
            <p>Please arrive 10 minutes before your reservation.</p>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Close modal button
    modal.querySelector('.btn-close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Voice Recognition
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Voice recognition is not supported in your browser.');
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chat-input').value = transcript;
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };
}

// API Status Check
async function checkAPIStatus() {
    const statusElement = document.getElementById('api-status');
    
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (response.ok) {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
            statusElement.className = 'status-online';
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        statusElement.className = 'status-offline';
    }
    
    // Check every 30 seconds
    setTimeout(checkAPIStatus, 30000);
}

// Add CSS for additional elements
const style = document.createElement('style');
style.textContent = `
    .chat-menu {
        margin: 10px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .chat-menu-item {
        margin: 10px 0;
        padding: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .chat-menu-item:last-child {
        border-bottom: none;
    }
    
    .table-types {
        display: flex;
        gap: 2px;
        justify-content: center;
        margin-top: 5px;
    }
    
    .table-type-tag {
        font-size: 0.7rem;
        background: var(--primary-color);
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .recommended-time {
        display: inline-block;
        margin: 5px;
        padding: 8px 15px;
        background: var(--primary-color);
        color: white;
        border-radius: 8px;
        cursor: pointer;
        transition: var(--transition);
    }
    
    .recommended-time:hover {
        background: var(--primary-dark);
    }
    
    .summary-item {
        margin: 10px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .confirmation-note {
        margin-top: 20px;
        padding: 15px;
        background: #e8f5e9;
        border-radius: 8px;
        border-left: 4px solid var(--success-color);
    }
    
    .tag.popular {
        background: var(--warning-color);
        color: var(--secondary-color);
    }
    
    .prep-time {
        margin-top: 10px;
        color: var(--gray-color);
        font-size: 0.9rem;
    }
`;
document.head.appendChild(style);