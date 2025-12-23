/**
 * DataEntry Library - Gestione dinamica form per data entry
 * @version 2.1.0 (Fix Decimal/Exchange formats)
 */

// Format validation helper
const FormatHelper = {
    // Validate FE_Decimal format
    // Accetta: "123.45 EUR" oppure "123.45:EUR"
    validateDecimal(value) {
        if (!value) return false;
        // Regex: 
        // ^-?\d+(\.\d+)?  -> Numero intero o decimale (positivo o negativo)
        // [\s:]           -> Separatore: UNO spazio OPPURE due punti
        // [A-Z]{3}$       -> Codice valuta (es. EUR)
        const regex = /^-?\d+(\.\d+)?[\s:][A-Z]{3}$/;
        return regex.test(value.trim());
    },

    // Validate FE_Exchange format
    // Accetta: "1.10 EUR/USD" oppure "1.10:EUR/USD"
    validateExchange(value) {
        if (!value) return false;
        // Regex:
        // ^-?\d+(\.\d+)?  -> Numero
        // [\s:]           -> Separatore spazio o due punti
        // [A-Z]{3}        -> Prima valuta
        // \/              -> Slash
        // [A-Z]{3}$       -> Seconda valuta
        const regex = /^-?\d+(\.\d+)?[\s:][A-Z]{3}\/[A-Z]{3}$/;
        return regex.test(value.trim());
    },

    // Validate FE_Float format (positive decimal number, e.g. "123.45")
    validateFloat(value) {
        if (!value) return false;
        const floatRegex = /^\d+(\.\d+)?$/;
        return floatRegex.test(value.trim());
    },

    // Validate FE_Date format (YYYY-MM-DD)
    validateDate(value) {
        if (!value) return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(value.trim());
    },

    // Validate FE_DateTime format (YYYY-MM-DD HH:MM:SS+ZZZZ)
    validateDateTime(value) {
        if (!value) return false;
        const dateTimeRegex = /^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)[+-]\d{4}$/;
        return dateTimeRegex.test(value.trim());
    },

    // Format instrument code (remove everything after first space or hyphen)
    formatInstrumentCode(value) {
        if (!value) return '';
        let code = value.split(' ')[0];
        if (code.includes('-')) {
            code = code.split('-')[0];
        }
        return code.trim();
    },

    /**
     * Trasforma l'input nel formato standard con i due punti.
     * Es: "100 EUR" -> "100:EUR"
     * Es: "1.2 EUR/USD" -> "1.2:EUR/USD"
     */
    transformToColonFormat(value) {
        if (!value) return '';
        const trimmed = value.trim();

        // Se contiene già i due punti ed è valido, lo ritorniamo così com'è (o trimmato)
        if (trimmed.includes(':')) {
            return trimmed;
        }

        // Se contiene uno spazio, lo sostituiamo con i due punti
        // La regex /\s/ trova il primo spazio bianco (space, tab, etc)
        if (/\s/.test(trimmed)) {
            return trimmed.replace(/\s/, ':');
        }

        return trimmed;
    }
};

class DataEntryManager {
    constructor(config = {}) {
        this.basePath = config.basePath || '';
        this.folder = config.folder || '';
        this.defaultValues = config.defaultValues || {};
        this.translations = config.translations || {};
        this.structure = null;
        this.mandatory = null;
        this.format = null;
        this.onSubmit = config.onSubmit || null;
        this.onChange = config.onChange || null;

        // Translation callbacks
        this.getTranslationFn = config.getTranslation || ((key) => this.translations[key] || key);
        this.getEventTranslationFn = config.getEventTranslation || ((code) => code);
    }

    async loadConfiguration() {
        try {
            const structurePath = `${this.basePath}${this.folder}/trade@data@structure.json`;
            const mandatoryPath = `${this.basePath}${this.folder}/trade@data@mandatory.json`;
            const formatPath = `${this.basePath}${this.folder}/trade@data@format.json`;

            const [structureRes, mandatoryRes, formatRes] = await Promise.all([
                fetch(structurePath),
                fetch(mandatoryPath),
                fetch(formatPath)
            ]);

            this.structure = await structureRes.json();
            this.mandatory = await mandatoryRes.json();
            this.format = await formatRes.json();

            return true;
        } catch (error) {
            console.error('Errore caricamento configurazione:', error);
            throw error;
        }
    }

