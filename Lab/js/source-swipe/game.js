
import { discoverMedia, IMAGE_BASE_URL } from '../api.js';
import { updateTasteProfile } from '../algorithm/taste-profile.js';

let overlay;
let stackContainer;
let cardQueue = [];
let currentPage = 1;
let isFetching = false;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentCard = null;

// --- Data Fetching ---

async function fetchMoreMovies() {
    if (isFetching) return;
    isFetching = true;

    try {
        // Randomize page slightly to keep it fresh, but mostly sequential
        if (currentPage > 500) currentPage = 1;

        const data = await discoverMedia('movie', { 
            sort_by: 'popularity.desc', 
            'vote_count.gte': 200 
        }, currentPage);
        
        currentPage++;

        if (data && data.results) {
            const newMovies = data.results.filter(m => m.poster_path);
            cardQueue = [...cardQueue, ...newMovies];
            renderStack();
        }
    } catch (e) {
        console.error("SourceSwipe: Failed to fetch movies", e);
    } finally {
        isFetching = false;
    }
}

function checkQueue() {
    if (cardQueue.length < 5) {
        fetchMoreMovies();
    }
}

// --- UI Rendering ---

function createGameDOM() {
    if (document.getElementById('source-swipe-overlay')) return;

    const div = document.createElement('div');
    div.id = 'source-swipe-overlay';
    div.className = 'source-swipe-overlay';
    div.innerHTML = `
        <button class="source-swipe-close-btn" aria-label="Exit Game">
            <i class="fas fa-times"></i>
        </button>

        <div class="source-swipe-header">
            <h2>CineSwipe</h2>
            <p>Code is boring. Let's play a game instead!</p>
        </div>
        
        <div class="source-swipe-container" id="movie-stack">
            <div class="loader-container">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
        </div>

        <div class="source-swipe-controls">
            <button class="game-btn pass" id="btn-pass" aria-label="Pass" title="Pass (Left Arrow)">
                <i class="fas fa-times"></i>
            </button>
            <button class="game-btn skip" id="btn-skip" aria-label="Skip" title="Skip (Up Arrow)">
                <i class="fas fa-share"></i>
            </button>
            <button class="game-btn like" id="btn-like" aria-label="Like" title="Like (Right Arrow)">
                <i class="fas fa-heart"></i>
            </button>
        </div>
    `;
    document.body.appendChild(div);
    overlay = div;
    stackContainer = div.querySelector('#movie-stack');

    // Event Listeners
    div.querySelector('.source-swipe-close-btn').addEventListener('click', closeGame);
    document.getElementById('btn-pass').addEventListener('click', () => triggerButtonSwipe('left'));
    document.getElementById('btn-like').addEventListener('click', () => triggerButtonSwipe('right'));
    document.getElementById('btn-skip').addEventListener('click', () => triggerButtonSwipe('up'));
    
    document.addEventListener('keydown', handleKeyNav);
}

function handleKeyNav(e) {
    if (!overlay || !overlay.classList.contains('active')) return;

    switch(e.key) {
        case 'Escape': closeGame(); break;
        case 'ArrowLeft': triggerButtonSwipe('left'); break;
        case 'ArrowRight': triggerButtonSwipe('right'); break;
        case 'ArrowUp': triggerButtonSwipe('up'); break;
    }
}

function createCardElement(movie, index) {
    const el = document.createElement('div');
    el.className = 'movie-swipe-card';
    
    el.movieData = movie;

    el.style.zIndex = 1000 - index;
    // Add visual stacking effect: scale down and move down slightly for cards behind
    el.style.transform = `scale(${1 - index * 0.05}) translateY(${index * 15}px)`;
    if (index > 0) {
        el.style.opacity = 1 - (index * 0.3); // Fade out cards in back
    }
    
    const year = movie.release_date ? movie.release_date.split('-')[0] : '';

    el.innerHTML = `
        <img src="${IMAGE_BASE_URL}${movie.poster_path}" class="movie-swipe-image" alt="${movie.title}" draggable="false">
        <div class="movie-swipe-info">
            <h3 class="movie-swipe-title">${movie.title}</h3>
            <div class="movie-swipe-meta">
                ${year ? `<span>${year}</span>` : ''}
                <span class="movie-rating"><i class="fas fa-star"></i> ${movie.vote_average.toFixed(1)}</span>
            </div>
        </div>
        <div class="card-stamp nope">NOPE</div>
        <div class="card-stamp like">LIKE</div>
        <div class="card-stamp skip">SKIP</div>
    `;

    if (index === 0) {
        initDrag(el);
        currentCard = el;
    }
    
    return el;
}

function renderStack() {
    if (!stackContainer) return;
    
    const existingCards = stackContainer.querySelectorAll('.movie-swipe-card');
    if (existingCards.length >= 3) return; // Keep 3 cards in DOM

    const needed = 3 - existingCards.length;
    const toRender = cardQueue.splice(0, needed);

    toRender.forEach((movie, i) => {
        const visualIndex = existingCards.length + i;
        const card = createCardElement(movie, visualIndex);
        stackContainer.appendChild(card);
    });

    checkQueue();
}

