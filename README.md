# 🏐 Beach Volley Preturo - Sistema Prenotazioni

Sistema di prenotazioni per il campetto di Beach Volley a Preturo con integrazione Google Calendar.

## 🚀 Caratteristiche

- ✅ Prenotazioni online in tempo reale
- ✅ Integrazione automatica con Google Calendar
- ✅ Gestione slot disponibili/bloccati
- ✅ Interfaccia admin per la gestione
- ✅ Database cloud (MongoDB Atlas)
- ✅ Deploy su Netlify (serverless)

## 🛠️ Tecnologie

- **Frontend**: HTML, CSS, JavaScript vanilla
- **Backend**: Node.js, Express, Netlify Functions
- **Database**: MongoDB Atlas
- **Calendar**: Google Calendar API
- **Deploy**: Netlify

## 📋 Setup e Installazione

### 1. Clona il repository
```bash
git clone <repository-url>
cd beach_volley
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Configura le variabili d'ambiente

Copia `.env.example` in `.env` e configura:

```bash
cp .env.example .env
```

#### Database MongoDB Atlas
1. Crea un account su [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crea un nuovo cluster (gratuito)
3. Crea un utente database
4. Ottieni la connection string e inseriscila in `MONGODB_URI`

#### Google Calendar API
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto
3. Abilita Google Calendar API
4. Crea credenziali (Service Account Key è più semplice)
5. Scarica il file JSON delle credenziali
6. Inserisci il contenuto in `GOOGLE_SERVICE_ACCOUNT_KEY`
7. Condividi il calendario con l'email del service account
8. Inserisci l'ID del calendario in `GOOGLE_CALENDAR_ID`

### 4. Test locale
```bash
npm run dev
```

### 5. Deploy su Netlify

#### Opzione A: Deploy automatico
1. Collega il repository a Netlify
2. Configura le variabili d'ambiente in Netlify Dashboard
3. Deploy automatico ad ogni push

#### Opzione B: Deploy manuale
```bash
npm run deploy
```

## 🔧 Configurazione Netlify

### Variabili d'ambiente da impostare in Netlify Dashboard:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/beach_volley
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
ADMIN_PASSWORD=beachvolley2024
NODE_ENV=production
```

### Build settings:
- **Build command**: `npm install`
- **Publish directory**: `public`
- **Functions directory**: `functions`

## 📱 API Endpoints

### Configurazioni
- `GET /api/config` - Ottieni configurazioni
- `POST /api/config` - Aggiorna configurazione (admin)

### Prenotazioni
- `GET /api/prenotazioni` - Ottieni prenotazioni
- `POST /api/prenotazioni` - Crea prenotazione
- `DELETE /api/prenotazioni/:id` - Cancella prenotazione

### Disponibilità
- `GET /api/disponibilita/:data` - Ottieni disponibilità per data
- `GET /api/blocked-slots` - Ottieni slot bloccati
- `POST /api/disponibilita/update` - Aggiorna status orario (admin)

### Google Calendar
- `POST /api/sync-calendar` - Sincronizza con Google Calendar

### Health Check
- `GET /api/health` - Status del servizio

## 🎯 Funzionalità

### Per gli utenti:
- Visualizza disponibilità in tempo reale
- Prenota slot con nome, telefono e numero giocatori
- Riceve conferma automatica
- Evento automaticamente aggiunto al calendario Google

### Per gli admin:
- Gestione slot bloccati/disponibili
- Modifica configurazioni (prezzi, orari, contatti)
- Visualizzazione tutte le prenotazioni
- Sincronizzazione manuale con Google Calendar

## 🔒 Sicurezza

- Validazione input lato server
- Rate limiting (gestito da Netlify)
- CORS configurato
- Password admin configurabile
- Connessioni database sicure

## 🚨 Troubleshooting

### Problemi comuni:

1. **Errore connessione MongoDB**
   - Verifica la connection string
   - Controlla che l'IP sia whitelistato in MongoDB Atlas

2. **Errore Google Calendar**
   - Verifica le credenziali del service account
   - Controlla che il calendario sia condiviso con l'email del service account
   - Verifica che l'ID del calendario sia corretto

3. **Errore deploy Netlify**
   - Controlla le variabili d'ambiente
   - Verifica che il build command sia corretto
   - Controlla i log di build

## 📞 Supporto

Per problemi o domande:
- 📧 Email: [tua-email]
- 📱 WhatsApp: [numero-telefono]

## 📄 Licenza

MIT License - vedi file LICENSE per dettagli. 