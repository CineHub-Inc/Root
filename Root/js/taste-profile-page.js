import { getTasteProfile } from './algorithm/taste-profile.js';
import { getPersonDetails, getMovieGenres, getTvGenres, IMAGE_BASE_URL } from './api.js';
import { showPreferencesModal } from './preferences-modal.js';

let allGenres = null;

async function getGenreMap() {
    if (allGenres) return allGenres;
    try {
        const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
        const genreMap = new Map();
        if (movieGenres?.genres) movieGenres.genres.forEach(g => genreMap.set(g.id, g.name));
        if (tvGenres?.genres) tvGenres.genres.forEach(g => genreMap.set(g.id, g.name));
        allGenres = genreMap;
        return allGenres;
    } catch (e) {
        console.error("Could not fetch genres", e);
        return new Map();
    }
}

function processAndSort(categoryData, limit) {
    if (!categoryData) return [];
    return Object.entries(categoryData)
        .filter(([, score]) => score > 0) // Only show positive preferences
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, limit);
}

function renderGenreSection(container, genres) {
    if (genres.length === 0) {
        container.innerHTML = '<h2>Top Genres</h2><p>No genre preferences found yet.</p>';
        return;
    }

    const maxScore = genres[0][1]; // First item is the highest score
    
    const chartHtml = genres.map(([id, score]) => {
        const name = allGenres.get(parseInt(id)) || `Genre ${id}`;
        const barWidth = (score / maxScore) * 100;
        return `
            <div class="bar-chart-item">
                <div class="bar-chart-label" title="${name}">${name}</div>
                <div class="bar-chart-bar-wrapper">
                    <div class="bar-chart-bar" style="width: ${barWidth}%;"></div>
                </div>
                <div class="bar-chart-value">${score.toFixed(1)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <h2>Top Genres</h2>
        <div class="bar-chart-container">${chartHtml}</div>
    `;
}

async function renderPeopleSection(container, title, people) {
    if (people.length === 0) {
        container.innerHTML = `<h2>Top ${title}</h2><p>No preferences for ${title.toLowerCase()} found yet.</p>`;
        return;
    }

    const placeholders = people.map(([id]) => `
        <div id="person-profile-container-${id}">
            <div class="person-profile-card">
                 <div class="person-profile-image"><i class="fas fa-spinner fa-spin"></i></div>
                 <div class="person-profile-name">Loading...</div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <h2>Top ${title}</h2>
        <div class="people-grid">${placeholders}</div>
    `;

    // Progressively load details
    for (const [id] of people) {
        try {
            const person = await getPersonDetails(id);
            const cardContainerEl = document.getElementById(`person-profile-container-${id}`);
            if (person && cardContainerEl) {
                const imageUrl = person.profile_path ? `${IMAGE_BASE_URL}${person.profile_path}` : '';
                cardContainerEl.innerHTML = `
                    <a href="#person?id=${person.id}" class="person-profile-card">
                        <div class="person-profile-image">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${person.name}">` : '<i class="fas fa-user"></i>'}
                        </div>
                        <div class="person-profile-name">${person.name}</div>
                    </a>
                `;
            } else if (cardContainerEl) {
                 cardContainerEl.style.display = 'none';
            }
        } catch (e) {
             console.error(`Failed to load person ${id}`, e);
             const cardContainerEl = document.getElementById(`person-profile-container-${id}`);
             if(cardContainerEl) cardContainerEl.style.display = 'none';
        }
    }
}


export async function renderTasteProfilePage(appRoot) {
    await getGenreMap(); // Pre-fetch genres
    const profile = getTasteProfile();

    const hasProfile = Object.values(profile).some(category => 
        Object.keys(category).length > 0 && Object.values(category).some(score => score > 0)
    );

    appRoot.innerHTML = `
        <div class="taste-profile-page">
            <header class="taste-profile-header">
                <h1>Your Recommendation DNA</h1>
                <p>This is your unique taste profile, built from the movies and shows you've watched, rated, and added to your lists.</p>
                <button class="refine-profile-btn" id="refine-profile-btn">
                    <i class="fas fa-sliders-h"></i> Refine Your Profile
                </button>
            </header>
            
            <div id="taste-profile-content"></div>
        </div>
    `;

    document.getElementById('refine-profile-btn').addEventListener('click', showPreferencesModal);
    
    const contentContainer = document.getElementById('taste-profile-content');
    
    if (!hasProfile) {
        contentContainer.innerHTML = '<p class="empty-profile-message">Your DNA is still forming! Watch, rate, and add items to your library to build your profile.</p>';
        return;
    }
    
    const topGenres = processAndSort(profile.genres, 10);
    const topActors = processAndSort(profile.actors, 12);
    const topDirectors = processAndSort(profile.directors, 12);

    contentContainer.innerHTML = `
        <section class="taste-profile-section" id="genres-section"></section>
        <section class="taste-profile-section" id="actors-section"></section>
        <section class="taste-profile-section" id="directors-section"></section>
    `;
    
    renderGenreSection(document.getElementById('genres-section'), topGenres);
    renderPeopleSection(document.getElementById('actors-section'), 'Actors', topActors);
    renderPeopleSection(document.getElementById('directors-section'), 'Directors', topDirectors);
}