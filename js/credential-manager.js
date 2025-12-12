// ===============================================
// CREDENTIALS MANAGER - Sistema Unificato
// Da includere in tutti gli HTML prima degli altri script
// ===============================================

const CredentialsManager = {
    // Chiavi per localStorage
    STORAGE_KEYS: {
        USERNAME: 'username',
        TOKEN: 'token',
        LANGUAGE: 'language',
        FILTER: 'filter'
    },

    /**
     * Recupera le credenziali con priorità:
     * 1. URL parameters (più alta priorità)
     * 2. localStorage (fallback)
     * 3. Valori di default
     */
    getCredentials() {
        const urlParams = new URLSearchParams(window.location.search);

        const credentials = {
            username: urlParams.get('username') ||
                localStorage.getItem(this.STORAGE_KEYS.USERNAME) || '',
            token: urlParams.get('token') ||
                localStorage.getItem(this.STORAGE_KEYS.TOKEN) || '',
            language: urlParams.get('language') ||
                localStorage.getItem(this.STORAGE_KEYS.LANGUAGE) || 'it_IT',
            filter: urlParams.get('filter') ||
                localStorage.getItem(this.STORAGE_KEYS.FILTER) || ''
        };

        // Se le credenziali sono presenti nell'URL, aggiorna anche il localStorage
        if (urlParams.has('username') || urlParams.has('token')) {
            this.saveCredentials(credentials);
        }

        // Log per debug (rimuovere in produzione)
        console.log('=== CREDENTIALS LOADED ===');
        console.log('Source:', urlParams.has('username') ? 'URL' : 'localStorage');
        console.log('Username:', credentials.username);
        console.log('Token:', credentials.token ? '***' + credentials.token.slice(-4) : 'missing');
        console.log('Language:', credentials.language);
        console.log('Filter:', credentials.filter);
        console.log('========================');

        return credentials;
    },

    /**
     * Salva le credenziali nel localStorage
     */
    saveCredentials(credentials) {
        if (credentials.username) {
            localStorage.setItem(this.STORAGE_KEYS.USERNAME, credentials.username);
        }
        if (credentials.token) {
            localStorage.setItem(this.STORAGE_KEYS.TOKEN, credentials.token);
        }
        if (credentials.language) {
            localStorage.setItem(this.STORAGE_KEYS.LANGUAGE, credentials.language);
        }
        if (credentials.filter !== undefined) {
            localStorage.setItem(this.STORAGE_KEYS.FILTER, credentials.filter);
        }
    },

    /**
     * Valida se le credenziali sono complete
     */
    validateCredentials(credentials) {
        if (!credentials.username || !credentials.token) {
            console.error('Missing required credentials');
            return false;
        }
        return true;
    },

    /**
     * Costruisce una query string con le credenziali correnti
     */
    buildQueryString(credentials = null) {
        const creds = credentials || this.getCredentials();
        const params = new URLSearchParams();

        if (creds.username) params.set('username', creds.username);
        if (creds.token) params.set('token', creds.token);
        if (creds.language) params.set('language', creds.language);
        if (creds.filter) params.set('filter', creds.filter);

        return params.toString();
    },

    /**
     * Apre una nuova finestra/tab con le credenziali correnti
     */
    openWindow(url, target = '_blank', credentials = null) {
        const queryString = this.buildQueryString(credentials);
        const separator = url.includes('?') ? '&' : '?';
        const fullUrl = `${url}${separator}${queryString}`;
        return window.open(fullUrl, target);
    },

    /**
     * Naviga a una nuova pagina mantenendo le credenziali
     */
    navigate(url, credentials = null) {
        const queryString = this.buildQueryString(credentials);
        const separator = url.includes('?') ? '&' : '?';
        window.location.href = `${url}${separator}${queryString}`;
    },

    /**
     * Cancella le credenziali dal localStorage
     */
    clearCredentials() {
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    /**
     * Mostra un errore se le credenziali mancano
     */
    showCredentialsError(messageElementId = 'message') {
        const msgDiv = document.getElementById(messageElementId);
        if (msgDiv) {
            msgDiv.textContent = 'Credenziali mancanti. Effettua nuovamente il login.';
            msgDiv.className = 'message error';
            msgDiv.style.display = 'block';
        }
        return false;
    },

    /**
     * Inizializza il sistema di gestione credenziali per una pagina
     * Restituisce le credenziali se valide, altrimenti false
     */
    initialize(options = {}) {
        const {
            requireAuth = true,
            messageElementId = 'message',
            onSuccess = null,
            onError = null
        } = options;

        const credentials = this.getCredentials();

        if (requireAuth && !this.validateCredentials(credentials)) {
            this.showCredentialsError(messageElementId);
            if (onError) onError(credentials);
            return false;
        }

        if (onSuccess) onSuccess(credentials);
        return credentials;
    }
};

// Rendi disponibile globalmente
window.CredentialsManager = CredentialsManager;


// ===============================================
// ESEMPI DI UTILIZZO
// ===============================================

/*

// === ESEMPIO 1: Inizializzazione base ===
const credentials = CredentialsManager.initialize({
    requireAuth: true,
    onSuccess: (creds) => {
        console.log('Credenziali valide:', creds);
        // Continua con il caricamento della pagina
    },
    onError: () => {
        console.error('Autenticazione fallita');
        // Opzionalmente reindirizza al login
    }
});

if (credentials) {
    // Usa le credenziali
    loadData(credentials);
}


// === ESEMPIO 2: Aprire finestra con credenziali ===
function openRegistryForm() {
    CredentialsManager.openWindow('dashboard-registry.html');
}

function openAccountForm() {
    CredentialsManager.openWindow('dashboard-account.html');
}


// === ESEMPIO 3: Navigazione con credenziali ===
function goToTradePage(tradeCode) {
    const credentials = CredentialsManager.getCredentials();
    const url = `dashboard-trade.html?code=${tradeCode}`;
    CredentialsManager.navigate(url, credentials);
}


// === ESEMPIO 4: Costruire URL manualmente ===
function getInstrumentUrl(symbol) {
    const queryString = CredentialsManager.buildQueryString();
    return `dashboard-instrument.html?code=${encodeURIComponent(symbol)}&${queryString}`;
}


// === ESEMPIO 5: Uso con fetch ===
async function fetchData(endpoint, additionalData = {}) {
    const credentials = CredentialsManager.getCredentials();
    
    const payload = {
        username: credentials.username,
        token: credentials.token,
        language: credentials.language,
        ...additionalData
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    return response.json();
}


// === ESEMPIO 6: Aggiornamento credenziali ===
function updateLanguage(newLanguage) {
    const credentials = CredentialsManager.getCredentials();
    credentials.language = newLanguage;
    CredentialsManager.saveCredentials(credentials);
    
    // Ricarica la pagina con la nuova lingua
    location.reload();
}


// === ESEMPIO 7: Logout ===
function logout() {
    CredentialsManager.clearCredentials();
    window.location.href = 'login.html';
}

*/