/**
 * DataEntry Library - Gestione dinamica form per data entry
 * @version 1.0.0
 */

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
     * Genera il campo input in base al formato
     */
    generateFieldInput(field) {
        const { name, format, defaultValue, required } = field;
        const formatType = format.format || 'text';
        const value = defaultValue || '';

        let input = '';
        const commonAttrs = `name="${name}" id="field_${name}" ${required ? 'required' : ''} data-format="${formatType}"`;

        switch (formatType) {
            case 'FE_Date':
                input = `<input type="date" ${commonAttrs} value="${value}" class="form-input">`;
                break;

            case 'FE_DateTime':
                input = `<input type="datetime-local" ${commonAttrs} value="${value}" class="form-input">`;
                break;

            case 'FE_Decimal':
                input = `<input type="number" step="0.01" ${commonAttrs} value="${value}" class="form-input">`;
                break;

            case 'FE_Account':
            case 'FE_Instrument':
            case 'FE_Event':
                input = `<select ${commonAttrs} class="form-input">
          <option value="">-- Seleziona --</option>
        </select>`;
                break;

            default:
                if (formatType.startsWith('list:')) {
                    const listValues = JSON.parse(formatType.replace('list:', ''));
                    input = `<select ${commonAttrs} class="form-input">
            <option value="">-- Seleziona --</option>
            ${listValues.map(v => `<option value="${v}" ${v == value ? 'selected' : ''}>${v}</option>`).join('')}
          </select>`;
                } else {
                    input = `<input type="text" ${commonAttrs} value="${value}" class="form-input">`;
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
            const labelText = this.getTranslation(field.label) || field.name;
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
          <button type="submit" class="btn btn-primary">Salva</button>
          <button type="reset" class="btn btn-secondary">Annulla</button>
        </div>
      </form>
    `;

        container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Ottiene la traduzione per una label
     */
    getTranslation(label) {
        if (typeof getTranslations === 'function') {
            return getTranslations(label);
        }
        return this.translations[label] || label;
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
     * Valida il form
     */
    validateForm() {
        const form = document.getElementById('dataentry-form');
        let isValid = true;

        this.clearErrors();

        const fields = this.getFields();
        fields.forEach(field => {
            const input = document.getElementById(`field_${field.name}`);
            if (!input) return;

            if (field.required && !input.value.trim()) {
                this.showError(field.name, 'Campo obbligatorio');
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
        document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    }

    /**
     * Ottiene i dati dal form
     */
    getFormData() {
        const form = document.getElementById('dataentry-form');
        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            data[key] = value;
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
    module.exports = DataEntryManager;
}