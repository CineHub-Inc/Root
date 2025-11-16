import { openModal, closeModal } from './modal.js';
import { getMovieGenres, getTvGenres, getLanguages } from './api.js';
import { getExplicitPreferences, saveExplicitPreferences } from './algorithm/taste-profile.js';
import { showToast } from './toast.js';
import { handleRouteChange } from './router.js';

let allGenres = [];
let allLanguages = [];
let selectedLanguages = new Set();
const topLanguages = new Set(['en', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ko', 'hi', 'ar', 'bn']);


async function loadData() {
    const [movieGenres, tvGenres, languages] = await Promise.all([
        getMovieGenres(),
        getTvGenres(),
        getLanguages()
    ]);

    const genreMap = new Map();
    if (movieGenres?.genres) movieGenres.genres.forEach(g => genreMap.set(g.id, g.name));
    if (tvGenres?.genres) tvGenres.genres.forEach(g => genreMap.set(g.id, g.name));
    allGenres = Array.from(genreMap.entries()).map(([id, name]) => ({ id, name }));

    allLanguages = languages || [];
}

function getModalHtml() {
    return `
        <div class="preferences-modal-content">
            <div class="preferences-header">
                <h2>Content Preferences</h2>
            </div>
            <div class="preferences-body">
                <section class="preferences-section">
                    <h3>Your Favorite Genres</h3>
                    <p class="description">Click once to 'Like' a genre, twice to 'Dislike', and a third time to reset. This helps us tailor recommendations for you.</p>
                    <div class="genres-container" id="pref-genres-container">
                        <!-- Genres will be rendered here -->
                    </div>
                </section>
                <section class="preferences-section">
                    <h3>Preferred Languages</h3>
                    <p class="description">Select the languages you enjoy watching content in. Click a suggestion or search for more.</p>
                    <div class="language-input-wrapper">
                        <div class="language-input-container" id="language-input-container">
                            <!-- Selected tags will go here -->
                            <input type="text" id="language-search-input" placeholder="Search and add languages...">
                        </div>
                        <ul id="language-search-results"></ul>
                    </div>
                    <div class="suggested-languages" id="suggested-languages-container">
                        <!-- Suggested language chips will go here -->
                    </div>
                </section>
            </div>
            <div class="preferences-footer">
                <button class="preferences-btn pref-cancel-btn">Cancel</button>
                <button class="preferences-btn pref-save-btn">Save & Rebuild Profile</button>
            </div>
        </div>
    `;
}

function renderGenres() {
    const container = document.getElementById('pref-genres-container');
    if (!container) return;
    
    const currentPrefs = getExplicitPreferences();

    const pillsHtml = allGenres.map(genre => {
        let state = '';
        if (currentPrefs.genres.liked.includes(genre.id)) {
            state = 'data-state="liked"';
        } else if (currentPrefs.genres.disliked.includes(genre.id)) {
            state = 'data-state="disliked"';
        }
        return `
            <button class="genre-pill-pref" data-id="${genre.id}" ${state}>
                <span>${genre.name}</span>
            </button>
        `;
    }).join('');
    container.innerHTML = pillsHtml;
}

function renderLanguages() {
    const currentPrefs = getExplicitPreferences();
    selectedLanguages = new Set(currentPrefs.languages);

    const searchResultsEl = document.getElementById('language-search-results');
    const suggestedContainer = document.getElementById('suggested-languages-container');

    const allLangsSorted = [...allLanguages].sort((a, b) => a.english_name.localeCompare(b.english_name));
    
    searchResultsEl.innerHTML = allLangsSorted
        .map(lang => `<li data-code="${lang.iso_639_1}">${lang.english_name}</li>`)
        .join('');

    const suggestedLangs = allLangsSorted.filter(lang => topLanguages.has(lang.iso_639_1));
    suggestedContainer.innerHTML = suggestedLangs
        .map(lang => `<button class="lang-chip" data-code="${lang.iso_639_1}">${lang.english_name}</button>`)
        .join('');

    updateSelectedLanguagesView();
}


function updateSelectedLanguagesView() {
    const container = document.getElementById('language-input-container');
    const searchInput = document.getElementById('language-search-input');
    const searchResultsEl = document.getElementById('language-search-results');
    const suggestedContainer = document.getElementById('suggested-languages-container');
    if (!container || !searchResultsEl || !suggestedContainer) return;
    
    container.querySelectorAll('.selected-lang-tag').forEach(tag => tag.remove());
    
    const tagsHtml = Array.from(selectedLanguages).map(langCode => {
        const lang = allLanguages.find(l => l.iso_639_1 === langCode);
        return `
            <div class="selected-lang-tag" data-code="${langCode}">
                <span>${lang ? lang.english_name : langCode}</span>
                <button class="remove-lang-btn" aria-label="Remove ${lang ? lang.english_name : ''}">&times;</button>
            </div>
        `;
    }).join('');
    
    searchInput.insertAdjacentHTML('beforebegin', tagsHtml);

    searchResultsEl.querySelectorAll('li').forEach(li => {
        li.classList.toggle('disabled', selectedLanguages.has(li.dataset.code));
    });
    suggestedContainer.querySelectorAll('.lang-chip').forEach(chip => {
        chip.classList.toggle('disabled', selectedLanguages.has(chip.dataset.code));
    });
}

async function handleSave() {
    const liked = [];
    const disliked = [];
    document.querySelectorAll('.genre-pill-pref').forEach(pill => {
        if (pill.dataset.state === 'liked') {
            liked.push(parseInt(pill.dataset.id));
        } else if (pill.dataset.state === 'disliked') {
            disliked.push(parseInt(pill.dataset.id));
        }
    });

    const newPrefs = {
        genres: { liked, disliked },
        languages: Array.from(selectedLanguages)
    };
    
    try {
        await saveExplicitPreferences(newPrefs);
        showToast({ message: 'Preferences saved! Your profile has been updated.', type: 'success' });
        closeModal();
        window.location.hash = '#taste-profile';
        handleRouteChange();
    } catch(err) {
        showToast({ message: 'Error saving preferences. Please try again.', type: 'error' });
        console.error("Save preferences failed:", err);
    }
}

function addLanguage(langCode) {
    const searchInput = document.getElementById('language-search-input');
    selectedLanguages.add(langCode);
    updateSelectedLanguagesView();
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input')); // Trigger filter reset
    searchInput.focus();
}

function setupEventListeners() {
    // Genres
    const genresContainer = document.getElementById('pref-genres-container');
    genresContainer.addEventListener('click', e => {
        const pill = e.target.closest('.genre-pill-pref');
        if (!pill) return;
        
        const currentState = pill.dataset.state || 'none';
        const nextState = { 'none': 'liked', 'liked': 'disliked', 'disliked': 'none' }[currentState];
        
        if (nextState === 'none') {
            delete pill.dataset.state;
        } else {
            pill.dataset.state = nextState;
        }
    });

    // Languages
    const searchInput = document.getElementById('language-search-input');
    const searchResults = document.getElementById('language-search-results');
    const inputContainer = document.getElementById('language-input-container');
    const suggestedContainer = document.getElementById('suggested-languages-container');
    const inputWrapper = document.querySelector('.language-input-wrapper');

    inputContainer.addEventListener('click', e => {
        if (e.target === inputContainer) searchInput.focus();
    });
    
    searchInput.addEventListener('input', () => {
        const filter = searchInput.value.toLowerCase();
        searchResults.querySelectorAll('li').forEach(li => {
            const isMatch = li.textContent.toLowerCase().includes(filter);
            li.classList.toggle('hidden', !isMatch);
        });
        searchResults.classList.toggle('visible', filter.length > 0);
    });

    searchInput.addEventListener('focus', () => {
        if(searchInput.value) searchResults.classList.add('visible');
    });

    document.addEventListener('click', e => {
        if (!inputWrapper.contains(e.target)) {
            searchResults.classList.remove('visible');
        }
    });
    
    searchResults.addEventListener('click', e => {
        const li = e.target.closest('li');
        if (li && !li.classList.contains('disabled')) {
            addLanguage(li.dataset.code);
            searchResults.classList.remove('visible');
        }
    });

    suggestedContainer.addEventListener('click', e => {
        const chip = e.target.closest('.lang-chip');
        if (chip && !chip.classList.contains('disabled')) {
            addLanguage(chip.dataset.code);
        }
    });

    inputContainer.addEventListener('click', e => {
        const button = e.target.closest('.remove-lang-btn');
        if (button) {
            const tag = button.closest('.selected-lang-tag');
            selectedLanguages.delete(tag.dataset.code);
            updateSelectedLanguagesView();
        }
    });

    // Footer
    document.querySelector('.pref-save-btn').addEventListener('click', handleSave);
    document.querySelector('.pref-cancel-btn').addEventListener('click', closeModal);
}

export async function showPreferencesModal() {
    openModal('<div class="loader"><i class="fas fa-spinner"></i></div>', 'preferences-modal');
    await loadData();
    openModal(getModalHtml(), 'preferences-modal');
    renderGenres();
    renderLanguages();
    setupEventListeners();
}