import { getMediaDetails } from '../api.js';
import { createSkeletonLoader } from './loader.js';
import { renderHero, setupHeroEventListeners } from './hero.js';
import { getCastTabHtml, renderCastTab } from './cast.js';
import { renderDetailsTab } from './details.js';
import { renderEpisodesTab, initEpisodes } from './episodes.js';
import { renderRecommendationsTab, initRecommendations } from './recommendations.js';
import { setupTabEventListeners } from './tabs.js';
import { addPageToHistory } from '../history-trail/history-trail.js';

function renderTabs(mediaType, data) {
    const seasonsTab = mediaType === 'tv' && data.seasons ? `
        <button class="media-tab" data-tab="episodes-content">Episodes</button>
    ` : '';

    return `
        <div class="media-tabs">
            <button class="media-tab active" data-tab="cast-content">Cast</button>
            <button class="media-tab" data-tab="details-content">Details</button>
            ${seasonsTab}
            <button class="media-tab" data-tab="recommendations-content">Recommendations</button>
        </div>
    `;
}

export async function renderMediaPage(appRoot, params) {
    const { id, type } = params;
    if (!id || !type) {
        appRoot.innerHTML = '<p>Invalid media specified.</p>';
        return;
    }

    appRoot.innerHTML = createSkeletonLoader();

    try {
        const data = await getMediaDetails(id, type);
        if (!data) throw new Error('Media not found');

        addPageToHistory({
            type: type,
            id: id,
            name: data.title || data.name,
            posterPath: data.poster_path
        });

        const breadcrumb = params.from === 'person' && params.fromId && params.fromName
            ? `<div class="breadcrumb"><a href="#person?id=${params.fromId}"><i class="fas fa-arrow-left"></i> Back to ${decodeURIComponent(params.fromName)}</a></div>`
            : '';

        const heroHtml = renderHero(data, type);
        const tabsHtml = renderTabs(type, data);
        const castTabHtml = getCastTabHtml();
        const detailsTabHtml = renderDetailsTab(data, type);
        const episodesTabHtml = type === 'tv' ? renderEpisodesTab(data) : '';
        const recommendationsTabHtml = renderRecommendationsTab();
        
        const pageHtml = `
            <div class="media-page-wrapper">
                ${breadcrumb}
                <div class="media-page-container">
                    ${heroHtml}
                    <main class="media-details-content">
                        ${tabsHtml}
                        ${castTabHtml}
                        ${detailsTabHtml}
                        ${episodesTabHtml}
                        ${recommendationsTabHtml}
                    </main>
                </div>
            </div>
        `;
        appRoot.innerHTML = pageHtml;

        // Animate in
        setTimeout(() => {
            const container = appRoot.querySelector('.media-page-wrapper');
            if (container) container.classList.add('loaded');
        }, 100);
        
        // Setup functionality
        setupHeroEventListeners(id, type);
        setupTabEventListeners();
        initRecommendations(id, type);

        if (data.credits) {
            renderCastTab(data.credits, data.release_date || data.first_air_date);
        }

        if (type === 'tv' && data.seasons?.length > 0) {
            initEpisodes(id, data.seasons);
        }

    } catch (error) {
        console.error(`Error rendering media page for ${type} ${id}:`, error);
        appRoot.innerHTML = '<p>Could not load media details. Please try again later.</p>';
    }
}