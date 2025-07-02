const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;
let db;

// Connessione al database MongoDB Atlas
async function connectDB() {
    if (client && db) return client;
    
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    console.log('🔗 Tentativo connessione MongoDB con URI:', uri.substring(0, 50) + '...');
    
    client = new MongoClient(uri);
    
    try {
        await client.connect();
        db = client.db('beach_volley');
        console.log('✅ Connesso a MongoDB Atlas');
        return client;
    } catch (error) {
        console.error('❌ Errore connessione MongoDB:', error.message);
        client = null;
        db = null;
        // Non lanciare l'errore, lascia che l'app continui in modalità offline
        console.log('⚠️ Continuando in modalità offline...');
        return null;
    }
}

// Inizializza il database con le collezioni
async function initDatabase() {
    try {
        await connectDB();
        
        // Verifica che la connessione sia attiva
        if (!db) {
            console.log('⚠️ Database non disponibile, usando modalità offline');
            return;
        }
        
        // Crea indici per ottimizzare le query
        await db.collection('prenotazioni').createIndex({ data: 1, orario: 1 });
        await db.collection('prenotazioni').createIndex({ nome: 1 });
        await db.collection('configurazioni').createIndex({ chiave: 1 }, { unique: true });
        await db.collection('orari_bloccati').createIndex({ data: 1, orario: 1 }, { unique: true });
        
        // Inserisci configurazioni di default
        await insertDefaultConfigs();
        
        console.log('✅ Database inizializzato con successo!');
    } catch (error) {
        console.error('❌ Errore inizializzazione database:', error.message);
        console.log('⚠️ Continuando in modalità offline...');
        // Non lanciare l'errore, lascia che l'app continui
    }
}

// Inserisci configurazioni di default
async function insertDefaultConfigs() {
    if (!db) {
        console.log('⚠️ Database non disponibile, saltando inserimento configurazioni');
        return;
    }
    
    const configs = [
        { chiave: 'orari_apertura', valore: '18:00-23:00', descrizione: 'Orari di apertura del campetto' },
        { chiave: 'durata_slot', valore: '60', descrizione: 'Durata slot in minuti' },
        { chiave: 'max_giocatori', valore: '12', descrizione: 'Numero massimo giocatori per slot' },
        { chiave: 'prezzo_over18', valore: '4', descrizione: 'Prezzo per persona over 18 in euro' },
        { chiave: 'prezzo_under18', valore: '3', descrizione: 'Prezzo per persona under 18 in euro' },
        { chiave: 'indirizzo', valore: 'Via Giovanni Palatucci 2 - 83025 Montoro(AV) Fraz. Preturo', descrizione: 'Indirizzo del campetto' },
        { chiave: 'contatto_marco', valore: '+393427004105', descrizione: 'Numero di Marco' },
        { chiave: 'contatto_luigi', valore: '+393391759103', descrizione: 'Numero di Luigi' },
        { chiave: 'instagram', valore: 'https://www.instagram.com/summer_beachvolley_preturo', descrizione: 'Link Instagram' },
        { chiave: 'google_calendar_id', valore: '', descrizione: 'ID del calendario Google' }
    ];
    
    try {
        for (const config of configs) {
            await db.collection('configurazioni').updateOne(
                { chiave: config.chiave },
                { $setOnInsert: config },
                { upsert: true }
            );
        }
        console.log('✅ Configurazioni di default inserite');
    } catch (error) {
        console.error('❌ Errore inserimento configurazioni:', error.message);
    }
}

// Funzioni per gestire le prenotazioni
async function creaPrenotazione(prenotazione) {
    await connectDB();
    
    const prenotazioneDoc = {
        ...prenotazione,
        stato: 'confermata',
        created_at: new Date(),
        google_event_id: null // Sarà popolato quando sincronizziamo con Google Calendar
    };
    
    const result = await db.collection('prenotazioni').insertOne(prenotazioneDoc);
    return result.insertedId;
}

