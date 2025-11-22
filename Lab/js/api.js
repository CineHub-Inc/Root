
import { TMDB_API_KEY, TMDB_API_BASE_URL, TMDB_IMAGE_BASE_URL, TMDB_IMAGE_BACKDROP_URL } from './config.js';

export const IMAGE_BASE_URL = TMDB_IMAGE_BASE_URL;
export const IMAGE_BACKDROP_URL = TMDB_IMAGE_BACKDROP_URL;

/**
 * Fetches data from the TMDb API.
 * @param {string} endpoint - The API endpoint to fetch.
 * @returns {Promise<any>} - A promise that resolves with the JSON data.
 */
async function fetchFromTMDB(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_API_BASE_URL}/${endpoint}${separator}api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch from TMDB:", error);
        return null;
    }
}

/**
 * Gets trending media for a given time window.
 * @param {string} [mediaType='all'] - The media type ('all', 'movie', 'tv', 'person').
 * @param {string} [timeWindow='day'] - The time window ('day' or 'week').
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<any>} - A promise that resolves with the trending media data.
 */
export async function getTrending(mediaType = 'all', timeWindow = 'day', page = 1) {
    return fetchFromTMDB(`trending/${mediaType}/${timeWindow}?page=${page}`);
}


/**
 * Discovers movies and TV shows from a specific streaming provider.
 * @param {number} providerId - The ID of the watch provider (e.g., 8 for Netflix).
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<{results: any[]}>} - A promise that resolves with combined and sorted media.
 */
export async function discoverMediaByProvider(providerId, page = 1) {
    // Note: TMDb discover endpoint fetches both movies and TV, but paginating them separately 
    // and combining is complex. For simplicity, we'll just paginate movies for now.
    // A more robust solution might alternate fetching pages of movies and tv shows.
    const movieEndpoint = `discover/movie?with_watch_providers=${providerId}&watch_region=US&sort_by=popularity.desc&page=${page}`;
    const tvEndpoint = `discover/tv?with_watch_providers=${providerId}&watch_region=US&sort_by=popularity.desc&page=${page}`;

    try {
        // To keep pagination simple, we'll fetch a page of movies and a page of tv shows and mix them
        const [movieData, tvData] = await Promise.all([
            fetchFromTMDB(movieEndpoint),
            fetchFromTMDB(tvEndpoint)
        ]);
        
        const movies = movieData.results.map(item => ({ ...item, media_type: 'movie' }));
        const tvShows = tvData.results.map(item => ({ ...item, media_type: 'tv' }));

        const combined = [...movies, ...tvShows].sort((a, b) => b.popularity - a.popularity);
        return { results: combined };

    } catch (error) {
        console.error(`Failed to discover media for provider ${providerId}:`, error);
        return { results: [] };
    }
}

/**
 * Fetches movies or TV shows based on a set of filters.
 * @param {string} mediaType - 'movie' or 'tv'.
 * @param {object} filters - An object of filter parameters (e.g., { sort_by: 'popularity.desc', with_genres: '28,12' }).
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<any>}
 */
export async function discoverMedia(mediaType, filters = {}, page = 1) {
    const params = new URLSearchParams({ page, watch_region: 'US', ...filters });
    return fetchFromTMDB(`discover/${mediaType}?${params.toString()}`);
}


// Genre fetches
export async function getMovieGenres() {
    return fetchFromTMDB('genre/movie/list');
}

export async function getTvGenres() {
    return fetchFromTMDB('genre/tv/list');
}

/**
 * Gets a list of languages from TMDb.
 * @returns {Promise<any>}
 */
export async function getLanguages() {
    return fetchFromTMDB('configuration/languages');
}

/**
 * Gets a list of countries (regions) from TMDb.
 * @returns {Promise<any>}
 */
export async function getCountries() {
    return fetchFromTMDB('configuration/countries');
}

/**
 * Gets a list of watch providers for a given region.
 * @param {string} mediaType - 'movie' or 'tv'.
 * @returns {Promise<any>}
 */
export async function getWatchProviders(mediaType) {
    return fetchFromTMDB(`watch/providers/${mediaType}?watch_region=US`);
}

/**
 * Gets upcoming movies.
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<any>}
 */
export async function getUpcomingMovies(page = 1) {
    return fetchFromTMDB(`movie/upcoming?page=${page}&region=US`);
}


/**
 * Gets detailed information for a specific person.
 * @param {string} personId - The ID of the person.
 * @returns {Promise<any>}
 */
export async function getPersonDetails(personId) {
    if (!personId) return null;
    return fetchFromTMDB(`person/${personId}?append_to_response=external_ids`);
}

/**
 * Gets the combined (movie and TV) credits for a specific person.
 * @param {string} personId The ID of the person.
 * @returns {Promise<any>}
 */
export async function getPersonCombinedCredits(personId) {
    if (!personId) return null;
    return fetchFromTMDB(`person/${personId}/combined_credits`);
}

// Search
/**
 * Searches for movies, TV shows, and people.
 * @param {string} query - The search query.
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<any>}
 */
export async function searchMulti(query, page = 1) {
    if (!query) return null;
    return fetchFromTMDB(`search/multi?query=${encodeURIComponent(query)}&page=${page}`);
}

/**
 * Gets detailed information for a specific media item.
 * @param {string} mediaId - The ID of the movie or TV show.
 * @param {string} mediaType - The type of media ('movie' or 'tv').
 * @returns {Promise<any>}
 */
export async function getMediaDetails(mediaId, mediaType) {
    if (!mediaId || !mediaType) return null;
    // Append credits and watch providers to the details call for efficiency
    return fetchFromTMDB(`${mediaType}/${mediaId}?append_to_response=credits,watch/providers`);
}

/**
 * Gets videos for a specific media item.
 * @param {string} mediaId - The ID of the movie or TV show.
 * @param {string} mediaType - The type of media ('movie' or 'tv').
 * @returns {Promise<any>}
 */
export async function getMediaVideos(mediaId, mediaType) {
    if (!mediaId || !mediaType) return null;
    return fetchFromTMDB(`${mediaType}/${mediaId}/videos`);
}

/**
 * Gets credits (cast and crew) for a specific media item.
 * @param {string} mediaId - The ID of the movie or TV show.
 * @param {string} mediaType - The type of media ('movie' or 'tv').
 * @returns {Promise<any>}
 */
export async function getMediaCredits(mediaId, mediaType) {
    if (!mediaId || !mediaType) return null;
    return fetchFromTMDB(`${mediaType}/${mediaId}/credits`);
}

/**
 * Gets recommendations for a specific media item.
 * @param {string} mediaId - The ID of the movie or TV show.
 * @param {string} mediaType - The type of media ('movie' or 'tv').
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Promise<any>}
 */
export async function getMediaRecommendations(mediaId, mediaType, page = 1) {
    if (!mediaId || !mediaType) return null;
    return fetchFromTMDB(`${mediaType}/${mediaId}/recommendations?page=${page}`);
}

/**
 * Gets details for a specific TV season.
 * @param {string} seriesId - The ID of the TV series.
 * @param {number} seasonNumber - The season number.
 * @returns {Promise<any>}
 */
export async function getTvSeasonDetails(seriesId, seasonNumber) {
    if (!seriesId || !seasonNumber && seasonNumber !== 0) return null;
    return fetchFromTMDB(`tv/${seriesId}/season/${seasonNumber}`);
}
