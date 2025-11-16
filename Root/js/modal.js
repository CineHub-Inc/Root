let modalOverlay = null;

function createModal() {
    if (document.getElementById('app-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'app-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-container" role="dialog" aria-modal="true">
            <button class="modal-close-btn" aria-label="Close modal">&times;</button>
            <div class="modal-content"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    modalOverlay = overlay;

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });

    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalOverlay.classList.contains('is-visible')) {
            closeModal();
        }
    });
}

export function openModal(contentHtml, containerClass = '') {
    if (!modalOverlay) {
        createModal();
    }
    const modalContainer = modalOverlay.querySelector('.modal-container');
    const modalContent = modalOverlay.querySelector('.modal-content');
    
    // Reset container class and apply new one if provided
    modalContainer.className = 'modal-container';
    if (containerClass) {
        modalContainer.classList.add(containerClass);
    }

    modalContent.innerHTML = contentHtml;
    document.body.style.overflow = 'hidden';
    modalOverlay.classList.add('is-visible');
}

export function closeModal() {
    if (!modalOverlay) return;

    const modalContent = modalOverlay.querySelector('.modal-content');
    // Clearing the content stops any playing media (e.g., YouTube iframe)
    if (modalContent) {
        modalContent.innerHTML = '';
    }

    document.body.style.overflow = '';
    modalOverlay.classList.remove('is-visible');
}

// Ensure the modal is created on initial load
createModal();