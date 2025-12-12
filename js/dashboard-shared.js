// Shared logic for Dashboard and Portfolio Graph ver 1.0

/**
 * Parses raw portfolio data into a flat list of objects.
 * Handles both array-of-arrays and object-of-objects formats.
 * @param {Object|Array} rawPortfolio - The raw portfolio data from the API.
 * @returns {Array} - Array of flat portfolio items.
 */
function parsePortfolioItems(rawPortfolio) {
    const portfolioData = [];

    const parseItem = (symbol, details) => {
        const flatItem = { Ticker: symbol };
        if (details && typeof details === 'object') {
            Object.keys(details).forEach(key => {
                let val = details[key];
                if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
                    flatItem[key] = parseFloat(val);
                } else {
                    flatItem[key] = val;
                }
            });
        }
        return flatItem;
    };

    if (Array.isArray(rawPortfolio)) {
        rawPortfolio.forEach(entry => {
            if (Array.isArray(entry) && entry.length === 2) {
                portfolioData.push(parseItem(entry[0], entry[1]));
            }
        });
    } else if (typeof rawPortfolio === 'object') {
        Object.keys(rawPortfolio).forEach(symbol => {
            portfolioData.push(parseItem(symbol, rawPortfolio[symbol]));
        });
    }

    // Calculate additional derived values like '%'
    portfolioData.forEach(item => {
        const mp = item['M/P'];
        const cost = item['cost_amount'];
        if (typeof mp === 'number' && typeof cost === 'number' && cost !== 0) {
            item['%'] = parseFloat(((mp / cost) * 100).toFixed(1));
        } else {
            item['%'] = null;
        }
    });

    return portfolioData;
}

/**
 * Populates a select element with grouping options based on classification data.
 * @param {HTMLElement} selectElement - The select element to populate.
 * @param {Array|Object} classificationList - List of classification objects.
 * @param {Function} translationFn - Function to translate keys (optional).
 * @param {string} initialValue - The initial value to select (optional).
 * @param {string} defaultLabel - Label for the default "no grouping" option (optional).
 */
function populateGroupingSelectSummary(selectElement, classificationList, translationFn, initialValue = "", defaultLabel = "Nessun raggruppamento") {
    selectElement.innerHTML = `<option value="">${defaultLabel}</option>`;

    let keys = [];

    // classificationList can be an array of objects, each representing an instrument's classification
    // We want to find all unique classification keys (columns) available.
    // Usually taking the keys of the first item (excluding id_instrument) is enough if the structure is consistent.
    if (Array.isArray(classificationList) && classificationList.length > 0) {
        keys = Object.keys(classificationList[0]).filter(k => k !== 'id_instrument');
    }

    keys.forEach(key => {
        const opt = document.createElement("option");
        opt.value = key;
        const label = translationFn ? translationFn(key) : key;
        opt.textContent = label || key;
        selectElement.appendChild(opt);
    });

    if (initialValue) {
        selectElement.value = initialValue;
    }
}

/**
 * Groups portfolio data based on a classification key.
 * @param {Array} portfolioData - Flat list of portfolio items.
 * @param {Object} classificationMap - Map of id_instrument -> classification object.
 * @param {string} groupingKey - The key to group by (e.g., 'asset_class').
 * @param {string} valueKey - The key of the value to sum up (e.g., 'CTVMKTTQ').
 * @returns {Array} - Array of { label: string, value: number } objects, sorted by value descending.
 */
function getGroupedData(portfolioData, classificationMap, groupingKey, valueKey = "CTVMKTTQ") {
    let active = portfolioData.filter(x => {
        const val = parseFloat(x[valueKey]);
        return !isNaN(val) && val > 0;
    });

    let groupedResults = [];

    if (groupingKey) {
        const grp = {};

        active.forEach(item => {
            let id = item.id_instrument;
            let cls = classificationMap[id];
            // If we have a classification map and a grouping key, try to get the value.
            // If cls is missing or the key is missing, fall back to "Other".
            let labelKey = cls ? cls[groupingKey] : null;
            let label = labelKey || "Other";

            if (!grp[label]) grp[label] = 0;
            grp[label] += parseFloat(item[valueKey]);
        });

        const sorted = Object.entries(grp).sort((a, b) => b[1] - a[1]);
        groupedResults = sorted.map(e => ({ label: e[0], value: e[1] }));
    } else {
        // No grouping, just list individual items
        active.sort((a, b) => b[valueKey] - a[valueKey]);
        // Limit to top 30 for charts usually, but return all here, let caller decide limit
        groupedResults = active.map(x => ({
            label: x.instrument_description || x.Ticker,
            value: parseFloat(x[valueKey])
        }));
    }

    return groupedResults;
}
