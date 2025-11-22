
import { getTasteProfile, ATTRIBUTE_WEIGHTS, getExplicitPreferences } from './taste-profile.js';
import { discoverMedia, getMediaDetails } from '../api.js';
import { getLocalWatchlist } from '../watchlist.js';

// Multipliers for explicit preferences
const PREF_MULTIPLIERS = {
    LIKED_GENRE: 1.5,
    PREFERRED_LANGUAGE: 1.2
};

/**
 * Scores a media item based on data available in the 'discover' endpoint response.
 * @param {object} mediaItem The media item to score.
 * @param {object} tasteProfile The user's taste profile.
 * @param {object} explicitPrefs User's explicit preferences.
 * @returns {number} The calculated preliminary recommendation score.
 */
function scoreMediaItemSimple(mediaItem, tasteProfile, explicitPrefs) {
    let score = 0;
    let multiplier = 1;

    if (mediaItem.genre_ids && tasteProfile.genres) {
        mediaItem.genre_ids.forEach(genreId => {
            score += (tasteProfile.genres[genreId] || 0) * ATTRIBUTE_WEIGHTS.genres;
            
            // Boost if explicitly liked
            if (explicitPrefs.genres.liked.includes(genreId)) {
                multiplier *= PREF_MULTIPLIERS.LIKED_GENRE;
            }
        });
    }
    if (mediaItem.original_language) {
        score += (tasteProfile.languages[mediaItem.original_language] || 0) * ATTRIBUTE_WEIGHTS.languages;
        
        // Boost if explicitly preferred
        if (explicitPrefs.languages.includes(mediaItem.original_language)) {
            multiplier *= PREF_MULTIPLIERS.PREFERRED_LANGUAGE;
        }
    }
    if (mediaItem.origin_country && tasteProfile.countries) {
        mediaItem.origin_country.forEach(countryCode => {
            score += (tasteProfile.countries[countryCode] || 0) * ATTRIBUTE_WEIGHTS.countries;
        });
    }
    return score * multiplier;
}

/**
 * Scores a media item using its full details, including credits.
 * @param {object} mediaDetails The full media details object from getMediaDetails.
 * @param {object} tasteProfile The user's taste profile.
 * @param {object} explicitPrefs User's explicit preferences.
 * @returns {number} The calculated final recommendation score.
 */
function scoreMediaItemDetailed(mediaDetails, tasteProfile, explicitPrefs) {
    let score = 0;
    let multiplier = 1;

    mediaDetails.genres?.forEach(genre => {
        score += (tasteProfile.genres[genre.id] || 0) * ATTRIBUTE_WEIGHTS.genres;
        
        // Boost if explicitly liked
        if (explicitPrefs.genres.liked.includes(genre.id)) {
            multiplier *= PREF_MULTIPLIERS.LIKED_GENRE;
        }
    });

    if (mediaDetails.original_language) {
        score += (tasteProfile.languages[mediaDetails.original_language] || 0) * ATTRIBUTE_WEIGHTS.languages;
        
        // Boost if explicitly preferred
        if (explicitPrefs.languages.includes(mediaDetails.original_language)) {
            multiplier *= PREF_MULTIPLIERS.PREFERRED_LANGUAGE;
        }
    }

    mediaDetails.production_countries?.forEach(country => {
        score += (tasteProfile.countries[country.iso_3166_1] || 0) * ATTRIBUTE_WEIGHTS.countries;
    });
    const director = mediaDetails.credits?.crew?.find(person => person.job === 'Director');
    if (director) {
        score += (tasteProfile.directors[director.id] || 0) * ATTRIBUTE_WEIGHTS.director;
    }
    mediaDetails.credits?.cast?.slice(0, 5).forEach(actor => {
        score += (tasteProfile.actors[actor.id] || 0) * ATTRIBUTE_WEIGHTS.actors;
    });
    
    return score * multiplier;
}


