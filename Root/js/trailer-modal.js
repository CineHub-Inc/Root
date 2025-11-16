import { getMediaVideos } from './api.js';
import { openModal } from './modal.js';

let player; // Keep a reference to the player to allow cleanup if needed

/**
 * Loads the YouTube IFrame Player API script.
 * Returns a promise that resolves when the API is ready.
 */
function loadYouTubeAPI() {
    return new Promise((resolve) => {
        // If API is already loaded, resolve immediately
        if (window.YT && window.YT.Player) {
            return resolve(window.YT);
        }

        // Add the script tag
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // YouTube API calls this global function when it's ready
        window.onYouTubeIframeAPIReady = () => {
            resolve(window.YT);
        };
    });
}

/**
 * YouTube Player onReady event handler.
 * Sets volume to 25% and starts playback.
 * @param {object} event - The onReady event object.
 */
function onPlayerReady(event) {
    event.target.setVolume(25); // Set volume to 25%
    event.target.playVideo();
}

/**
 * Creates a new YouTube player instance.
 * @param {string} videoId - The YouTube video ID.
 */
function createYouTubePlayer(videoId) {
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'rel': 0,
            'controls': 1,
            'showinfo': 0,
            'iv_load_policy': 3,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
        }
    });
}


export async function showTrailer(mediaId, mediaType) {
    openModal('<div class="loader"><i class="fas fa-spinner"></i></div>');

    try {
        const data = await getMediaVideos(mediaId, mediaType);
        const officialTrailer = data?.results?.find(video => 
            video.site === 'YouTube' && 
            (video.type === 'Trailer' || video.type === 'Teaser') &&
            video.official
        ) || data?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer');

        if (officialTrailer) {
            const contentHtml = `
                <div class="trailer-container">
                    <div id="youtube-player"></div>
                </div>
            `;
            // Open modal with a special class for video styling
            openModal(contentHtml, 'video-modal'); 
            
            // Load API and create player
            await loadYouTubeAPI();
            createYouTubePlayer(officialTrailer.key);
            
        } else {
            openModal('<p class="no-content-message">No trailer available for this title.</p>');
        }
    } catch (error) {
        console.error('Error fetching trailer:', error);
        openModal('<p class="no-content-message">Could not load trailer.</p>');
    }
}
