import { getMediaDetails } from '../api.js';
import { auth, db } from '../firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TASTE_PROFILE_KEY = 'cinehub-tasteProfile';
const USER_PREFERENCES_COLLECTION = 'userPreferences';

// This local variable will act as a cache for the user's explicit preferences
let localExplicitPreferences = { genres: { liked: [], disliked: [] }, languages: [] };


const ACTION_WEIGHTS = {
    watchlist: { score: 1 },
    watched: { score: 2 },
    rated_high: { score: 3 }, // Rating 8-10
    rated_low: { score: -2 }, // Rating 1-4
    not_interested: { score: -3 },
};

export const ATTRIBUTE_WEIGHTS = {
    genres: 1.5,
    director: 1.2,
    actors: 1.0,
    languages: 1.0,
    countries: 0.8,
};

const EXPLICIT_WEIGHTS = {
    liked_genre: 20,
    disliked_genre: -1000, // Make dislike a very strong negative signal to act as a hard filter
    language: 15
};

export function getTasteProfile() {
    try {
        const profileJson = localStorage.getItem(TASTE_PROFILE_KEY);
        return profileJson ? JSON.parse(profileJson) : { genres: {}, actors: {}, directors: {}, languages: {}, countries: {} };
    } catch (e) {
        console.error("Failed to parse taste profile:", e);
        return { genres: {}, actors: {}, directors: {}, languages: {}, countries: {} };
    }
}

function saveTasteProfile(profile) {
    localStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(profile));
}

function updateScore(profile, category, id, weight) {
    if (!id || !weight) return;
    profile[category] = profile[category] || {};
    profile[category][id] = (profile[category][id] || 0) + weight;
}

async function applyScoresToProfile(profile, action, details, multiplier = 1) {
    const actionConfig = ACTION_WEIGHTS[action];
    if (!actionConfig || !details) return;

    const baseScore = actionConfig.score * multiplier;

    details.genres?.forEach(g => updateScore(profile, 'genres', g.id, baseScore * ATTRIBUTE_WEIGHTS.genres));
    const director = details.credits?.crew?.find(p => p.job === 'Director');
    if (director) updateScore(profile, 'directors', director.id, baseScore * ATTRIBUTE_WEIGHTS.director);
    details.credits?.cast?.slice(0, 5).forEach(a => updateScore(profile, 'actors', a.id, baseScore * ATTRIBUTE_WEIGHTS.actors));
    updateScore(profile, 'languages', details.original_language, baseScore * ATTRIBUTE_WEIGHTS.languages);
    details.production_countries?.forEach(c => updateScore(profile, 'countries', c.iso_3166_1, baseScore * ATTRIBUTE_WEIGHTS.countries));
}

export async function updateTasteProfile(mediaId, mediaType, newStatus, oldStatus = null, mediaDetails = null) {
    let details = mediaDetails;
    if (!details) {
        details = await getMediaDetails(mediaId, mediaType);
    }
    if (!details) return;

    const profile = getTasteProfile();

    if (oldStatus && ACTION_WEIGHTS[oldStatus]) {
        await applyScoresToProfile(profile, oldStatus, details, -1);
    }

    if (newStatus && newStatus !== 'remove' && ACTION_WEIGHTS[newStatus]) {
        await applyScoresToProfile(profile, newStatus, details, 1);
    }
    
    saveTasteProfile(profile);
}

// Fetches preferences from Firestore and caches them locally
export async function fetchAndCacheExplicitPreferences() {
    const user = auth.currentUser;
    const defaultPrefs = { genres: { liked: [], disliked: [] }, languages: [] };
    if (!user) {
        localExplicitPreferences = defaultPrefs;
        return null;
    }
    try {
        const prefDocRef = doc(db, USER_PREFERENCES_COLLECTION, user.uid);
        const docSnap = await getDoc(prefDocRef);
        if (docSnap.exists()) {
            const fetchedData = docSnap.data() || {};
            // Start with a deep clone of the default structure
            const finalPrefs = JSON.parse(JSON.stringify(defaultPrefs));

            // Safely merge properties from the fetched data
            if (fetchedData.genres) {
                if (Array.isArray(fetchedData.genres.liked)) {
                    finalPrefs.genres.liked = fetchedData.genres.liked;
                }
                if (Array.isArray(fetchedData.genres.disliked)) {
                    finalPrefs.genres.disliked = fetchedData.genres.disliked;
                }
            }
            if (Array.isArray(fetchedData.languages)) {
                finalPrefs.languages = fetchedData.languages;
            }
            
            localExplicitPreferences = finalPrefs;
            return localExplicitPreferences;
        } else {
            // No preferences saved yet
            localExplicitPreferences = defaultPrefs;
            return null;
        }
    } catch (error) {
        console.error("Error fetching explicit preferences:", error);
        localExplicitPreferences = defaultPrefs; // Reset on error as well for safety
        return null;
    }
}


