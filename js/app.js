let currentLang = 'en_UK';

const languageSelector = document.getElementById('languageSelector');
const title = document.getElementById('title');
const description = document.getElementById('description');

async function loadTranslations(lang) {
  try {
    const response = await fetch(`lang/${lang}.json`);
    if (!response.ok) throw new Error(`Errore caricamento: ${lang}.json`);
    const translations = await response.json();

    title.textContent = translations.title;
    description.textContent = translations.description;
  } catch (error) {
    console.error('Errore:', error);
    title.textContent = 'Errore nel caricamento delle traduzioni';
    description.textContent = '';
  }
}

// cambio lingua
languageSelector.addEventListener('change', (e) => {
  currentLang = e.target.value;
  loadTranslations(currentLang);
});

// lingua iniziale
loadTranslations(currentLang);

