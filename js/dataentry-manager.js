/**
 * DataEntry Library - Gestione dinamica form per data entry
 * @version 2.0.0
 */

// Format validation helper
const FormatHelper = {
    // Validate FE_Decimal format (number space currency, e.g. "123.45 EUR")
    validateDecimal(value) {
        if (!value) return false;
        const lastSpaceIndex = value.trim().lastIndexOf(' ');
        if (lastSpaceIndex === -1) return false;
        const number = value.substring(0, lastSpaceIndex).trim();
        const currency = value.substring(lastSpaceIndex + 1).trim();
        const numRegex = /^-?\d+(\.\d{1,6})?$/;
        if (!numRegex.test(number)) return false;
        const currencyRegex = /^[A-Z]{3}$/;
        if (!currencyRegex.test(currency)) return false;
        return true;
    },

    // Validate FE_Exchange format (number space currency pair, e.g. "1.10 EUR/USD" or "1.10:EUR/USD")
    validateExchange(value) {
        if (!value) return false;

        // Support both space and colon as separator
        let separator = ' ';
        if (value.includes(':')) separator = ':';
        else if (!value.includes(' ')) return false;

        const parts = value.split(separator);
        if (parts.length !== 2) return false;

        const number = parts[0];
        const currencies = parts[1];

        if (!currencies.includes('/')) return false;
        const currencyParts = currencies.split('/');
        if (currencyParts.length !== 2) return false;

        const numRegex = /^-?\d+(\.\d{1,6})?$/;
        if (!numRegex.test(number)) return false;

        const currencyRegex = /^[A-Z]{3}$/;
        if (!currencyRegex.test(currencyParts[0]) || !currencyRegex.test(currencyParts[1])) return false;

        return true;
    },

    // Validate FE_Float format (positive decimal number, e.g. "123.45")
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

    /**
     * Carica i file di configurazione dalla cartella specificata
     */
    async loadConfiguration() {
        try {
            const structurePath = `${this.basePath}${this.folder}/${this.folder}@data@structure.json`;
            const mandatoryPath = `${this.basePath}${this.folder}/${this.folder}@data@mandatory.json`;
            const formatPath = `${this.basePath}${this.folder}/${this.folder}@data@format.json`;

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
            case 'Fe_Float':
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
        if (formatType === 'FE_Decimal') {
            if (!FormatHelper.validateDecimal(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.decimal.invalid') || 'Formato non valido. Usa: numero VALUTA (es: 123.45 EUR)'
                };
            }
        }

        // Validate FE_Exchange format
        if (formatType === 'FE_Exchange') {
            if (!FormatHelper.validateExchange(value)) {
                return {
                    isValid: false,
                    message: this.getTranslation('int.format.exchange.invalid') || 'Formato non valido. Usa: numero VALUTA1/VALUTA2 (es: 1.10 EUR/USD)'
                };
            }
        }

        // Validate FE_Float format
        if (formatType === 'FE_Float' || formatType === 'Fe_Float') {
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