async function getPrenotazioni(data = null) {
    try {
        await connectDB();
        
        let query = {};
        if (data) {
            query.data = data;
        }
        
        return await db.collection('prenotazioni')
            .find(query)
            .sort({ data: 1, orario: 1 })
            .toArray();
    } catch (error) {
        console.error('❌ Errore getPrenotazioni:', error.message);
        // Ritorna array vuoto se il database non è disponibile
        return [];
    }
}

async function getPrenotazioneById(id) {
    await connectDB();
    
    return await db.collection('prenotazioni').findOne({ _id: id });
}

async function cancellaPrenotazione(id) {
    await connectDB();
    
    const result = await db.collection('prenotazioni').deleteOne({ _id: id });
    return result.deletedCount > 0;
}

async function updatePrenotazioneGoogleEvent(id, googleEventId) {
    await connectDB();
    
    await db.collection('prenotazioni').updateOne(
        { _id: id },
        { $set: { google_event_id: googleEventId } }
    );
}

// Funzioni per gestire le configurazioni
async function getConfigurazione(chiave) {
    try {
        await connectDB();
        
        const config = await db.collection('configurazioni').findOne({ chiave });
        return config ? config.valore : null;
    } catch (error) {
        console.error('❌ Errore getConfigurazione:', error.message);
        // Ritorna valori di default se il database non è disponibile
        const defaults = {
            'orari_apertura': '18:00-23:00',
            'durata_slot': '60',
            'max_giocatori': '12',
            'prezzo_over18': '4',
            'prezzo_under18': '3',
            'indirizzo': 'Via Giovanni Palatucci 2 - 83025 Montoro(AV) Fraz. Preturo',
            'contatto_marco': '+393427004105',
            'contatto_luigi': '+393391759103',
            'instagram': 'https://www.instagram.com/summer_beachvolley_preturo'
        };
        return defaults[chiave] || null;
    }
}



// Verifica disponibilità slot
async function verificaDisponibilita(data, orario) {
    await connectDB();
    
    const count = await db.collection('prenotazioni').countDocuments({
        data,
        orario,
        stato: 'confermata'
    });
    
    return count === 0;
}

// Funzioni per gestire orari bloccati
async function getOrariBloccati(data = null) {
    try {
        await connectDB();
        
        let query = {};
        if (data) {
            query.data = data;
        }
        
        return await db.collection('orari_bloccati')
            .find(query)
            .sort({ data: 1, orario: 1 })
            .toArray();
    } catch (error) {
        console.error('❌ Errore getOrariBloccati:', error.message);
        // Ritorna array vuoto se il database non è disponibile
        return [];
    }
}



// Blocca un orario specifico
async function bloccaOrario(data, orario, motivo = 'Slot bloccato') {
    await connectDB();
    
    await db.collection('orari_bloccati').updateOne(
        { data, orario },
        { 
            $set: { 
                tipo: 'bloccato',
                motivo,
                updated_at: new Date()
            },
            $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
    );
    
    console.log(`🚫 Orario bloccato: ${data} ${orario} - ${motivo}`);
}

// Sblocca un orario specifico
async function sbloccaOrario(data, orario) {
    await connectDB();
    
    const result = await db.collection('orari_bloccati').deleteOne({ data, orario });
    
    if (result.deletedCount > 0) {
        console.log(`✅ Orario sbloccato: ${data} ${orario}`);
    }
    
    return result.deletedCount > 0;
}

// Chiudi connessione
async function closeConnection() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}

module.exports = {
    connectDB,
    initDatabase,
    creaPrenotazione,
    getPrenotazioni,
    getPrenotazioneById,
    cancellaPrenotazione,
    updatePrenotazioneGoogleEvent,
    getConfigurazione,
    verificaDisponibilita,
    getOrariBloccati,
    bloccaOrario,
    sbloccaOrario,
    closeConnection
}; 