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
        if (/^\d+(\.\d+)?\:[A-Z]{3}$/.test(v)) {
            return v;
        }

        // "valore divisa"
        const m = v.match(/^(\d+(?:\.\d+)?)\s+([A-Z]{3})$/);
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
        return /^\d+(\.\d+)?\:[A-Z]{3}$/.test(value);
    },

    validateExchange(value) {
        return /^\d+(\.\d+)?\:[A-Z]{3}\/[A-Z]{3}$/.test(value);
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

    // Format instrument code (remove everything after first space or hyphen)
    formatInstrumentCode(value) {
        if (!value) return '';
        let code = value.split(' ')[0];
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
            let folder = this.folder;
            if (folder && !folder.endsWith('/')) {
                folder += '/';
            }
            const structurePath = `${this.basePath}${folder}${this.filePrefix}@data@structure.json`;
            const mandatoryPath = `${this.basePath}${folder}${this.filePrefix}@data@mandatory.json`;
            const formatPath = `${this.basePath}${folder}${this.filePrefix}@data@format.json`;

            const [structureRes, mandatoryRes, formatRes] = await Promise.all([
                fetch(structurePath),
                fetch(mandatoryPath),
                fetch(formatPath)
            ]);

            if (!structureRes.ok) throw new Error(`Missing or invalid structure file: ${structurePath}`);
            if (!mandatoryRes.ok) throw new Error(`Missing or invalid mandatory file: ${mandatoryPath}`);
            if (!formatRes.ok) throw new Error(`Missing or invalid format file: ${formatPath}`);

            this.structure = await structureRes.json();
            this.mandatory = await mandatoryRes.json();
            this.format = await formatRes.json();

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
        return Object.keys(fieldObject).map(key => ({
            name: key,
            label: fieldObject[key],
            required: this.mandatory.required.includes(key),
            optional: this.mandatory.optional.includes(key),
            format: this.format[key] || {},
            defaultValue: this.defaultValues[key] || ''
        }));
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
                } else if (name === 'type_event' || name.startsWith('type_event')) {
                    // For type_event, show translated description
                    const eventDesc = value ? this.getEventTranslation(value) : '';
                    const displayValue = eventDesc !== value ? `${value} - ${eventDesc}` : value;
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
            // For type_event fields, extract the code from data-code attribute
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
     * Imposta i valori del form
     */
    setFormData(data) {
        Object.keys(data).forEach(key => {
            const input = document.getElementById(`field_${key}`);
            if (input) {
                input.value = data[key];
            }
        });
    }

    /**
     * Inizializza il form
     */
    async init(containerId) {
        await this.loadConfiguration();
        this.generateForm(containerId);
    }
}

// Export per uso come modulo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataEntryManager, FormatHelper };
}