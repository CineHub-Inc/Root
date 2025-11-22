let loaderOverlay = null;
let loaderText = null;

function createLoaderOverlayDOM() {
    if (document.getElementById('loader-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'loader-overlay';
    overlay.innerHTML = `
        <div class="loader-overlay-spinner"></div>
        <p class="loader-overlay-text"></p>
    `;
    document.body.appendChild(overlay);
    loaderOverlay = overlay;
    loaderText = overlay.querySelector('.loader-overlay-text');
}

export function showLoaderOverlay(text = '') {
    if (!loaderOverlay) {
        createLoaderOverlayDOM();
    }
    loaderText.textContent = text;
    loaderOverlay.classList.add('is-visible');
}

export function hideLoaderOverlay() {
    if (loaderOverlay) {
        loaderOverlay.classList.remove('is-visible');
    }
}

// Create the DOM element on script load
createLoaderOverlayDOM();
