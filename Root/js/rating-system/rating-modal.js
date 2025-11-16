import { openModal, closeModal } from '../modal.js';
import { getMediaDetails, IMAGE_BASE_URL } from '../api.js';
import { updateItemRating, getLocalWatchlist } from '../watchlist.js';
import { showToast } from '../toast.js';
import { updateTasteProfile } from '../algorithm/taste-profile.js';

let currentRating = 0; // Stored as 0 to 5
let initialRating = 0;
let currentMediaDetails = null;

function getRatingModalHtml(media) {
    const title = media.title || media.name;
    const posterUrl = media.poster_path ? `${IMAGE_BASE_URL}${media.poster_path}` : '';
    
    return `
        <div class="rating-modal-content">
            <div class="rating-item-info">
                <img src="${posterUrl}" alt="${title}" class="rating-item-poster">
                <div class="rating-item-details">
                    <h3 class="rating-item-title">${title}</h3>
                    <p class="rating-item-prompt">Select your rating</p>
                </div>
            </div>
            
            <div class="star-rating-container">
                <div class="stars-wrapper" role="radiogroup" aria-label="Star rating">
                    ${[...Array(5)].map((_, i) => `<i class="star far fa-star" data-value="${i + 1}" role="radio" aria-label="${i + 1} star"></i>`).join('')}
                </div>
                <div class="rating-value-display"></div>
            </div>

            <div class="rating-modal-actions">
                <button class="rating-action-btn rating-cancel-btn">Cancel</button>
                <button id="rating-save-btn" class="rating-action-btn rating-save-btn" disabled>Save Rating</button>
            </div>
        </div>
    `;
}

function handleStarInteraction() {
    const starsWrapper = document.querySelector('.stars-wrapper');
    const stars = starsWrapper.querySelectorAll('.star');
    const ratingDisplay = document.querySelector('.rating-value-display');
    const saveBtn = document.getElementById('rating-save-btn');

    const updateStarsVisual = (rating) => {
        stars.forEach((star, index) => {
            if (rating >= index + 1) {
                star.className = 'star fas fa-star';
            } else if (rating >= index + 0.5) {
                star.className = 'star fas fa-star-half-alt';
            } else {
                star.className = 'star far fa-star';
            }
        });
        
        if (rating > 0) {
            ratingDisplay.textContent = `${rating * 2} / 10`;
        } else {
            ratingDisplay.textContent = '';
        }
    };

    const getRatingFromEvent = (e) => {
        const targetStar = e.target.closest('.star');
        if (!targetStar) return 0;

        const starValue = parseFloat(targetStar.dataset.value);
        const rect = targetStar.getBoundingClientRect();
        const isHalf = (e.clientX - rect.left) < (rect.width / 2);

        return starValue - (isHalf ? 0.5 : 0);
    };
    
    // Set initial state
    updateStarsVisual(initialRating);
    currentRating = initialRating;
    if (currentRating > 0) {
        saveBtn.disabled = false;
    }

    starsWrapper.addEventListener('mousemove', e => {
        const hoverRating = getRatingFromEvent(e);
        if (hoverRating > 0) {
            updateStarsVisual(hoverRating);
        }
    });

    starsWrapper.addEventListener('mouseleave', () => {
        updateStarsVisual(currentRating); // revert to saved rating
    });

    starsWrapper.addEventListener('click', e => {
        const clickedRating = getRatingFromEvent(e);
        if (clickedRating >= 0.5) { // Allow selecting half a star
            currentRating = clickedRating;
            updateStarsVisual(currentRating);
            saveBtn.disabled = false;
        }
    });
}

async function handleSaveRating(mediaId, mediaType) {
    const saveBtn = document.getElementById('rating-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const success = await updateItemRating(mediaId, mediaType, currentRating * 2);
    
    if (success) {
        const ratingValue = currentRating * 2;
        let action = null;
        if (ratingValue >= 8) action = 'rated_high';
        else if (ratingValue <= 4) action = 'rated_low';

        if (action) {
            updateTasteProfile(mediaId, mediaType, action, null, currentMediaDetails);
        }

        showToast({ message: 'Rating saved!', type: 'success' });
        closeModal();
    } else {
        showToast({ message: 'Could not save rating.', type: 'error' });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Rating';
    }
}

export async function showRatingModal(mediaId, mediaType) {
    // Reset state
    currentRating = 0;
    initialRating = 0;
    currentMediaDetails = null;

    // Check for existing rating
    const watchlist = getLocalWatchlist();
    const item = watchlist.get(`${mediaType}:${mediaId}`);
    if (item && item.userRating) {
        initialRating = item.userRating / 2; // Convert 1-10 scale to 0-5
    }

    try {
        const media = await getMediaDetails(mediaId, mediaType);
        if (!media) throw new Error('Media details not found');
        currentMediaDetails = media;

        openModal(getRatingModalHtml(media), 'rating-modal');

        handleStarInteraction();
        
        document.getElementById('rating-save-btn').addEventListener('click', () => handleSaveRating(mediaId, mediaType));
        document.querySelector('.rating-cancel-btn').addEventListener('click', closeModal);

    } catch (err) {
        console.error("Could not open rating modal:", err);
        showToast({ message: "Could not open rating modal.", type: 'error' });
    }
}
