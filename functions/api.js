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
        
        res.json({ 
            success: true, 
            id, 
            message: 'Prenotazione creata con successo' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Cancella prenotazione
app.delete('/prenotazioni/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Cancella prenotazione
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
        res.status(500).json({ error: error.message });
    }
});

// GET - Ottieni disponibilità per data
app.get('/disponibilita/:data', async (req, res) => {
    try {
        const { data } = req.params;
        const prenotazioni = await db.getPrenotazioni(data);
        
        // Genera orari disponibili (16:00-23:00, slot di 1 ora)
        const orari = [];
        for (let ora = 16; ora < 23; ora++) {
            const orario = `${ora.toString().padStart(2, '0')}:00`;
            const occupato = prenotazioni.some(p => p.orario === orario);
            
            orari.push({
                orario,
                disponibile: !occupato,
                prenotazione: occupato ? prenotazioni.find(p => p.orario === orario) : null
            });
        }
        
        res.json(orari);
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
        
        const stats = {
            totali: prenotazioni.length,
            oggi: prenotazioniOggi.length,
            questaSettimana: prenotazioni.filter(p => {
                const data = new Date(p.data);
                const oggi = new Date();
                const unaSettimanaFa = new Date(oggi.getTime() - 7 * 24 * 60 * 60 * 1000);
                return data >= unaSettimanaFa && data <= oggi;
            }).length
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
    if (!isInitialized) {
        await initApp();
        isInitialized = true;
    }
    
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const port = server.address().port;
            const url = `http://localhost:${port}`;
            
            // Simula la richiesta HTTP
            const http = require('http');
            const urlObj = new URL(event.path, url);
            
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: urlObj.pathname + urlObj.search,
                method: event.httpMethod,
                headers: event.headers || {}
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    server.close();
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });
            
            req.on('error', (err) => {
                server.close();
                reject(err);
            });
            
            if (event.body) {
                req.write(event.body);
            }
            req.end();
        });
    });
};

module.exports = { handler }; 