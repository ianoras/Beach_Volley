const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Importa i moduli
const db = require('./database');
const googleCalendar = require('./googleCalendar');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware per logging delle richieste
app.use((req, res, next) => {
    console.log(`🚀 Express riceve: ${req.method} ${req.path}`);
    next();
});

// Inizializza database
async function initApp() {
    try {
        await db.initDatabase();
        console.log('Applicazione inizializzata con successo!');
    } catch (error) {
        console.error('Errore inizializzazione:', error);
        throw error;
    }
}

// API Routes

// GET - Ottieni configurazioni
app.get('/config', async (req, res) => {
    try {
        const orariApertura = await db.getConfigurazione('orari_apertura');
        const durataSlot = await db.getConfigurazione('durata_slot');
        const maxGiocatori = await db.getConfigurazione('max_giocatori');
        const prezzoUnder18 = await db.getConfigurazione('prezzo_under18');
        const prezzoOver18 = await db.getConfigurazione('prezzo_over18');
        const indirizzo = await db.getConfigurazione('indirizzo');
        const contattoMarco = await db.getConfigurazione('contatto_marco');
        const contattoLuigi = await db.getConfigurazione('contatto_luigi');
        const instagram = await db.getConfigurazione('instagram');
        
        res.json({
            orariApertura,
            durataSlot: parseInt(durataSlot),
            maxGiocatori: parseInt(maxGiocatori),
            prezzoUnder18: parseInt(prezzoUnder18),
            prezzoOver18: parseInt(prezzoOver18),
            indirizzo,
            contattoMarco,
            contattoLuigi,
            instagram
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Ottieni prenotazioni
app.get('/prenotazioni', async (req, res) => {
    try {
        const { data } = req.query;
        const prenotazioni = await db.getPrenotazioni(data);
        res.json(prenotazioni);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Test prenotazione (per debug)
app.post('/test-prenotazione', async (req, res) => {
    try {
        console.log('🧪 Test prenotazione...');
        const { nome, telefono, data, orario, numero_giocatori, note } = req.body;
        
        console.log('📝 Dati prenotazione:', { nome, telefono, data, orario, numero_giocatori, note });
        
        // Validazione
        if (!nome || !telefono || !data || !orario || !numero_giocatori) {
            return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        }
        
        // Verifica disponibilità
        console.log('🔍 Verificando disponibilità...');
        const disponibile = await db.verificaDisponibilita(data, orario);
        console.log('✅ Disponibilità:', disponibile);
        
        if (!disponibile) {
            return res.status(409).json({ error: 'Slot non disponibile' });
        }
        
        // Crea prenotazione nel database
        console.log('💾 Creando prenotazione nel database...');
        const prenotazione = { nome, telefono, data, orario, numero_giocatori, note };
        const id = await db.creaPrenotazione(prenotazione);
        console.log('✅ Prenotazione creata con ID:', id);
        
        // Crea evento in Google Calendar
        console.log('📅 Creando evento in Google Calendar...');
        try {
            const googleEventId = await googleCalendar.createCalendarEvent(prenotazione);
            await db.updatePrenotazioneGoogleEvent(id, googleEventId);
            console.log('✅ Evento Google Calendar creato:', googleEventId);
        } catch (calendarError) {
            console.error('❌ Errore creazione evento Google Calendar:', calendarError);
            // Non blocchiamo la prenotazione se Google Calendar fallisce
        }
        
        res.json({ 
            success: true, 
            id, 
            message: 'Test prenotazione completato con successo',
            prenotazione: prenotazione
        });
    } catch (error) {
        console.error('❌ Errore test prenotazione:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Crea nuova prenotazione
app.post('/prenotazioni', async (req, res) => {
    try {
        const { nome, telefono, data, orario, numero_giocatori, note } = req.body;
        
        console.log('📝 Nuova prenotazione:', { nome, telefono, data, orario, numero_giocatori, note });
        
        // Validazione
        if (!nome || !telefono || !data || !orario || !numero_giocatori) {
            return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        }
        
        // Verifica disponibilità
        const disponibile = await db.verificaDisponibilita(data, orario);
        if (!disponibile) {
            return res.status(409).json({ error: 'Slot non disponibile' });
        }
        
        // Crea prenotazione nel database
        const prenotazione = { nome, telefono, data, orario, numero_giocatori, note };
        const id = await db.creaPrenotazione(prenotazione);
        
        // Crea evento in Google Calendar
        try {
            const googleEventId = await googleCalendar.createCalendarEvent(prenotazione);
            await db.updatePrenotazioneGoogleEvent(id, googleEventId);
            console.log('Evento Google Calendar creato:', googleEventId);
        } catch (calendarError) {
            console.error('Errore creazione evento Google Calendar:', calendarError);
            // Non blocchiamo la prenotazione se Google Calendar fallisce
        }
        
        res.json({ 
            success: true, 
            id, 
            message: 'Prenotazione creata con successo' 
        });
    } catch (error) {
        console.error('Errore creazione prenotazione:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Cancella prenotazione
app.delete('/prenotazioni/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Prima ottieni i dettagli della prenotazione
        const prenotazione = await db.getPrenotazioneById(id);
        if (!prenotazione) {
            return res.status(404).json({ error: 'Prenotazione non trovata' });
        }
        
        // Cancella evento da Google Calendar se esiste
        if (prenotazione.google_event_id) {
            try {
                await googleCalendar.deleteCalendarEvent(prenotazione.google_event_id);
                console.log('Evento Google Calendar cancellato:', prenotazione.google_event_id);
            } catch (calendarError) {
                console.error('Errore cancellazione evento Google Calendar:', calendarError);
                // Non blocchiamo la cancellazione se Google Calendar fallisce
            }
        }
        
        // Cancella prenotazione dal database
        const cancellata = await db.cancellaPrenotazione(id);
        
        if (cancellata) {
            res.json({ 
                success: true, 
                message: 'Prenotazione cancellata con successo' 
            });
        } else {
            res.status(404).json({ error: 'Prenotazione non trovata' });
        }
    } catch (error) {
        console.error('Errore cancellazione prenotazione:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Test connessione Google Calendar
app.get('/test-calendar', async (req, res) => {
    try {
        console.log('🧪 Test connessione Google Calendar...');
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        console.log('📅 Calendar ID configurato:', calendarId);
        
        const isConnected = await googleCalendar.testGoogleCalendarConnection();
        
        if (isConnected) {
            res.json({ 
                success: true, 
                message: 'Connessione Google Calendar OK',
                calendarId: calendarId
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Errore connessione Google Calendar',
                calendarId: calendarId
            });
        }
    } catch (error) {
        console.error('Errore test Google Calendar:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Ottieni disponibilità per data
app.get('/disponibilita/:data', async (req, res) => {
    try {
        const { data } = req.params;
        console.log(`📅 Richiesta disponibilità per: ${data}`);
        
        console.log('🔍 Chiamando db.getPrenotazioni...');
        const prenotazioni = await db.getPrenotazioni(data);
        console.log('🔍 Chiamando db.getOrariBloccati...');
        const orariBloccati = await db.getOrariBloccati(data);
        
        console.log(`📊 Prenotazioni trovate: ${prenotazioni.length}`, prenotazioni);
        console.log(`🚫 Orari bloccati: ${orariBloccati.length}`, orariBloccati);
        
        // Genera orari disponibili (18:00-23:00, slot di 1 ora)
        const orari = [];
        for (let ora = 18; ora < 23; ora++) {
            const orario = `${ora.toString().padStart(2, '0')}:00`;
            const occupato = prenotazioni.some(p => p.orario === orario);
            const bloccato = orariBloccati.some(b => b.orario === orario);
            
            let tipo = 'libero';
            if (bloccato) {
                tipo = 'bloccato';
            } else if (occupato) {
                tipo = 'occupato';
            }
            
            orari.push({
                orario,
                disponibile: !occupato && !bloccato,
                tipo,
                prenotazione: occupato ? prenotazioni.find(p => p.orario === orario) : null
            });
        }
        
        console.log(`✅ Disponibilità per ${data}:`, orari);
        
        // Assicurati che la risposta non sia vuota
        if (orari.length === 0) {
            console.log('⚠️ Nessun orario generato, creando orari di default');
            // Crea orari di default se non ce ne sono
            for (let ora = 18; ora < 23; ora++) {
                const orario = `${ora.toString().padStart(2, '0')}:00`;
                orari.push({
                    orario,
                    disponibile: true,
                    tipo: 'libero'
                });
            }
        }
        
        res.json(orari);
    } catch (error) {
        console.error('❌ Errore disponibilità:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Ottieni tutti gli slot bloccati
app.get('/blocked-slots', async (req, res) => {
    try {
        const orariBloccati = await db.getOrariBloccati();
        res.json(orariBloccati);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// POST - Blocca slot nel calendario Google
app.post('/block-slot', async (req, res) => {
    try {
        const { data, orario, motivo } = req.body;
        
        if (!data || !orario) {
            return res.status(400).json({ error: 'Data e orario sono obbligatori' });
        }
        
        // Crea evento di blocco nel calendario Google
        const eventId = await googleCalendar.createBlockedSlot(data, orario, motivo || 'Slot bloccato');
        
        // Salva anche nel database locale
        await db.bloccaOrario(data, orario, motivo || 'Slot bloccato');
        
        res.json({ 
            success: true, 
            message: 'Slot bloccato con successo',
            eventId: eventId
        });
    } catch (error) {
        console.error('Errore blocco slot:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Sblocca slot
app.delete('/unblock-slot', async (req, res) => {
    try {
        const { data, orario } = req.body;
        
        if (!data || !orario) {
            return res.status(400).json({ error: 'Data e orario sono obbligatori' });
        }
        
        // Rimuovi dal database locale
        await db.sbloccaOrario(data, orario);
        
        // TODO: Rimuovi anche dal calendario Google se necessario
        
        res.json({ 
            success: true, 
            message: 'Slot sbloccato con successo'
        });
    } catch (error) {
        console.error('Errore sblocco slot:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Sincronizza con Google Calendar
app.post('/sync-calendar', async (req, res) => {
    try {
        const prenotazioni = await db.getPrenotazioni();
        await googleCalendar.syncAllPrenotazioni(prenotazioni);
        
        res.json({ 
            success: true, 
            message: 'Sincronizzazione con Google Calendar completata' 
        });
    } catch (error) {
        console.error('Errore sincronizzazione Google Calendar:', error);
        res.status(500).json({ error: error.message });
    }
});





// GET - Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// GET - Test connessioni
app.get('/test', async (req, res) => {
    try {
        const results = {
            database: false,
            googleCalendar: false,
            timestamp: new Date().toISOString()
        };
        
        // Test database
        try {
            await db.connectDB();
            results.database = true;
            console.log('✅ Database connesso');
        } catch (dbError) {
            console.error('❌ Errore database:', dbError.message);
        }
        
        // Test Google Calendar
        try {
            await googleCalendar.testGoogleCalendarConnection();
            results.googleCalendar = true;
        } catch (calendarError) {
            console.error('❌ Errore Google Calendar:', calendarError.message);
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware per gestire route non trovate (deve essere l'ultimo)
app.use((req, res, next) => {
    console.log(`❌ Route non trovata: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route non trovata' });
});

// Inizializza l'app
initApp().catch(console.error);

// Handler per Netlify Functions
const handler = async (event, context) => {
    // Chiudi connessioni al database dopo ogni richiesta
    context.callbackWaitsForEmptyEventLoop = false;
    
    console.log('🔍 Richiesta ricevuta:', {
        method: event.httpMethod,
        path: event.path,
        query: event.queryStringParameters
    });
    
    try {
        // Gestisci richieste OPTIONS per CORS
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: ''
            };
        }
        
        // Converti evento Netlify in richiesta Express
        const fullPath = event.path.replace('/.netlify/functions/api', '').replace('/api', '');
        const method = event.httpMethod;
        const headers = event.headers || {};
        const body = event.body ? JSON.parse(event.body) : {};
        const query = event.queryStringParameters || {};
        
        // Estrai parametri dal path per le route con parametri (es: /disponibilita/:data)
        const pathParts = fullPath.split('/');
        const params = {};
        
        // Gestisci parametri per route specifiche
        if (pathParts[1] === 'disponibilita' && pathParts[2]) {
            params.data = pathParts[2];
        } else if (pathParts[1] === 'prenotazioni' && pathParts[2]) {
            params.id = pathParts[2];
        }
        
        // Simula richiesta Express
        const req = {
            method,
            path: fullPath,
            headers,
            body,
            query,
            params
        };
        
        const res = {
            statusCode: 200,
            headers: {},
            body: '',
            
            status(code) {
                this.statusCode = code;
                return this;
            },
            
            json(data) {
                this.body = JSON.stringify(data);
                this.headers['Content-Type'] = 'application/json';
                return this;
            },
            
            send(data) {
                this.body = typeof data === 'string' ? data : JSON.stringify(data);
                return this;
            }
        };
        
        console.log('🔍 Simulando richiesta Express:', {
            method: req.method,
            path: req.path,
            params: req.params
        });
        
        // Gestisci la richiesta direttamente invece di usare Express
        console.log('🔍 Gestione diretta della richiesta:', { method: req.method, path: req.path, params: req.params });
        
        if (req.method === 'GET' && req.path.startsWith('/disponibilita/')) {
            const data = req.params.data;
            console.log(`📅 Richiesta disponibilità per: ${data}`);
            
            try {
                console.log('🔍 Chiamando db.getPrenotazioni...');
                let prenotazioni = [];
                let orariBloccati = [];
                
                try {
                    prenotazioni = await db.getPrenotazioni(data);
                } catch (error) {
                    console.error('❌ Errore lettura prenotazioni dal database:', error);
                    prenotazioni = [];
                }
                
                console.log('🔍 Chiamando db.getOrariBloccati...');
                try {
                    orariBloccati = await db.getOrariBloccati(data);
                } catch (error) {
                    console.error('❌ Errore lettura orari bloccati dal database:', error);
                    orariBloccati = [];
                }
                
                // Leggi anche gli slot bloccati dal calendario Google
                console.log('🔍 Chiamando googleCalendar.getBlockedSlots...');
                const googleResult = await googleCalendar.getBlockedSlots(data);
                const googleBlockedSlots = googleResult.blockedSlots;
                
                // Sincronizza automaticamente il database con Google Calendar
                console.log('🔄 Sincronizzazione automatica database con Google Calendar...');
                try {
                    const prenotazioniOrfane = await googleCalendar.syncDatabaseWithCalendar(data, prenotazioni, db, googleResult.googlePrenotazioni);
                    
                    // Se ci sono prenotazioni orfane, ricarica le prenotazioni dal database
                    if (prenotazioniOrfane && prenotazioniOrfane.length > 0) {
                        console.log('🔄 Ricaricando prenotazioni dal database dopo sincronizzazione...');
                        try {
                            prenotazioni = await db.getPrenotazioni(data);
                        } catch (error) {
                            console.error('❌ Errore ricaricamento prenotazioni dopo sincronizzazione:', error);
                            // Continua con le prenotazioni originali
                        }
                    }
                } catch (error) {
                    console.error('❌ Errore sincronizzazione automatica:', error);
                    // Continua senza sincronizzazione
                }
                
                console.log(`📊 Prenotazioni trovate: ${prenotazioni.length}`, prenotazioni);
                console.log(`🚫 Orari bloccati DB: ${orariBloccati.length}`, orariBloccati);
                console.log(`🚫 Orari bloccati Google: ${googleBlockedSlots.length}`, googleBlockedSlots);
                
                // Combina gli slot bloccati dal database e da Google Calendar
                const allBlockedSlots = [...orariBloccati];
                googleBlockedSlots.forEach(slot => {
                    // Evita duplicazioni: se c'è già una prenotazione nel database per questo orario, non aggiungere quella di Google
                    const existingPrenotazione = prenotazioni.find(p => p.orario === slot.orario);
                    const existingBlocked = allBlockedSlots.some(existing => existing.orario === slot.orario);
                    
                    if (!existingPrenotazione && !existingBlocked) {
                        allBlockedSlots.push({
                            orario: slot.orario,
                            motivo: slot.motivo,
                            source: 'google_calendar',
                            tipo: slot.tipo || 'blocco'
                        });
                        console.log(`➕ Aggiunto slot Google: ${slot.orario} - ${slot.motivo}`);
                    } else {
                        console.log(`⏭️ Saltato slot Google (duplicato): ${slot.orario} - ${slot.motivo}`);
                    }
                });
                
                console.log(`🚫 Totale orari bloccati: ${allBlockedSlots.length}`, allBlockedSlots);
                
                // Genera orari disponibili (18:00-23:00, slot di 1 ora)
                const orari = [];
                for (let ora = 18; ora < 23; ora++) {
                    const orario = `${ora.toString().padStart(2, '0')}:00`;
                    
                    // Cerca prenotazioni nel database
                    const prenotazioneDB = prenotazioni.find(p => p.orario === orario);
                    
                    // Cerca slot occupati da Google Calendar
                    const slotGoogle = allBlockedSlots.find(b => b.orario === orario);
                    
                    let tipo = 'libero';
                    let prenotazione = null;
                    let blocco = null;
                    let disponibile = true;
                    
                    // Priorità: Google Calendar > Database
                    if (slotGoogle) {
                        // Slot bloccato da Google Calendar (evento manuale)
                        tipo = 'bloccato';
                        blocco = slotGoogle;
                        disponibile = false;
                        console.log(`🚫 Slot ${orario}: BLOCCATO da Google - ${slotGoogle.motivo}`);
                    } else if (prenotazioneDB) {
                        // Slot bloccato da prenotazione nel database
                        tipo = 'bloccato';
                        prenotazione = prenotazioneDB;
                        disponibile = false;
                        console.log(`🚫 Slot ${orario}: BLOCCATO da prenotazione DB - ${prenotazioneDB.nome}`);
                    } else {
                        console.log(`✅ Slot ${orario}: LIBERO`);
                    }
                    
                    orari.push({
                        orario,
                        disponibile,
                        tipo,
                        prenotazione,
                        blocco
                    });
                }
                
                console.log(`✅ Disponibilità per ${data}:`, orari);
                
                // Assicurati che la risposta non sia vuota
                if (orari.length === 0) {
                    console.log('⚠️ Nessun orario generato, creando orari di default');
                    // Crea orari di default se non ce ne sono
                    for (let ora = 18; ora < 23; ora++) {
                        const orario = `${ora.toString().padStart(2, '0')}:00`;
                        orari.push({
                            orario,
                            disponibile: true,
                            tipo: 'libero'
                        });
                    }
                }
                
                res.json(orari);
                console.log('✅ Risposta inviata con successo');
            } catch (error) {
                console.error('❌ Errore disponibilità:', error);
                res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'POST' && req.path === '/prenotazioni') {
            console.log('📝 Richiesta POST prenotazioni ricevuta');
            console.log('📝 Body:', req.body);
            
            try {
                const { nome, telefono, data, orario, numero_giocatori, note } = req.body;
                
                console.log('📝 Dati prenotazione:', { nome, telefono, data, orario, numero_giocatori, note });
                
                // Validazione
                if (!nome || !telefono || !data || !orario || !numero_giocatori) {
                    console.log('❌ Validazione fallita: campi mancanti');
                    res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
                    return;
                }
                
                // Verifica disponibilità
                console.log('🔍 Verificando disponibilità...');
                const disponibile = await db.verificaDisponibilita(data, orario);
                console.log('✅ Disponibilità:', disponibile);
                
                if (!disponibile) {
                    console.log('❌ Slot non disponibile');
                    res.status(409).json({ error: 'Slot non disponibile' });
                    return;
                }
                
                // Crea prenotazione nel database
                console.log('💾 Creando prenotazione nel database...');
                const prenotazione = { nome, telefono, data, orario, numero_giocatori, note };
                const id = await db.creaPrenotazione(prenotazione);
                console.log('✅ Prenotazione creata con ID:', id);
                
                // Crea evento in Google Calendar
                console.log('📅 Creando evento in Google Calendar...');
                try {
                    const googleEventId = await googleCalendar.createCalendarEvent(prenotazione);
                    await db.updatePrenotazioneGoogleEvent(id, googleEventId);
                    console.log('✅ Evento Google Calendar creato:', googleEventId);
                } catch (calendarError) {
                    console.error('❌ Errore creazione evento Google Calendar:', calendarError);
                    // Non blocchiamo la prenotazione se Google Calendar fallisce
                }
                
                console.log('✅ Prenotazione completata con successo');
                res.json({ 
                    success: true, 
                    id, 
                    message: 'Prenotazione creata con successo' 
                });
            } catch (error) {
                console.error('❌ Errore creazione prenotazione:', error);
                res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'DELETE' && req.path === '/prenotazioni') {
            console.log('🗑️ Richiesta DELETE prenotazioni ricevuta');
            console.log('🗑️ Body:', req.body);
            
            try {
                const { id } = req.body;
                
                if (!id) {
                    console.log('❌ ID prenotazione mancante');
                    res.status(400).json({ error: 'ID prenotazione è obbligatorio' });
                    return;
                }
                
                console.log('🗑️ Cancellando prenotazione con ID:', id);
                const deleted = await db.cancellaPrenotazione(id);
                
                if (deleted) {
                    console.log('✅ Prenotazione cancellata con successo');
                    res.json({ 
                        success: true, 
                        message: 'Prenotazione cancellata con successo' 
                    });
                } else {
                    console.log('❌ Prenotazione non trovata');
                    res.status(404).json({ error: 'Prenotazione non trovata' });
                }
            } catch (error) {
                console.error('❌ Errore cancellazione prenotazione:', error);
                res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'POST' && req.path === '/test-prenotazione') {
            console.log('🧪 Richiesta POST test-prenotazione ricevuta');
            console.log('🧪 Body:', req.body);
            
            try {
                const { nome, telefono, data, orario, numero_giocatori, note } = req.body;
                
                console.log('🧪 Dati prenotazione:', { nome, telefono, data, orario, numero_giocatori, note });
                
                // Validazione
                if (!nome || !telefono || !data || !orario || !numero_giocatori) {
                    console.log('❌ Validazione fallita: campi mancanti');
                    res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
                    return;
                }
                
                // Verifica disponibilità
                console.log('🔍 Verificando disponibilità...');
                const disponibile = await db.verificaDisponibilita(data, orario);
                console.log('✅ Disponibilità:', disponibile);
                
                if (!disponibile) {
                    console.log('❌ Slot non disponibile');
                    res.status(409).json({ error: 'Slot non disponibile' });
                    return;
                }
                
                // Crea prenotazione nel database
                console.log('💾 Creando prenotazione nel database...');
                const prenotazione = { nome, telefono, data, orario, numero_giocatori, note };
                const id = await db.creaPrenotazione(prenotazione);
                console.log('✅ Prenotazione creata con ID:', id);
                
                // Crea evento in Google Calendar
                console.log('📅 Creando evento in Google Calendar...');
                try {
                    const googleEventId = await googleCalendar.createCalendarEvent(prenotazione);
                    await db.updatePrenotazioneGoogleEvent(id, googleEventId);
                    console.log('✅ Evento Google Calendar creato:', googleEventId);
                } catch (calendarError) {
                    console.error('❌ Errore creazione evento Google Calendar:', calendarError);
                    // Non blocchiamo la prenotazione se Google Calendar fallisce
                }
                
                console.log('✅ Test prenotazione completato con successo');
                res.json({ 
                    success: true, 
                    id, 
                    message: 'Test prenotazione completato con successo',
                    prenotazione: prenotazione
                });
            } catch (error) {
                console.error('❌ Errore test prenotazione:', error);
                res.status(500).json({ error: error.message });
            }
        } else {
            // Per altre route, usa Express
            await new Promise((resolve, reject) => {
                app(req, res, (err) => {
                    if (err) {
                        console.error('❌ Errore Express:', err);
                        reject(err);
                    } else {
                        console.log('✅ Richiesta Express gestita, status:', res.statusCode, 'body length:', res.body.length);
                        resolve();
                    }
                });
            });
        }
        
        // Chiudi connessione database
        await db.closeConnection();
        
        return {
            statusCode: res.statusCode,
            headers: {
                'Content-Type': res.headers['Content-Type'] || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: res.body
        };
        
    } catch (error) {
        console.error('Errore handler:', error);
        
        // Chiudi connessione database in caso di errore
        await db.closeConnection();
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Errore interno del server' })
        };
    }
};

module.exports = { handler }; 