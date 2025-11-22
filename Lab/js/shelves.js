import { getTrending, discoverMedia, getMovieGenres, getTvGenres } from './api.js';
import { renderShelf } from './ui-components.js';
import { auth } from './firebase.js';
import { renderPersonalizedShelves } from './algorithm/shelves.js';
import { getTasteProfile, getExplicitPreferences } from './algorithm/taste-profile.js';
import { renderContinueWatchingShelf } from './continue-watching/continue-watching.js';

/**
 * Renders all the shelves for the home page.
 * @param {HTMLElement} appRoot - The main application container.
 * @param {object} params - The URL query parameters (not used on home page, but passed by router).
 */
export async function renderHomePageShelves(appRoot, params) {
    appRoot.innerHTML = ''; // Clear previous content

    // Render personalized shelves first if user is logged in
    if (auth.currentUser) {
        await renderContinueWatchingShelf(appRoot);
        renderPersonalizedShelves(appRoot);
    }

    const preferenceFilters = getExplicitPreferences();
    const discoverFilters = {};
    if (preferenceFilters.genres.disliked?.length > 0) {
        discoverFilters.without_genres = preferenceFilters.genres.disliked.join(',');
    }
    if (preferenceFilters.genres.liked?.length > 0) {
        discoverFilters.with_genres = preferenceFilters.genres.liked.join('|');
    }
    if (preferenceFilters.languages?.length > 0) {
        discoverFilters.with_original_language = preferenceFilters.languages.join('|');
    }

    const shelves = [
        { 
            title: 'Films Trending This Week', 
            fetcher: (page) => getTrending('movie', 'week', page),
            options: { autoplay: true }
        },
        { 
            title: 'TV Series Trending This Week', 
            fetcher: (page) => getTrending('tv', 'week', page),
            options: {}
        },
        { 
            title: 'Top Rated Films', 
            fetcher: (page) => discoverMedia('movie', { ...discoverFilters, sort_by: 'vote_average.desc', 'vote_count.gte': 500 }, page),
            options: {}
        },
        { 
            title: 'Must-See TV Series', 
            fetcher: (page) => discoverMedia('tv', { ...discoverFilters, sort_by: 'popularity.desc' }, page),
            options: {}
        },
    ];

    shelves.forEach(shelf => {
        renderShelf(appRoot, shelf.title, shelf.fetcher, shelf.options);
    });

    if (auth.currentUser) {
        const tasteProfile = getTasteProfile();
        if (tasteProfile.genres && Object.keys(tasteProfile.genres).length > 0) {
            const topGenres = Object.entries(tasteProfile.genres)
                .filter(([, score]) => score > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4); // Get top 4 genres

            if (topGenres.length > 0) {
                const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
                const allGenres = new Map();
                if (movieGenres?.genres) movieGenres.genres.forEach(g => allGenres.set(String(g.id), g.name));
                if (tvGenres?.genres) tvGenres.genres.forEach(g => allGenres.set(String(g.id), g.name));

                for (let i = 0; i < topGenres.length; i++) {
                    const [genreId] = topGenres[i];
                    const genreName = allGenres.get(genreId);
                    if (genreName) {
                        const title = i === 0 
                            ? `Because You Like ${genreName}`
                            : `More ${genreName} For You`;
                        
                        // Exclude liked genres from the base preferences to avoid conflict, but keep disliked and language
                        const { with_genres, ...otherPrefs } = discoverFilters;
                        const shelfSpecificFilters = {
                             ...otherPrefs,
                             with_genres: genreId,
                             sort_by: 'popularity.desc'
                        };
                        
                        renderShelf(
                            appRoot,
                            title,
                            (page) => discoverMedia('movie', shelfSpecificFilters, page),
                            {}
                        );
                    }
                }
            }
        }
    }
}