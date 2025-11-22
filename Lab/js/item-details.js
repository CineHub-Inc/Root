
import { getMediaDetails } from './api.js';
import { auth } from './firebase.js';
import { showAuthModal } from './auth.js';
import { updateItemStatus, getItemStatus } from './watchlist.js';
import { showToast } from './toast.js';
import { showRatingModal } from './rating-system/rating-modal.js';
import { escapeHTML } from './media-page/utils.js';

const appRoot = document.getElementById('app-root');

/**
 * Formats minutes into a "Xh Ym" string.
 * @param {number} minutes - The total number of minutes.
 * @returns {string} - The formatted string.
 */
function formatRuntime(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
}

/**
 * Populates the media card overlay with detailed data.
 * @param {HTMLElement} card - The media card element.
 * @param {object} data - The detailed data from the API.
 * @param {string} mediaType - The type of media ('movie' or 'tv').
 */
function populateOverlay(card, data, mediaType) {
    const primaryMetadata = card.querySelector('.primary-metadata');
    const detailsList = card.querySelector('.details-list');
    const statusTagPlaceholder = card.querySelector('.status-tag-placeholder');

    if (!primaryMetadata || !detailsList || !statusTagPlaceholder) return;

    // --- Primary Metadata ---
    const year = (data.release_date || data.first_air_date)?.substring(0, 4) || 'N/A';
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'NR';
    primaryMetadata.innerHTML = `
        <span class="year">${escapeHTML(year)}</span>
        <span class="rating"><i class="fas fa-star"></i> ${rating}</span>
    `;

    // --- Details List ---
    let detailsHtml = '';
    
    let countryName = '';
    if (data.production_countries?.length > 0) {
        countryName = data.production_countries[0].name;
    } else if (data.origin_country?.length > 0) {
        try {
            // Convert ISO 3166-1 code to full region name
            countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(data.origin_country[0]);
        } catch (e) {
            countryName = data.origin_country[0]; // Fallback to code on error
        }
    }

    if (countryName === 'United States of America') {
        countryName = 'USA';
    }

    if (countryName) {
        detailsHtml += `<li><i class="fa-solid fa-earth-americas"></i> ${escapeHTML(countryName)}</li>`;
    }

    if (data.original_language) {
        const lang = new Intl.DisplayNames(['en'], { type: 'language' }).of(data.original_language);
        if(lang) detailsHtml += `<li><i class="fa-regular fa-message"></i> ${escapeHTML(lang)}</li>`;
    }
    if (data.genres && data.genres.length > 0) {
        detailsHtml += `<li><i class="fa-solid fa-clapperboard"></i> ${data.genres.map(g => escapeHTML(g.name)).slice(0, 2).join(', ')}</li>`;
    }
    
    // --- TV Series Specific Details ---
    if (mediaType === 'tv') {
        if (data.number_of_seasons) {
            const seasonText = data.number_of_seasons > 1 ? 'Seasons' : 'Season';
            detailsHtml += `<li><i class="fa-regular fa-rectangle-list"></i> ${data.number_of_seasons} ${seasonText}</li>`;
        }
        if (data.networks && data.networks.length > 0) {
            detailsHtml += `<li><i class="fa-solid fa-tv"></i> ${escapeHTML(data.networks[0].name)}</li>`;
        }
    }
    
    // --- Movie Specific Details ---
    if (mediaType === 'movie' && data.runtime) {
        detailsHtml += `<li><i class="fa-regular fa-clock"></i> ${formatRuntime(data.runtime)}</li>`;
    }

    detailsList.innerHTML = detailsHtml;

    // --- Status Tag (TV Only) ---
    if (mediaType === 'tv' && data.status) {
        let statusText = data.status;
        let statusClass = '';
        
        if (statusText === 'Returning Series') {
            statusClass = 'returning';
            statusText = 'Returning';
        } else if (statusText === 'Ended' || statusText === 'Canceled') {
            statusClass = 'ended';
        } else if (statusText === 'In Production') {
            statusClass = 'in-production';
        } else if (statusText === 'On Air') {
            statusClass = 'on-air';
        }

        if (statusClass) {
            statusTagPlaceholder.innerHTML = `<div class="status-tag ${statusClass}">${escapeHTML(statusText)}</div>`;
        }
    }
}


/**
 * Fetches and loads details for a media card on hover.
 * @param {HTMLElement} card - The media card element.
 */
async function loadMediaDetails(card) {
    if (card.dataset.detailsLoaded === 'true') return;
    
    const mediaId = card.dataset.id;
    const mediaType = card.dataset.type;

    if (!mediaId || !mediaType) return;
    
    // Prevent multiple fetches
    card.dataset.detailsLoaded = 'true';

    try {
        const data = await getMediaDetails(mediaId, mediaType);
        if (data) {
            populateOverlay(card, data, mediaType);
        } else {
             card.dataset.detailsLoaded = 'error'; // Mark as error to prevent retries
        }
    } catch (error) {
        console.error(`Failed to load details for ${mediaType} ID ${mediaId}:`, error);
        card.dataset.detailsLoaded = 'error';
    }
}

let hoverTimer = null;

// Use event delegation for hover events with a delay
appRoot.addEventListener('mouseover', (event) => {
    const card = event.target.closest('.media-card');
    // Check if we are entering the card from outside to simulate mouseenter
    if (card && (!event.relatedTarget || !card.contains(event.relatedTarget))) {
        hoverTimer = setTimeout(() => {
            loadMediaDetails(card);
            card.classList.add('details-visible');
        }, 300); // 300ms delay
    }
});

