const { google } = require('googleapis');
require('dotenv').config();

// Configurazione Google Calendar API
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Crea client OAuth2
function createOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

// Crea client con credenziali di servizio (più semplice per serverless)
function createServiceAccountClient() {
    try {
        let serviceAccountKey;
        
        // Prova a parsare le credenziali da variabile d'ambiente
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
                serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            } catch (e) {
                console.error('Errore parsing credenziali Google:', e);
                throw new Error('Credenziali Google Calendar non valide');
            }
        } else {
            throw new Error('Credenziali Google Calendar non configurate');
        }
        
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountKey,
            scopes: SCOPES,
        });
        
        return auth;
    } catch (error) {
        console.error('Errore creazione client Google Calendar:', error);
        throw error;
    }
}

// Ottieni calendario
async function getCalendar() {
    try {
        const auth = await createServiceAccountClient();
        return google.calendar({ version: 'v3', auth });
    } catch (error) {
        console.error('Errore creazione client Google Calendar:', error);
        throw error;
    }
}

// Crea evento nel calendario
async function createCalendarEvent(prenotazione) {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Converti data e orario in formato ISO
        const [year, month, day] = prenotazione.data.split('-');
        const [hour, minute] = prenotazione.orario.split(':');
        
        const startDateTime = new Date(year, month - 1, day, hour, minute);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 ora
        
        const event = {
            summary: `🏐 Beach Volley - ${prenotazione.nome}`,
            description: `
Prenotazione Beach Volley

👤 Nome: ${prenotazione.nome}
📞 Telefono: ${prenotazione.telefono}
👥 Giocatori: ${prenotazione.numero_giocatori}
📅 Data: ${prenotazione.data}
🕐 Orario: ${prenotazione.orario}
${prenotazione.note ? `📝 Note: ${prenotazione.note}` : ''}


            `.trim(),
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            
            colorId: '1', // Blu
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 giorno prima
                    { method: 'popup', minutes: 60 }, // 1 ora prima
                ],
            },
        };
        
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });
        
        console.log('Evento creato nel calendario:', response.data.id);
        return response.data.id;
        
    } catch (error) {
        console.error('Errore creazione evento Google Calendar:', error);
        throw error;
    }
}

// Aggiorna evento nel calendario
async function updateCalendarEvent(eventId, prenotazione) {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Converti data e orario in formato ISO
        const [year, month, day] = prenotazione.data.split('-');
        const [hour, minute] = prenotazione.orario.split(':');
        
        const startDateTime = new Date(year, month - 1, day, hour, minute);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 ora
        
        const event = {
            summary: `🏐 Beach Volley - ${prenotazione.nome}`,
            description: `
Prenotazione Beach Volley

👤 Nome: ${prenotazione.nome}
📞 Telefono: ${prenotazione.telefono}
👥 Giocatori: ${prenotazione.numero_giocatori}
📅 Data: ${prenotazione.data}
🕐 Orario: ${prenotazione.orario}
${prenotazione.note ? `📝 Note: ${prenotazione.note}` : ''}

            `.trim(),
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            
            colorId: '1', // Blu
        };
        
        const response = await calendar.events.update({
            calendarId,
            eventId,
            resource: event,
        });
        
        console.log('Evento aggiornato nel calendario:', response.data.id);
        return response.data.id;
        
    } catch (error) {
        console.error('Errore aggiornamento evento Google Calendar:', error);
        throw error;
    }
}

// Cancella evento dal calendario
async function deleteCalendarEvent(eventId) {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        
        console.log('Evento cancellato dal calendario:', eventId);
        return true;
        
    } catch (error) {
        console.error('Errore cancellazione evento Google Calendar:', error);
        throw error;
    }
}

