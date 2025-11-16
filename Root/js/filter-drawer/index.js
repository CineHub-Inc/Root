import { renderMediaTypeFilter } from './filter-media-type.js';
import { renderYearsFilter } from './filter-years.js';
import { renderRatingFilter } from './filter-rating.js';

let drawerOverlay = null;
let currentFilters = {
    mediaType: 'movie'
};

function createDrawer() {
    if (document.getElementById('filter-drawer-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'filter-drawer-overlay';
    overlay.className = 'filter-drawer-overlay';
    overlay.innerHTML = `
        <div class="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-title">
            <header class="filter-drawer-header">
                <h2 id="filter-drawer-title" class="filter-drawer-title">Filters</h2>
                <button class="filter-drawer-close" aria-label="Close Filters">&times;</button>
            </header>
            <div class="filter-drawer-content">
                <div id="media-type-filter-container"></div>
                <div id="years-filter-container"></div>
                <div id="rating-filter-container"></div>
            </div>
            <footer class="filter-drawer-footer">
                <button class="apply-filters-btn">Apply Filters</button>
            </footer>
        </div>
    `;
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    // Event listeners
    drawerOverlay.addEventListener('click', (event) => {
        if (event.target === drawerOverlay) closeDrawer();
    });
    drawerOverlay.querySelector('.filter-drawer-close').addEventListener('click', closeDrawer);
    drawerOverlay.querySelector('.apply-filters-btn').addEventListener('click', applyFilters);

    // Listen for changes from individual filter components
    drawerOverlay.addEventListener('filterChanged', handleFilterChange);
}

function openDrawer() {
    if (!drawerOverlay) createDrawer();
    document.body.style.overflow = 'hidden';
    drawerOverlay.classList.add('is-visible');
}

function closeDrawer() {
    if (!drawerOverlay) return;
    document.body.style.overflow = '';
    drawerOverlay.classList.remove('is-visible');
}

function handleFilterChange(e) {
    // Update the central filters object
    currentFilters = { ...currentFilters, ...e.detail };

    // When media type changes, we need to update other filters
    if (e.detail.mediaType) {
        const yearsContainer = drawerOverlay.querySelector('#years-filter-container');
        renderYearsFilter(yearsContainer, currentFilters.mediaType);
    }
}

function applyFilters() {
    // Update discovery page title
    const discoveryTitle = document.getElementById('discovery-title');
    if (discoveryTitle) {
        discoveryTitle.textContent = currentFilters.mediaType === 'movie' ? 'Discover Films' : 'Discover TV Series';
    }

    const filtersAppliedEvent = new CustomEvent('filtersApplied', {
        detail: { ...currentFilters }
    });
    document.dispatchEvent(filtersAppliedEvent);
    closeDrawer();
}

function renderFilters() {
    const mediaTypeContainer = drawerOverlay.querySelector('#media-type-filter-container');
    const yearsContainer = drawerOverlay.querySelector('#years-filter-container');
    const ratingContainer = drawerOverlay.querySelector('#rating-filter-container');

    renderMediaTypeFilter(mediaTypeContainer, currentFilters.mediaType);
    renderYearsFilter(yearsContainer, currentFilters.mediaType);
    renderRatingFilter(ratingContainer);
}

export function initFilterDrawer() {
    createDrawer();
    const filterBtn = document.getElementById('global-filter-btn');
    
    // Detach any old listeners before adding a new one
    const newFilterBtn = filterBtn.cloneNode(true);
    filterBtn.parentNode.replaceChild(newFilterBtn, filterBtn);

    newFilterBtn.addEventListener('click', () => {
        // Reset to a clean state each time it's opened
        currentFilters = {
            mediaType: 'movie'
        };
        renderFilters();
        openDrawer();
    });
}