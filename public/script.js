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
        if (!response.ok) {
            throw new Error('API non disponibile');
        }
        
        const text = await response.text();
        if (!text) {
            throw new Error('Risposta vuota');
        }
        
        config = JSON.parse(text);
    } catch (error) {
        console.log('Usando configurazioni di default (modalità locale)');
        // Configurazioni di default per il beach volley
        config = {
            orariApertura: '16:00-23:00',
            durataSlot: 60,
            maxGiocatori: 12,
            prezzoUnder18: 3,
            prezzoOver18: 4
        };
    }
}

// Setup event listeners
function setupEventListeners() {
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }
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
    
    if (currentMonthEl) {
        currentMonthEl.textContent = `${monthNames[month]} ${year}`;
    }
    
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
        const isPast = currentDay < today && currentDay.toDateString() !== today.toDateString();
        
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
    
    if (calendarDays) {
        calendarDays.innerHTML = calendarHTML;
        
        // Aggiungi event listeners ai giorni
        document.querySelectorAll('.calendar-day:not(.disabled)').forEach(day => {
            day.addEventListener('click', () => selectDate(day.dataset.date));
        });
    }
}

// Seleziona data
async function selectDate(dateString) {
    selectedDate = new Date(dateString);
    selectedTime = null;
    
    // Aggiorna UI calendario
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    const selectedDayElement = document.querySelector(`[data-date="${dateString}"]`);
    if (selectedDayElement) {
        selectedDayElement.classList.add('selected');
    }
    
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
        
        if (!response.ok) {
            throw new Error('API non disponibile');
        }
        
        const text = await response.text();
        if (!text) {
            throw new Error('Risposta vuota');
        }
        
        const data = JSON.parse(text);
        
        // Gestisce sia array che oggetto (per compatibilità Netlify)
        const slots = Array.isArray(data) ? data : (data.body ? JSON.parse(data.body) : []);
        
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
        
        if (timeSlots) {
            timeSlots.innerHTML = slotsHTML;
        }
        showLoading(false);
    } catch (error) {
        console.log('Usando orari di esempio (modalità locale)');
        // Genera orari di esempio per il beach volley (16:00-23:00) - tutti liberi
        const orari = [];
        const now = new Date();
        const currentHour = now.getHours();
        
        // Controlla se ci sono orari bloccati in modalità test
        const testSchedule = JSON.parse(sessionStorage.getItem('testSchedule') || '{}');
        const dateSchedule = testSchedule[dateString] || {};
        
        for (let hour = 16; hour <= 22; hour++) {
            // Se è oggi, mostra solo orari futuri
            const isToday = selectedDate && selectedDate.toDateString() === now.toDateString();
            const isFutureHour = hour > currentHour;
            
            if (!isToday || isFutureHour) {
                const orario = `${hour.toString().padStart(2, '0')}:00`;
                const savedStatus = dateSchedule[orario] || 'libero';
                
                orari.push({
                    orario: orario,
                    disponibile: savedStatus === 'libero'
                });
            }
        }
        
        let slotsHTML = '';
        orari.forEach(slot => {
            const slotClass = slot.disponibile ? 'time-slot' : 'time-slot occupied';
            const savedStatus = dateSchedule[slot.orario] || 'libero';
            let slotText = slot.orario;
            
            if (!slot.disponibile) {
                if (savedStatus === 'bloccato') {
                    slotText = `${slot.orario} - Bloccato`;
                } else {
                    slotText = `${slot.orario} - Occupato`;
                }
            }
            
            slotsHTML += `
                <div class="${slotClass}" data-time="${slot.orario}" ${slot.disponibile ? 'onclick="selectTime(\'' + slot.orario + '\')"' : ''}>
                    ${slotText}
                </div>
            `;
        });
        
        if (timeSlots) {
            timeSlots.innerHTML = slotsHTML;
        }
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
    if (!bookingSummary) return;
    
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
        
        // Prova a inviare al server se disponibile
        try {
            const response = await fetch('/api/prenotazioni', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            });
            
            if (response.ok) {
                const text = await response.text();
                if (text) {
                    const result = JSON.parse(text);
                    if (result.success) {
                        showBookingConfirmation(bookingData);
                        resetForm();
                        showLoading(false);
                        return;
                    }
                }
            }
        } catch (apiError) {
            console.log('API non disponibile, usando modalità locale');
        }
        
        // Modalità locale - mostra direttamente la conferma
        showBookingConfirmation(bookingData);
        resetForm();
        showLoading(false);
        
    } catch (error) {
        console.error('Errore prenotazione:', error);
        alert('Errore nella prenotazione. Riprova più tardi.');
        showLoading(false);
    }
}

// Reset form dopo prenotazione
function resetForm() {
    if (bookingForm) {
        bookingForm.reset();
    }
    selectedDate = null;
    selectedTime = null;
    renderCalendar();
    if (timeSlots) {
        timeSlots.innerHTML = '<p class="no-selection">Seleziona prima una data</p>';
    }
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
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
    
    // Numero WhatsApp del gestore
    const gestoreNumber = '+393427004105'; // Numero di Marco
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
    if (!loadingSpinner) return;
    
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