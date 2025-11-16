import { discoverMedia, IMAGE_BASE_URL } from '../api.js';

let stackContainer;
let cardsData = [];
let likedMovies = [];

let isDragging = false;
let startPoint = { x: 0, y: 0 };
let currentTarget = null;

function createCardElement(movie, index) {
    const card = document.createElement('div');
    card.className = 'swipe-card';
    card.dataset.index = index;
    card.style.zIndex = cardsData.length - index;
    card.style.transform = `scale(${1 - (index * 0.05)}) translateY(${-index * 10}px)`;
    
    card.innerHTML = `
        <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}" class="swipe-card-image">
        <div class="swipe-card-indicator like">Like</div>
        <div class="swipe-card-indicator skip">Skip</div>
    `;
    return card;
}

// Animate the swipe and handle the logic
function animateSwipe(card, direction) {
    if (card.isAnimating) return;
    card.isAnimating = true;
    
    const movieIndex = parseInt(card.dataset.index, 10);

    card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
    card.style.transform = `translate(${direction * 500}px, 0) rotate(${direction * 30}deg)`;
    card.style.opacity = 0;
    
    if (direction === 1) { // Liked
        likedMovies.push(cardsData[movieIndex]);
    }
    
    setTimeout(() => {
        if (card.parentNode === stackContainer) {
            stackContainer.removeChild(card);
        }
        updateStack();
    }, 400);
}

// Trigger swipe from buttons
function triggerButtonSwipe(direction) {
    const cardElements = stackContainer.querySelectorAll('.swipe-card');
    if (cardElements.length === 0) return;

    // Find the topmost card (highest z-index)
    const topCard = Array.from(cardElements).reduce((a, b) => 
        parseInt(a.style.zIndex) > parseInt(b.style.zIndex) ? a : b
    );
    
    animateSwipe(topCard, direction);
}


function onDragStart(e) {
    if (isDragging) return;
    
    isDragging = true;
    currentTarget = e.currentTarget;
    currentTarget.classList.add('dragging');

    startPoint.x = e.pageX || e.touches[0].pageX;
    startPoint.y = e.pageY || e.touches[0].pageY;
}

function onDragMove(e) {
    if (!isDragging || !currentTarget) return;
    
    e.preventDefault();
    
    const currentX = e.pageX || e.touches[0].pageX;
    const currentY = e.pageY || e.touches[0].pageY;

    const deltaX = currentX - startPoint.x;
    const deltaY = currentY - startPoint.y;
    const rotation = deltaX * 0.1;

    currentTarget.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
    
    const likeIndicator = currentTarget.querySelector('.like');
    const skipIndicator = currentTarget.querySelector('.skip');
    
    const opacity = Math.min(Math.abs(deltaX) / 100, 1);
    
    if (deltaX > 0) {
        likeIndicator.style.opacity = opacity;
        skipIndicator.style.opacity = 0;
    } else {
        skipIndicator.style.opacity = opacity;
        likeIndicator.style.opacity = 0;
    }
}

function onDragEnd(e) {
    if (!isDragging || !currentTarget) return;

    isDragging = false;
    const endX = e.pageX || e.changedTouches[0].pageX;
    const deltaX = endX - startPoint.x;
    const decisionThreshold = 100;

    const likeIndicator = currentTarget.querySelector('.like');
    const skipIndicator = currentTarget.querySelector('.skip');
    likeIndicator.style.opacity = 0;
    skipIndicator.style.opacity = 0;
    
    if (Math.abs(deltaX) > decisionThreshold) {
        const direction = deltaX > 0 ? 1 : -1;
        animateSwipe(currentTarget, direction);
    } else {
        // Snap back
        const cardIndex = parseInt(currentTarget.dataset.index, 10);
        const originalIndex = Array.from(stackContainer.querySelectorAll('.swipe-card')).indexOf(currentTarget);
        currentTarget.style.transform = `scale(${1 - (originalIndex * 0.05)}) translateY(${-originalIndex * 10}px)`;
    }
    
    currentTarget.classList.remove('dragging');
    currentTarget = null;
}

function updateStack() {
    const remainingCards = stackContainer.querySelectorAll('.swipe-card');
    if (remainingCards.length === 0) {
        stackContainer.innerHTML = '<p class="swipe-stack-empty-message">All done! Click Finish to continue.</p>';
    }
    remainingCards.forEach((card, index) => {
        card.style.zIndex = remainingCards.length - index;
        card.style.transform = `scale(${1 - (index * 0.05)}) translateY(${-index * 10}px)`;
    });
}

async function fetchAndRenderCards() {
    try {
        const data = await discoverMedia('movie', { sort_by: 'popularity.desc' }, 1);
        cardsData = data.results.slice(0, 15);

        if (cardsData.length > 0) {
            cardsData.forEach((movie, index) => {
                const cardEl = createCardElement(movie, index);
                stackContainer.appendChild(cardEl);

                cardEl.addEventListener('mousedown', onDragStart);
                cardEl.addEventListener('touchstart', onDragStart);
            });

            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('touchmove', onDragMove, { passive: false });
            
            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchend', onDragEnd);
        } else {
             stackContainer.innerHTML = '<p>Could not load movies to swipe.</p>';
        }

    } catch (error) {
        console.error("Failed to fetch movies for swipe stack:", error);
        stackContainer.innerHTML = '<p>Could not load movies to swipe.</p>';
    }
}

export function initSwipeStack(wrapperContainer) {
    stackContainer = wrapperContainer.querySelector('.swipe-stack-container');
    const likeBtn = wrapperContainer.querySelector('.like-btn');
    const skipBtn = wrapperContainer.querySelector('.skip-btn');

    stackContainer.innerHTML = '';
    likedMovies = [];
    
    likeBtn.addEventListener('click', () => triggerButtonSwipe(1));
    skipBtn.addEventListener('click', () => triggerButtonSwipe(-1));

    fetchAndRenderCards();
}

export function getLikedMovies() {
    // Cleanup listeners when done
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchend', onDragEnd);
    
    return likedMovies;
}