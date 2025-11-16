import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const WATCH_PROGRESS_COLLECTION = 'watchProgress';
let localWatchProgress = {};
let unsubscribeProgress = null;

export function initWatchProgressSync() {
    if (unsubscribeProgress) {
        unsubscribeProgress();
        unsubscribeProgress = null;
    }
    const user = auth.currentUser;
    if (!user) {
        localWatchProgress = {};
        return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
        const docRef = doc(db, WATCH_PROGRESS_COLLECTION, user.uid);
        let isFirstLoad = true;

        unsubscribeProgress = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                localWatchProgress = docSnap.data();
            } else {
                localWatchProgress = {};
            }
            // Dispatch a global event so the UI can react
            document.dispatchEvent(new CustomEvent('user-data-updated'));
            
            if (isFirstLoad) {
                isFirstLoad = false;
                resolve();
            }
        }, (error) => {
            console.error("Watch progress sync error:", error);
            if (isFirstLoad) {
                isFirstLoad = false;
                reject(error); // Reject on error during initial load
            }
        });
    });
}

export function detachWatchProgressSync() {
    if (unsubscribeProgress) {
        unsubscribeProgress();
        unsubscribeProgress = null;
    }
    localWatchProgress = {};
}

function getWatchedProgress() {
    return localWatchProgress;
}

async function saveWatchedProgress(progress) {
    const user = auth.currentUser;
    if (!user) return;
    // Don't update local state here; the onSnapshot listener will handle it.
    const docRef = doc(db, WATCH_PROGRESS_COLLECTION, user.uid);
    try {
        await setDoc(docRef, progress);
    } catch (error) {
        console.error("Error saving watch progress:", error);
    }
}


/**
 * Checks if a series is complete and updates its main status to 'watched' if so.
 * Uses dynamic imports to avoid circular dependencies with watchlist.js.
 * @param {string} seriesId The TMDB ID of the series.
 */
async function checkAndMarkSeriesAsWatched(seriesId) {
    try {
        const { getMediaDetails } = await import('./api.js');
        const { updateItemStatus, getItemStatus } = await import('./watchlist.js');

        const currentStatus = getItemStatus(seriesId, 'tv');
        if (currentStatus === 'watched') {
            return; // Already marked as watched, no action needed.
        }

        const details = await getMediaDetails(seriesId, 'tv');
        if (!details || !details.seasons) return;

        const totalEpisodes = getTotalSeriesEpisodes(details.seasons);
        const watchedCount = getTotalWatchedCount(seriesId);

        if (totalEpisodes > 0 && watchedCount >= totalEpisodes) {
            updateItemStatus(seriesId, 'tv', 'watched');
        }
    } catch (error) {
        console.error("Error checking for series completion:", error);
    }
}

export async function markEpisodeAsWatched(seriesId, seasonNumber, episodeNumber) {
    const progress = getWatchedProgress();
    const seriesProgress = progress[seriesId] || {};
    const seasonKey = `s${seasonNumber}`;
    
    const seasonEpisodes = new Set(seriesProgress[seasonKey] || []);
    seasonEpisodes.add(parseInt(episodeNumber, 10));
    
    seriesProgress[seasonKey] = Array.from(seasonEpisodes).sort((a, b) => a - b);
    seriesProgress.lastWatchedTimestamp = Date.now();
    progress[seriesId] = seriesProgress;
    await saveWatchedProgress(progress);
    
    checkAndMarkSeriesAsWatched(seriesId);
}

export async function unmarkEpisodeAsWatched(seriesId, seasonNumber, episodeNumber) {
    const progress = getWatchedProgress();
    if (!progress[seriesId]) return;
    const seasonKey = `s${seasonNumber}`;
    if (!progress[seriesId][seasonKey]) return;
    const seasonEpisodes = new Set(progress[seriesId][seasonKey]);
    seasonEpisodes.delete(parseInt(episodeNumber, 10));
    if (seasonEpisodes.size === 0) {
        delete progress[seriesId][seasonKey];
        if (Object.keys(progress[seriesId]).length <= 1 && progress[seriesId].lastWatchedTimestamp) { // only timestamp left
            delete progress[seriesId];
        }
    } else {
        progress[seriesId][seasonKey] = Array.from(seasonEpisodes).sort((a, b) => a - b);
    }
    await saveWatchedProgress(progress);
}

