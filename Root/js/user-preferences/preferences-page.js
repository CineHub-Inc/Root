import { getTasteProfile, clearTasteProfile, buildProfileFromOnboarding } from '../algorithm/taste-profile.js';
import { getMovieGenres, getTvGenres, getLanguages } from '../api.js';
import { showToast } from '../toast.js';

let allGenres = [];
let allLanguages = [];
let originalPreferences = { likedGenres: new Set(), dislikedGenres: new Set(), languages: new Set() };
let currentPreferences = { likedGenres: new Set(), dislikedGenres: new Set(), languages: new Set() };

async function fetchData() {
    const [movieGenres, tvGenres, languages] = await Promise.all([
        getMovieGenres(),
        getTvGenres(),
        getLanguages(),
    ]);

    const genreMap = new Map();
    if (movieGenres?.genres) movieGenres.genres.forEach(g => genreMap.set(g.id.toString(), g.name));
    if (tvGenres?.genres) tvGenres.genres.forEach(g => genreMap.set(g.id.toString(), g.name));
    allGenres = Array.from(genreMap.entries()).map(([id, name]) => ({ id, name }));
    
    const commonLanguages = ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'hi', 'pt'];
    allLanguages = languages
        .filter(lang => commonLanguages.includes(lang.iso_639_1))
        .map(lang => ({ id: lang.iso_639_1, name: lang.english_name }));
}

function loadCurrentPreferences() {
    const profile = getTasteProfile();
    
    Object.entries(profile.genres || {}).forEach(([id, score]) => {
        if (score > 0) originalPreferences.likedGenres.add(id);
        if (score < 0) originalPreferences.dislikedGenres.add(id);
    });
    
    Object.entries(profile.languages || {}).forEach(([id, score]) => {
        if (score > 0) originalPreferences.languages.add(id);
    });
    
    // Deep copy for editing
    currentPreferences.likedGenres = new Set(originalPreferences.likedGenres);
    currentPreferences.dislikedGenres = new Set(originalPreferences.dislikedGenres);
    currentPreferences.languages = new Set(originalPreferences.languages);
}

function renderSection(title, items, preferenceKey, dislike = false) {
    const chipsHtml = items.map(item => {
        const isSelected = currentPreferences[preferenceKey].has(item.id);
        let classes = 'choice-chip';
        if (isSelected) {
            classes += dislike ? ' disliked' : ' selected';
        }
        return `<button class="${classes}" data-id="${item.id}">${item.name}</button>`;
    }).join('');

    return `
        <section class="preferences-section">
            <h2>${title}</h2>
            <div class="choice-chips-container">${chipsHtml}</div>
        </section>
    `;
}

function handleChipClick(e) {
    const chip = e.target.closest('.choice-chip');
    if (!chip) return;
    
    const section = chip.closest('.preferences-section');
    const id = chip.dataset.id;
    const isLikedGenres = section.innerHTML.includes('Favorite Genres');
    const isDislikedGenres = section.innerHTML.includes('Genres to Avoid');

    if (isLikedGenres) {
        if (currentPreferences.likedGenres.has(id)) {
            currentPreferences.likedGenres.delete(id);
            chip.classList.remove('selected');
        } else {
            currentPreferences.likedGenres.add(id);
            chip.classList.add('selected');
            // Ensure it's not also disliked
            if (currentPreferences.dislikedGenres.has(id)) {
                currentPreferences.dislikedGenres.delete(id);
                document.querySelector(`.choice-chip[data-id="${id}"]`).classList.remove('disliked');
            }
        }
    } else if (isDislikedGenres) {
        if (currentPreferences.dislikedGenres.has(id)) {
            currentPreferences.dislikedGenres.delete(id);
            chip.classList.remove('disliked');
        } else {
            currentPreferences.dislikedGenres.add(id);
            chip.classList.add('disliked');
            // Ensure it's not also liked
            if (currentPreferences.likedGenres.has(id)) {
                currentPreferences.likedGenres.delete(id);
                const otherChip = document.querySelectorAll(`.choice-chip[data-id="${id}"]`)[0];
                if(otherChip) otherChip.classList.remove('selected');
            }
        }
    } else { // Languages
        if(currentPreferences.languages.has(id)) {
            currentPreferences.languages.delete(id);
            chip.classList.remove('selected');
        } else {
            currentPreferences.languages.add(id);
            chip.classList.add('selected');
        }
    }
}

async function handleSaveChanges() {
    const saveBtn = document.querySelector('.pref-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        // Here we clear the old profile and rebuild it with the new explicit preferences.
        // This is a simple strategy. A more complex one would merge changes.
        clearTasteProfile(); 
        await buildProfileFromOnboarding({
            likedGenres: Array.from(currentPreferences.likedGenres),
            dislikedGenres: Array.from(currentPreferences.dislikedGenres),
            languages: Array.from(currentPreferences.languages),
            likedMovies: [], // We don't re-process movies here, only explicit prefs
        });
        
        // Update original preferences to match the saved state
        originalPreferences = JSON.parse(JSON.stringify(currentPreferences));
        
        showToast({ message: "Preferences saved!", type: 'success' });
        
    } catch (error) {
        console.error("Failed to save preferences:", error);
        showToast({ message: "Could not save preferences.", type: 'error' });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

export async function renderPreferencesPage(appRoot) {
    appRoot.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`;
    
    await fetchData();
    loadCurrentPreferences();

    appRoot.innerHTML = `
        <div class="preferences-page">
            <header class="preferences-header">
                <h1>Content Preferences</h1>
                <p>Adjust your preferences to refine the recommendations we show you.</p>
            </header>
            
            <div id="preferences-content">
                ${renderSection('Favorite Genres', allGenres, 'likedGenres')}
                ${renderSection('Genres to Avoid', allGenres, 'dislikedGenres', true)}
                ${renderSection('Preferred Languages', allLanguages, 'languages')}
            </div>

            <footer class="preferences-footer">
                <button class="pref-save-btn">Save Changes</button>
            </footer>
        </div>
    `;

    appRoot.addEventListener('click', handleChipClick);
    appRoot.querySelector('.pref-save-btn').addEventListener('click', handleSaveChanges);
}