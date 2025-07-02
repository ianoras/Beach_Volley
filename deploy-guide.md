# 🚀 Guida Deployment Netlify

## Prerequisiti

1. **Account Netlify** (gratuito)
2. **Account MongoDB Atlas** (gratuito)
3. **Account Google Cloud** (gratuito)

## Passo 1: Setup MongoDB Atlas

### 1.1 Crea cluster MongoDB
1. Vai su [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crea account gratuito
3. Crea nuovo cluster (M0 - Free)
4. Scegli provider e regione (es. AWS, Frankfurt)

### 1.2 Configura sicurezza
1. **Database Access**: Crea utente database
   - Username: `beachvolley`
   - Password: `[password-sicura]`
   - Role: `Read and write to any database`

2. **Network Access**: Aggiungi IP
   - Clicca "Add IP Address"
   - Clicca "Allow Access from Anywhere" (0.0.0.0/0)

### 1.3 Ottieni connection string
1. Clicca "Connect" sul cluster
2. Scegli "Connect your application"
3. Copia la connection string
4. Sostituisci `<password>` con la password dell'utente
5. Sostituisci `<dbname>` con `beach_volley`

Esempio:
```
mongodb+srv://beachvolley:password123@cluster0.xxxxx.mongodb.net/beach_volley?retryWrites=true&w=majority
```

## Passo 2: Setup Google Calendar API

### 2.1 Crea progetto Google Cloud
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea nuovo progetto: `beach-volley-preturo`
3. Seleziona il progetto

### 2.2 Abilita Google Calendar API
1. Vai su "APIs & Services" > "Library"
2. Cerca "Google Calendar API"
3. Clicca e abilita

### 2.3 Crea Service Account
1. Vai su "APIs & Services" > "Credentials"
2. Clicca "Create Credentials" > "Service Account"
3. Nome: `beach-volley-calendar`
4. Descrizione: `Service account per Beach Volley Preturo`
5. Clicca "Create and Continue"
6. Role: `Editor`
7. Clicca "Done"

### 2.4 Genera chiave privata
1. Clicca sul service account creato
2. Tab "Keys"
3. "Add Key" > "Create new key"
4. Tipo: JSON
5. Clicca "Create"
6. Scarica il file JSON

### 2.5 Configura calendario
1. Apri Google Calendar
2. Crea nuovo calendario: "Beach Volley Preturo"
3. Clicca sui 3 punti > "Settings and sharing"
4. Copia "Calendar ID" (es. `abc123@group.calendar.google.com`)
5. Nella sezione "Share with specific people":
   - Aggiungi l'email del service account (dal file JSON)
   - Permissions: "Make changes to events"

## Passo 3: Deploy su Netlify

### 3.1 Collega repository
1. Vai su [Netlify](https://netlify.com)
2. Clicca "New site from Git"
3. Collega il repository GitHub/GitLab
4. Branch: `main`

### 3.2 Configura build settings
```
Build command: npm install
Publish directory: public
Functions directory: functions
```

### 3.3 Configura variabili d'ambiente
In Netlify Dashboard > Site settings > Environment variables:

```
MONGODB_URI=mongodb+srv://beachvolley:password123@cluster0.xxxxx.mongodb.net/beach_volley?retryWrites=true&w=majority

GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"beach-volley-preturo","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"beach-volley-calendar@beach-volley-preturo.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/beach-volley-calendar%40beach-volley-preturo.iam.gserviceaccount.com"}

GOOGLE_CALENDAR_ID=abc123@group.calendar.google.com

ADMIN_PASSWORD=beachvolley2024

NODE_ENV=production
```

### 3.4 Deploy
1. Clicca "Deploy site"
2. Aspetta il completamento del build
3. Il sito sarà disponibile su `https://[nome-sito].netlify.app`

## Passo 4: Test

### 4.1 Test connessioni
Visita: `https://[nome-sito].netlify.app/.netlify/functions/api/test`

Dovresti vedere:
```json
{
  "database": true,
  "googleCalendar": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4.2 Test prenotazione
1. Vai sul sito principale
2. Prova a fare una prenotazione
3. Verifica che appaia nel calendario Google

## Troubleshooting

### Errore MongoDB
- Verifica connection string
- Controlla che l'IP sia whitelistato (0.0.0.0/0)
- Verifica username/password

### Errore Google Calendar
- Verifica che il calendario sia condiviso con il service account
- Controlla che l'ID del calendario sia corretto
- Verifica che le credenziali JSON siano complete

### Errore Netlify Functions
- Controlla i log in Netlify Dashboard
- Verifica che tutte le variabili d'ambiente siano impostate
- Controlla che il build sia completato con successo

## Costi

- **Netlify**: Gratuito (100GB bandwidth/mese)
- **MongoDB Atlas**: Gratuito (512MB storage)
- **Google Cloud**: Gratuito (quota generosa per Calendar API)

## Sicurezza

- Le credenziali sono sicure nelle variabili d'ambiente di Netlify
- MongoDB Atlas ha connessioni SSL
- Google Calendar API usa OAuth2
- Rate limiting gestito da Netlify 