/**
 * Generates personalized media recommendations for the user.
 * @param {string} mediaType 'movie' or 'tv'.
 * @param {number} count The number of recommendations to return per page.
 * @param {number} page The page number of recommendations to fetch.
 * @returns {Promise<object>} A promise that resolves to a paginated object of recommended media items.
 */
export async function getRecommendations(mediaType, count = 20, page = 1) {
    const tasteProfile = getTasteProfile();
    const explicitPrefs = getExplicitPreferences();
    const hasProfile = Object.values(tasteProfile).some(category => Object.keys(category).length > 0);

    if (!hasProfile) {
        return { results: [], page: 1, total_pages: 0 };
    }

    const watchlist = getLocalWatchlist();
    const seenIds = new Set(Array.from(watchlist.keys()));
    const candidatePool = [];
    let totalPagesFromDiscover = 0;

    const discoverFilters = { sort_by: 'popularity.desc' };
    
    // Apply explicit preferences to pre-filter API results for better candidates
    if (explicitPrefs.genres?.liked?.length > 0) {
        discoverFilters.with_genres = explicitPrefs.genres.liked.join('|');
    }
    if (explicitPrefs.genres?.disliked?.length > 0) {
        discoverFilters.without_genres = explicitPrefs.genres.disliked.join(',');
    }
    if (explicitPrefs.languages?.length > 0) {
        discoverFilters.with_original_language = explicitPrefs.languages.join('|');
    }
    
    const pagesToFetchPerRecPage = 2; // Fetch 2 pages of discover results for each page of recommendations
    const discoverPageStart = ((page - 1) * pagesToFetchPerRecPage) + 1;
    const discoverPageEnd = discoverPageStart + pagesToFetchPerRecPage - 1;

    for (let i = discoverPageStart; i <= discoverPageEnd; i++) {
        const data = await discoverMedia(mediaType, discoverFilters, i);
        if (data?.results) {
            candidatePool.push(...data.results);
             if (i === discoverPageStart) {
                // Cap total pages to prevent excessive fetching for very broad profiles
                totalPagesFromDiscover = data.total_pages > 500 ? 500 : data.total_pages; 
            }
        }
    }
    
    const uniqueCandidates = Array.from(new Map(candidatePool.map(item => [item.id, item])).values());
    const filteredCandidates = uniqueCandidates.filter(item => 
        !seenIds.has(`${item.media_type || mediaType}:${item.id}`)
    );

    const preliminaryScored = filteredCandidates.map(item => ({
        ...item,
        media_type: item.media_type || mediaType,
        preliminaryScore: scoreMediaItemSimple(item, tasteProfile, explicitPrefs),
    })).filter(item => item.preliminaryScore > 0)
       .sort((a, b) => b.preliminaryScore - a.preliminaryScore);

    const promisingCandidates = preliminaryScored.slice(0, count * 2.5);

    const detailPromises = promisingCandidates.map(item => getMediaDetails(item.id, item.media_type));
    const detailedResults = await Promise.allSettled(detailPromises);

    const finalScoredCandidates = [];
    for (const result of detailedResults) {
        if (result.status === 'fulfilled' && result.value) {
            const mediaDetails = result.value;
            const finalScore = scoreMediaItemDetailed(mediaDetails, tasteProfile, explicitPrefs);
            if (finalScore > 0) {
                finalScoredCandidates.push({
                    ...mediaDetails,
                    media_type: mediaDetails.first_air_date ? 'tv' : 'movie',
                    recommendationScore: finalScore,
                });
            }
        }
    }
    
    finalScoredCandidates.sort((a, b) => b.recommendationScore - a.recommendationScore);

    const totalRecommendationPages = Math.floor(totalPagesFromDiscover / pagesToFetchPerRecPage);

    return {
        results: finalScoredCandidates.slice(0, count),
        page: page,
        total_pages: totalRecommendationPages,
    };
}