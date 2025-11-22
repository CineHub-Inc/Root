
import { getTvSeasonDetails, IMAGE_BASE_URL } from '../api.js';
import { formatDate, escapeHTML } from './utils.js';
import { isWatchFeatureUnlocked, watchTvShow } from '../watch-feature.js';
import { 
    isEpisodeWatched,
    markEpisodeAsWatched,
    unmarkEpisodeAsWatched,
    getSeasonWatchedCount,
    markSeasonAsWatched,
    unmarkSeasonAsWatched,
    getTotalWatchedCount,
    getTotalSeriesEpisodes
} from '../watch-progress.js';
import { showToast } from '../toast.js';

let currentSeriesId = null;
let currentSeasonsData = [];

function renderCircularProgressBar(percentage) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    return `
        <div class="series-progress-circle">
            <svg>
                <circle class="circle-bg" cx="45" cy="45" r="${radius}"></circle>
                <circle class="circle-progress" cx="45" cy="45" r="${radius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}">
                </circle>
            </svg>
            <span class="progress-value">${percentage.toFixed(0)}%</span>
        </div>
    `;
}

async function updateProgressUI(seasonNumber) {
    const progressContainer = document.getElementById('season-progress-container');
    if (!progressContainer) return;

    // Total Series Progress
    const totalSeriesEpisodes = getTotalSeriesEpisodes(currentSeasonsData);
    const totalWatchedCount = getTotalWatchedCount(currentSeriesId);
    const totalSeriesPercentage = totalSeriesEpisodes > 0 ? (totalWatchedCount / totalSeriesEpisodes) * 100 : 0;
    const circularProgressBarHtml = renderCircularProgressBar(totalSeriesPercentage);

    // Current Season Progress
    const season = currentSeasonsData.find(s => s.season_number == seasonNumber);
    if (!season) {
        progressContainer.innerHTML = '';
        return;
    }
    const seasonEpisodeCount = season.episode_count;
    const seasonWatchedCount = getSeasonWatchedCount(currentSeriesId, seasonNumber);
    const isSeasonCompleted = seasonWatchedCount === seasonEpisodeCount;

    progressContainer.innerHTML = `
        ${circularProgressBarHtml}
        <div class="series-progress-info">
            <h4>Total Progress</h4>
            <p class="progress-text">${totalWatchedCount} of ${totalSeriesEpisodes} episodes watched</p>
            <button class="season-action-btn" data-action="toggle-season-watched" data-season="${seasonNumber}" data-total="${seasonEpisodeCount}">
                ${isSeasonCompleted ? `Unmark Season ${seasonNumber} as Watched` : `Mark Season ${seasonNumber} as Watched`}
            </button>
        </div>
    `;
}


async function renderEpisodesForSeason(seriesId, seasonNumber) {
    const episodesContent = document.getElementById('episodes-content-data');
    if (!episodesContent) return;
    episodesContent.innerHTML = `<div class="loader-small"><i class="fas fa-spinner"></i></div>`;
    
    await updateProgressUI(seasonNumber);

    try {
        const seasonData = await getTvSeasonDetails(seriesId, seasonNumber);
        if (!seasonData || !seasonData.episodes || seasonData.episodes.length === 0) {
            episodesContent.innerHTML = '<p>No episode information available for this season.</p>';
            return;
        }

        const episodesHtml = seasonData.episodes.map(episode => {
            const watched = isEpisodeWatched(seriesId, seasonNumber, episode.episode_number);
            const name = escapeHTML(episode.name);
            const overview = escapeHTML(episode.overview);
            
            const watchButton = isWatchFeatureUnlocked() ? `
                <div class="episode-actions">
                    <button class="watch-episode-btn"
                        data-series-id="${seriesId}"
                        data-season="${seasonNumber}"
                        data-episode="${episode.episode_number}">
                        <i class="fas fa-play"></i>
                        <span>${watched ? 'Watch Again' : 'Watch'}</span>
                    </button>
                </div>
            ` : '';

            return `
                <div class="episode-card ${watched ? 'watched' : ''}">
                    <div class="episode-thumbnail" 
                         role="button" 
                         tabindex="0"
                         aria-label="${watched ? 'Mark as unwatched' : 'Mark as watched'}"
                         data-series-id="${seriesId}" 
                         data-season="${seasonNumber}" 
                         data-episode="${episode.episode_number}">

                        ${episode.still_path ? `<img src="${IMAGE_BASE_URL}${episode.still_path}" alt="${name}" loading="lazy">` : ''}
                        <div class="watched-overlay">
                           <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <div class="watch-hint-overlay">
                            <i class="fa-solid fa-check"></i>
                        </div>
                    </div>
                    <div class="episode-details">
                        <h4 class="episode-title">${episode.episode_number}. ${name}</h4>
                        <div class="episode-meta">
                            <span><i class="fa-regular fa-calendar"></i> ${formatDate(episode.air_date)}</span>
                            <span><i class="fas fa-star"></i> ${episode.vote_average.toFixed(1)}</span>
                        </div>
                        <p class="episode-overview">${overview || 'No overview available.'}</p>
                        ${watchButton}
                    </div>
                </div>
            `;
        }).join('');

        episodesContent.innerHTML = `<div class="episode-list">${episodesHtml}</div>`;
        
    } catch (error) {
        console.error(`Error fetching episodes for season ${seasonNumber}:`, error);
        episodesContent.innerHTML = '<p>Could not load episodes for this season.</p>';
    }
}