export function isEpisodeWatched(seriesId, seasonNumber, episodeNumber) {
    const progress = getWatchedProgress();
    const seriesProgress = progress[seriesId] || {};
    const seasonKey = `s${seasonNumber}`;
    const seasonEpisodes = seriesProgress[seasonKey] || [];
    return seasonEpisodes.includes(parseInt(episodeNumber, 10));
}

export function getSeasonWatchedCount(seriesId, seasonNumber) {
    const progress = getWatchedProgress();
    const seriesProgress = progress[seriesId] || {};
    const seasonKey = `s${seasonNumber}`;
    return (seriesProgress[seasonKey] || []).length;
}

export async function markSeasonAsWatched(seriesId, seasonNumber, totalEpisodes) {
    const progress = getWatchedProgress();
    if (!progress[seriesId]) progress[seriesId] = {};
    const seasonKey = `s${seasonNumber}`;
    progress[seriesId][seasonKey] = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    progress[seriesId].lastWatchedTimestamp = Date.now();
    await saveWatchedProgress(progress);
    
    checkAndMarkSeriesAsWatched(seriesId);
}

export async function unmarkSeasonAsWatched(seriesId, seasonNumber) {
     const progress = getWatchedProgress();
    if (!progress[seriesId]) return;
    const seasonKey = `s${seasonNumber}`;
    if (progress[seriesId][seasonKey]) {
        delete progress[seriesId][seasonKey];
        if (Object.keys(progress[seriesId]).length <= 1 && progress[seriesId].lastWatchedTimestamp) { // only timestamp left
            delete progress[seriesId];
        }
    }
    await saveWatchedProgress(progress);
}

export async function clearSeriesWatchProgress(seriesId) {
    const progress = getWatchedProgress();
    if (progress[seriesId]) {
        delete progress[seriesId];
        await saveWatchedProgress(progress);
    }
}

export function getTotalWatchedCount(seriesId) {
    const progress = getWatchedProgress();
    const seriesProgress = progress[seriesId] || {};
    let total = 0;
    for (const seasonKey in seriesProgress) {
        if (seasonKey !== 'lastWatchedTimestamp') {
            total += (seriesProgress[seasonKey] || []).length;
        }
    }
    return total;
}

export function getTotalSeriesEpisodes(seasons) {
    if (!seasons) return 0;
    return seasons
        .filter(s => s.season_number > 0) // Exclude "Specials"
        .reduce((acc, season) => acc + (season.episode_count || 0), 0);
}

export function getNextEpisodeToWatch(seriesId, seasons) {
    if (!seasons || seasons.length === 0) {
        return { seasonNumber: 1, episodeNumber: 1, isCompleted: false };
    }

    const progress = getWatchedProgress();
    const seriesProgress = progress[seriesId] || {};

    const validSeasons = seasons
        .filter(s => s.season_number > 0 && s.episode_count > 0)
        .sort((a, b) => a.season_number - b.season_number);

    if (validSeasons.length === 0) {
        return { seasonNumber: 1, episodeNumber: 1, isCompleted: false };
    }

    for (const season of validSeasons) {
        const seasonKey = `s${season.season_number}`;
        const watchedEpisodes = new Set(seriesProgress[seasonKey] || []);
        
        for (let i = 1; i <= season.episode_count; i++) {
            if (!watchedEpisodes.has(i)) {
                return {
                    seasonNumber: season.season_number,
                    episodeNumber: i,
                    isCompleted: false,
                };
            }
        }
    }

    // If all episodes of all seasons are watched
    return {
        seasonNumber: validSeasons[0].season_number,
        episodeNumber: 1,
        isCompleted: true,
    };
}

export function getInProgressSeries() {
    const user = auth.currentUser;
    if (!user) return [];

    const progress = getWatchedProgress();
    const inProgress = [];

    for (const seriesId in progress) {
        const seriesData = progress[seriesId];
        if (seriesData.lastWatchedTimestamp) {
            inProgress.push({
                seriesId: seriesId,
                lastWatchedTimestamp: seriesData.lastWatchedTimestamp,
            });
        }
    }

    return inProgress.sort((a, b) => b.lastWatchedTimestamp - a.lastWatchedTimestamp);
}