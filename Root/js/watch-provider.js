import { db, auth } from './firebase.js';
import { doc, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './toast.js';
import { isWatchFeatureEnabled } from './user-state.js';
import { getLocalWatchlist } from './watchlist.js';

const BASE_URL = 'https://vidsrc.to/embed/';

async function updateProgress(seriesId, season, episode) {
    const user = auth.currentUser;
    if (!user) return;

    const watchlistRef = doc(db, "watchlists", user.uid);
    const seasonKey = `s${season}`;

    try {
        // Ensure the nested objects exist before using arrayUnion
        const watchlist = getLocalWatchlist();
        const userDoc = watchlist[user.uid] || { watchedProgress: {} };
        if (!userDoc.watchedProgress) userDoc.watchedProgress = {};
        if (!userDoc.watchedProgress[seriesId]) userDoc.watchedProgress[seriesId] = {};

        await setDoc(watchlistRef, { 
            watchedProgress: {
                [seriesId]: {
                    [seasonKey]: arrayUnion(parseInt(episode))
                }
            }
        }, { merge: true });

    } catch (error) {
        console.error("Failed to update watch progress:", error);
    }
}


function handleWatchClick(event) {
    const watchButton = event.target.closest('[data-action="watch"]');
    if (!watchButton) return;
    
    event.preventDefault();
    event.stopPropagation();

    if (!isWatchFeatureEnabled()) {
        showToast({ message: 'This feature is not enabled for your account.', type: 'info' });
        return;
    }

    const { mediaId, mediaType, seasonNumber, episodeNumber } = watchButton.dataset;

    let url;
    if (mediaType === 'movie') {
        url = `${BASE_URL}movie/${mediaId}`;
    } else if (mediaType === 'tv') {
        const season = seasonNumber || '1';
        const episode = episodeNumber || '1';
        url = `${BASE_URL}tv/${mediaId}/${season}/${episode}`;
        updateProgress(mediaId, season, episode);
    }

    if (url) {
        window.open(url, '_blank');
    }
}


export function initWatchProvider() {
    // Use a single delegated listener on the body for all watch clicks
    document.body.addEventListener('click', handleWatchClick);
}
