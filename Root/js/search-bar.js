import { searchMulti, getMediaDetails, getPersonDetails, IMAGE_BASE_URL } from './api.js';
import { auth } from './firebase.js';
import { showToast } from './toast.js';
import { handleUnlockCode } from './feature-unlock.js';

function clearResults() {
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('has-content');
    }
}

/**
 * Progressively loads and populates detailed information for a single search result item.
 * @param {object} item - The search result item.
 */
async function loadAndPopulateDetails(item) {
    const detailsElement = document.getElementById(`search-result-details-${item.id}`);
    if (!detailsElement) return;

    detailsElement.innerHTML = '<span class="loader-tiny"></span>';

    try {
        if (item.media_type === 'movie' || item.media_type === 'tv') {
            const data = await getMediaDetails(item.id, item.media_type);
            if (!data) throw new Error('No media data received');

            const year = (data.release_date || data.first_air_date)?.substring(0, 4) || '';
            let country = data.production_countries?.[0]?.name || '';
             if (!country && data.origin_country?.[0]) {
                try {
                    country = new Intl.DisplayNames(['en'], { type: 'region' }).of(data.origin_country[0]);
                } catch (e) {
                    country = data.origin_country[0]; // Fallback to code
                }
            }
            if (country === 'United States of America') country = 'USA';
            
            detailsElement.innerHTML = [year, country].filter(Boolean).join(' &bull; ');

        } else if (item.media_type === 'person' && (item.known_for_department === 'Acting' || item.known_for_department === 'Directing')) {
            const data = await getPersonDetails(item.id);
            if (!data) throw new Error('No person data received');
            
            let country = data.place_of_birth?.split(',').pop().trim() || '';
            if (country === 'United States of America') country = 'USA';
            
            let ageText = '';
            if (data.birthday && !data.deathday) {
                const birthYear = new Date(data.birthday).getFullYear();
                const currentAge = new Date().getFullYear() - birthYear;
                ageText = `Age ${currentAge}`;
            }
            detailsElement.innerHTML = [country, ageText].filter(Boolean).join(' &bull; ');
        }
    } catch (error) {
        console.warn(`Could not load details for search item ${item.id}:`, error);
        detailsElement.innerHTML = ''; // Clear loader on error
    }
}


function renderResults(results) {
    const searchResults = document.getElementById('search-results');
    clearResults();
    if (!searchResults || !results || results.length === 0) return;

    // Categorize results
    const films = results.filter(item => item.media_type === 'movie' && item.poster_path);
    const tvSeries = results.filter(item => item.media_type === 'tv' && item.poster_path);
    const actors = results.filter(item => item.media_type === 'person' && item.profile_path && item.known_for_department === 'Acting');
    const directors = results.filter(item => item.media_type === 'person' && item.profile_path && item.known_for_department === 'Directing');

    const createItemHtml = (item) => {
        const title = item.title || item.name;
        const imagePath = item.poster_path || item.profile_path;
        const imageUrl = `${IMAGE_BASE_URL}${imagePath}`;
        const imageContainerClass = item.media_type === 'person' ? 'result-image person' : 'result-image';
        
        let detailsHtml;
        if (item.media_type === 'movie' || item.media_type === 'tv' || (item.media_type === 'person' && (item.known_for_department === 'Acting' || item.known_for_department === 'Directing'))) {
            detailsHtml = `<div class="result-details" id="search-result-details-${item.id}"></div>`;
        } else {
            let typeDisplay = item.media_type === 'person' ? item.known_for_department : item.media_type;
            detailsHtml = `<span class="result-type">${typeDisplay}</span>`;
        }
        
        const href = item.media_type === 'person'
            ? `#person?id=${item.id}`
            : `#media?type=${item.media_type}&id=${item.id}`;

        return `
            <a href="${href}" class="search-result-item">
                <div class="${imageContainerClass}">
                    <img src="${imageUrl}" alt="${title}" loading="lazy">
                </div>
                <div class="result-info">
                    <span class="result-title">${title}</span>
                    ${detailsHtml}
                </div>
            </a>
        `;
    };

    const createCategoryHtml = (title, items) => {
        if (items.length === 0) return '';
        return `
            <div class="search-category">
                <h3 class="search-category-title">${title}</h3>
                ${items.map(createItemHtml).join('')}
            </div>
        `;
    };

    const finalHtml = [
        createCategoryHtml('Films', films),
        createCategoryHtml('TV Series', tvSeries),
        createCategoryHtml('Actors', actors),
        createCategoryHtml('Directors', directors)
    ].join('');

    if (finalHtml.trim()) {
        searchResults.innerHTML = finalHtml;
        searchResults.classList.add('has-content');
        
        // Progressively load the extra details for relevant items
        [...films, ...tvSeries, ...actors, ...directors].forEach(loadAndPopulateDetails);
    }
}


async function handleSearch(event) {
    const query = event.target.value.trim();

    // Easter Egg: Check for unlock code before performing a search.
    if (auth.currentUser && query.length > 5) {
        const unlocked = await handleUnlockCode(query);
        if (unlocked) {
            // Success! Clear input and close search.
            event.target.value = '';
            clearResults();
            document.dispatchEvent(new CustomEvent('close-command-bar-widgets'));
            return; // Stop processing as a search query
        }
    }
    
    // Normal Search Logic
    if (query.length < 2) {
        clearResults();
        return;
    }

    const data = await searchMulti(query);
    renderResults(data?.results);
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

export function initSearchLogic() {
    const searchInput = document.getElementById('command-bar-search-input');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Add event listener to clear results on demand
    document.addEventListener('clear-search-results', clearResults);

    searchResults.addEventListener('click', (e) => {
        const item = e.target.closest('a.search-result-item');
        if (item) {
            // Navigation is handled by the <a> tag. We just need to close the search.
            document.dispatchEvent(new CustomEvent('close-command-bar-widgets'));
        }
    });
}