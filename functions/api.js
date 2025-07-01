const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Importa i moduli
const db = require('../server/database');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// POST - Crea nuova prenotazione
app.post('/prenotazioni', async (req, res) => {
    try {
        const { nome, telefono, data, orario, numero_giocatori, note } = req.body;
        
        // Validazione
        if (!nome || !telefono || !data || !orario || !numero_giocatori) {
            return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        }
        
        // Verifica disponibilità
        const disponibile = await db.verificaDisponibilita(data, orario);
        if (!disponibile) {
            return res.status(409).json({ error: 'Slot non disponibile' });
        }
        
        // Crea prenotazione
        const prenotazione = { nome, telefono, data, orario, numero_giocatori, note };
        const id = await db.creaPrenotazione(prenotazione);
        
        // Blocca automaticamente lo slot come "occupato"
        await db.updateOrarioStatus(data, orario, 'occupato');
        
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
        
        // Cancella prenotazione
        const cancellata = await db.cancellaPrenotazione(id);
        
        if (cancellata) {
            // Libera lo slot
            await db.updateOrarioStatus(prenotazione.data, prenotazione.orario, 'libero');
            
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

// GET - Ottieni disponibilità per data
app.get('/disponibilita/:data', async (req, res) => {
    try {
        const { data } = req.params;
        const prenotazioni = await db.getPrenotazioni(data);
        const orariBloccati = await db.getOrariBloccati(data);
        
        // Genera orari disponibili (16:00-23:00, slot di 1 ora)
        const orari = [];
        for (let ora = 16; ora < 23; ora++) {
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
                prenotazione: occupato ? prenotazioni.find(p => p.orario === orario) : null,
                // Aggiungi informazioni per debug
                debug: {
                    occupato,
                    bloccato,
                    prenotazioniCount: prenotazioni.filter(p => p.orario === orario).length,
                    bloccatiCount: orariBloccati.filter(b => b.orario === orario).length
                }
            });
        }
        
        console.log(`Disponibilità per ${data}:`, orari);
        res.json(orari);
    } catch (error) {
        console.error('Errore disponibilità:', error);
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

// POST - Aggiorna status orario (admin)
app.post('/disponibilita/update', async (req, res) => {
    try {
        const { data, orario, tipo, motivo } = req.body;
        
        if (!data || !orario || !tipo) {
            return res.status(400).json({ error: 'Data, orario e tipo sono obbligatori' });
        }
        
        if (!['libero', 'occupato', 'bloccato'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo non valido' });
        }
        
        await db.updateOrarioStatus(data, orario, tipo, motivo);
        
        res.json({ 
            success: true, 
            message: `Orario ${orario} aggiornato come ${tipo}` 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Aggiorna configurazione
app.put('/config/:chiave', async (req, res) => {
    try {
        const { chiave } = req.params;
        const { valore } = req.body;
        
        if (!valore) {
            return res.status(400).json({ error: 'Valore richiesto' });
        }
        
        await db.setConfigurazione(chiave, valore);
        res.json({ 
            success: true, 
            message: 'Configurazione aggiornata' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Verifica password admin
app.post('/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD || 'beachvolley2024';
        
        if (password === adminPassword) {
            res.json({ 
                success: true, 
                message: 'Accesso autorizzato' 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Password non corretta' 
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Statistiche prenotazioni
app.get('/stats', async (req, res) => {
    try {
        const prenotazioni = await db.getPrenotazioni();
        
        const oggi = new Date().toISOString().split('T')[0];
        const prenotazioniOggi = prenotazioni.filter(p => p.data === oggi);
        
        // Conta slot bloccati totali
        const orariBloccati = await db.getOrariBloccati();
        const slotBloccati = orariBloccati.length;
        
        const stats = {
            totali: prenotazioni.length,
            oggi: prenotazioniOggi.length,
            questaSettimana: prenotazioni.filter(p => {
                const data = new Date(p.data);
                const oggi = new Date();
                const unaSettimanaFa = new Date(oggi.getTime() - 7 * 24 * 60 * 60 * 1000);
                return data >= unaSettimanaFa && data <= oggi;
            }).length,
            slotBloccati: slotBloccati
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Gestione errori 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato' });
});

// Gestione errori globali
app.use((error, req, res, next) => {
    console.error('Errore server:', error);
    res.status(500).json({ error: 'Errore interno del server' });
});

// Inizializza e esporta per Netlify
let isInitialized = false;

const handler = async (event, context) => {
    try {
        if (!isInitialized) {
            await initApp();
            isInitialized = true;
        }
        
        // Estrai path e query parameters
        const path = event.path.replace('/.netlify/functions/api', '');
        const method = event.httpMethod.toLowerCase();
        
        // Crea mock request e response per Express
        const mockReq = {
            method: event.httpMethod,
            url: path,
            path: path,
            query: event.queryStringParameters || {},
            body: event.body ? JSON.parse(event.body) : {},
            headers: event.headers || {},
            params: {}
        };
        
        // Estrai parametri dal path se necessario
        if (path.startsWith('/disponibilita/')) {
            mockReq.params.data = path.split('/')[2];
        } else if (path.startsWith('/prenotazioni/') && path.split('/').length > 2) {
            mockReq.params.id = path.split('/')[2];
        } else if (path.startsWith('/config/')) {
            mockReq.params.chiave = path.split('/')[2];
        }
        
        let responseBody = '';
        let responseStatus = 200;
        let responseHeaders = {};
        
        const mockRes = {
            status: (code) => {
                responseStatus = code;
                return mockRes;
            },
            json: (data) => {
                responseBody = JSON.stringify(data);
                responseHeaders['Content-Type'] = 'application/json';
            },
            send: (data) => {
                responseBody = data;
            }
        };
        
        // Trova e esegui la route corrispondente
        const route = app._router.stack.find(layer => {
            if (layer.route) {
                const routePath = layer.route.path;
                const routeMethod = Object.keys(layer.route.methods)[0];
                return routeMethod === method && 
                       (routePath === path || 
                        (routePath.includes(':') && path.match(new RegExp(routePath.replace(/:[^/]+/g, '[^/]+')))));
            }
            return false;
        });
        
        if (route) {
            await route.route.stack[0].handle(mockReq, mockRes);
        } else {
            responseStatus = 404;
            responseBody = JSON.stringify({ error: 'Endpoint non trovato' });
        }
        
        return {
            statusCode: responseStatus,
            headers: responseHeaders,
            body: responseBody
        };
        
    } catch (error) {
        console.error('Errore handler:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Errore interno del server' })
        };
    }
};

module.exports = { handler }; 