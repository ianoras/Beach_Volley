# 🏐 Preturo Beach Volley - Sistema Prenotazioni

Sistema di prenotazione per il campetto di beach volley di Preturo (Montoro AV).

## 🎯 Funzionalità

- 📅 **Calendario interattivo** con disponibilità in tempo reale
- 🏐 **Prenotazione semplice** con form intuitivo
- 📱 **Integrazione WhatsApp** diretta (gratuita)
- 🔒 **Blocco automatico** delle prenotazioni esistenti
- 👨‍💼 **Dashboard admin** protetta per gestione
- 📍 **Mappa Google Maps** integrata
- 📱 **Design responsive** ottimizzato per mobile

## 🚀 Installazione Rapida

1. **Installa le dipendenze:**
```bash
npm install
```

2. **Avvia il server:**
```bash
npm start
```

3. **Apri il browser su:** `http://localhost:3000`

## 🔐 Accesso Admin

- **URL:** `http://localhost:3000/admin`
- **Password:** `Preturo2024!`

## 📋 Struttura Progetto

```
beach_volley/
├── public/                 # Frontend
│   ├── index.html         # Pagina principale prenotazioni
│   ├── admin.html         # Dashboard amministratore
│   ├── admin-login.html   # Login admin
│   ├── styles.css         # Stili CSS
│   └── script.js          # JavaScript frontend
├── server/                # Backend
│   ├── server.js          # Server Express
│   └── database.js        # Gestione database SQLite
├── database/              # Database SQLite
├── package.json           # Dipendenze Node.js
└── README.md             # Documentazione
```

## 💰 Prezzi

- **Over 18:** €4 per persona/ora
- **Under 18:** €3 per persona/ora

## 🕒 Orari

- **Apertura:** Tutti i giorni dalle 16:00 alle 23:00
- **Slot:** 1 ora per prenotazione
- **Max giocatori:** 12 per slot

## 📍 Indirizzo

**Via Giovanni Palatucci 2 - 83025 Montoro(AV) Fraz. Preturo**

## 📞 Contatti

- **Marco:** +39 342 700 4105
- **Luigi:** +39 339 175 9103
- **Instagram:** [@summer_beachvolley_preturo](https://www.instagram.com/summer_beachvolley_preturo)

## 🔧 Personalizzazione

### Cambiare Password Admin
Modifica il file `public/admin-login.html` alla riga 85:
```javascript
if (password === 'Preturo2024!') {
```

### Cambiare Numero WhatsApp
Modifica il file `public/script.js` alla riga 320:
```javascript
const gestoreNumber = config.contattoMarco || '+393427004105';
```

## 📱 Utilizzo

1. **Prenotazione:** Vai su `/` e seleziona data/orario
2. **Admin:** Vai su `/admin` (password: `beachvolley2024`)
3. **WhatsApp:** Clicca "Conferma" per aprire WhatsApp con messaggio preimpostato

## 🎨 Tecnologie

- **Frontend:** HTML5, CSS3, JavaScript (vanilla)
- **Backend:** Node.js, Express
- **Database:** SQLite
- **WhatsApp:** Link diretto (gratuito)
- **Maps:** Google Maps (link diretto) 