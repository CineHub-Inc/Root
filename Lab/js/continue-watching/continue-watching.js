
import { getInProgressSeries, getNextEpisodeToWatch, getTotalWatchedCount, getTotalSeriesEpisodes, clearSeriesWatchProgress, markEpisodeAsWatched, markSeasonAsWatched } from '../watch-progress.js';
import { getMediaDetails, getTvSeasonDetails, IMAGE_BACKDROP_URL } from '../api.js';
import { watchTvShow } from '../watch-feature.js';
import { auth } from '../firebase.js';
import { showToast } from '../toast.js';
import { getLocalWatchlist } from '../watchlist.js';

// Helper to close all menus and reset fixed positioning
const closeMenus = () => {
    const activeMenus = document.querySelectorAll('.cw-actions-menu.is-active');
    activeMenus.forEach(menu => {
        menu.classList.remove('is-active');
        const btn = menu.querySelector('.cw-actions-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        
        // Reset inline styles used for fixed positioning
        const dropdown = menu.querySelector('.cw-actions-dropdown');
        if (dropdown) {
            dropdown.style.position = '';
            dropdown.style.top = '';
            dropdown.style.left = '';
            dropdown.style.width = '';
            dropdown.style.zIndex = '';
        }
    });
};

let listenersAttached = false;

function createContinueWatchingCard({ seriesDetails, episodeData, nextEpisode }) {
    const seriesId = seriesDetails.id;
    const seriesTitle = seriesDetails.name;
    const seasonNum = nextEpisode.seasonNumber;
    const episodeNum = nextEpisode.episodeNumber;

    const episodeTitle = episodeData?.name ? `S${seasonNum} E${episodeNum} - ${episodeData.name}` : `S${seasonNum} E${episodeNum}`;
    const stillPath = episodeData?.still_path ? `${IMAGE_BACKDROP_URL}${episodeData.still_path}` : (seriesDetails.backdrop_path ? `${IMAGE_BACKDROP_URL}${seriesDetails.backdrop_path}` : '');

    const href = `#media?type=tv&id=${seriesId}`;
    
    return `
        <div class="cw-card" data-series-id="${seriesId}">
            <a href="#" class="cw-card-thumbnail-link" 
               data-series-id="${seriesId}" 
               data-season="${seasonNum}" 
               data-episode="${episodeNum}">
                <div class="cw-card-thumbnail" style="background-image: url('${stillPath}')">
                    <div class="cw-play-overlay">
                        <div class="cw-play-button">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
            </a>
            <div class="cw-card-info">
                <div class="cw-info-text">
                    <h4 class="cw-series-title"><a href="${href}">${seriesTitle}</a></h4>
                    <p class="cw-episode-title">${episodeTitle}</p>
                </div>
                <div class="cw-actions-menu">
                    <button class="cw-actions-btn" aria-haspopup="true" aria-expanded="false" aria-label="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="cw-actions-dropdown">
                        <a href="${href}" class="cw-action-item">
                            <i class="fas fa-info-circle"></i><span>Details</span>
                        </a>
                        <button class="cw-action-item remove-from-row">
                            <i class="fas fa-trash-alt"></i><span>Remove</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function renderContinueWatchingShelf(container) {
    if (!auth.currentUser) return;

    // Attach global listeners once to handle closing menus on scroll/resize/click-outside
    if (!listenersAttached) {
        window.addEventListener('scroll', closeMenus, { capture: true });
        window.addEventListener('resize', closeMenus);
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.cw-actions-menu')) {
                closeMenus();
            }
        });
        listenersAttached = true;
    }

    // Filter out 'caught-up' series before processing
    const watchlist = getLocalWatchlist();
    const allInProgress = getInProgressSeries();
    const inProgressSeries = allInProgress.filter(series => {
        const item = watchlist.get(`tv:${series.seriesId}`);
        return !item || item.status !== 'caught-up';
    });

    if (inProgressSeries.length === 0) return;

    const shelfElement = document.createElement('section');
    shelfElement.className = 'shelf cw-shelf';
    shelfElement.innerHTML = `
        <div class="shelf-header">
            <h2 class="shelf-title">Continue Watching</h2>
        </div>
        <div class="shelf-grid-container">
            <div class="loader-small"><i class="fas fa-spinner"></i></div>
        </div>
    `;
    container.prepend(shelfElement);
    const gridContainer = shelfElement.querySelector('.shelf-grid-container');

    const cardDataPromises = inProgressSeries.map(async (series) => {
        try {
            const details = await getMediaDetails(series.seriesId, 'tv');
            if (!details) return null;

            const totalEpisodes = getTotalSeriesEpisodes(details.seasons);
            const watchedCount = getTotalWatchedCount(series.seriesId);

            if (totalEpisodes > 0 && watchedCount >= totalEpisodes) {
                return null; // Skip completed series
            }

            const nextEpisode = getNextEpisodeToWatch(series.seriesId, details.seasons);
            const seasonDetails = await getTvSeasonDetails(series.seriesId, nextEpisode.seasonNumber);
            const episodeData = seasonDetails?.episodes.find(e => e.episode_number === nextEpisode.episodeNumber);

            return {
                seriesDetails: details,
                episodeData: episodeData,
                nextEpisode: nextEpisode,
            };
        } catch (error) {
            console.error(`Failed to get details for continue watching series ${series.seriesId}`, error);
            return null;
        }
    });

    const cardsData = (await Promise.all(cardDataPromises)).filter(Boolean);

    if (cardsData.length === 0) {
        shelfElement.remove();
        return;
    }

    const cardsHtml = cardsData.map(createContinueWatchingCard).join('');
    gridContainer.innerHTML = `<div class="shelf-grid cw-grid">${cardsHtml}</div>`;
    
    // Add event listeners for shelf interactions
    const grid = gridContainer.querySelector('.cw-grid');
    grid.addEventListener('click', async (e) => {
        // --- Menu Handling ---
        const clickedToggleButton = e.target.closest('.cw-actions-btn');
        const clickedMenu = clickedToggleButton ? clickedToggleButton.closest('.cw-actions-menu') : null;
        
        // If we clicked a button, toggle its menu.
        if (clickedMenu) {
            e.preventDefault(); 
            e.stopPropagation();

            const wasActive = clickedMenu.classList.contains('is-active');
            
            closeMenus(); // Close any open menus first

            if (!wasActive) {
                clickedMenu.classList.add('is-active');
                clickedToggleButton.setAttribute('aria-expanded', 'true');

                // --- Fixed Positioning Hack ---
                // We force the dropdown to use position: fixed so it breaks out of the 
                // scrolling container's overflow clipping.
                const dropdown = clickedMenu.querySelector('.cw-actions-dropdown');
                const rect = clickedToggleButton.getBoundingClientRect();
                
                dropdown.style.position = 'fixed';
                // Position top: just below the button
                dropdown.style.top = `${rect.bottom + 5}px`;
                // Position left: Align right edge of dropdown with right edge of button
                // Dropdown is 160px wide.
                dropdown.style.left = `${rect.right - 160}px`;
                dropdown.style.width = '160px';
                dropdown.style.right = 'auto';
                dropdown.style.zIndex = '1100'; // Higher than most UI elements
            }
            return;
        }

        // --- Action Handlers ---
        const removeItemBtn = e.target.closest('.remove-from-row');
        const thumbnail = e.target.closest('.cw-card-thumbnail-link');
        
        // Handle remove button
        if (removeItemBtn) {
            e.preventDefault();
            const card = removeItemBtn.closest('.cw-card');
            const seriesId = card.dataset.seriesId;

            // Close menu immediately
            closeMenus();

            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, width 0.3s ease, margin-right 0.3s ease, padding 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            card.style.width = '0';
            card.style.marginRight = '0';
            card.style.padding = '0';
            
            clearSeriesWatchProgress(seriesId);
            showToast({ message: 'Removed from Continue Watching.', type: 'info' });

            // Wait for animation, then remove. Check if shelf is empty.
            setTimeout(() => {
                if (card.parentNode) {
                    card.remove();
                }
                // Check remaining cards in the grid
                if (grid.querySelectorAll('.cw-card').length === 0) {
                    shelfElement.remove();
                }
            }, 300);
            return;
        }

        // Handle thumbnail click to play. Don't trigger if a button inside was clicked.
        if (thumbnail && !e.target.closest('button')) {
            e.preventDefault();
            const { seriesId, season, episode } = thumbnail.dataset;
            watchTvShow(seriesId, season, episode);
            return;
        }
    });
}
