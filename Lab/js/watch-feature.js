
import { auth } from './firebase.js';
import { markEpisodeAsWatched } from './watch-progress.js';
import { getCurrentUserDoc } from './user-state.js';
import { showToast } from './toast.js';
import { WATCH_EMBED_BASE_URL } from './config.js';

export function isWatchFeatureUnlocked() {
    const user = auth.currentUser;
    if (!user) return false;
    
    // Check for feature unlock from user document in Firestore.
    const userData = getCurrentUserDoc();
    
    if (userData && userData.powerUserExpiresAt) {
        // Firestore timestamp needs to be converted to a Date object
        // Safety check: ensure toDate method exists and handles different formats
        try {
            let expiryDate;
            if (typeof userData.powerUserExpiresAt.toDate === 'function') {
                expiryDate = userData.powerUserExpiresAt.toDate();
            } else if (userData.powerUserExpiresAt instanceof Date) {
                expiryDate = userData.powerUserExpiresAt;
            } else if (typeof userData.powerUserExpiresAt === 'string') {
                expiryDate = new Date(userData.powerUserExpiresAt);
            } else {
                return false;
            }
            
            return expiryDate > new Date();
        } catch (e) {
            console.error("Error parsing expiry date", e);
            return false;
        }
    }
    
    return false;
}

export function watchMovie(tmdbId) {
    if (!isWatchFeatureUnlocked()) return;
    const url = `${WATCH_EMBED_BASE_URL}movie/${tmdbId}`;
    const newTab = window.open(url, '_blank');
    if (!newTab) {
        showToast({ message: 'Please allow pop-ups for this site to watch content.', type: 'error' });
    }
}

export async function watchTvShow(tmdbId, seasonNumber, episodeNumber) {
    if (!isWatchFeatureUnlocked()) return;

    // Open the new tab IMMEDIATELY in response to the user click to avoid pop-up blockers.
    const url = `${WATCH_EMBED_BASE_URL}tv/${tmdbId}/${seasonNumber}/${episodeNumber}`;
    const newTab = window.open(url, '_blank');

    if (!newTab) {
        // Pop-up was blocked. Inform the user and do not proceed.
        showToast({ message: 'Please allow pop-ups for this site to watch content.', type: 'error' });
        return;
    }
    
    // Now, update the watch progress in the background.
    await markEpisodeAsWatched(tmdbId, seasonNumber, episodeNumber);
}
