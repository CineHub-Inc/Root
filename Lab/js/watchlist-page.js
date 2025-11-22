
import { getLocalWatchlist, updateAllWatchlistIcons, updateWatchlistOrder } from './watchlist.js';
import { getMediaDetails } from './api.js';
import { createMediaCard } from './ui-components.js';
import { showToast } from './toast.js';

function applyLibraryFilters(appRoot) {
    const activeFilter = appRoot.querySelector('.chip.active')?.dataset.filter;
    const activeMediaType = appRoot.querySelector('.media-tab.active')?.dataset.mediaType || 'all';
    const searchTerm = appRoot.querySelector('#library-search')?.value.toLowerCase() || '';
    const mediaCards = appRoot.querySelectorAll('.media-card');
    const emptyMessage = appRoot.querySelector('.library-empty');
    const grid = appRoot.querySelector('.media-grid');

    let visibleCount = 0;

    mediaCards.forEach(card => {
        const statusMatch = card.dataset.status === activeFilter;
        const titleMatch = card.dataset.title.toLowerCase().includes(searchTerm);
        const typeMatch = activeMediaType === 'all' || card.dataset.type === activeMediaType;

        const wrapper = card.closest('a.media-card-link');

        if (statusMatch && titleMatch && typeMatch) {
            if (wrapper) wrapper.style.display = ''; else card.style.display = '';
            visibleCount++;
        } else {
            if (wrapper) wrapper.style.display = 'none'; else card.style.display = 'none';
        }
    });

    if (emptyMessage) {
        if (visibleCount === 0) {
            emptyMessage.textContent = 'No items match your search or filter.';
            emptyMessage.style.display = 'block';
            if (grid) grid.style.display = 'none';
        } else {
            emptyMessage.style.display = 'none';
            if (grid) grid.style.display = 'grid';
        }
    }
}


function setupLibraryInteractions(appRoot) {
    const chips = appRoot.querySelectorAll('.chip');
    const searchInput = appRoot.querySelector('#library-search');
    const mediaTabsContainer = appRoot.querySelector('.library-media-tabs');

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            appRoot.querySelector('.chip.active').classList.remove('active');
            chip.classList.add('active');
            applyLibraryFilters(appRoot);
        });
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyLibraryFilters(appRoot);
        });
    }

    if (mediaTabsContainer) {
        mediaTabsContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.media-tab');
            if (!clickedTab || clickedTab.classList.contains('active')) return;

            mediaTabsContainer.querySelector('.media-tab.active').classList.remove('active');
            clickedTab.classList.add('active');
            applyLibraryFilters(appRoot);
        });
    }
}

function initSortableGrid(gridContainer, appRoot) {
    if (!gridContainer || gridContainer.children.length < 2) return;

    if (typeof Sortable === 'undefined') {
        console.warn('SortableJS not loaded. Drag and drop disabled.');
        return;
    }

    new Sortable(gridContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        delay: 300, // Add delay to prevent accidental drags on click
        
        onEnd: async function (evt) {
            const orderedLinks = [...evt.to.querySelectorAll('a.media-card-link')];
            const orderedIds = orderedLinks.map(link => {
                const card = link.querySelector('.media-card');
                return `${card.dataset.type}:${card.dataset.id}`;
            });
            
            const success = await updateWatchlistOrder(orderedIds);

            if (!success) {
                showToast({ message: 'Failed to save order. Reverting.', type: 'error' });
                const currentActiveFilter = appRoot.querySelector('.chip.active')?.dataset.filter || 'watchlist';
                const currentActiveMediaType = appRoot.querySelector('.media-tab.active')?.dataset.mediaType || 'all';
                renderLibraryPage(appRoot, { activeFilter: currentActiveFilter, activeMediaType: currentActiveMediaType });
            }
        },
    });
}