appRoot.addEventListener('mouseout', (event) => {
    const card = event.target.closest('.media-card');
    // Check if we are leaving the card to go outside to simulate mouseleave
    if (card && (!event.relatedTarget || !card.contains(event.relatedTarget))) {
        clearTimeout(hoverTimer);
        card.classList.remove('details-visible');
    }
});

async function handleWatchlistActionFeedback(card, mediaId, mediaType, newStatus, previousStatus) {
    const toastMessages = {
        watchlist: 'Added to Watchlist',
        watched: 'Marked as Watched',
        not_interested: 'Hidden from recommendations',
        remove: 'Removed from list'
    };

    const isLibraryPage = !!document.getElementById('library-search');
    const isPersonPage = card ? !!card.closest('.person-page-container') : false;
    
    const toastOptions = {
        message: toastMessages[newStatus] || 'List updated',
        type: 'success',
    };

    // Add rating action if applicable
    if (newStatus === 'watched') {
        toastOptions.actions = [{
            text: 'Rate It',
            className: 'toast-rate-btn',
            callback: () => showRatingModal(mediaId, mediaType)
        }];
    }

    // Case 1: Library page - Global event listener in app.js will handle re-render
    if (isLibraryPage) {
        if (card) {
            const cardLink = card.closest('a.media-card-link');
             if (cardLink) {
                // Visual removal cue before the grid refreshes
                cardLink.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                cardLink.style.opacity = '0';
                cardLink.style.transform = 'scale(0.9)';
            }
        }
        showToast(toastOptions); // Show simple toast without undo
        return;
    }
    
    // Case 2: Person page - just show a toast, no DOM manipulation
    if (isPersonPage) {
        showToast(toastOptions);
        return;
    }
    
    // Case 3: Discovery pages (includes shelves and grids)
    // If an item is added to a list, remove it from the discovery view.
    if (newStatus !== 'remove' && card) {
        const cardLink = card.closest('a.media-card-link');
        const shelfGrid = card.closest('.shelf-grid');

        // Define Undo logic
        toastOptions.onUndo = async () => {
            const undoSuccess = await updateItemStatus(mediaId, mediaType, previousStatus);
            if (undoSuccess) {
                showToast({ message: 'Action undone. Item restored to list.', type: 'info' });
                // Note: We don't need to manually restore display here, 
                // updateAllWatchlistIcons (via global listener) will handle removing the hidden class
                // when the item is removed from the watchlist.
            } else {
                showToast({ message: 'Could not undo.', type: 'error' });
            }
        };

        if (shelfGrid && typeof shelfGrid.fetchReplacement === 'function') {
            // Sub-case 3a: Shelf with replacement logic
            if (cardLink) {
                cardLink.style.transition = 'opacity 0.3s ease, width 0.3s ease, margin 0.3s ease, padding 0.3s ease';
                cardLink.style.opacity = '0';
                cardLink.style.width = '0';
                cardLink.style.margin = '0';
                cardLink.style.padding = '0';
                
                setTimeout(() => {
                    // Use class to hide instead of remove, allowing restoration
                    cardLink.classList.add('hidden-in-discovery');
                    // Reset styles so it appears correctly if shown again
                    cardLink.style.opacity = '';
                    cardLink.style.width = '';
                    cardLink.style.margin = '';
                    cardLink.style.padding = '';
                    
                    shelfGrid.fetchReplacement();
                }, 300);
            }
        } else if (cardLink) {
            // Sub-case 3b: Normal grid (films/series page), hide and request replacement
            cardLink.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            cardLink.style.opacity = '0';
            cardLink.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (cardLink.style.opacity === '0') {
                    cardLink.classList.add('hidden-in-discovery');
                    // Reset styles
                    cardLink.style.opacity = '';
                    cardLink.style.transform = '';
                    
                    const grid = cardLink.closest('.media-grid');
                    if (grid) {
                        const event = new CustomEvent('request-grid-replacement', {
                            bubbles: true,
                            detail: { gridId: grid.id }
                        });
                        grid.dispatchEvent(event);
                    }
                }
            }, 300);
        }
    }
    showToast(toastOptions);
}


appRoot.addEventListener('click', async (event) => {
    const card = event.target.closest('.media-card');
    if (!card) return;

    if (card.closest('.modal-container')) return;

    const button = event.target.closest('.action-button');
    const mediaId = card.dataset.id;
    const mediaType = card.dataset.type;

    if (button) { // An action button was clicked
        event.preventDefault();
        event.stopPropagation();

        if (!auth.currentUser) {
            showAuthModal();
            return;
        }

        if (button.dataset.action === 'rate') {
            const itemOnList = getItemStatus(mediaId, mediaType);
            if (!itemOnList) {
                showToast({ message: 'Add this item to a list to rate it.', type: 'info' });
                return;
            }
            showRatingModal(mediaId, mediaType);
            return;
        }

        if (button.dataset.status) {
            const clickedStatus = button.dataset.status;
            const previousStatus = getItemStatus(mediaId, mediaType) || 'remove';
            const newStatus = button.classList.contains('active') ? 'remove' : clickedStatus;
            
            const success = await updateItemStatus(mediaId, mediaType, newStatus);

            if (success) {
                handleWatchlistActionFeedback(card, mediaId, mediaType, newStatus, previousStatus);
            } else {
                showToast({ message: 'Could not update list', type: 'error' });
            }
            return;
        }
    }
});
