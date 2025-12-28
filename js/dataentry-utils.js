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
        /**
         * context expected structure:
         * {
         *   translations: {},
         *   instrumentTranslations: {},
         *   availableInstruments: {},
         *   availableCurrenciesInstruments: {},
         *   availableAccounts: [],
         *   instrumentManifest: {},
         *   urlParams: {}
         * }
         */
        this.context = {
            translations: {},
            instrumentTranslations: {},
            availableInstruments: {},
            availableCurrenciesInstruments: {},
            availableAccounts: [],
            instrumentManifest: {},
            urlParams: {},
            ...context
        };
    }

    getTranslation(key) {
        const { instrumentTranslations, translations } = this.context;
        return (instrumentTranslations && instrumentTranslations[key]) || (translations && translations[key]) || key;
    }

    generateFieldInput(field) {
        const { name, label, format, defaultValue, required } = field;
        const formatType = format.format || 'text';
        const isFixed = format.modify === "False" && defaultValue;
        const fieldId = `field_${name}`;
        const fixedClass = isFixed ? ' fixed-field' : '';
        let value = (field.value !== undefined ? field.value : defaultValue) || '';

        // Special handling for id_instrument code if present in defaultValue
        if (name === 'id_instrument' && value && typeof FormatHelper !== 'undefined') {
            value = FormatHelper.formatInstrumentCode(value);
        }

        let input = '';

        switch (formatType) {
            case 'FE_Decimal':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Decimal" placeholder="es: 123.45 EUR">`;
                break;

            case 'FE_Exchange':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Exchange" placeholder="es: 1.10:EUR/USD">`;
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
                const filterSector = (this.context.urlParams.account_sector || '').trim().toUpperCase();
                const filteredAccs = (this.context.availableAccounts || []).filter(acc => {
                    if (!filterSector) return true;
                    return (acc.account_sector || '').trim().toUpperCase() === filterSector;
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
                const sector = this.context.urlParams.account_sector || '';
                const manifestItems = this.context.instrumentManifest[sector] || [];
                let options = '';

                manifestItems.forEach(block => {
                    Object.entries(block).forEach(([code, labelKey]) => {
                        const label = this.getTranslation(labelKey) || code;
                        options += `<option value="${code}" ${code == value ? 'selected' : ''}>${label}</option>`;
                    });
                });

                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Instrument">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${options}
                        </select>`;
                break;

            case 'FE_Currency':
                const currOptions = Object.values(this.context.availableCurrenciesInstruments || {}).map(curr =>
                    `<option value="${curr.id}" ${curr.id == value ? 'selected' : ''}>${curr.id} ${curr.instrument_description || ''}</option>`
                ).join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Currency">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${currOptions}
                        </select>`;
                break;

            case 'FE_Sector':
                const sectorOptions = Object.keys(this.context.translations || {})
                    .filter(key => key.startsWith('dom.sector:'))
                    .map(key => ({
                        code: key.split(':')[1],
                        label: this.context.translations[key]
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map(sect =>
                        `<option value="${sect.code}" ${sect.code == value ? 'selected' : ''}>${sect.label}</option>`
                    ).join('');
                input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} class="form-select${fixedClass}" data-format="FE_Sector">
                            <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                            ${sectorOptions}
                        </select>`;
                break;

            case 'FE_Text':
                input = `<input type="text" name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'readonly' : ''} value="${value}" class="form-input${fixedClass}" data-format="FE_Text">`;
                break;

            default:
                if (formatType.startsWith('list:')) {
                    try {
                        const listValues = JSON.parse(formatType.replace('list:', ''));
                        const options = listValues.map(v =>
                            `<option value="${v}" ${v == value ? 'selected' : ''}>${v}</option>`
                        ).join('');
                        input = `<select name="${name}" id="${fieldId}" ${required ? 'required' : ''} ${isFixed ? 'disabled' : ''} class="form-select${fixedClass}" data-format="list">
                                    <option value="">-- ${this.getTranslation('ins.select.option') || 'Seleziona'} --</option>
                                    ${options}
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
        const { name, required, format } = field;
        const formatType = format.format || 'text';
        const isFixed = format.modify === "False" && field.defaultValue;

        if (isFixed) return;

        const input = inputElement.querySelector('input') || inputElement;

        if (formatType === 'FE_Decimal') {
            this.attachValidator(input, required, 'Decimal', callbacks);
        } else if (formatType === 'FE_Exchange') {
            this.attachValidator(input, required, 'Exchange', callbacks);
        } else if (formatType === 'FE_Text') {
            this.attachValidator(input, required, 'Text', callbacks);
        }
    }

    attachValidator(input, required, type, callbacks = {}) {
        input.addEventListener('blur', (e) => {
            let value = e.target.value.trim();
            if (!value && required) {
                if (callbacks.showError) callbacks.showError(input, this.getTranslation('ins.field.required'));
                return;
            }
            if (!value) {
                if (callbacks.clearError) callbacks.clearError(input);
                return;
            }

            if (type === 'Text') {
                const isValidText = /^[a-zA-Z][a-zA-Z0-9]*$/.test(value);
                if (!isValidText) {
                    const msg = this.getTranslation('ins.format.text.invalid') || 'Deve essere alfanumerico e iniziare con una lettera';
                    if (callbacks.showError) callbacks.showError(input, msg);
                } else {
                    if (callbacks.clearError) callbacks.clearError(input);
                }
                return;
            }

            const normalized = type === 'Decimal' ? FormatHelper.normalizeDecimal(value) : FormatHelper.normalizeExchange(value);
            e.target.value = normalized;

            const isValid = type === 'Decimal' ? FormatHelper.validateDecimal(normalized) : FormatHelper.validateExchange(normalized);
            if (!isValid) {
                const msg = type === 'Decimal' ?
                    (this.getTranslation('ins.format.decimal.invalid') || 'Formato non valido. Usa: valore:DIVISA') :
                    (this.getTranslation('ins.format.exchange.invalid') || 'Formato non valido. Usa: valore:DIVISA/DIVISA');
                if (callbacks.showError) callbacks.showError(input, msg);
            } else {
                if (callbacks.clearError) callbacks.clearError(input);
            }
        });
    }
}

class SharedDataEntryValidator {
    constructor(renderer) {
        this.renderer = renderer;
    }

    validateField(field, inputElement) {
        const { name, required, format } = field;
        const formatType = format.format || 'text';
        const input = inputElement.querySelector('input') || inputElement;
        const value = input.value.trim();

        if (required && !value) {
            return { isValid: false, message: this.renderer.getTranslation('ins.field.required') || 'Campo obbligatorio' };
        }

        if (value && typeof FormatHelper !== 'undefined') {
            if (formatType === 'FE_Decimal' && !FormatHelper.validateDecimal(value)) {
                return { isValid: false, message: this.renderer.getTranslation('ins.format.decimal.invalid') || 'Formato non valido' };
            }
            if (formatType === 'FE_DateTime' && !FormatHelper.validateDateTime(value)) {
                return { isValid: false, message: this.renderer.getTranslation('ins.format.datetime.invalid') || 'Formato non valido' };
            }
            if (formatType === 'FE_Date' && !FormatHelper.validateDate(value)) {
                return { isValid: false, message: this.renderer.getTranslation('ins.format.date.invalid') || 'Formato non valido' };
            }
            if (formatType === 'FE_Exchange' && !FormatHelper.validateExchange(value)) {
                return { isValid: false, message: this.renderer.getTranslation('ins.format.exchange.invalid') || 'Formato non valido' };
            }
            if (formatType === 'FE_Text' && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) {
                return { isValid: false, message: this.renderer.getTranslation('ins.format.text.invalid') || 'Formato non valido' };
            }
        }

        return { isValid: true };
    }

    getFormData(formElement) {
        const data = {};
        const fields = formElement.querySelectorAll('[name]');
        fields.forEach(field => {
            let val = field.value.trim();
            // Handle "ID - Description" format if it leaks into input (though mostly handled by combobox now)
            if (val.includes(' - ')) {
                data[field.name] = val.split(' - ')[0].trim();
            } else {
                data[field.name] = val;
            }
        });
        return data;
    }
}
