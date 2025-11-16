import { getInProgressSeries, getNextEpisodeToWatch, getTotalWatchedCount, getTotalSeriesEpisodes, clearSeriesWatchProgress, markEpisodeAsWatched, markSeasonAsWatched } from '../watch-progress.js';
import { getMediaDetails, getTvSeasonDetails, IMAGE_BACKDROP_URL } from '../api.js';
import { watchTvShow } from '../watch-feature.js';
import { auth } from '../firebase.js';
import { showToast } from '../toast.js';

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
                        <i class="fas fa-play"></i>
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

    const inProgressSeries = getInProgressSeries();
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
        
        // Close any menu that isn't the one we just clicked the button for.
        // This handles clicking outside a menu, or clicking a different menu's button.
        grid.querySelectorAll('.cw-actions-menu.is-active').forEach(openMenu => {
            if (openMenu !== clickedMenu) {
                openMenu.classList.remove('is-active');
                openMenu.querySelector('.cw-actions-btn').setAttribute('aria-expanded', 'false');
            }
        });
        
        // If we clicked a button, toggle its menu.
        if (clickedMenu) {
            e.preventDefault(); // Prevent any parent link from firing.
            const isActive = clickedMenu.classList.toggle('is-active');
            clickedToggleButton.setAttribute('aria-expanded', isActive);
        }

        // Sync overflow state for the entire grid.
        const parentShelfGrid = e.target.closest('.shelf-grid');
        if (parentShelfGrid) {
            const anyMenuActive = !!grid.querySelector('.cw-actions-menu.is-active');
            parentShelfGrid.classList.toggle('shelf-grid-overflow-visible', anyMenuActive);
        }

        // --- Action Handlers ---
        const removeItemBtn = e.target.closest('.remove-from-row');
        const thumbnail = e.target.closest('.cw-card-thumbnail-link');
        
        // Handle remove button
        if (removeItemBtn) {
            e.preventDefault();
            const card = removeItemBtn.closest('.cw-card');
            const seriesId = card.dataset.seriesId;

            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, width 0.3s ease, margin-right 0.3s ease, padding 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            card.style.width = '0';
            card.style.marginRight = '0';
            card.style.padding = '0';
            
            clearSeriesWatchProgress(seriesId);
            showToast({ message: 'Removed from Continue Watching.', type: 'info' });

            setTimeout(() => {
                card.remove();
                if (grid.children.length === 0) {
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