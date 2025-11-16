let overlayElement = null;
let containerElement = null;
let progressCircle = null;
let progressValueElement = null;
let statusMessageElement = null;

// State for smooth animation
let currentPercentage = 0;
let targetPercentage = 0;
let animationFrameId = null;

function createProgressBarDOM() {
    if (document.getElementById('loading-overlay')) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'loading-overlay';
    overlayElement.className = 'loading-overlay';

    overlayElement.innerHTML = `
        <div class="loading-container">
            <div class="progress-bar-circle">
                <span class="progress-value">0%</span>
            </div>
            <span class="loading-status-message"></span>
        </div>
    `;
    document.body.appendChild(overlayElement);

    containerElement = overlayElement.querySelector('.loading-container');
    progressCircle = overlayElement.querySelector('.progress-bar-circle');
    progressValueElement = overlayElement.querySelector('.progress-value');
    statusMessageElement = overlayElement.querySelector('.loading-status-message');
}

/**
 * The animation loop that smoothly updates the progress bar.
 */
function animateProgress() {
    // If we are close enough to the target, snap to it and stop the animation.
    if (Math.abs(targetPercentage - currentPercentage) < 0.1) {
        currentPercentage = targetPercentage;
        animationFrameId = null;
    } else {
        // Move towards the target by a fraction of the remaining distance.
        // This creates a smooth easing effect (fast at first, then slows down).
        currentPercentage += (targetPercentage - currentPercentage) * 0.08;
        animationFrameId = requestAnimationFrame(animateProgress);
    }
    
    const displayPercentage = Math.round(currentPercentage);
    progressValueElement.textContent = `${displayPercentage}%`;
    progressCircle.style.background = `
        conic-gradient(
            var(--focus-color) ${currentPercentage * 3.6}deg,
            var(--progress-bar-track-color) ${currentPercentage * 3.6}deg
        )
    `;
}

export function showProgressBar() {
    if (!overlayElement) {
        createProgressBarDOM();
    }

    // Reset state for a clean start
    currentPercentage = 0;
    targetPercentage = 0;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Set initial visual state to 0
    progressValueElement.textContent = `0%`;
    statusMessageElement.textContent = 'Initializing...';
    progressCircle.style.background = `
        conic-gradient(
            var(--progress-bar-track-color) 0deg,
            var(--progress-bar-track-color) 360deg
        )
    `;

    overlayElement.classList.add('is-visible');
}

export function updateProgress(percentage, message) {
    if (!overlayElement) return;

    // Set the new target for the animation
    targetPercentage = Math.min(100, Math.max(0, percentage));
    
    if (message) {
        statusMessageElement.textContent = message;
    }

    // Kick off the animation loop if it's not already running
    if (!animationFrameId) {
        animateProgress();
    }
}

export function hideProgressBar() {
    if (!overlayElement) return;
    
    // Stop any ongoing animation when hiding
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    overlayElement.classList.remove('is-visible');
}