export function getExplicitPreferences() {
    return localExplicitPreferences;
}

// Function to apply explicit preferences on top of the calculated profile
export function applyExplicitPreferencesToProfile(newPrefs, oldPrefs) {
    const profile = getTasteProfile();

    // Revert old preferences if provided
    if (oldPrefs) {
        (oldPrefs.genres.liked || []).forEach(id => updateScore(profile, 'genres', id, -EXPLICIT_WEIGHTS.liked_genre));
        (oldPrefs.genres.disliked || []).forEach(id => updateScore(profile, 'genres', id, -EXPLICIT_WEIGHTS.disliked_genre));
        (oldPrefs.languages || []).forEach(code => updateScore(profile, 'languages', code, -EXPLICIT_WEIGHTS.language));
    }

    // Apply new preferences
    (newPrefs.genres.liked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.liked_genre));
    (newPrefs.genres.disliked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.disliked_genre));
    (newPrefs.languages || []).forEach(code => updateScore(profile, 'languages', code, EXPLICIT_WEIGHTS.language));
    
    saveTasteProfile(profile);
}


export async function saveExplicitPreferences(newPrefs) {
    const user = auth.currentUser;
    if (!user) {
        console.error("Cannot save preferences, user not logged in.");
        throw new Error("User not authenticated");
    }
    const oldPrefs = getExplicitPreferences();

    try {
        const prefDocRef = doc(db, USER_PREFERENCES_COLLECTION, user.uid);
        await setDoc(prefDocRef, newPrefs);

        // Update local cache
        localExplicitPreferences = newPrefs;
        
        // Recalculate profile with new preferences
        applyExplicitPreferencesToProfile(newPrefs, oldPrefs);

    } catch (error) {
        console.error("Failed to save explicit preferences:", error);
        // Revert local cache if DB save fails
        localExplicitPreferences = oldPrefs;
        throw error; // Let the caller handle UI feedback
    }
}


export function clearTasteProfile() {
    localStorage.removeItem(TASTE_PROFILE_KEY);
    localExplicitPreferences = { genres: { liked: [], disliked: [] }, languages: [] };
}

export async function buildInitialProfileFromLibrary(library, progressCallback = () => {}, explicitPrefs = null) {
    const user = auth.currentUser;
    if (!user) return;
    const MIGRATION_FLAG_KEY = `cinehub-profileMigrated-${user.uid}`;
    
    clearTasteProfile();
    progressCallback(0, "Analyzing your library...");

    const items = Array.from(library.entries());
    if (items.length === 0) {
        if (explicitPrefs) {
             const profile = getTasteProfile(); // Start with empty
             // Apply explicit prefs even with an empty library
            (explicitPrefs.genres.liked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.liked_genre));
            (explicitPrefs.genres.disliked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.disliked_genre));
            (explicitPrefs.languages || []).forEach(code => updateScore(profile, 'languages', code, EXPLICIT_WEIGHTS.language));
            saveTasteProfile(profile);
        }
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        progressCallback(100, "Library empty, profile initialized.");
        return;
    }
    
    const detailPromises = items.map(([key]) => {
        const [mediaType, mediaId] = key.split(':');
        return getMediaDetails(mediaId, mediaType);
    });

    try {
        const results = await Promise.allSettled(detailPromises);
        progressCallback(20, "Building your taste profile...");
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const profile = getTasteProfile(); // Start with empty
        for (const [index, result] of results.entries()) {
            if (result.status === 'fulfilled' && result.value) {
                const mediaDetails = result.value;
                const [, itemData] = items[index];
                
                if (itemData.status && itemData.status !== 'remove') {
                    await applyScoresToProfile(profile, itemData.status, mediaDetails);
                }
                if (itemData.userRating) {
                    const ratingAction = itemData.userRating >= 8 ? 'rated_high' : (itemData.userRating <= 4 ? 'rated_low' : null);
                    if (ratingAction) await applyScoresToProfile(profile, ratingAction, mediaDetails);
                }
            }
            const progress = 20 + Math.round(((index + 1) / items.length) * 70);
            progressCallback(progress, `Processing ${index + 1} of ${items.length}...`);
        }
        
        if (explicitPrefs) {
            (explicitPrefs.genres.liked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.liked_genre));
            (explicitPrefs.genres.disliked || []).forEach(id => updateScore(profile, 'genres', id, EXPLICIT_WEIGHTS.disliked_genre));
            (explicitPrefs.languages || []).forEach(code => updateScore(profile, 'languages', code, EXPLICIT_WEIGHTS.language));
        }

        saveTasteProfile(profile);
        progressCallback(95, "Finalizing profile...");
        await new Promise(resolve => setTimeout(resolve, 500));
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        progressCallback(100, "Profile complete!");
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
        console.error("Error during profile migration:", error);
    }
}