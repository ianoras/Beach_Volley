// Variabili globali
let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let config = {};

// Funzione per ottenere l'URL base delle API
function getApiBaseUrl() {
    // Se siamo su Netlify (produzione), usa le funzioni serverless
    if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('netlify.com')) {
        return '/.netlify/functions/api';
    }
    // Altrimenti usa il server locale
    return '/api';
}

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
        const response = await fetch(`${getApiBaseUrl()}/config`);
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

// Funzioni per scroll automatico e navigazione smart
function scrollToSection(sectionId, smooth = true) {
    const section = document.getElementById(sectionId);
    if (section) {
        const offset = 80; // Offset per l'header
        const targetPosition = section.offsetTop - offset;
        
        if (smooth) {
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo(0, targetPosition);
        }
    }
}

function highlightSection(sectionId) {
    // Rimuovi highlight precedenti
    document.querySelectorAll('.booking-container > div').forEach(div => {
        div.classList.remove('highlight-section');
    });
    
    // Aggiungi highlight alla sezione corrente
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('highlight-section');
        
        // Rimuovi highlight dopo 2 secondi
        setTimeout(() => {
            section.classList.remove('highlight-section');
        }, 2000);
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
    
    // Setup focus automatico tra i campi del form
    setupFormFocus();
}

// Setup focus automatico tra i campi del form
function setupFormFocus() {
    const nomeInput = document.getElementById('nome');
    const telefonoInput = document.getElementById('telefono');
    const numeroGiocatoriSelect = document.getElementById('numero_giocatori');
    const noteTextarea = document.getElementById('note');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    // Quando si completa il nome, vai al telefono
    if (nomeInput) {
        nomeInput.addEventListener('input', function() {
            if (this.value.length >= 3) { // Se ha almeno 3 caratteri
                setTimeout(() => {
                    if (telefonoInput) {
                        telefonoInput.focus();
                    }
                }, 500);
            }
        });
    }
    
    // Quando si completa il telefono, vai al numero giocatori
    if (telefonoInput) {
        telefonoInput.addEventListener('input', function() {
            if (this.value.length >= 10) { // Se ha almeno 10 caratteri
                setTimeout(() => {
                    if (numeroGiocatoriSelect) {
                        numeroGiocatoriSelect.focus();
                    }
                }, 500);
            }
        });
    }
    
    // Quando si seleziona il numero giocatori, vai al bottone conferma
    if (numeroGiocatoriSelect) {
        numeroGiocatoriSelect.addEventListener('change', function() {
            if (this.value) {
                setTimeout(() => {
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.focus();
                        // Scroll al bottone se necessario
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        });
    }
    
    // Enter key navigation
    if (nomeInput) {
        nomeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.length >= 3) {
                e.preventDefault();
                if (telefonoInput) telefonoInput.focus();
            }
        });
    }
    
    if (telefonoInput) {
        telefonoInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.length >= 10) {
                e.preventDefault();
                if (numeroGiocatoriSelect) numeroGiocatoriSelect.focus();
            }
        });
    }
    
    if (numeroGiocatoriSelect) {
        numeroGiocatoriSelect.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value) {
                e.preventDefault();
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.focus();
                    submitBtn.click();
                }
            }
        });
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
        // Usa formato data locale per evitare problemi di fuso orario
        const dateString = currentDay.getFullYear() + '-' + 
                          String(currentDay.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(currentDay.getDate()).padStart(2, '0');
        calendarHTML += `<div class="${dayClass}" data-date="${dateString}">${dayNumber}</div>`;
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
    // Crea data locale per evitare problemi di fuso orario
    const [year, month, day] = dateString.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
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
    
    // Scroll automatico agli orari disponibili
    setTimeout(() => {
        scrollToSection('time-selector');
        highlightSection('time-selector');
    }, 300);
}

// Carica orari disponibili
async function loadTimeSlots(dateString) {
    try {
        showLoading(true);
        console.log('Caricamento orari per:', dateString);
        
        const response = await fetch(`${getApiBaseUrl()}/disponibilita/${dateString}`);
        
        if (!response.ok) {
            throw new Error(`API non disponibile: ${response.status}`);
        }
        
        const text = await response.text();
        if (!text) {
            throw new Error('Risposta vuota');
        }
        
        console.log('Risposta API:', text);
        const data = JSON.parse(text);
        
        // Gestisce sia array che oggetto (per compatibilità Netlify)
        const slots = Array.isArray(data) ? data : (data.body ? JSON.parse(data.body) : []);
        
        console.log('Slot elaborati:', slots);
        
        let slotsHTML = '';
        slots.forEach(slot => {
            let slotClass = 'time-slot';
            let slotText = slot.orario;
            
            if (slot.tipo === 'bloccato') {
                slotClass += ' blocked';
                slotText += ' - Bloccato';
            }
            
            const isClickable = slot.tipo === 'libero';
            
            slotsHTML += `
                <div class="${slotClass}" data-time="${slot.orario}" data-tipo="${slot.tipo}" ${isClickable ? 'onclick="selectTime(\'' + slot.orario + '\')"' : ''}>
                    ${slotText}
                </div>
            `;
        });
        
        if (timeSlots) {
            timeSlots.innerHTML = slotsHTML;
        }
        showLoading(false);
    } catch (error) {
        console.error('Errore caricamento orari:', error);
        // Mostra messaggio di errore
        if (timeSlots) {
            timeSlots.innerHTML = '<p class="error">Errore nel caricamento degli orari. Riprova più tardi.</p>';
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
    
    // Scroll automatico al form di prenotazione
    setTimeout(() => {
        scrollToSection('booking-form');
        highlightSection('booking-form');
        
        // Focus sul primo campo del form
        const firstInput = document.querySelector('#booking-form input');
        if (firstInput) {
            firstInput.focus();
        }
    }, 300);
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
    // Formatta la data correttamente per l'API
    const dataString = selectedDate.getFullYear() + '-' + 
                      String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(selectedDate.getDate()).padStart(2, '0');
    
    const bookingData = {
        nome: formData.get('nome'),
        telefono: formData.get('telefono'),
        data: dataString,
        orario: selectedTime,
        numero_giocatori: parseInt(formData.get('numero_giocatori')),
        note: formData.get('note')
    };
    
    try {
        showLoading(true);
        
        // Prova a inviare al server se disponibile
        try {
            const response = await fetch(`${getApiBaseUrl()}/prenotazioni`, {
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
            console.error('Errore API:', apiError);
            alert('Errore nella prenotazione. Riprova più tardi.');
            showLoading(false);
            return;
        }
        
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
    // Crea data locale per evitare problemi di fuso orario
    const [year, month, day] = bookingData.data.split('-').map(Number);
    const bookingDate = new Date(year, month - 1, day);
    
    const dataFormatted = bookingDate.toLocaleDateString('it-IT', {
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