// Sincronizza tutte le prenotazioni con Google Calendar
async function syncAllPrenotazioni(prenotazioni) {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Ottieni tutti gli eventi esistenti
        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date().toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const existingEvents = response.data.items || [];
        
        // Per ogni prenotazione, crea o aggiorna l'evento
        for (const prenotazione of prenotazioni) {
            const eventTitle = `🏐 Beach Volley - ${prenotazione.nome}`;
            const existingEvent = existingEvents.find(event => 
                event.summary === eventTitle && 
                event.start.dateTime.includes(prenotazione.data)
            );
            
            if (existingEvent) {
                // Aggiorna evento esistente
                await updateCalendarEvent(existingEvent.id, prenotazione);
            } else {
                // Crea nuovo evento
                const eventId = await createCalendarEvent(prenotazione);
                // Aggiorna la prenotazione con l'ID dell'evento
                // Questo dovrebbe essere fatto nel database
            }
        }
        
        console.log('Sincronizzazione completata');
        return true;
        
    } catch (error) {
        console.error('Errore sincronizzazione Google Calendar:', error);
        throw error;
    }
}

// Ottieni eventi bloccati dal calendario per una data specifica
async function getBlockedSlots(data) {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Converti la data in formato ISO per la ricerca
        const [year, month, day] = data.split('-').map(Number);
        const startDate = new Date(year, month - 1, day, 0, 0, 0);
        const endDate = new Date(year, month - 1, day, 23, 59, 59);
        
        console.log(`🔍 Cercando eventi bloccati per ${data}...`);
        
        const response = await calendar.events.list({
            calendarId,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items || [];
        const blockedSlots = [];
        const googlePrenotazioni = []; // Lista delle prenotazioni trovate in Google Calendar
        
        console.log(`📅 Eventi trovati per ${data}:`, events.length);
        console.log(`📅 Dettagli eventi:`, events.map(e => ({
            summary: e.summary,
            colorId: e.colorId,
            start: e.start.dateTime,
            id: e.id
        })));
        
        for (const event of events) {
            console.log(`🔍 Analizzando evento: "${event.summary}" - colorId: ${event.colorId} - start: ${event.start.dateTime}`);
            
            // Ignora eventi senza titolo o con titoli generici
            if (!event.summary || event.summary === 'undefined' || event.summary.trim() === '') {
                console.log(`⏭️ Saltato evento senza titolo: ${event.id}`);
                continue;
            }
            
            // Controlla se l'evento è una prenotazione di beach volley
            const isBeachVolleyBooking = event.summary && 
                (event.summary.includes('🏐 Beach Volley') || 
                 event.summary.includes('Beach Volley'));
            
            // TUTTI gli eventi che non sono prenotazioni di beach volley sono considerati bloccati
            const isBlockedEvent = event.summary && !isBeachVolleyBooking;
            
            // Considera sia le prenotazioni che gli eventi bloccati come slot non disponibili
            const isOccupiedSlot = isBeachVolleyBooking || isBlockedEvent;
            
            console.log(`🔍 Evento "${event.summary}" è prenotazione? ${isBeachVolleyBooking}`);
            console.log(`🔍 Evento "${event.summary}" è bloccato? ${isBlockedEvent}`);
            console.log(`🔍 Evento "${event.summary}" occupa slot? ${isOccupiedSlot}`);
            
            if (isOccupiedSlot) {
                const startTime = new Date(event.start.dateTime);
                const orario = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
                
                blockedSlots.push({
                    orario,
                    motivo: isBeachVolleyBooking ? `Prenotazione: ${event.summary}` : event.summary,
                    eventId: event.id,
                    tipo: isBeachVolleyBooking ? 'prenotazione' : 'blocco'
                });
                
                // Se è una prenotazione, salvala per la sincronizzazione
                if (isBeachVolleyBooking) {
                    googlePrenotazioni.push({
                        orario,
                        eventId: event.id,
                        nome: event.summary.replace('🏐 Beach Volley - ', '')
                    });
                }
                
                console.log(`🚫 Slot occupato trovato: ${orario} - ${event.summary} (${isBeachVolleyBooking ? 'prenotazione' : 'blocco'})`);
            }
        }
        
        console.log(`✅ Slot bloccati per ${data}:`, blockedSlots);
        console.log(`📋 Prenotazioni Google Calendar per ${data}:`, googlePrenotazioni);
        
        // Ritorna sia gli slot bloccati che le prenotazioni Google per la sincronizzazione
        return {
            blockedSlots,
            googlePrenotazioni
        };
        
    } catch (error) {
        console.error('❌ Errore lettura slot bloccati:', error);
        // Ritorna array vuoti in caso di errore per non bloccare il sistema
        return {
            blockedSlots: [],
            googlePrenotazioni: []
        };
    }
}

// Crea evento di blocco nel calendario
async function createBlockedSlot(data, orario, motivo = 'Slot bloccato') {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Converti data e orario in formato ISO
        const [year, month, day] = data.split('-').map(Number);
        const [hour, minute] = orario.split(':').map(Number);
        
        const startDateTime = new Date(year, month - 1, day, hour, minute);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 ora
        
        const event = {
            summary: `🚫 BLOCCATO - ${motivo}`,
            description: `Slot non disponibile per prenotazioni`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Europe/Rome',
            },
            colorId: '11', // Rosso per eventi bloccati
            transparency: 'opaque',
        };
        
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });
        
        console.log('Evento blocco creato nel calendario:', response.data.id);
        return response.data.id;
        
    } catch (error) {
        console.error('Errore creazione evento blocco:', error);
        throw error;
    }
}

