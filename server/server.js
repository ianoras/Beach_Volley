const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Importa i moduli
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Inizializza database
async function initApp() {
    try {
        await db.initDatabase();
        console.log('Applicazione inizializzata con successo!');
    } catch (error) {
        console.error('Errore inizializzazione:', error);
        process.exit(1);
    }
}

// API Routes

// GET - Pagina principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// GET - Pagina admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// GET - Pagina login admin
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin-login.html'));
});

// GET - Ottieni configurazioni
app.get('/api/config', async (req, res) => {
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
app.get('/api/prenotazioni', async (req, res) => {
    try {
        const { data } = req.query;
        const prenotazioni = await db.getPrenotazioni(data);
        res.json(prenotazioni);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crea nuova prenotazione
app.post('/api/prenotazioni', async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Cancella prenotazione
app.delete('/api/prenotazioni/:id', async (req, res) => {
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
app.get('/api/disponibilita/:data', async (req, res) => {
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
                tipo = 'bloccato';
            }
            
            orari.push({
                orario,
                disponibile: !occupato && !bloccato,
                tipo,
                prenotazione: occupato ? prenotazioni.find(p => p.orario === orario) : null
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
app.get('/api/blocked-slots', async (req, res) => {
    try {
        const orariBloccati = await db.getOrariBloccati();
        res.json(orariBloccati);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Aggiorna status orario (admin)
app.post('/api/disponibilita/update', async (req, res) => {
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
app.put('/api/config/:chiave', async (req, res) => {
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
app.post('/api/admin/login', (req, res) => {
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
app.get('/api/stats', async (req, res) => {
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

// Avvia server
initApp().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server avviato su http://localhost:${PORT}`);
        console.log(`📱 Sistema di prenotazioni Beach Volley attivo!`);
    });
}); 