import { updateItemRating } from '../watchlist.js';
import { showToast } from '../toast.js';

function renderStars(rating = 0, isRated = false) {
    let starsHtml = '';
    for (let i = 10; i >= 1; i--) {
        const isRatedStar = i <= rating;
        starsHtml += `
            <button class="star ${isRatedStar ? 'rated' : ''}" 
                    data-value="${i}" 
                    aria-label="Rate ${i} out of 10" 
                    ${isRated ? 'disabled' : ''}>
                <i class="fas fa-star"></i>
            </button>
        `;
    }
    return starsHtml;
}

export function renderRatingComponent(mediaId, mediaType, rating) {
    const isRated = typeof rating === 'number' && rating > 0;
    const ratingValue = isRated ? rating : 0;

    return `
        <div class="rating-system ${isRated ? 'is-rated' : ''}" 
             data-media-id="${mediaId}" 
             data-media-type="${mediaType}">
            ${renderStars(ratingValue, isRated)}
        </div>
    `;
}

async function handleRatingClick(e) {
    const starButton = e.target.closest('.star');
    const ratingSystem = e.target.closest('.rating-system');

    if (!starButton || !ratingSystem || ratingSystem.classList.contains('is-rated')) {
        return;
    }

    const newRating = parseInt(starButton.dataset.value, 10);
    const { mediaId, mediaType } = ratingSystem.dataset;

    // Optimistically update UI
    ratingSystem.classList.add('is-rated');
    ratingSystem.innerHTML = renderStars(newRating, true);

    const success = await updateItemRating(mediaId, mediaType, newRating);

    if (success) {
        showToast({ message: `Rated ${newRating}/10`, type: 'success' });
    } else {
        showToast({ message: 'Could not save rating', type: 'error' });
        // Revert UI on failure
        ratingSystem.classList.remove('is-rated');
        ratingSystem.innerHTML = renderStars(0, false);
    }
}

export function initRatingSystemListeners(container) {
    // Only one listener is needed for all rating systems within the container
    container.addEventListener('click', handleRatingClick);
}
