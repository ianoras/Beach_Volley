// Variabili globali
let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let config = {};

// Elementi DOM
const calendarDays = document.getElementById('calendarDays');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const timeSlots = document.getElementById('timeSlots');
const bookingForm = document.getElementById('bookingForm');
const bookingSummary = document.getElementById('bookingSummary');
const confirmModal = document.getElementById('confirmModal');
const loadingSpinner = document.getElementById('loadingSpinner');

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    try {
        showLoading(true);
        await loadConfig();
        renderCalendar();
        setupEventListeners();
        showLoading(false);
    } catch (error) {
        console.error('Errore inizializzazione:', error);
        showLoading(false);
    }
}

// Carica configurazioni
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
    } catch (error) {
        console.error('Errore caricamento configurazioni:', error);
        // Configurazioni di default
        config = {
            orariApertura: '09:00-22:00',
            durataSlot: 60,
            maxGiocatori: 12,
            prezzoUnder18: 25,
            prezzoOver18: 30
        };
    }
}

// Setup event listeners
function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    bookingForm.addEventListener('submit', handleBookingSubmit);
}

// Render calendario
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Aggiorna header
    const monthNames = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    currentMonthEl.textContent = `${monthNames[month]} ${year}`;
    
    // Calcola giorni
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    let calendarHTML = '';
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + i);
        
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = currentDay.toDateString() === today.toDateString();
        const isPast = currentDay < today;
        
        let dayClass = 'calendar-day';
        if (!isCurrentMonth) dayClass += ' disabled';
        if (isToday) dayClass += ' today';
        if (isPast) dayClass += ' disabled';
        
        if (selectedDate && currentDay.toDateString() === selectedDate.toDateString()) {
            dayClass += ' selected';
        }
        
        const dayNumber = currentDay.getDate();
        calendarHTML += `<div class="${dayClass}" data-date="${currentDay.toISOString().split('T')[0]}">${dayNumber}</div>`;
    }
    
    calendarDays.innerHTML = calendarHTML;
    
    // Aggiungi event listeners ai giorni
    document.querySelectorAll('.calendar-day:not(.disabled)').forEach(day => {
        day.addEventListener('click', () => selectDate(day.dataset.date));
    });
}

// Seleziona data
async function selectDate(dateString) {
    selectedDate = new Date(dateString);
    selectedTime = null;
    
    // Aggiorna UI calendario
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    document.querySelector(`[data-date="${dateString}"]`).classList.add('selected');
    
    // Carica orari disponibili
    await loadTimeSlots(dateString);
    
    // Aggiorna riepilogo
    updateBookingSummary();
}

// Carica orari disponibili
async function loadTimeSlots(dateString) {
    try {
        showLoading(true);
        const response = await fetch(`/api/disponibilita/${dateString}`);
        const slots = await response.json();
        
        let slotsHTML = '';
        slots.forEach(slot => {
            const slotClass = slot.disponibile ? 'time-slot' : 'time-slot occupied';
            const slotText = slot.disponibile ? slot.orario : `${slot.orario} - Occupato`;
            
            slotsHTML += `
                <div class="${slotClass}" data-time="${slot.orario}" ${slot.disponibile ? 'onclick="selectTime(\'' + slot.orario + '\')"' : ''}>
                    ${slotText}
                </div>
            `;
        });
        
        timeSlots.innerHTML = slotsHTML;
        showLoading(false);
    } catch (error) {
        console.error('Errore caricamento orari:', error);
        timeSlots.innerHTML = '<p class="error">Errore nel caricamento degli orari</p>';
        showLoading(false);
    }
}

// Seleziona orario
function selectTime(time) {
    selectedTime = time;
    
    // Aggiorna UI orari
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    document.querySelector(`[data-time="${time}"]`).classList.add('selected');
    
    // Abilita form
    document.querySelector('button[type="submit"]').disabled = false;
    
    // Aggiorna riepilogo
    updateBookingSummary();
}

