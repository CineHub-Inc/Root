
import { getTasteProfile } from './algorithm/taste-profile.js';
import { getPersonDetails, getMovieGenres, getTvGenres, IMAGE_BASE_URL, getCountries } from './api.js';
import { showPreferencesModal } from './preferences-modal.js';

let allGenres = null;
let allCountries = null;
let appRootEl = null;

// --- Data Fetching ---

async function loadReferenceData() {
    if (allGenres && allCountries) return;
    try {
        const [movieGenres, tvGenres, countriesData] = await Promise.all([
            getMovieGenres(),
            getTvGenres(),
            getCountries()
        ]);
        
        const genreMap = new Map();
        if (movieGenres?.genres) movieGenres.genres.forEach(g => genreMap.set(g.id, g.name));
        if (tvGenres?.genres) tvGenres.genres.forEach(g => genreMap.set(g.id, g.name));
        allGenres = genreMap;

        const countryMap = new Map();
        if (countriesData) countriesData.forEach(c => countryMap.set(c.iso_3166_1, c.english_name));
        allCountries = countryMap;

    } catch (e) {
        console.error("Could not fetch reference data", e);
        allGenres = new Map();
        allCountries = new Map();
    }
}

// --- Data Processing ---

function processAndSort(categoryData, limit = 10) {
    if (!categoryData) return [];
    return Object.entries(categoryData)
        .filter(([, score]) => score > 0)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, limit);
}

function getTopItem(data, map = null) {
    const sorted = processAndSort(data, 1);
    if (sorted.length === 0) return 'N/A';
    const [id] = sorted[0];
    if (map) return map.get(parseInt(id)) || map.get(id) || id;
    return id; // Return ID if no map
}

// --- Render Functions ---