export async function renderLibraryPage(appRoot, params = {}) {
    const { activeFilter = 'watchlist', activeMediaType = 'all', isRefresh = false } = params;
    const watchlistMap = getLocalWatchlist();

    // Preserve scroll position if refreshing
    let scrollPos = 0;
    if (isRefresh) {
        scrollPos = window.scrollY;
    }

    const headerHtml = `
        <div class="page-header">
            <h1 class="shelf-title">My Library</h1>
        </div>
    `;

    const controlsHtml = `
        <div class="library-controls">
            <div class="filter-chips">
                <button class="chip ${activeFilter === 'watchlist' ? 'active' : ''}" data-filter="watchlist">Watchlist</button>
                <button class="chip ${activeFilter === 'caught-up' ? 'active' : ''}" data-filter="caught-up">Caught Up</button>
                <button class="chip ${activeFilter === 'watched' ? 'active' : ''}" data-filter="watched">Watched</button>
                <button class="chip ${activeFilter === 'not_interested' ? 'active' : ''}" data-filter="not_interested">Hidden</button>
            </div>
            <input type="search" id="library-search" placeholder="Search your library...">
        </div>
    `;
    
    const tabsHtml = `
        <div class="media-tabs library-media-tabs">
            <button class="media-tab ${activeMediaType === 'all' ? 'active' : ''}" data-media-type="all">All</button>
            <button class="media-tab ${activeMediaType === 'movie' ? 'active' : ''}" data-media-type="movie">Films</button>
            <button class="media-tab ${activeMediaType === 'tv' ? 'active' : ''}" data-media-type="tv">TV Series</button>
        </div>
    `;

    const itemsOnLists = Array.from(watchlistMap.values()).filter(item => ['watchlist', 'watched', 'not_interested', 'caught-up'].includes(item.status));

    if (itemsOnLists.length === 0) {
        appRoot.innerHTML = `
            ${headerHtml}
            <p class="library-empty">Your library is empty. Browse and add movies or shows!</p>
        `;
        return;
    }
    
    // Only show loader if not refreshing in-place
    if (!isRefresh) {
        appRoot.innerHTML = `${headerHtml}${controlsHtml}${tabsHtml}<div class="loader"><i class="fas fa-spinner"></i></div>`;
    }

    try {
        const sortedItems = Array.from(watchlistMap.entries()).sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

        const promises = sortedItems.map(([itemString]) => {
            const [type, id] = itemString.split(':');
            return getMediaDetails(id, type);
        });

        const mediaDetailsResults = await Promise.all(promises);
        
        const mediaDetailsMap = new Map(mediaDetailsResults.filter(Boolean).map(d => [`${d.first_air_date ? 'tv' : 'movie'}:${d.id}`, d]));

        if (mediaDetailsMap.size === 0) {
             appRoot.innerHTML = `
                ${headerHtml}
                ${controlsHtml}
                ${tabsHtml}
                <p class="library-empty">Could not load details for items in your library.</p>
            `;
            return;
        }

        const gridHtml = sortedItems.map(([itemString, itemData]) => {
            const media = mediaDetailsMap.get(itemString);
            if (!media) return '';

            return createMediaCard(media, {
                draggable: true,
                cardDataAttrs: { status: itemData.status }
            });
        }).join('');

        appRoot.innerHTML = `
            ${headerHtml}
            ${controlsHtml}
            ${tabsHtml}
            <div class="media-grid">${gridHtml}</div>
            <p class="library-empty" style="display: none;"></p>
        `;
        
        updateAllWatchlistIcons();
        setupLibraryInteractions(appRoot);
        applyLibraryFilters(appRoot);

        const grid = appRoot.querySelector('.media-grid');
        initSortableGrid(grid, appRoot);

        // Restore scroll position
        if (isRefresh) {
            window.scrollTo(0, scrollPos);
        }

    } catch (error) {
        console.error("Failed to render library:", error);
        appRoot.innerHTML = `
            ${headerHtml}
            ${controlsHtml}
            ${tabsHtml}
            <p class="library-empty">Could not load your library. Please try again later.</p>
        `;
    }
}