// Aggiorna riepilogo prenotazione
function updateBookingSummary() {
    if (!selectedDate || !selectedTime) {
        bookingSummary.innerHTML = '<p>Seleziona data e orario per vedere il riepilogo</p>';
        return;
    }
    
    const dataFormatted = selectedDate.toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    bookingSummary.innerHTML = `
        <div class="summary-item">
            <span>Data:</span>
            <strong>${dataFormatted}</strong>
        </div>
        <div class="summary-item">
            <span>Orario:</span>
            <strong>${selectedTime}</strong>
        </div>
        <div class="summary-item">
            <span>Durata:</span>
            <strong>${config.durataSlot} minuti</strong>
        </div>
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
        <div class="pricing-info">
            <h5>💰 Prezzi per persona:</h5>
            <div class="price-breakdown">
                <div class="price-item">
                    <span>Over 18:</span>
                    <strong>€${config.prezzoOver18}/ora</strong>
                </div>
                <div class="price-item">
                    <span>Under 18:</span>
                    <strong>€${config.prezzoUnder18}/ora</strong>
                </div>
            </div>
        </div>
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 0.8rem; color: #666;">
            <i class="fas fa-info-circle"></i>
            Clicca "Conferma" per inviare la prenotazione via WhatsApp
        </p>
    `;
}

// Gestisce submit prenotazione
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
        alert('Seleziona data e orario prima di procedere');
        return;
    }
    
    const formData = new FormData(bookingForm);
    const bookingData = {
        nome: formData.get('nome'),
        telefono: formData.get('telefono'),
        data: selectedDate.toISOString().split('T')[0],
        orario: selectedTime,
        numero_giocatori: parseInt(formData.get('numero_giocatori')),
        note: formData.get('note')
    };
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/prenotazioni', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showBookingConfirmation(bookingData);
            bookingForm.reset();
            selectedDate = null;
            selectedTime = null;
            renderCalendar();
            timeSlots.innerHTML = '<p class="no-selection">Seleziona prima una data</p>';
            document.querySelector('button[type="submit"]').disabled = true;
        } else {
            alert('Errore nella prenotazione: ' + result.error);
        }
        
        showLoading(false);
    } catch (error) {
        console.error('Errore prenotazione:', error);
        alert('Errore nella prenotazione. Riprova più tardi.');
        showLoading(false);
    }
}

// Mostra conferma prenotazione
function showBookingConfirmation(bookingData) {
    const dataFormatted = new Date(bookingData.data).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Genera messaggio WhatsApp
    const whatsappMessage = `🏐 *PRENOTAZIONE BEACH VOLLEY*

Ciao! Vorrei prenotare il campetto:

👤 *Nome:* ${bookingData.nome}
📅 *Data:* ${dataFormatted}
🕐 *Orario:* ${bookingData.orario}
👥 *Numero giocatori:* ${bookingData.numero_giocatori}
${bookingData.note ? `📝 *Note:* ${bookingData.note}` : ''}

Grazie! 🏖️`;

    // Codifica il messaggio per l'URL
    const encodedMessage = encodeURIComponent(whatsappMessage);
    
    // Numero WhatsApp del gestore (da configurare)
    const gestoreNumber = config.contattoMarco || '+393427004105'; // Usa il numero di Marco
    const whatsappUrl = `https://wa.me/${gestoreNumber}?text=${encodedMessage}`;
    
    // Aggiorna il bottone WhatsApp
    document.getElementById('whatsappButton').href = whatsappUrl;
    
    document.getElementById('bookingDetails').innerHTML = `
        <div class="summary-item">
            <span>Nome:</span>
            <strong>${bookingData.nome}</strong>
        </div>
        <div class="summary-item">
            <span>Telefono:</span>
            <strong>${bookingData.telefono}</strong>
        </div>
        <div class="summary-item">
            <span>Data:</span>
            <strong>${dataFormatted}</strong>
        </div>
        <div class="summary-item">
            <span>Orario:</span>
            <strong>${bookingData.orario}</strong>
        </div>
        <div class="summary-item">
            <span>Giocatori:</span>
            <strong>${bookingData.numero_giocatori}</strong>
        </div>
        ${bookingData.note ? `
        <div class="summary-item">
            <span>Note:</span>
            <strong>${bookingData.note}</strong>
        </div>
        ` : ''}
    `;
    
    confirmModal.classList.add('show');
}

// Chiudi modal
function closeModal() {
    confirmModal.classList.remove('show');
}

// Mostra/nascondi loading
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.add('show');
    } else {
        loadingSpinner.classList.remove('show');
    }
}

// Chiudi modal cliccando fuori
window.addEventListener('click', function(e) {
    if (e.target === confirmModal) {
        closeModal();
    }
});

// Gestione errori globali
window.addEventListener('error', function(e) {
    console.error('Errore JavaScript:', e.error);
    showLoading(false);
}); 