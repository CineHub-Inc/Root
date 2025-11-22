import { discoverMedia } from './api.js';
import { createMediaCard } from './ui-components.js';
import { updateAllWatchlistIcons, getLocalWatchlist } from './watchlist.js';
import { init as initFilterDrawer } from './filter-drawer/filter-orchestrator.js';
import { getExplicitPreferences } from './algorithm/taste-profile.js';

let currentPage = 1;
let currentFilters = {};
let isLoading = false;
let observer;
let hasMore = true;
const mediaType = 'tv';
const today = new Date().toISOString().split('T')[0];

let replacementPool = [];
let replacementPage = 50; 
let isFetchingReplacement = false;

const sortStrategies = [
    { sort_by: 'popularity.desc' },
    { sort_by: 'first_air_date.desc' },
    { sort_by: 'vote_average.desc', 'vote_count.gte': 100 },
];

function getRandomSortStrategy() {
    return sortStrategies[Math.floor(Math.random() * sortStrategies.length)];
}

async function fetchAndAppendSeries() {
    if (replacementPool.length === 0) {
        if (isFetchingReplacement) return;
        isFetchingReplacement = true;
        try {
            const data = await discoverMedia(mediaType, currentFilters, replacementPage);
            if (data && data.results) {
                const watchlist = getLocalWatchlist();
                const newItems = data.results.filter(item => {
                    const itemMediaType = item.media_type || mediaType;
                    const alreadyExists = document.querySelector(`.media-card[data-id="${item.id}"][data-type="${itemMediaType}"]`);
                    return !watchlist.has(`${itemMediaType}:${item.id}`) && !alreadyExists;
                });
                replacementPool.push(...newItems);
                replacementPage++;
            }
        } catch (e) {
            console.error("Failed to fetch replacement series:", e);
        } finally {
            isFetchingReplacement = false;
        }
    }

    const newItem = replacementPool.shift();
    if (newItem) {
        const grid = document.getElementById('series-grid');
        if (grid) {
            const cardHtml = createMediaCard(newItem);
            grid.insertAdjacentHTML('beforeend', cardHtml);
            updateAllWatchlistIcons();
        }
    } else if (hasMore) {
        setTimeout(fetchAndAppendSeries, 100);
    }
}

function handleSeriesReplacementRequest(event) {
    if (event.detail.gridId === 'series-grid') {
        fetchAndAppendSeries();
    }
}


function renderGrid(mediaItems, append = false) {
    const grid = document.getElementById('series-grid');
    if (!grid) return;

    const watchlist = getLocalWatchlist();
    const filteredItems = mediaItems.filter(item => {
        const itemMediaType = item.media_type || mediaType;
        return !watchlist.has(`${itemMediaType}:${item.id}`);
    });

    const gridHtml = filteredItems.map(createMediaCard).join('');
    
    if (append) {
        grid.insertAdjacentHTML('beforeend', gridHtml);
    } else {
        grid.innerHTML = gridHtml;
    }
    updateAllWatchlistIcons();
}

async function loadSeries(page = 1, append = false) {
    if (isLoading || (!hasMore && append)) return;
    isLoading = true;

    const initialLoader = document.querySelector('.loader');
    const scrollLoader = document.getElementById('infinite-scroll-loader');

    if (page === 1 && !append && initialLoader) initialLoader.style.display = 'flex';
    if (append && scrollLoader) scrollLoader.style.display = 'flex';
    
    try {
        const data = await discoverMedia(mediaType, currentFilters, page);
        if (data && data.results) {
            renderGrid(data.results, append);
            hasMore = data.page < data.total_pages;
            currentPage = data.page;

             if (!hasMore && observer) {
                const sentinel = document.getElementById('infinite-scroll-sentinel');
                if (sentinel) observer.unobserve(sentinel);
            }
        } else {
            hasMore = false;
            if (!append) {
                const grid = document.getElementById('series-grid');
                if (grid) grid.innerHTML = `<p class="no-content-message">No series match the selected criteria.</p>`;
            }
        }
    } catch (error) {
        console.error("Error loading TV series:", error);
        hasMore = false;
    } finally {
        isLoading = false;
        if (initialLoader) initialLoader.style.display = 'none';
        if (scrollLoader) scrollLoader.style.display = 'none';
    }
}

function handleFilterChange(newFilters) {
    const prefs = getExplicitPreferences();
    const prefFilters = {};

    if (prefs.genres.liked?.length > 0) {
        prefFilters.with_genres = prefs.genres.liked.join('|');
    }
    if (prefs.languages?.length > 0) {
        prefFilters.with_original_language = prefs.languages.join('|');
    }
    
    const dislikedFromPrefs = (prefs.genres.disliked || []).map(String);
    const dislikedFromDrawer = newFilters.without_genres ? newFilters.without_genres.split(',') : [];
    const allDisliked = [...new Set([...dislikedFromPrefs, ...dislikedFromDrawer])];
    
    // Drawer filters override preferences for liked genres/languages, but disliked genres are combined.
    currentFilters = { 
        ...getRandomSortStrategy(), 
        ...prefFilters,
        ...newFilters,
        'first_air_date.lte': today
    };
    
    if (allDisliked.length > 0) {
        currentFilters.without_genres = allDisliked.join(',');
    }

    currentPage = 1;
    hasMore = true;

    const grid = document.getElementById('series-grid');
    if(grid) grid.innerHTML = ''; // Clear grid immediately

    loadSeries(1, false); // Fetch page 1, don't append

    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel && observer) {
        observer.observe(sentinel); // Re-observe in case it was unobserved
    }
}


function setupInfiniteScroll() {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) return;

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            loadSeries(currentPage + 1, true);
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}


/**
 * Renders the entire TV Series page with a filterable grid.
 * @param {HTMLElement} appRoot - The main application container.
 * @param {object} params - The URL query parameters.
 */
export function renderSeriesPage(appRoot, params) {
    const prefs = getExplicitPreferences();
    const prefFilters = {};
    if (prefs.genres.disliked?.length > 0) {
        prefFilters.without_genres = prefs.genres.disliked.join(',');
    }
    if (prefs.genres.liked?.length > 0) {
        prefFilters.with_genres = prefs.genres.liked.join('|');
    }
    if (prefs.languages?.length > 0) {
        prefFilters.with_original_language = prefs.languages.join('|');
    }

    const randomPage = Math.floor(Math.random() * 40) + 1;
    currentFilters = {
        sort_by: 'vote_average.desc',
        'vote_count.gte': 100,
        'first_air_date.lte': today, // Exclude upcoming series
        ...prefFilters
    };
    currentPage = randomPage; // Start from this random page
    hasMore = true;
    if (observer) observer.disconnect();

    replacementPool = [];
    replacementPage = 50; 
    isFetchingReplacement = false;

    appRoot.innerHTML = `
        <div class="page-header">
            <h1 class="shelf-title">TV Series</h1>
        </div>
        <div class="media-grid" id="series-grid"></div>
        <div class="loader"><i class="fas fa-spinner"></i></div>
        <div id="infinite-scroll-loader" class="load-more-container" style="display: none;">
            <div class="loader-small"><i class="fas fa-spinner"></i></div>
        </div>
        <div id="infinite-scroll-sentinel"></div>
    `;

    appRoot.removeEventListener('request-grid-replacement', handleSeriesReplacementRequest);
    appRoot.addEventListener('request-grid-replacement', handleSeriesReplacementRequest);
    
    loadSeries(randomPage).then(() => {
        setupInfiniteScroll();
        initFilterDrawer(mediaType, handleFilterChange);
    });
}