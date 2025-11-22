
import { IMAGE_BACKDROP_URL, IMAGE_BASE_URL } from '../api.js';
import { formatRuntime, escapeHTML } from './utils.js';
import { toggleWatchlistMenu } from '../watchlist-menu.js';
import { showTrailer } from '../trailer-modal.js';
import { auth } from '../firebase.js';
import { showAuthModal } from '../auth.js';
import { getItemStatus, updateWatchlistIcon } from '../watchlist.js';
import { isWatchFeatureUnlocked, watchMovie, watchTvShow } from '../watch-feature.js';
import { getNextEpisodeToWatch } from '../watch-progress.js';

function renderScoreCircle(score) {
    const percentage = score * 10;
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return `
        <div class="score-circle">
            <svg>
                <circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                <circle class="circle-progress" cx="25" cy="25" r="${radius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}">
                </circle>
            </svg>
            <span class="score-value">${percentage.toFixed(0)}%</span>
        </div>
    `;
}

export function renderHero(data, mediaType) {
    const backdropUrl = data.backdrop_path ? `${IMAGE_BACKDROP_URL}${data.backdrop_path}` : '';
    const posterUrl = data.poster_path ? `${IMAGE_BASE_URL}${data.poster_path}` : '';
    const title = escapeHTML(data.title || data.name);
    const tagline = escapeHTML(data.tagline);
    const overview = escapeHTML(data.overview);
    const releaseYear = (data.release_date || data.first_air_date)?.substring(0, 4) || 'N/A';
    const runtime = formatRuntime(data.runtime || data.episode_run_time?.[0]);
    const genres = data.genres.map(g => `<span class="genre-tag">${escapeHTML(g.name)}</span>`).join('');

    let networkHtml = '';
    // For TV shows, prioritize the original network
    if (mediaType === 'tv' && data.networks?.length > 0) {
        const network = data.networks[0];
        networkHtml = `<span><i class="fa-solid fa-tv"></i> ${escapeHTML(network.name)}</span>`;
    } 
    // For movies, or as a fallback for TV shows, check streaming providers
    else if (data['watch/providers']?.results?.US?.flatrate?.length > 0) {
        const provider = data['watch/providers'].results.US.flatrate[0];
        networkHtml = `<span><i class="fa-solid fa-play-circle"></i> ${escapeHTML(provider.provider_name)}</span>`;
    }

    let watchButtonHtml = '';
    if (isWatchFeatureUnlocked()) {
        if (mediaType === 'movie') {
            watchButtonHtml = `
                <button id="hero-watch-btn" class="hero-action-btn" data-media-id="${data.id}" data-media-type="movie">
                    <i class="fas fa-play"></i> Watch Now
                </button>
            `;
        } else { // TV show
            const nextEpisode = getNextEpisodeToWatch(data.id, data.seasons);
            const buttonText = nextEpisode.isCompleted ? 'Watch Again' : 'Continue Watching';
            const episodeDetails = nextEpisode.isCompleted ? 'S1 E1' : `S${nextEpisode.seasonNumber} E${nextEpisode.episodeNumber}`;
            
            watchButtonHtml = `
                <button id="hero-watch-btn" class="hero-action-btn" 
                    data-media-id="${data.id}" 
                    data-media-type="tv" 
                    data-season="${nextEpisode.seasonNumber}" 
                    data-episode="${nextEpisode.episodeNumber}">
                    <i class="fas fa-play"></i> 
                    <span>${buttonText}</span>
                    <span class="watch-episode-details">${episodeDetails}</span>
                </button>
            `;
        }
    }

    const trailerButtonHtml = `
        <button id="hero-trailer-btn" class="hero-action-btn ${watchButtonHtml ? 'secondary' : ''}">
            <i class="fa-brands fa-youtube"></i> Watch Trailer
        </button>
    `;

    return `
        <header class="media-hero" style="background-image: url('${backdropUrl}')">
            <div class="media-hero-content">
                <img src="${posterUrl}" alt="${title}" class="media-hero-poster">
                <div class="media-hero-details">
                    <h1 class="media-hero-title">${title}</h1>
                    ${tagline ? `<p class="media-hero-tagline">${tagline}</p>` : ''}
                    <div class="media-hero-meta">
                        ${renderScoreCircle(data.vote_average)}
                        <span class="media-hero-year"><i class="fa-regular fa-calendar"></i> ${releaseYear}</span>
                        ${runtime ? `<span><i class="fas fa-clock"></i> ${runtime}</span>` : ''}
                        ${networkHtml}
                    </div>
                    <div class="media-hero-genres">${genres}</div>
                    <div class="media-hero-overview">
                        <p>${overview || 'No overview available.'}</p>
                    </div>
                    <div class="media-hero-actions">
                        ${watchButtonHtml}
                        ${trailerButtonHtml}
                        <button id="hero-watchlist-btn" class="hero-action-btn secondary watchlist-toggle" data-id="${data.id}" data-type="${mediaType}">
                            <i class="fa-regular fa-bookmark"></i>
                            <span class="watchlist-btn-text">Add to List</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    `;
}

export function setupHeroEventListeners(mediaId, mediaType) {
    const watchlistBtn = document.getElementById('hero-watchlist-btn');
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
             if (!auth.currentUser) {
                showAuthModal();
                return;
            }
            toggleWatchlistMenu(watchlistBtn);
        });
        
        const watchlistBtnText = watchlistBtn.querySelector('.watchlist-btn-text');
        const status = getItemStatus(mediaId, mediaType);
        if (status) {
             watchlistBtnText.textContent = status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        updateWatchlistIcon(mediaId, mediaType);
    }

    const trailerBtn = document.getElementById('hero-trailer-btn');
    if (trailerBtn) {
        trailerBtn.addEventListener('click', () => {
            showTrailer(mediaId, mediaType);
        });
    }

    const watchBtn = document.getElementById('hero-watch-btn');
    if (watchBtn) {
        watchBtn.addEventListener('click', async () => {
            const { mediaId, mediaType, season, episode } = watchBtn.dataset;
            if (mediaType === 'movie') {
                watchMovie(mediaId);
            } else {
                await watchTvShow(mediaId, season, episode);
            }
        });
    }
}
