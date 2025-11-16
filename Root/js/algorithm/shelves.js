import { renderShelf } from '../ui-components.js';
import { getRecommendations } from './recommender.js';
import { getTasteProfile } from './taste-profile.js';

/**
 * Renders personalized shelves, such as "Top Picks For You".
 * @param {HTMLElement} container The parent element to append the shelves to.
 */
export function renderPersonalizedShelves(container) {
    const tasteProfile = getTasteProfile();
    const hasProfile = Object.keys(tasteProfile.genres).length > 0 ||
                       Object.keys(tasteProfile.actors).length > 0 ||
                       Object.keys(tasteProfile.directors).length > 0;

    // Only render if the user has a profile with some data
    if (!hasProfile) {
        return;
    }

    // "Top Picks For You" Shelf (Films)
    renderShelf(
        container,
        'Top Film Picks For You',
        (page) => getRecommendations('movie', 20, page),
        {}
    );
    
    // "Top Picks For You" Shelf (TV)
    renderShelf(
        container,
        'Top TV Picks For You',
        (page) => getRecommendations('tv', 20, page),
        {}
    );
}