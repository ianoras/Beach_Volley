const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crea connessione al database
const dbPath = path.join(__dirname, '../database/beach_volley.db');
const db = new sqlite3.Database(dbPath);

// Inizializza il database con le tabelle
function initDatabase() {
    return new Promise((resolve, reject) => {
        // Tabella prenotazioni
        db.run(`
            CREATE TABLE IF NOT EXISTS prenotazioni (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefono TEXT NOT NULL,
                data TEXT NOT NULL,
                orario TEXT NOT NULL,
                numero_giocatori INTEGER NOT NULL,
                note TEXT,
                stato TEXT DEFAULT 'confermata',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Errore creazione tabella prenotazioni:', err);
                reject(err);
                return;
            }
            
                    // Tabella configurazioni
        db.run(`
            CREATE TABLE IF NOT EXISTS configurazioni (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chiave TEXT UNIQUE NOT NULL,
                valore TEXT NOT NULL,
                descrizione TEXT
            )
        `, (err) => {
            if (err) {
                console.error('Errore creazione tabella configurazioni:', err);
                reject(err);
                return;
            }
            
            // Tabella orari bloccati
            db.run(`
                CREATE TABLE IF NOT EXISTS orari_bloccati (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL,
                    orario TEXT NOT NULL,
                    tipo TEXT NOT NULL DEFAULT 'bloccato',
                    motivo TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(data, orario)
                )
            `, (err) => {
                if (err) {
                    console.error('Errore creazione tabella orari_bloccati:', err);
                    reject(err);
                    return;
                }
                
                // Inserisci configurazioni di default
                insertDefaultConfigs().then(() => {
                    console.log('Database inizializzato con successo!');
                    resolve();
                }).catch(reject);
            });
        });
        });
    });
}

// Inserisci configurazioni di default
function insertDefaultConfigs() {
    return new Promise((resolve, reject) => {
        const configs = [
            ['orari_apertura', '16:00-23:00', 'Orari di apertura del campetto'],
            ['durata_slot', '60', 'Durata slot in minuti'],
            ['max_giocatori', '12', 'Numero massimo giocatori per slot'],
            ['prezzo_over18', '4', 'Prezzo per persona over 18 in euro'],
            ['prezzo_under18', '3', 'Prezzo per persona under 18 in euro'],
            ['indirizzo', 'Via Giovanni Palatucci 2 - 83025 Montoro(AV) Fraz. Preturo', 'Indirizzo del campetto'],
            ['contatto_marco', '+393427004105', 'Numero di Marco'],
            ['contatto_luigi', '+393391759103', 'Numero di Luigi'],
            ['instagram', 'https://www.instagram.com/summer_beachvolley_preturo', 'Link Instagram']
        ];
        
        const stmt = db.prepare('INSERT OR IGNORE INTO configurazioni (chiave, valore, descrizione) VALUES (?, ?, ?)');
        
        configs.forEach(config => {
            stmt.run(config[0], config[1], config[2]);
        });
        
        stmt.finalize((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Funzioni per gestire le prenotazioni
function creaPrenotazione(prenotazione) {
    return new Promise((resolve, reject) => {
        const { nome, telefono, data, orario, numero_giocatori, note } = prenotazione;
        
        db.run(`
            INSERT INTO prenotazioni (nome, telefono, data, orario, numero_giocatori, note)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [nome, telefono, data, orario, numero_giocatori, note || ''], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

function getPrenotazioni(data = null) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM prenotazioni ORDER BY data, orario';
        let params = [];
        
        if (data) {
            query = 'SELECT * FROM prenotazioni WHERE data = ? ORDER BY orario';
            params = [data];
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function getPrenotazioneById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM prenotazioni WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function cancellaPrenotazione(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM prenotazioni WHERE id = ?', [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Funzioni per gestire le configurazioni
function getConfigurazione(chiave) {
    return new Promise((resolve, reject) => {
        db.get('SELECT valore FROM configurazioni WHERE chiave = ?', [chiave], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.valore : null);
            }
        });
    });
}

function setConfigurazione(chiave, valore) {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR REPLACE INTO configurazioni (chiave, valore) VALUES (?, ?)', 
               [chiave, valore], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Verifica disponibilità slot
function verificaDisponibilita(data, orario) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT COUNT(*) as count 
            FROM prenotazioni 
            WHERE data = ? AND orario = ? AND stato = 'confermata'
        `, [data, orario], (err, row) => {
            if (err) {
                reject(err);
            } else {
                // Verifica anche se l'orario è bloccato
                db.get(`
                    SELECT COUNT(*) as blocked_count 
                    FROM orari_bloccati 
                    WHERE data = ? AND orario = ?
                `, [data, orario], (err2, row2) => {
                    if (err2) {
                        reject(err2);
                    } else {
                        resolve(row.count === 0 && row2.blocked_count === 0);
                    }
                });
            }
        });
    });
}

// Funzioni per gestire gli orari bloccati
function getOrariBloccati(data) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT orario, tipo, motivo 
            FROM orari_bloccati 
            WHERE data = ?
        `, [data], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function updateOrarioStatus(data, orario, tipo) {
    return new Promise((resolve, reject) => {
        if (tipo === 'libero') {
            // Rimuovi dalla tabella orari bloccati
            db.run(`
                DELETE FROM orari_bloccati 
                WHERE data = ? AND orario = ?
            `, [data, orario], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } else {
            // Inserisci o aggiorna nella tabella orari bloccati
            db.run(`
                INSERT OR REPLACE INTO orari_bloccati (data, orario, tipo) 
                VALUES (?, ?, ?)
            `, [data, orario, tipo], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
}

module.exports = {
    initDatabase,
    creaPrenotazione,
    getPrenotazioni,
    getPrenotazioneById,
    cancellaPrenotazione,
    getConfigurazione,
    setConfigurazione,
    verificaDisponibilita,
    getOrariBloccati,
    updateOrarioStatus,
    db
}; 