// Sincronizza database con Google Calendar per una data specifica
async function syncDatabaseWithCalendar(data, dbPrenotazioni, db, googlePrenotazioni = null) {
    try {
        console.log(`🔄 Sincronizzazione database con Google Calendar per ${data}...`);
        
        // Validazione parametri
        if (!data || !dbPrenotazioni || !db) {
            console.log('⚠️ Parametri mancanti per sincronizzazione, saltando...');
            return [];
        }
        
        // Se non sono state passate, ottieni prenotazioni da Google Calendar
        if (!googlePrenotazioni) {
            try {
                const result = await getBlockedSlots(data);
                googlePrenotazioni = result.googlePrenotazioni || [];
            } catch (error) {
                console.error('❌ Errore lettura Google Calendar, saltando sincronizzazione:', error);
                return [];
            }
        }
        
        // Trova prenotazioni nel database che non esistono più in Google Calendar
        const prenotazioniDaCancellare = dbPrenotazioni.filter(dbPren => {
            // Verifica che la prenotazione abbia tutti i campi necessari
            if (!dbPren || !dbPren.orario || !dbPren._id) {
                console.log('⚠️ Prenotazione DB malformata, saltando:', dbPren);
                return false;
            }
            
            // Cerca se esiste una prenotazione Google Calendar corrispondente
            const googlePren = googlePrenotazioni.find(gp => gp.orario === dbPren.orario);
            return !googlePren; // Se non trova corrispondenza, va cancellata
        });
        
        console.log(`📋 Prenotazioni da cancellare dal database:`, prenotazioniDaCancellare);
        
        // Cancella le prenotazioni orfane dal database
        for (const prenotazione of prenotazioniDaCancellare) {
            console.log(`🗑️ Cancellando prenotazione orfana: ${prenotazione.nome} - ${prenotazione.orario}`);
            try {
                const deleted = await db.cancellaPrenotazione(prenotazione._id);
                if (deleted) {
                    console.log(`✅ Prenotazione cancellata: ${prenotazione.nome} - ${prenotazione.orario}`);
                } else {
                    console.log(`⚠️ Prenotazione non trovata nel database: ${prenotazione.nome} - ${prenotazione.orario}`);
                }
            } catch (error) {
                console.error(`❌ Errore cancellazione prenotazione ${prenotazione.nome}:`, error);
                // Non bloccare la sincronizzazione per un singolo errore
            }
        }
        
        console.log(`✅ Sincronizzazione completata per ${data}`);
        return prenotazioniDaCancellare;
        
    } catch (error) {
        console.error('❌ Errore sincronizzazione database:', error);
        return [];
    }
}

// Test connessione Google Calendar
async function testGoogleCalendarConnection() {
    try {
        const calendar = await getCalendar();
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        // Prova a listare gli eventi per verificare la connessione
        await calendar.events.list({
            calendarId,
            maxResults: 1,
        });
        
        console.log('✅ Connessione Google Calendar OK');
        return true;
        
    } catch (error) {
        console.error('❌ Errore connessione Google Calendar:', error);
        return false;
    }
}

module.exports = {
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    syncAllPrenotazioni,
    testGoogleCalendarConnection,
    getBlockedSlots,
    createBlockedSlot,
    syncDatabaseWithCalendar
}; 