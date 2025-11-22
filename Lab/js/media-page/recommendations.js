import { getMediaRecommendations } from '../api.js';
import { createMediaCard } from '../ui-components.js';
import { updateAllWatchlistIcons, getLocalWatchlist } from '../watchlist.js';

let currentPage = 1;
let isLoading = false;
let hasMore = true;
let mediaId, mediaType;

// Load initial batch of recommendations
async function loadInitialRecommendations() {
    const grid = document.getElementById('recommendations-grid');
    if (!grid) return;
    
    isLoading = true;
    grid.innerHTML = `<div class="loader-small"><i class="fas fa-spinner"></i></div>`;

    try {
        const data = await getMediaRecommendations(mediaId, mediaType, 1);
        if (grid && data && data.results && data.results.length > 0) {
            const watchlist = getLocalWatchlist();
            const seenIds = new Set(Array.from(watchlist.keys()));

            const filteredResults = data.results.filter(item => {
                const itemType = item.media_type || (item.title ? 'movie' : 'tv');
                return !seenIds.has(`${itemType}:${item.id}`);
            });

            if (filteredResults.length > 0) {
                const gridHtml = filteredResults.map(createMediaCard).join('');
                grid.innerHTML = gridHtml;
                updateAllWatchlistIcons();
                hasMore = data.page < data.total_pages;
                currentPage = data.page;
            } else {
                grid.innerHTML = `<p>No new recommendations found.</p>`;
                hasMore = false;
            }
        } else {
            if (grid) grid.innerHTML = `<p>No recommendations found.</p>`;
            hasMore = false;
        }
    } catch (error) {
        console.error("Error loading recommendations:", error);
        if (grid) grid.innerHTML = `<p>Could not load recommendations.</p>`;
        hasMore = false;
    } finally {
        isLoading = false;
    }
}

// Load more recommendations on scroll
async function loadMoreRecommendations() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    currentPage++;

    const grid = document.getElementById('recommendations-grid');
    if (!grid) {
        isLoading = false;
        return;
    }

    const loader = document.createElement('div');
    loader.className = 'loader-small-infinite';
    loader.innerHTML = '<i class="fas fa-spinner"></i>';
    grid.appendChild(loader);

    try {
        const data = await getMediaRecommendations(mediaId, mediaType, currentPage);
        if (data && data.results && data.results.length > 0) {
            const watchlist = getLocalWatchlist();
            const seenIds = new Set(Array.from(watchlist.keys()));

            const filteredResults = data.results.filter(item => {
                const itemType = item.media_type || (item.title ? 'movie' : 'tv');
                return !seenIds.has(`${itemType}:${item.id}`);
            });

            if (filteredResults.length > 0) {
                const newContent = filteredResults.map(createMediaCard).join('');
                grid.insertAdjacentHTML('beforeend', newContent);
                updateAllWatchlistIcons();
            }
            
            hasMore = data.page < data.total_pages;
        } else {
            hasMore = false;
        }
    } catch (error) {
        console.error("Error loading more recommendations:", error);
        hasMore = false;
    } finally {
        if (grid.contains(loader)) {
            grid.removeChild(loader);
        }
        isLoading = false;
    }
}

function setupHorizontalScroll() {
    const grid = document.getElementById('recommendations-grid');
    if (!grid) return;

    grid.addEventListener('scroll', () => {
        const { scrollLeft, scrollWidth, clientWidth } = grid;
        // Load more when user is 300px from the end
        if (scrollLeft + clientWidth >= scrollWidth - 300) {
            loadMoreRecommendations();
        }
    });
}

export function renderRecommendationsTab() {
    return `
        <div id="recommendations-content" class="tab-content">
            <h2 class="shelf-title">More Like This</h2>
            <div class="media-grid" id="recommendations-grid"></div>
        </div>
    `;
}

export function initRecommendations(id, type) {
    currentPage = 1;
    hasMore = true;
    isLoading = false;
    mediaId = id;
    mediaType = type;
    
    loadInitialRecommendations().then(() => {
        setupHorizontalScroll();
    });
}