function renderStatsRow(container, profile) {
    const topGenre = getTopItem(profile.genres, allGenres);
    
    // Calculate favorite era
    const eras = processAndSort(profile.years, 1);
    let favoriteEra = 'N/A';
    if (eras.length > 0) {
        favoriteEra = `${eras[0][0]}s`;
    }

    // Top Person (Actor or Director)
    const topActor = processAndSort(profile.actors, 1)[0];
    const topDirector = processAndSort(profile.directors, 1)[0];
    
    let topPersonId = null;
    let topPersonLabel = 'Top Person';
    
    if (topActor && topDirector) {
        if (topActor[1] > topDirector[1]) {
            topPersonId = topActor[0];
            topPersonLabel = 'Top Actor';
        } else {
            topPersonId = topDirector[0];
            topPersonLabel = 'Top Director';
        }
    } else if (topActor) {
        topPersonId = topActor[0];
        topPersonLabel = 'Top Actor';
    } else if (topDirector) {
        topPersonId = topDirector[0];
        topPersonLabel = 'Top Director';
    }

    const personHtml = topPersonId 
        ? `<span id="stat-person-name">Loading...</span>` 
        : 'N/A';

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i class="fas fa-film"></i></div>
            <div class="stat-content">
                <h3>Top Genre</h3>
                <div class="stat-value">${topGenre}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i class="fas fa-calendar-alt"></i></div>
            <div class="stat-content">
                <h3>Favorite Era</h3>
                <div class="stat-value">${favoriteEra}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon-wrapper"><i class="fas fa-star"></i></div>
            <div class="stat-content">
                <h3>${topPersonLabel}</h3>
                <div class="stat-value">${personHtml}</div>
            </div>
        </div>
    `;

    if (topPersonId) {
        getPersonDetails(topPersonId).then(person => {
            const el = document.getElementById('stat-person-name');
            if (el && person) el.textContent = person.name;
        });
    }
}

function renderGenreChart(container, genres) {
    if (genres.length === 0) {
        container.innerHTML = '<p class="no-content">No genre data yet.</p>';
        return;
    }
    const maxScore = genres[0][1];
    const html = genres.map(([id, score]) => {
        const name = allGenres.get(parseInt(id)) || id;
        const width = (score / maxScore) * 100;
        return `
            <div class="bar-chart-item">
                <div class="bar-chart-label">${name}</div>
                <div class="bar-chart-bar-wrapper">
                    <div class="bar-chart-bar" style="width: ${width}%"></div>
                </div>
                <div class="bar-chart-value">${score.toFixed(1)}</div>
            </div>
        `;
    }).join('');
    container.innerHTML = `<div class="bar-chart-container">${html}</div>`;
}

async function renderPeopleCircles(container, people, type) {
    if (people.length === 0) {
        container.innerHTML = `<p class="no-content">No ${type} data yet.</p>`;
        return;
    }

    const placeholders = people.map(([id], index) => `
        <a href="#person?id=${id}" class="person-circle-card ${index === 0 ? 'top-rank' : ''}" id="person-circle-${id}">
            <div class="person-circle-image">
                <div class="loader-tiny"></div>
            </div>
            <div class="person-circle-name">Loading...</div>
        </a>
    `).join('');
    
    container.innerHTML = `<div class="people-circle-grid">${placeholders}</div>`;

    // Fetch details
    for (const [id] of people) {
        try {
            const person = await getPersonDetails(id);
            const el = document.getElementById(`person-circle-${id}`);
            if (el && person) {
                const imgHtml = person.profile_path 
                    ? `<img src="${IMAGE_BASE_URL}${person.profile_path}" alt="${person.name}">` 
                    : '<i class="fas fa-user"></i>';
                
                el.querySelector('.person-circle-image').innerHTML = imgHtml;
                el.querySelector('.person-circle-name').textContent = person.name;
            }
        } catch (e) { console.warn(e); }
    }
}

function renderSimpleList(container, items, map = null, labelSuffix = '') {
    if (items.length === 0) {
        container.innerHTML = '<p class="no-content">No data available.</p>';
        return;
    }
    
    const maxScore = items[0][1];
    const html = items.map(([key, score]) => {
        let label = key;
        if (map) label = map.get(key) || key;
        if (labelSuffix) label += labelSuffix; // e.g. "s" for 1990s

        const width = (score / maxScore) * 100;
        return `
            <li class="simple-list-item">
                <span class="list-label">${label}</span>
                <div class="list-score-bar">
                    <div class="list-score-fill" style="width: ${width}%"></div>
                </div>
            </li>
        `;
    }).join('');
    container.innerHTML = `<ul class="simple-list">${html}</ul>`;
}

// --- Main Page Render ---

async function renderDashboard() {
    if (!appRootEl) return;
    
    const profile = getTasteProfile();
    const hasProfile = Object.values(profile).some(cat => Object.keys(cat).length > 0);

    if (!hasProfile) {
        appRootEl.innerHTML = `
            <div class="taste-profile-page">
                <header class="taste-profile-header">
                    <h1>Your Recommendation DNA</h1>
                    <p>Your profile is empty. Start interacting with content to build your DNA.</p>
                    <button class="refine-profile-btn" id="refine-profile-btn">
                        <i class="fas fa-sliders-h"></i> Set Preferences
                    </button>
                </header>
                <p class="empty-profile-message">Watch movies, rate shows, and add to your library to generate insights!</p>
            </div>
        `;
        document.getElementById('refine-profile-btn').addEventListener('click', showPreferencesModal);
        return;
    }

    appRootEl.innerHTML = `
        <div class="taste-profile-page">
            <header class="taste-profile-header">
                <h1>Your Recommendation DNA</h1>
                <p>A real-time analysis of your unique cinematic fingerprint.</p>
                <button class="refine-profile-btn" id="refine-profile-btn">
                    <i class="fas fa-sliders-h"></i> Refine Preferences
                </button>
            </header>

            <div class="profile-dashboard">
                <!-- Stats Row -->
                <div class="stats-row" id="stats-row"></div>

                <!-- Genre DNA (Full Width) -->
                <section class="dashboard-section section-full-width">
                    <h2><i class="fas fa-dna"></i> Genre Spectrum</h2>
                    <div id="genres-chart"></div>
                </section>

                <!-- Left Column: People -->
                <section class="dashboard-section">
                    <h2><i class="fas fa-user-astronaut"></i> Favorite Actors</h2>
                    <div id="actors-grid"></div>
                </section>

                <section class="dashboard-section">
                    <h2><i class="fas fa-chair"></i> Preferred Directors</h2>
                    <div id="directors-grid"></div>
                </section>

                <!-- Right Column: Metadata -->
                <section class="dashboard-section">
                    <h2><i class="fas fa-history"></i> Era Affinity</h2>
                    <div id="eras-list"></div>
                </section>

                <section class="dashboard-section">
                    <h2><i class="fas fa-globe-americas"></i> Global Taste</h2>
                    <div id="countries-list"></div>
                </section>
            </div>
        </div>
    `;

    document.getElementById('refine-profile-btn').addEventListener('click', showPreferencesModal);

    const topGenres = processAndSort(profile.genres, 8);
    const topActors = processAndSort(profile.actors, 6);
    const topDirectors = processAndSort(profile.directors, 4);
    const topEras = processAndSort(profile.years, 5);
    const topCountries = processAndSort(profile.countries, 5);

    renderStatsRow(document.getElementById('stats-row'), profile);
    renderGenreChart(document.getElementById('genres-chart'), topGenres);
    renderPeopleCircles(document.getElementById('actors-grid'), topActors, 'actor');
    renderPeopleCircles(document.getElementById('directors-grid'), topDirectors, 'director');
    renderSimpleList(document.getElementById('eras-list'), topEras, null, 's');
    renderSimpleList(document.getElementById('countries-list'), topCountries, allCountries);
}

function handleProfileUpdate() {
    // Re-render the dashboard when the profile changes
    // This is triggered by the event dispatched in taste-profile.js
    if (window.location.hash === '#taste-profile') {
        renderDashboard();
    }
}

// One-time event listener setup (idempotent)
document.removeEventListener('profile-updated', handleProfileUpdate);
document.addEventListener('profile-updated', handleProfileUpdate);

export async function renderTasteProfilePage(appRoot) {
    appRootEl = appRoot;
    appRoot.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`;
    await loadReferenceData();
    renderDashboard();
}