    getFields() {
        if (!this.structure || !this.structure.data || !this.structure.data[0]) {
            return [];
        }

        const fieldObject = this.structure.data[0];
        return Object.keys(fieldObject).map(key => ({
            name: key,
            label: fieldObject[key],
            required: this.mandatory.required.includes(key),
            optional: this.mandatory.optional.includes(key),
            format: this.format[key] || {},
            defaultValue: this.defaultValues[key] || ''
        }));
    }

    getTranslation(key) {
        return this.getTranslationFn(key);
    }

    getEventTranslation(code) {
        return this.getEventTranslationFn(code);
    }

    generateFieldInput(field) {
        // Implementazione base. Verrà sovrascritta dal renderer custom nell'HTML
        // ma manteniamo una struttura di base per sicurezza.
        const { name, defaultValue } = field;
        return `<input type="text" name="${name}" id="field_${name}" value="${defaultValue || ''}" class="form-input">`;
    }

    generateForm(containerId) {
        // Implementazione base, solitamente sovrascritta dall'HTML per gestire layout complessi
        const fields = this.getFields();
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '<form id="dataentry-form">';
        fields.forEach(field => {
            html += `<div><label>${field.name}</label>${this.generateFieldInput(field)}</div>`;
        });
        html += '</form>';
        container.innerHTML = html;
    }

    // Validazione singolo campo
    validateField(field, value) {
        const { required, format } = field;
        const formatType = format.format || 'text';

        if (required && !value.trim()) {
            return {
                isValid: false,
                message: this.getTranslation('int.field.required') || 'Campo obbligatorio'
            };
        }

        if (!value) return { isValid: true };

        // Validazione FE_Decimal
        if (formatType === 'FE_Decimal') {
            if (!FormatHelper.validateDecimal(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.decimal.invalid') || 'Formato: numero:VALUTA (es: 100:EUR)'
                };
            }
        }

        // Validazione FE_Exchange
        if (formatType === 'FE_Exchange') {
            if (!FormatHelper.validateExchange(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.exchange.invalid') || 'Formato: numero:VAL1/VAL2 (es: 1.2:EUR/USD)'
                };
            }
        }

        // Validazione FE_Float
        if (formatType === 'FE_Float') {
            if (!FormatHelper.validateFloat(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.float.invalid') || 'Numero non valido'
                };
            }
        }

        // Validazione Date
        if (formatType === 'FE_Date') {
            if (!FormatHelper.validateDate(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.date.invalid') || 'Data non valida'
                };
            }
        }

        // Validazione DateTime
        if (formatType === 'FE_DateTime') {
            if (!FormatHelper.validateDateTime(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.datetime.invalid') || 'Data/Ora non valida'
                };
            }
        }

        return { isValid: true };
    }

    validateForm() {
        let isValid = true;
        this.clearErrors();

        const fields = this.getFields();
        fields.forEach(field => {
            const input = document.getElementById(`field_${field.name}`);
            if (!input) return;

            // Per i campi complessi (instrument/event) potremmo dover recuperare il data-code
            let value = input.value;
            if (input.dataset.code) value = input.dataset.code;

            const result = this.validateField(field, value);
            if (!result.isValid) {
                this.showError(field.name, result.message);
                isValid = false;
            }
        });

        return isValid;
    }

    showError(fieldName, message) {
        const errorEl = document.getElementById(`error_${fieldName}`);
        const inputEl = document.getElementById(`field_${fieldName}`);
        if (errorEl) errorEl.textContent = message;
        if (inputEl) inputEl.classList.add('error');
    }

    clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));
    }

    // Inizializza
    async init(containerId) {
        await this.loadConfiguration();
        this.generateForm(containerId);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataEntryManager, FormatHelper };
}