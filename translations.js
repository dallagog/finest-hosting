const TranslationManager = {
  currentLang: 'en_UK',
  translations: {},
  
  async loadTranslations(lang) {
    console.log("📚 Loading translations for:", lang);

    const url = `lang/${lang}.json`;
    console.log("Fetching:", url);

    try {
      const response = await fetch(url);

      console.log("Translation fetch response:", {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) throw new Error(`Cannot load: ${url}`);

      const json = await response.json();
      console.log("Loaded keys:", Object.keys(json));

      this.translations = json;
      this.currentLang = lang;

      return true;
    } catch (error) {
      console.error('❌ Error loading translations:', error);
      this.translations = {}; // evita riferimenti vecchi
      return false;
    }
  },
  
  getTranslation(key) {
    if (!this.translations) {
      console.warn("⚠️ No translations loaded yet.");
    }
    
    const value = this.translations[key];

    if (!value) {
      console.warn(`⚠️ Missing translation for key: "${key}"`);
      return key;
    }

    return value;
  },
  
  get(key) {
    return this.getTranslation(key);
  },
  
  async setLanguage(lang) {
    return await this.loadTranslations(lang);
  },
  
  getCurrentLanguage() {
    return this.currentLang;
  }
};

window.getTranslation = (key) => TranslationManager.getTranslation(key);
