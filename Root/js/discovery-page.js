import { discoverMedia } from './api.js';
import { createMediaCard } from './ui-components.js';
import { updateAllWatchlistIcons, getLocalWatchlist } from './watchlist.js';

let currentPage = 1;
let currentFilters = {};
let currentMediaType = 'movie';
let isLoading = false;
let observer;
let hasMore = true;

function renderGrid(mediaItems, append = false) {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    const watchlist = getLocalWatchlist();
    const filteredResults = mediaItems.filter(item => {
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        const status = watchlist.get(`${mediaType}:${item.id}`);
        return !status;
    });

    const gridHtml = filteredResults.map(createMediaCard).join('');
    
    if (append) {
        grid.insertAdjacentHTML('beforeend', gridHtml);
    } else {
        grid.innerHTML = gridHtml;
    }
    updateAllWatchlistIcons();
}

async function loadMedia(page = 1, append = false) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const initialLoader = document.querySelector('.loader');
    const scrollLoader = document.getElementById('infinite-scroll-loader');
    
    if (page === 1 && initialLoader) initialLoader.style.display = 'flex';
    if (append && scrollLoader) scrollLoader.style.display = 'flex';
    
    try {
        const data = await discoverMedia(currentMediaType, currentFilters, page);
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
        }
    } catch (error) {
        console.error(`Error loading ${currentMediaType}:`, error);
        hasMore = false;
    } finally {
        isLoading = false;
        if (initialLoader) initialLoader.style.display = 'none';
        if (scrollLoader) scrollLoader.style.display = 'none';
    }
}

function setupInfiniteScroll() {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) return;

    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            loadMedia(currentPage + 1, true);
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

function handleFilterChange(event) {
    const { mediaType, ...filters } = event.detail;
    currentMediaType = mediaType;
    currentFilters = filters;
    
    currentPage = 1;
    hasMore = true;
    
    const grid = document.getElementById('discovery-grid');
    if(grid) grid.innerHTML = '';

    loadMedia(1).then(() => {
        setupInfiniteScroll();
    });
}

export function renderDiscoveryPage(appRoot, params) {
    // Reset state for the page
    currentMediaType = 'movie'; // Default to movies
    currentFilters = {}; 
    currentPage = 1;
    hasMore = true;
    if (observer) observer.disconnect();

    appRoot.innerHTML = `
        <h1 class="shelf-title" id="discovery-title">Discover Films</h1>
        <div class="media-grid" id="discovery-grid"></div>
        <div class="loader"><i class="fas fa-spinner"></i></div>
        <div id="infinite-scroll-loader" class="load-more-container" style="display: none;">
            <div class="loader-small"><i class="fas fa-spinner"></i></div>
        </div>
        <div id="infinite-scroll-sentinel"></div>
    `;
    
    // Listen for filter updates
    document.removeEventListener('filtersApplied', handleFilterChange); // Remove old listener
    document.addEventListener('filtersApplied', handleFilterChange);
    
    loadMedia(1).then(() => {
        setupInfiniteScroll();
    });
}