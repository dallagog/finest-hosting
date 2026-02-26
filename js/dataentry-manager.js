/**
 * DataEntry Library - Gestione dinamica form per data entry
 * @version 1.0.0
 */

// Format validation helper
const FormatHelper = {
    normalizeDecimal(value) {
        // accetta: "123.45 EUR" oppure "123.45:EUR"
        const v = value.trim();

        // già corretto
        if (/^-?\d+(\.\d+)?\:[A-Z]{3}$/.test(v)) {
            return v;
        }

        // "valore divisa"
        const m = v.match(/^(-?\d+(?:\.\d+)?)\s+([A-Z]{3})$/);
        if (m) {
            return `${m[1]}:${m[2]}`;
        }

        return v; // non normalizzabile
    },

    normalizeExchange(value) {
        // accetta: "1.10 EUR/USD" oppure "1.10:EUR/USD"
        const v = value.trim();

        // già corretto
        if (/^\d+(\.\d+)?\:[A-Z]{3}\/[A-Z]{3}$/.test(v)) {
            return v;
        }

        // "valore divisa/divisa"
        const m = v.match(/^(\d+(?:\.\d+)?)\s+([A-Z]{3}\/[A-Z]{3})$/);
        if (m) {
            return `${m[1]}:${m[2]}`;
        }

        return v;
    },

    validateDecimal(value) {
        return /^-?\d+(\.\d+)?\:[A-Z]{3}$/.test(value);
    },

    validateExchange(value) {
        return /^\d+(\.\d+)?\:[A-Z]{3}\/[A-Z]{3}$/.test(value);
    },

    normalizeCrypto(value) {
        // accetta: "123.45 BTC" oppure "123.45:BTC"
        const v = value.trim();
        // Check if already correct format (number:string)
        if (/^-?\d+(\.\d+)?\:.+$/.test(v)) {
            return v;
        }
        // Normalize space -> colon (Number + Space(s) + Anything)
        const m = v.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/);
        if (m) {
            return `${m[1]}:${m[2]}`;
        }
        return v;
    },

    validateCrypto(value) {
        // Valida numero:stringaqualunque
        return /^-?\d+(\.\d+)?\:.+$/.test(value);
    },

    validateFloat(value) {
        if (!value) return false;
        const floatRegex = /^\d+(\.\d+)?$/;
        return floatRegex.test(value.trim());
    },

    // Validate FE_Date format (YYYY-MM-DD, e.g. "2024-12-19")
    validateDate(value) {
        if (!value) return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(value.trim());
    },

    // Validate FE_DateTime format (YYYY-MM-DD HH:MM:SS+ZZZZ, e.g. "2024-12-19 14:30:00+0100")
    validateDateTime(value) {
        if (!value) return false;
        const dateTimeRegex = /^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)[+-]\d{4}$/;
        return dateTimeRegex.test(value.trim());
    },

    // Format instrument code (remove everything after first space or hyphen, handles colons)
    formatInstrumentCode(value) {
        if (!value) return '';

        // Se contiene due punti, prendiamo l'ultima parte (es: ACCOUNT:TICKER -> TICKER)
        let code = value;
        if (code.includes(':')) {
            const parts = code.split(':');
            code = parts[parts.length - 1];
        }

        code = code.split(' ')[0];
        if (code.includes('-')) {
            code = code.split('-')[0];
        }
        return code.trim();
    },

    // Transform "value currency" or "value currency/currency" to "value:currency"
    transformToColonFormat(value) {
        if (!value) return '';
        const trimmed = value.trim();
        // If it already has a colon, do nothing
        if (trimmed.includes(':')) return trimmed;

        const lastSpaceIndex = trimmed.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return trimmed;

        const part1 = trimmed.substring(0, lastSpaceIndex).trim();
        const part2 = trimmed.substring(lastSpaceIndex + 1).trim();

        // Check if part1 is a number and part2 is either a currency or currency pair
        const numRegex = /^-?\d+(\.\d{1,6})?$/;
        if (!numRegex.test(part1)) return trimmed;

        return `${part1}:${part2}`;
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
        this.filePrefix = config.filePrefix || 'trade';

        // Translation callbacks
        this.getTranslationFn = config.getTranslation || ((key) => this.translations[key] || key);
        this.getEventTranslationFn = config.getEventTranslation || ((code) => code);
    }

    /**
     * Carica i file di configurazione dalla cartella specificata
     */
    async loadConfiguration() {
        try {
            // Helper to join path parts and ensure single slashes
            const joinPaths = (...parts) => {
                return parts
                    .filter(p => p !== undefined && p !== null)
                    .map(p => p.toString().replace(/\/+$/, '').replace(/^\/+/, ''))
                    .filter(p => p.length > 0)
                    .join('/');
            };

            // Calculate paths
            const folderPart = this.folder || '';
            const basePathPart = this.basePath || '';

            // Si presume che basePath possa essere relativo (es. ./dataentry/)
            // Se inizia con ./ lo manteniamo per il fetch
            const finalBase = basePathPart.startsWith('./') ? './' + joinPaths(basePathPart.substring(2)) : joinPaths(basePathPart);
            const fullFolderPath = joinPaths(finalBase, folderPart);

            const v = new Date().getTime();
            const structurePath = `${fullFolderPath}/${this.filePrefix}@data@structure.json?v=${v}`;
            const mandatoryPath = `${fullFolderPath}/${this.filePrefix}@data@mandatory.json?v=${v}`;
            const formatPath = `${fullFolderPath}/${this.filePrefix}@data@format.json?v=${v}`;

            console.log('DataEntryManager: Fetching configuration files:');
            console.log(' - Structure:', structurePath);
            console.log(' - Mandatory:', mandatoryPath);
            console.log(' - Format:', formatPath);

            const [structureRes, mandatoryRes, formatRes] = await Promise.all([
                fetch(structurePath),
                fetch(mandatoryPath),
                fetch(formatPath)
            ]);

            if (!structureRes.ok) throw new Error(`Missing or invalid structure file (${structureRes.status}): ${structurePath}`);
            if (!mandatoryRes.ok) throw new Error(`Missing or invalid mandatory file (${mandatoryRes.status}): ${mandatoryPath}`);
            if (!formatRes.ok) throw new Error(`Missing or invalid format file (${formatRes.status}): ${formatPath}`);

            const structureRaw = await structureRes.text();
            const mandatoryRaw = await mandatoryRes.text();
            const formatRaw = await formatRes.text();

            // Clean text (remove BOM and trim)
            const clean = (txt) => txt.trim().replace(/^\uFEFF/, '');

            const structureText = clean(structureRaw);
            const mandatoryText = clean(mandatoryRaw);
            const formatText = clean(formatRaw);

            try {
                this.structure = JSON.parse(structureText);
            } catch (e) {
                console.error('Invalid JSON in structure file:', structurePath);
                console.log('Content starts with:', structureText.substring(0, 100));
                throw e;
            }

            try {
                this.mandatory = JSON.parse(mandatoryText);
            } catch (e) {
                console.error('Invalid JSON in mandatory file:', mandatoryPath);
                console.log('Content starts with:', mandatoryText.substring(0, 100));
                throw e;
            }

            try {
                this.format = JSON.parse(formatText);
            } catch (e) {
                console.error('Invalid JSON in format file:', formatPath);
                console.log('Content starts with:', formatText.substring(0, 100));
                throw e;
            }

            return true;
        } catch (error) {
            console.error('Errore caricamento configurazione:', error);
            throw error;
        }
    }

    /**
     * Estrae i campi dalla struttura
     */
    getFields() {
        if (!this.structure || !this.structure.data || !this.structure.data[0]) {
            return [];
        }

        const fieldObject = this.structure.data[0];
        console.log('[DataEntryManager] getFields structure data:', fieldObject);
        return Object.keys(fieldObject).map(key => {
            const format = this.format[key] || {};
            // Priorità al valore definito in format.json (se presente)
            let defaultValue = this.defaultValues[key] !== undefined ? this.defaultValues[key] : (format.value || '');

            // Normalize id_instrument if it contains colons (e.g. ACCOUNT:TICKER -> TICKER)
            if (key === 'id_instrument' && defaultValue && typeof FormatHelper !== 'undefined') {
                const original = defaultValue;
                defaultValue = FormatHelper.formatInstrumentCode(defaultValue);
                console.log('[DataEntryManager] id_instrument normalized in getFields:', original, '->', defaultValue);
            }

            return {
                name: key,
                label: fieldObject[key],
                required: this.mandatory.required.includes(key),
                optional: this.mandatory.optional.includes(key),
                format: format,
                defaultValue: defaultValue
            };
        });
    }

    /**
     * Ottiene la traduzione per una label
     */
    getTranslation(key) {
        return this.getTranslationFn(key);
    }

    /**
     * Ottiene la traduzione per un evento
     */
    getEventTranslation(code) {
        return this.getEventTranslationFn(code);
    }

    /**
     * Genera il campo input in base al formato
     */
    generateFieldInput(field) {
        const { name, format, defaultValue, required } = field;
        const formatType = format.format || 'text';
        const isFixed = format.modify === "False" && defaultValue;

        // Special handling for id_instrument - extract only the code
        let value = defaultValue || '';
        if (name === 'id_instrument' && value) {
            value = FormatHelper.formatInstrumentCode(value);
        }

        let input = '';
        const fixedClass = isFixed ? ' fixed-field' : '';
        const fieldId = `field_${name}`;

        switch (formatType) {
            case 'FE_Decimal':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}"
                               class="form-input${fixedClass}"
                               data-format="FE_Decimal"
                               placeholder="es: 123.45 EUR">`;
                break;

            case 'FE_Exchange':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}"
                               class="form-input${fixedClass}"
                               data-format="FE_Exchange"
                               placeholder="es: 1.10 EUR/USD">`;
                break;

            case 'FE_Crypto':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}"
                               class="form-input${fixedClass}"
                               data-format="FE_Crypto"
                               placeholder="es: 0.05 BTC">`;
                break;

            case 'FE_Float':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}"
                               class="form-input${fixedClass}"
                               data-format="FE_Float"
                               placeholder="es: 123.45">`;
                break;

            case 'FE_Date':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}" 
                               class="form-input${fixedClass}"
                               data-format="FE_Date"
                               placeholder="es: 2024-12-19">`;
                break;

            case 'FE_DateTime':
                input = `<input type="text" 
                               name="${name}" 
                               id="${fieldId}"
                               ${required ? 'required' : ''}
                               ${isFixed ? 'readonly' : ''}
                               value="${value}" 
                               class="form-input${fixedClass}"
                               data-format="FE_DateTime"
                               placeholder="es: 2024-12-19 14:30:00+0100">`;
                break;

            case 'FE_Account':
            case 'FE_Instrument':
            case 'FE_Event':
                if (name === 'id_instrument') {
                    input = `<input type="text" 
                                   name="${name}" 
                                   id="${fieldId}"
                                   ${required ? 'required' : ''}
                                   ${isFixed ? 'readonly' : ''}
                                   value="${value}" 
                                   class="form-input${fixedClass}"
                                   data-format="${formatType}"
                                   placeholder="Codice strumento">`;
                } else if (name === 'id_event' || name.startsWith('id_event') || name === 'type_event' || name.startsWith('type_event')) {
                    // For id_event/type_event, show translated description
                    const eventDesc = value ? this.getEventTranslation(value) : '';
                    const displayValue = eventDesc && eventDesc !== value ? `${value} - ${eventDesc}` : value;
                    input = `<input type="text" 
                                   name="${name}" 
                                   id="${fieldId}"
                                   ${required ? 'required' : ''}
                                   ${isFixed ? 'readonly' : ''}
                                   value="${displayValue}" 
                                   data-code="${value}"
                                   class="form-input${fixedClass}"
                                   data-format="${formatType}">`;
                } else {
                    input = `<input type="text" 
                                   name="${name}" 
                                   id="${fieldId}"
                                   ${required ? 'required' : ''}
                                   ${isFixed ? 'readonly' : ''}
                                   value="${value}" 
                                   class="form-input${fixedClass}"
                                   data-format="${formatType}"
                                   list="${name}-list">
                             <datalist id="${name}-list"></datalist>`;
                }
                break;

            default:
                if (formatType.startsWith('list:')) {
                    try {
                        const listValues = JSON.parse(formatType.replace('list:', ''));
                        const options = listValues.map(v =>
                            `<option value="${v}" ${v == value ? 'selected' : ''}>${v}</option>`
                        ).join('');

                        input = `<select name="${name}" 
                                         id="${fieldId}"
                                         ${required ? 'required' : ''}
                                         ${isFixed ? 'disabled' : ''}
                                         class="form-select${fixedClass}"
                                         data-format="list">
                                    <option value="">-- ${this.getTranslation('int.select.option') || 'Seleziona'} --</option>
                                    ${options}
                                </select>`;
                    } catch (e) {
                        input = `<input type="text" 
                                       name="${name}" 
                                       id="${fieldId}"
                                       ${required ? 'required' : ''}
                                       ${isFixed ? 'readonly' : ''}
                                       value="${value}" 
                                       class="form-input${fixedClass}">`;
                    }
                } else {
                    input = `<input type="text" 
                                   name="${name}" 
                                   id="${fieldId}"
                                   ${required ? 'required' : ''}
                                   ${isFixed ? 'readonly' : ''}
                                   value="${value}" 
                                   class="form-input${fixedClass}">`;
                }
        }

        return input;
    }

    /**
     * Genera il form HTML completo
     */
    generateForm(containerId) {
        const fields = this.getFields();
        const container = document.getElementById(containerId);

        if (!container) {
            console.error(`Container ${containerId} non trovato`);
            return;
        }

        let html = `
      <form id="dataentry-form" class="dataentry-form">
        <div class="form-grid">
    `;

        fields.forEach(field => {
            const labelKey = field.name;
            const labelText = this.getTranslation(labelKey) || field.name;
            const requiredMark = field.required ? '<span class="required-mark">*</span>' : '';

            html += `
        <div class="form-group ${field.required ? 'required' : ''}">
          <label for="field_${field.name}" class="form-label">
            ${labelText}${requiredMark}
          </label>
          ${this.generateFieldInput(field)}
          <span class="error-message" id="error_${field.name}"></span>
        </div>
      `;
        });

        html += `
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${this.getTranslation('int.save') || 'Salva'}</button>
          <button type="reset" class="btn btn-secondary">${this.getTranslation('int.cancel') || 'Annulla'}</button>
        </div>
      </form>
    `;

        container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Collega gli event listener al form
     */
    attachEventListeners() {
        const form = document.getElementById('dataentry-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateForm()) {
                const data = this.getFormData();
                if (this.onSubmit) {
                    this.onSubmit(data);
                }
            }
        });

        form.addEventListener('reset', (e) => {
            setTimeout(() => this.clearErrors(), 0);
        });

        if (this.onChange) {
            form.addEventListener('change', (e) => {
                this.onChange(e.target.name, e.target.value);
            });
        }

        // Handle blur events for normalization
        form.addEventListener('focusout', (e) => {
            if (e.target.matches('.form-input')) {
                const format = e.target.dataset.format;
                const value = e.target.value;

                if (!value) return;

                let normalized = value;
                if (format === 'FE_Crypto') {
                    normalized = FormatHelper.normalizeCrypto(value);
                } else if (format === 'FE_Decimal') {
                    normalized = FormatHelper.normalizeDecimal(value);
                } else if (format === 'FE_Exchange') {
                    normalized = FormatHelper.normalizeExchange(value);
                }

                if (normalized !== value) {
                    e.target.value = normalized;
                    // Also trigger onChange if defined
                    if (this.onChange) {
                        this.onChange(e.target.name, normalized);
                    }
                }
            }
        });
    }

    /**
     * Valida un singolo campo
     */
    validateField(field, value) {
        const { name, required, format } = field;
        const formatType = format.format || 'text';

        // Check required fields
        if (required && !value.trim()) {
            return {
                isValid: false,
                message: this.getTranslation('int.field.required') || 'Campo obbligatorio'
            };
        }

        if (!value) return { isValid: true };

        // Validate FE_Decimal format
        if (formatType === 'FE_Decimal' && value) {
            const normalized = FormatHelper.normalizeDecimal(value);
            // Non possiamo aggiornare l'input qui direttamente se non abbiamo il riferimento
            // ma possiamo almeno validare il normalizzato
            if (!FormatHelper.validateDecimal(normalized)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.decimal.invalid') || 'Formato non valido. Usa: valore:DIVISA'
                };
            }
        }

        // Validate FE_Exchange format
        if (formatType === 'FE_Exchange' && value) {
            const normalized = FormatHelper.normalizeExchange(value);
            if (!FormatHelper.validateExchange(normalized)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.exchange.invalid') || 'Formato non valido. Usa: valore:DIVISA/DIVISA'
                };
            }
        }

        // Validate FE_Crypto format
        if (formatType === 'FE_Crypto' && value) {
            const normalized = FormatHelper.normalizeCrypto(value);
            if (!FormatHelper.validateCrypto(normalized)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.crypto.invalid') || 'Formato non valido. Usa: valore:CODICE (es: 0.5:BTC)'
                };
            }
            return { isValid: true, normalized: normalized };
        }

        // Validate FE_Float format
        if (formatType === 'FE_Float') {
            if (!FormatHelper.validateFloat(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.float.invalid') || 'Formato non valido. Inserire un numero positivo (es: 123.45)'
                };
            }
        }

        // Validate FE_Date format
        if (formatType === 'FE_Date') {
            if (!FormatHelper.validateDate(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.date.invalid') || 'Formato non valido. Usa: YYYY-MM-DD (es: 2024-12-19)'
                };
            }
        }

        // Validate FE_DateTime format
        if (formatType === 'FE_DateTime') {
            if (!FormatHelper.validateDateTime(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.datetime.invalid') || 'Formato non valido. Usa: YYYY-MM-DD HH:MM:SS+ZZZZ (es: 2024-12-19 14:30:00+0100)'
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Valida il form completo
     */
    validateForm() {
        let isValid = true;
        this.clearErrors();

        const fields = this.getFields();
        fields.forEach(field => {
            const input = document.getElementById(`field_${field.name}`);
            if (!input) return;

            const result = this.validateField(field, input.value);
            if (!result.isValid) {
                this.showError(field.name, result.message);
                isValid = false;
            } else if (result.normalized && result.normalized !== input.value) {
                input.value = result.normalized;
            }
        });

        return isValid;
    }

    /**
     * Mostra un errore su un campo
     */
    showError(fieldName, message) {
        const errorEl = document.getElementById(`error_${fieldName}`);
        const inputEl = document.getElementById(`field_${fieldName}`);

        if (errorEl) errorEl.textContent = message;
        if (inputEl) inputEl.classList.add('error');
    }

    /**
     * Pulisce tutti gli errori
     */
    clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));
    }

    /**
     * Ottiene i dati dal form
     */
    getFormData() {
        const form = document.getElementById('dataentry-form');
        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            // For type_event/id_event fields, extract the code from data-code attribute
            const input = document.getElementById(`field_${key}`);
            if (input && input.dataset.code) {
                data[key] = input.dataset.code;
            } else {
                data[key] = value;
            }
        }

        return data;
    }

    /**
     * Ottiene il valore di un campo dal DOM
     */
    getFieldValue(name) {
        const input = document.getElementById(`field_${name}`);
        if (!input) return null;

        // Se è un campo con data-code, restituisci quello
        if (input.dataset && input.dataset.code) {
            return input.dataset.code;
        }

        return input.value;
    }

    /**
     * Imposta i valori del form
     */
    setFormData(data) {
        console.log('[DataEntryManager] setFormData called with:', data);
        Object.keys(data).forEach(key => {
            const input = document.getElementById(`field_${key}`);
            if (input) {
                let value = data[key];
                if (key === 'id_instrument' && value && typeof FormatHelper !== 'undefined') {
                    const original = value;
                    value = FormatHelper.formatInstrumentCode(value);
                    console.log('[DataEntryManager] id_instrument normalized in setFormData:', original, '->', value);
                }
                input.value = value;
            }
        });
    }

    /**
     * Inizializza il form
     */
    /**
     * Inizializza il form
     */
    async init(containerId) {
        await this.loadConfiguration();
        this.generateForm(containerId);
    }
}

/**
 * Advanced searchable combobox for Instrument Selection
 */
class InstrumentSearchBox {
    constructor(element, options = {}) {
        this.element = element; // The container div
        this.options = options;
        this.instruments = options.instruments || {};
        this.onSelect = options.onSelect || (() => { });
        this.getTranslation = options.getTranslation || (key => key);
        this.name = options.name || 'id_instrument';
        this.required = options.required || false;
        this.defaultValue = options.defaultValue || '';
        this.isFixed = options.isFixed || false;

        this.isOpen = false;
        this.selectedIndex = -1;
        this.filteredResults = [];

        this.nodes = {
            input: null,
            hidden: null,
            dropdown: null
        };

        this.init();
    }

    init() {
        const value = this.defaultValue;
        const initialText = this.instruments[value] ?
            `${value} - ${this.instruments[value].instrument_description || ''}` :
            value;

        // Give the wrapper a specific ID and transfer the main ID to the input for label association
        this.element.id = `field_${this.name}_wrapper`;

        this.element.innerHTML = `
            <div class="instrument-search-container">
                <input type="text" 
                       id="field_${this.name}"
                       class="form-input instrument-search-input${this.isFixed ? ' fixed-field' : ''}" 
                       placeholder="${this.getTranslation('int.search.instrument') || 'Cerca strumento...'}"
                       value="${initialText}"
                       ${this.isFixed ? 'readonly' : ''}
                       autocomplete="off"
                       data-format="FE_Instrument">
                <input type="hidden" name="${this.name}" id="field_${this.name}_hidden" value="${value}" ${this.required ? 'required' : ''}>
                <div class="instrument-dropdown" style="display: none;"></div>
            </div>
        `;

        this.nodes.input = this.element.querySelector('.instrument-search-input');
        this.nodes.hidden = this.element.querySelector('input[type="hidden"]');
        this.nodes.dropdown = this.element.querySelector('.instrument-dropdown');

        InstrumentSearchBox.injectStyles();

        if (!this.isFixed) {
            this.attachEvents();
        }
    }

    attachEvents() {
        this.nodes.input.addEventListener('input', (e) => {
            const query = e.target.value;
            this.handleSearch(query);
        });

        this.nodes.input.addEventListener('focus', () => {
            if (this.nodes.input.value.trim() === '') {
                this.handleSearch('');
            } else {
                this.handleSearch(this.nodes.input.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                this.closeDropdown();
            }
        });

        this.nodes.input.addEventListener('keydown', (e) => {
            if (!this.isOpen) {
                if (e.key === 'ArrowDown') this.handleSearch(this.nodes.input.value);
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.moveSelection(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.moveSelection(-1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (this.selectedIndex >= 0) {
                        this.selectResult(this.filteredResults[this.selectedIndex]);
                    }
                    break;
                case 'Escape':
                    this.closeDropdown();
                    break;
            }
        });
    }

    handleSearch(query) {
        const q = query.toLowerCase().trim();
        this.filteredResults = Object.entries(this.instruments)
            .map(([id, data]) => ({ id, ...data }))
            .filter(inst => {
                if (!q) return true;
                return (
                    inst.id.toLowerCase().includes(q) ||
                    (inst.instrument_description || '').toLowerCase().includes(q) ||
                    (inst.sector || '').toLowerCase().includes(q) ||
                    (inst.instrument_type || '').toLowerCase().includes(q) ||
                    (inst.id_currency || '').toLowerCase().includes(q)
                );
            })
            .slice(0, 50); // Limit to 50 results

        this.renderDropdown();
    }

    renderDropdown() {
        if (this.filteredResults.length === 0) {
            this.nodes.dropdown.innerHTML = `<div class="dropdown-item empty">${this.getTranslation('int.no.results') || 'Nessun risultato'}</div>`;
        } else {
            this.nodes.dropdown.innerHTML = this.filteredResults.map((inst, index) => {
                const isSelected = index === this.selectedIndex;
                const sector = inst.sector ? `<span class="badge sector">${inst.sector}</span>` : '';
                const type = inst.instrument_type ? `<span class="badge typeShort">${inst.instrument_type}</span>` : '';
                const currency = inst.id_currency ? `<span class="badge currency">${inst.id_currency}</span>` : '';

                return `
                    <div class="dropdown-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                        <div class="item-main">
                            <span class="item-id">${inst.id}</span>
                            <span class="item-desc">${inst.instrument_description || ''}</span>
                        </div>
                        <div class="item-meta">
                            ${type} ${sector} ${currency}
                        </div>
                    </div>
                `;
            }).join('');

            this.nodes.dropdown.querySelectorAll('.dropdown-item:not(.empty)').forEach(el => {
                el.addEventListener('click', () => {
                    const index = parseInt(el.dataset.index);
                    this.selectResult(this.filteredResults[index]);
                });
            });
        }

        this.nodes.dropdown.style.display = 'block';
        this.isOpen = true;
    }

    moveSelection(direction) {
        this.selectedIndex += direction;
        if (this.selectedIndex < 0) this.selectedIndex = this.filteredResults.length - 1;
        if (this.selectedIndex >= this.filteredResults.length) this.selectedIndex = 0;
        this.renderDropdown();

        // Scroll into view
        const selectedEl = this.nodes.dropdown.querySelector('.selected');
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }

    selectResult(inst) {
        const text = `${inst.id} - ${inst.instrument_description || ''}`;
        this.nodes.input.value = text;
        this.nodes.hidden.value = inst.id;
        this.closeDropdown();
        this.onSelect(inst);

        // Trigger change event for form tracking
        const event = new Event('change', { bubbles: true });
        this.nodes.hidden.dispatchEvent(event);
    }

    closeDropdown() {
        this.nodes.dropdown.style.display = 'none';
        this.isOpen = false;
        this.selectedIndex = -1;

        // If user left something that doesn't match an instrument, reset or handle
        const currentVal = this.nodes.hidden.value;
        if (currentVal && this.instruments[currentVal]) {
            const inst = this.instruments[currentVal];
            this.nodes.input.value = `${currentVal} - ${inst.instrument_description || ''}`;
        }
    }

    static injectStyles() {
        if (document.getElementById('instrument-search-styles')) return;

        const css = `
            .instrument-search-container {
                position: relative;
                width: 100%;
            }
            .instrument-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: #fff;
                border: 1px solid #000;
                border-top: none;
                z-index: 1000;
                max-height: 300px;
                overflow-y: auto;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-radius: 0 0 4px 4px;
            }
            .dropdown-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .dropdown-item:last-child {
                border-bottom: none;
            }
            .dropdown-item:hover, .dropdown-item.selected {
                background: #f0f0f0;
            }
            .dropdown-item.empty {
                color: #999;
                font-style: italic;
                cursor: default;
            }
            .item-main {
                display: flex;
                gap: 10px;
                align-items: baseline;
            }
            .item-id {
                font-weight: bold;
                color: #000;
                min-width: 80px;
            }
            .item-desc {
                font-size: 0.9em;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .item-meta {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .badge {
                font-size: 0.75em;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                font-weight: bold;
            }
            .badge.sector { background: #e3f2fd; color: #1565c0; border: 1px solid #bbdefb; }
            .badge.typeShort { background: #f3e5f5; color: #7b1fa2; border: 1px solid #e1bee7; }
            .badge.currency { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
        `;

        const style = document.createElement('style');
        style.id = 'instrument-search-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }
}

/**
 * Shared utilities for Data Entry pages
 */
const DataEntryUtils = {
    getTimezoneOffsetString() {
        const tzo = -new Date().getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const pad = (num) => String(Math.abs(num)).padStart(2, '0');
        return dif + pad(Math.floor(tzo / 60)) + pad(tzo % 60);
    },

    formatCurrentDateTime() {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        return `${dateStr} ${timeStr}${this.getTimezoneOffsetString()}`;
    },

    formatCurrentDate() {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
};

class SharedDataEntryRenderer {
    constructor(context) {
        this.context = {
            translations: {},
            instrumentTranslations: {},
            availableInstruments: {},
            availableCurrenciesInstruments: {},
            availableAccounts: [],
            instrumentManifest: {},
            eventManifest: {},
            eventTranslations: {},
            urlParams: {},
            ...context
        };
    }

    getTranslation(key) {
        const { instrumentTranslations, eventTranslations, translations } = this.context;
        return (instrumentTranslations && instrumentTranslations[key]) ||
            (eventTranslations && eventTranslations[key]) ||
            (translations && translations[key]) ||
            key;
    }

    generateFieldInput(field) {
        const { name, label, format, defaultValue, required } = field;
        const formatType = format.format || 'text';
        const isFixed = format.modify === "False" && defaultValue;
        const fieldId = `field_${name}`;
        const fixedClass = isFixed ? ' fixed-field' : '';
        let value = (field.value !== undefined ? field.value : defaultValue) || '';

        if (name === 'id_instrument' && value && typeof FormatHelper !== 'undefined') {
            const original = value;
            value = FormatHelper.formatInstrumentCode(value);
            console.log('[SharedDataEntryRenderer] id_instrument normalized in generateFieldInput:', original, '->', value);
        } else if (name === 'id_instrument') {
            console.log('[SharedDataEntryRenderer] id_instrument rendering for field:', field);
        }

        let input = '';

        switch (formatType) {
            case 'FE_Decimal':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Decimal" placeholder="es: 123.45 EUR">`;
                break;
            case 'FE_Exchange':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Exchange" placeholder="es: 1.10:EUR/USD">`;
                break;
            case 'FE_Crypto':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Crypto" placeholder="es: 0.05:BTC">`;
                break;
            case 'FE_Date':
                let dateValue = value;
                if (value && value.includes(' ')) dateValue = value.split(' ')[0];
                input = `<div class="input-group">
                            <input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${dateValue}" class="form-input${fixedClass}" data-format="FE_Date" placeholder="YYYY-MM-DD">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('${fieldId}').value = DataEntryUtils.formatCurrentDate()">
                                <i class="fas fa-calendar-day"></i>
                            </button>
                         </div>`;
                break;
            case 'FE_DateTime':
                input = `<div class="input-group">
                            <input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_DateTime" placeholder="YYYY-MM-DD HH:MM:SS+ZZZZ">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('${fieldId}').value = DataEntryUtils.formatCurrentDateTime()">
                                <i class="fas fa-clock"></i>
                            </button>
                         </div>`;
                break;
            case 'FE_Account':
                const filterSector = (this.context.urlParams.account_sector || '').trim();
                const filteredAccs = (this.context.availableAccounts || []).filter(acc => {
                    if (!filterSector) return true;
                    return (acc.account_sector || '').trim() === filterSector;
                });
                const accOptions = filteredAccs.map(acc =>
                    `<option value="${acc.id_account}" ${acc.id_account == value ? 'selected' : ''}>${acc.id_account}</option>`
                ).join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Account">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${accOptions}
                        </select>`;
                break;
            case 'FE_Instrument':
                // Use advanced searchable combobox - Placeholder ID must be field_${name} for initial label/listener logic
                input = `<div id="field_${name}" class="instrument-search-box-wrapper"></div>`;
                break;
            case 'FE_Currency':
                const currOptions = Object.entries(this.context.availableCurrenciesInstruments || {}).map(([id, curr]) => {
                    const currId = curr.id || id;
                    const isSelected = String(currId).trim() === String(value).trim();
                    return `<option value="${currId}" ${isSelected ? 'selected' : ''}>${currId} ${curr.instrument_description || ''}</option>`;
                }).join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Currency">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${currOptions}
                        </select>`;
                break;
            case 'FE_Sector':
                const sectorOptions = Object.keys(this.context.translations || {})
                    .filter(key => key.startsWith('dom.sector:'))
                    .map(key => ({ code: key.split(':')[1], label: this.context.translations[key] }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map(sect => `<option value="${sect.code}" ${sect.code == value ? 'selected' : ''}>${sect.label}</option>`)
                    .join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Sector">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${sectorOptions}
                        </select>`;
                break;
            case 'FE_Event':
                const eventSector = (this.context.urlParams.account_sector || '').trim();
                console.log('[FE_Event] urlParams:', this.context.urlParams);
                console.log('[FE_Event] account_sector from urlParams:', eventSector);
                console.log('[FE_Event] eventManifest keys:', Object.keys(this.context.eventManifest || {}));
                const sectorEvents = (this.context.eventManifest || {})[eventSector] || [];
                console.log('[FE_Event] Events for sector', eventSector, ':', sectorEvents.length, 'events');
                const eventOptions = sectorEvents.map(evt => {
                    const code = evt.id_event || evt.type_event;
                    const lKey = evt.id_event_label || evt.type_event_label || `eve.${code}`;
                    const desc = this.getTranslation(lKey);
                    return `<option value="${code}" ${code == value ? 'selected' : ''}>${code} - ${desc}</option>`;
                }).join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Event">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${eventOptions}
                        </select>`;
                break;
            case 'FE_Text':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Text">`;
                break;
            default:
                if (formatType.startsWith('list:')) {
                    try {
                        const listValues = JSON.parse(formatType.replace('list:', ''));
                        const opts = listValues.map(v => `<option value="${v}" ${v == value ? 'selected' : ''}>${v}</option>`).join('');
                        input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'disabled' : ''} class="form-select${fixedClass}" data-format="list">
                                    <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                                    ${opts}
                                </select>`;
                    } catch (e) {
                        input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}">`;
                    }
                } else {
                    input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}">`;
                }
        }
        return input;
    }

    attachFieldListeners(field, inputElement, callbacks = {}) {
        const formatType = field.format.format || 'text';
        const isFixed = field.format.modify === "False" && field.defaultValue;
        const name = field.name;

        if (formatType === 'FE_Instrument' && !isFixed) {
            const wrapper = inputElement.querySelector('.instrument-search-box-wrapper') || inputElement;
            if (wrapper) {
                new InstrumentSearchBox(wrapper, {
                    instruments: this.context.availableInstruments,
                    getTranslation: key => this.getTranslation(key),
                    name: field.name,
                    required: field.required,
                    defaultValue: field.defaultValue || this.context.urlParams[name] || '',
                    isFixed: isFixed
                });
            }
            return;
        }

        if (isFixed) return;
        const input = inputElement.querySelector('input') || inputElement;
        if (formatType === 'FE_Decimal') this.attachValidator(input, field.required, 'Decimal', callbacks);
        else if (formatType === 'FE_Exchange') this.attachValidator(input, field.required, 'Exchange', callbacks);
        else if (formatType === 'FE_Text') this.attachValidator(input, field.required, 'Text', callbacks);
    }

    attachValidator(input, required, type, callbacks = {}) {
        input.addEventListener('blur', (e) => {
            let value = e.target.value.trim();
            if (!value && required) { if (callbacks.showError) callbacks.showError(input, this.getTranslation('ins.field.required')); return; }
            if (!value) { if (callbacks.clearError) callbacks.clearError(input); return; }
            if (type === 'Text') {
                if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) { if (callbacks.showError) callbacks.showError(input, this.getTranslation('ins.format.text.invalid') || 'Deve essere alfanumerico e iniziare con una lettera'); }
                else { if (callbacks.clearError) callbacks.clearError(input); }
                return;
            }
            const normalized = type === 'Decimal' ? FormatHelper.normalizeDecimal(value) : FormatHelper.normalizeExchange(value);
            e.target.value = normalized;
            const isValid = type === 'Decimal' ? FormatHelper.validateDecimal(normalized) : FormatHelper.validateExchange(normalized);
            if (!isValid) { if (callbacks.showError) callbacks.showError(input, type === 'Decimal' ? (this.getTranslation('ins.format.decimal.invalid') || 'Formato non valido. Usa: valore:DIVISA') : (this.getTranslation('ins.format.exchange.invalid') || 'Formato non valido. Usa: valore:DIVISA/DIVISA')); }
            else { if (callbacks.clearError) callbacks.clearError(input); }
        });
    }
}

class SharedDataEntryValidator {
    constructor(renderer) { this.renderer = renderer; }

    validateField(field, inputElement) {
        const formatType = field.format.format || 'text';
        const input = inputElement.querySelector('input') || inputElement;
        const value = input.value.trim();
        if (field.required && !value) return { isValid: false, message: this.renderer.getTranslation('ins.field.required') || 'Campo obbligatorio' };
        if (value && typeof FormatHelper !== 'undefined') {
            if (formatType === 'FE_Decimal' && !FormatHelper.validateDecimal(value)) return { isValid: false, message: this.renderer.getTranslation('ins.format.decimal.invalid') || 'Formato non valido' };
            if (formatType === 'FE_DateTime' && !FormatHelper.validateDateTime(value)) return { isValid: false, message: this.renderer.getTranslation('ins.format.datetime.invalid') || 'Formato non valido' };
            if (formatType === 'FE_Date' && !FormatHelper.validateDate(value)) return { isValid: false, message: this.renderer.getTranslation('ins.format.date.invalid') || 'Formato non valido' };
            if (formatType === 'FE_Exchange' && !FormatHelper.validateExchange(value)) return { isValid: false, message: this.renderer.getTranslation('ins.format.exchange.invalid') || 'Formato non valido' };
            if (formatType === 'FE_Text' && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) return { isValid: false, message: this.renderer.getTranslation('ins.format.text.invalid') || 'Formato non valido' };
        }
        return { isValid: true };
    }

    getFormData(formElement) {
        const data = {};
        formElement.querySelectorAll('[name]').forEach(field => {
            let val = field.value.trim();
            data[field.name] = val.includes(' - ') ? val.split(' - ')[0].trim() : val;
        });
        return data;
    }
}

// Export per uso come modulo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataEntryManager, FormatHelper, DataEntryUtils, SharedDataEntryRenderer, SharedDataEntryValidator };
}