// translations.js - Libreria condivisa per le traduzioni
const TranslationManager = {
  currentLang: 'en_UK',
  translations: {},
  
  async loadTranslations(lang) {
    console.log("📚 Loading translations for:", lang);
    try {
      const response = await fetch(`lang/${lang}.json`);
      console.log("Translation fetch response:", response.status, response.ok);
      if (!response.ok) throw new Error("Loading error: " + lang);
      this.translations = await response.json();
      this.currentLang = lang;
      console.log("✅ Translations loaded successfully:", Object.keys(this.translations).length, "keys");
      return true;
    } catch (error) {
      console.error('❌ Error loading translations:', error);
      return false;
    }
  },
  
  getTranslation(key) {
    const value = this.translations[key] || key;
    console.log(`🔤 Translation [${key}]:`, value);
    return value;
  },
  
  get(key) {
    return this.getTranslation(key);
  },
  
  setLanguage(lang) {
    this.currentLang = lang;
    return this.loadTranslations(lang);
  },
  
  getCurrentLanguage() {
    return this.currentLang;
  }
};

// Alias globale per retrocompatibilità
window.getTranslation = (key) => TranslationManager.getTranslation(key);