export function renderEpisodesTab(data) {
    if (!data.seasons) return '';
    
    currentSeriesId = data.id;
    currentSeasonsData = data.seasons;
    
    return `
        <div id="episodes-content" class="tab-content">
            <div class="season-selector-container">
                <div class="season-buttons">
                    ${data.seasons.filter(s => s.season_number > 0).map((s, index) => `<button class="season-btn ${index === 0 ? 'active' : ''}" data-season="${s.season_number}">${escapeHTML(s.name)}</button>`).join('')}
                </div>
            </div>
            <div id="season-progress-container"></div>
            <div id="episodes-content-data"></div>
        </div>
    `;
}

export function initEpisodes(seriesId, seasons) {
    const seasonButtonsContainer = document.querySelector('.season-buttons');
    if (seasonButtonsContainer) {
        seasonButtonsContainer.addEventListener('click', async (e) => {
            const button = e.target.closest('.season-btn');
            if (button) {
                seasonButtonsContainer.querySelector('.active').classList.remove('active');
                button.classList.add('active');
                await renderEpisodesForSeason(currentSeriesId, button.dataset.season);
            }
        });
    }

    const episodesContentContainer = document.getElementById('episodes-content');
    if (episodesContentContainer) {
        episodesContentContainer.addEventListener('click', async e => {
            const watchBtn = e.target.closest('.watch-episode-btn');
            const episodeThumbnail = e.target.closest('.episode-thumbnail');
            const seasonToggle = e.target.closest('.season-action-btn[data-action="toggle-season-watched"]');

            if (watchBtn) {
                const { seriesId, season, episode } = watchBtn.dataset;
                await watchTvShow(seriesId, season, episode);
                
                // Optimistic UI update
                const card = watchBtn.closest('.episode-card');
                if (card && !card.classList.contains('watched')) {
                    card.classList.add('watched');
                    updateProgressUI(season);
                    const buttonText = watchBtn.querySelector('span');
                    if (buttonText) buttonText.textContent = 'Watch Again';
                }
                return;
            }

            if (episodeThumbnail) {
                const card = episodeThumbnail.closest('.episode-card');
                const { seriesId, season, episode } = episodeThumbnail.dataset;
                const isWatched = card.classList.contains('watched');
                
                if (isWatched) {
                    await unmarkEpisodeAsWatched(seriesId, season, episode);
                } else {
                    await markEpisodeAsWatched(seriesId, season, episode);
                }
                
                card.classList.toggle('watched');
                episodeThumbnail.setAttribute('aria-label', isWatched ? 'Mark as watched' : 'Mark as unwatched');
                updateProgressUI(season);
                
                const watchButtonSpan = card.querySelector('.watch-episode-btn span');
                if (watchButtonSpan) {
                    watchButtonSpan.textContent = isWatched ? 'Watch' : 'Watch Again';
                }
                return;
            }
            
            if (seasonToggle) {
                const { season, total } = seasonToggle.dataset;
                const seasonWatchedCount = getSeasonWatchedCount(currentSeriesId, season);
                const totalEpisodes = parseInt(total, 10);
                const isSeasonCompleted = !isNaN(totalEpisodes) && seasonWatchedCount === totalEpisodes;

                if (isSeasonCompleted) {
                    await unmarkSeasonAsWatched(currentSeriesId, season);
                    showToast({message: `Season ${season} unmarked as watched.`, type: 'info'});
                } else {
                    await markSeasonAsWatched(currentSeriesId, season, totalEpisodes);
                    showToast({message: `Season ${season} marked as watched.`, type: 'success'});
                }
                
                await renderEpisodesForSeason(currentSeriesId, season);
            }
        });
    }

    const firstSeason = seasons.find(s => s.season_number > 0);
    if (firstSeason) {
        renderEpisodesForSeason(seriesId, firstSeason.season_number);
    }
}