// --- Game Interaction ---

function triggerButtonSwipe(direction) {
    if (!currentCard) return;
    swipeCard(currentCard, direction);
}

function swipeCard(card, direction) {
    let x = 0;
    let y = 0;
    let rotate = 0;

    if (direction === 'left') {
        x = -window.innerWidth * 0.8;
        rotate = -20;
    } else if (direction === 'right') {
        x = window.innerWidth * 0.8;
        rotate = 20;
    } else if (direction === 'up') {
        y = -window.innerHeight * 0.8;
        rotate = 0;
    }

    card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s';
    card.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
    card.style.opacity = '0';

    // Visual feedback
    const selector = direction === 'left' ? '.nope' : (direction === 'right' ? '.like' : '.skip');
    const stamp = card.querySelector(selector);
    if (stamp) {
        stamp.style.opacity = 1;
        if (direction === 'up') stamp.style.transform = 'translate(-50%, -50%) scale(1.2)'; 
    }

    // --- DATA INTEGRATION ---
    if (card.movieData) {
        const movie = card.movieData;
        if (direction === 'right') {
            updateTasteProfile(movie.id, 'movie', 'rated_high', null, movie);
        } else if (direction === 'left') {
            updateTasteProfile(movie.id, 'movie', 'not_interested', null, movie);
        }
        // Skip (up) does nothing to the profile
    }

    setTimeout(() => {
        card.remove();
        reindexStack();
        renderStack();
    }, 300);
}

function reindexStack() {
    const cards = stackContainer.querySelectorAll('.movie-swipe-card');
    cards.forEach((c, i) => {
        c.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease';
        c.style.zIndex = 1000 - i;
        c.style.transform = `scale(${1 - i * 0.05}) translateY(${i * 15}px)`;
        
        if (i === 0) {
            c.style.opacity = 1;
            initDrag(c);
            currentCard = c;
        } else {
            c.style.opacity = 1 - (i * 0.3);
        }
        
        c.querySelectorAll('.card-stamp').forEach(s => s.style.opacity = 0);
    });
    if (cards.length === 0) currentCard = null;
}

function closeGame() {
    if (overlay) {
        overlay.classList.remove('active');
        document.removeEventListener('keydown', handleKeyNav);
        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            overlay = null;
            stackContainer = null;
            cardQueue = [];
            currentPage = Math.floor(Math.random() * 20) + 1; 
        }, 400);
    }
}

// --- Drag Logic ---

function initDrag(el) {
    isDragging = false;
    el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

    const onDown = (e) => {
        if (e.target.closest('.source-swipe-close-btn')) return;
        if (el !== currentCard) return;
        
        startX = e.clientX || e.touches[0].clientX;
        startY = e.clientY || e.touches[0].clientY;
        isDragging = true;
        el.style.transition = 'none';
        el.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const currentX = e.clientX || e.touches[0].clientX;
        const currentY = e.clientY || e.touches[0].clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        const rotate = deltaX * 0.05;
        
        // Combine translation
        el.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotate}deg)`;

        // Opacity Calculations
        const opacityX = Math.min(Math.abs(deltaX) / 120, 1);
        const opacityY = Math.min(Math.abs(deltaY) / 120, 1) * (deltaY < 0 ? 1 : 0); // Only swipe up

        const nope = el.querySelector('.nope');
        const like = el.querySelector('.like');
        const skip = el.querySelector('.skip');

        // Reset
        like.style.opacity = 0;
        nope.style.opacity = 0;
        skip.style.opacity = 0;

        // Prioritize Swipe Up (Skip) if vertical movement dominates horizontal significantly
        if (deltaY < -50 && Math.abs(deltaY) > Math.abs(deltaX)) {
             skip.style.opacity = opacityY;
        } else {
            if (deltaX > 0) {
                like.style.opacity = opacityX;
            } else {
                nope.style.opacity = opacityX;
            }
        }
    };

    const onUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = 'grab';
        
        const currentX = e.clientX || (e.changedTouches ? e.changedTouches[0].clientX : startX);
        const currentY = e.clientY || (e.changedTouches ? e.changedTouches[0].clientY : startY);
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const threshold = 100;

        // Check vertical swipe first (Swipe Up)
        if (deltaY < -threshold && Math.abs(deltaY) > Math.abs(deltaX)) {
            swipeCard(el, 'up');
        } 
        // Check horizontal swipe
        else if (deltaX > threshold) {
            swipeCard(el, 'right');
        } else if (deltaX < -threshold) {
            swipeCard(el, 'left');
        } else {
            // Snap back
            el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            el.style.transform = `scale(1) translateY(0)`;
            el.querySelectorAll('.card-stamp').forEach(s => s.style.opacity = 0);
        }
        
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    };

    el.addEventListener('mousedown', (e) => {
        onDown(e);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    
    el.addEventListener('touchstart', (e) => {
        onDown(e);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    });
}

export function initGame() {
    createGameDOM();
    overlay.style.display = 'flex';
    
    if (cardQueue.length === 0) {
        currentPage = Math.floor(Math.random() * 20) + 1;
        fetchMoreMovies();
    } else {
        renderStack();
    }

    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}
