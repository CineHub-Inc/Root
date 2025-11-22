import { updateItemStatus, getItemStatus } from './watchlist.js';
import { showToast } from './toast.js';
import { showRatingModal } from './rating-system/rating-modal.js';

let menuElement = null;

function closeMenu() {
    if (menuElement && menuElement.classList.contains('is-visible')) {
        menuElement.classList.remove('is-visible');
    }
}

function createMenu() {
    if (menuElement) return;

    menuElement = document.createElement('div');
    menuElement.className = 'watchlist-menu';
    document.body.appendChild(menuElement);

    // Close menu on outside click
    document.addEventListener('click', (event) => {
        if (menuElement.classList.contains('is-visible') && !menuElement.contains(event.target) && !event.target.closest('.watchlist-toggle')) {
            closeMenu();
        }
    });

    // Close menu on scroll
    document.addEventListener('scroll', closeMenu, { capture: true });

    // Close menu when mouse leaves
    menuElement.addEventListener('mouseleave', closeMenu);
}

async function handleMenuClick(event) {
    const button = event.target.closest('.watchlist-menu-item');
    if (!button) return;

    const { status: newStatus, toast: toastMessage } = button.dataset;
    const { mediaId, mediaType } = menuElement.dataset;
    const card = document.querySelector(`.media-card[data-id="${mediaId}"][data-type="${mediaType}"]`);

    const previousStatus = getItemStatus(mediaId, mediaType) || 'remove';

    closeMenu();

    const success = await updateItemStatus(mediaId, mediaType, newStatus);

    if (success) {
        const isLibraryPage = !!document.querySelector('.library-controls');

        const toastOptions = {
            message: toastMessage,
            type: 'success',
        };

        if (newStatus === 'watched') {
            toastOptions.actions = [{
                text: 'Rate It',
                className: 'toast-rate-btn',
                callback: () => showRatingModal(mediaId, mediaType)
            }];
        }
        
        if (!isLibraryPage && newStatus !== 'remove') {
            // On discovery pages, hide the card
            if (card) {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    if (card.style.opacity === '0') card.style.display = 'none';
                }, 300);
            }

            toastOptions.onUndo = async () => {
                const undoSuccess = await updateItemStatus(mediaId, mediaType, previousStatus);
                if (undoSuccess && card) {
                    card.style.display = '';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 50);
                    showToast({ message: 'Action undone.', type: 'info', duration: 3000 });
                } else {
                    showToast({ message: 'Could not undo.', type: 'error' });
                }
            };
            showToast(toastOptions);

        } else {
            // On library page: Toast only. 
            // Re-render is handled by app.js global 'user-data-updated' listener.
            showToast(toastOptions);
        }
    } else {
        showToast({ message: 'Could not update list', type: 'error' });
    }
}

function populateMenu(mediaId, mediaType) {
    const currentStatus = getItemStatus(mediaId, mediaType);
    let menuHtml = '';

    switch (currentStatus) {
        case 'watchlist':
            menuHtml = `
                <button class="watchlist-menu-item" data-status="watched" data-toast="Moved to Watched">
                    <i class="fa-solid fa-check"></i>
                    <span>Mark as Watched</span>
                </button>
                <button class="watchlist-menu-item" data-status="not_interested" data-toast="Moved to Hidden">
                    <i class="fa-solid fa-eye-slash"></i>
                    <span>Hide</span>
                </button>
                <div class="watchlist-menu-divider"></div>
                <button class="watchlist-menu-item remove-item" data-status="remove" data-toast="Removed from Watchlist">
                    <i class="fa-solid fa-xmark"></i>
                    <span>Remove from Watchlist</span>
                </button>
            `;
            break;
        case 'watched':
            menuHtml = `
                <button class="watchlist-menu-item" data-status="watchlist" data-toast="Moved to Watchlist">
                    <i class="fa-solid fa-bookmark"></i>
                    <span>Move to Watchlist</span>
                </button>
                <button class="watchlist-menu-item" data-status="not_interested" data-toast="Moved to Hidden">
                    <i class="fa-solid fa-eye-slash"></i>
                    <span>Hide</span>
                </button>
                <div class="watchlist-menu-divider"></div>
                <button class="watchlist-menu-item remove-item" data-status="remove" data-toast="Removed from Watched">
                    <i class="fa-solid fa-xmark"></i>
                    <span>Remove from Watched</span>
                </button>
            `;
            break;
        case 'not_interested':
            menuHtml = `
                 <button class="watchlist-menu-item" data-status="watchlist" data-toast="Added to Watchlist">
                    <i class="fa-solid fa-bookmark"></i>
                    <span>Add to Watchlist</span>
                </button>
                <button class="watchlist-menu-item" data-status="watched" data-toast="Marked as Watched">
                    <i class="fa-solid fa-check"></i>
                    <span>Watched</span>
                </button>
                <div class="watchlist-menu-divider"></div>
                <button class="watchlist-menu-item remove-item" data-status="remove" data-toast="Removed from Hidden">
                    <i class="fa-solid fa-xmark"></i>
                    <span>Remove from Hidden</span>
                </button>
            `;
            break;
        default: // Not on any list
            menuHtml = `
                <button class="watchlist-menu-item" data-status="watchlist" data-toast="Added to Watchlist">
                    <i class="fa-solid fa-bookmark"></i>
                    <span>Add to Watchlist</span>
                </button>
                <button class="watchlist-menu-item" data-status="watched" data-toast="Marked as Watched">
                    <i class="fa-solid fa-check"></i>
                    <span>Watched</span>
                </button>
                <button class="watchlist-menu-item" data-status="not_interested" data-toast="Hidden from recommendations">
                    <i class="fa-solid fa-eye-slash"></i>
                    <span>Hide</span>
                </button>
            `;
            break;
    }
    menuElement.innerHTML = menuHtml;
}


export function toggleWatchlistMenu(button) {
    createMenu();

    let id, type;
    const card = button.closest('.media-card');
    if (card) {
        ({ id, type } = card.dataset);
    } else {
        // Fallback for buttons not in a card, like the hero button
        ({ id, type } = button.dataset);
    }

    if (!id || !type) {
        console.error("Watchlist button is missing data-id or data-type.", button);
        return;
    }

    if (menuElement.classList.contains('is-visible') && menuElement.dataset.mediaId === id) {
        closeMenu();
    } else {
        menuElement.dataset.mediaId = id;
        menuElement.dataset.mediaType = type;

        populateMenu(id, type);

        const rect = button.getBoundingClientRect();
        menuElement.style.top = `${rect.bottom + 5}px`;
        menuElement.style.left = `${rect.right - menuElement.offsetWidth}px`;
        
        menuElement.classList.add('is-visible');
    }
}

// Attach the listener once
createMenu();
menuElement.addEventListener('click', handleMenuClick);