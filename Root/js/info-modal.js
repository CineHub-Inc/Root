import { getMediaDetails } from './api.js';
import { openModal } from './modal.js';

export async function showInfo(mediaId, mediaType) {
    openModal('<div class="loader"><i class="fas fa-spinner"></i></div>');

    try {
        const data = await getMediaDetails(mediaId, mediaType);
        if (data) {
            const title = data.title || data.name;
            const synopsis = data.overview;
            const contentHtml = `
                <h2 class="info-modal-title">${title}</h2>
                <hr class="info-modal-divider">
                <p class="info-modal-synopsis">${synopsis || 'No synopsis available.'}</p>
            `;
            openModal(contentHtml);
        } else {
            openModal('<p class="no-content-message">Could not load information.</p>');
        }
    } catch (error) {
        console.error('Error fetching details:', error);
        openModal('<p class="no-content-message">Could not load information.</p>');
    }
}