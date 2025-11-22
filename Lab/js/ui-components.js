
import { IMAGE_BASE_URL } from './api.js';
import { initInfiniteScroll } from './infinite-scroll.js';
import { updateAllWatchlistIcons, getLocalWatchlist } from './watchlist.js';
import { escapeHTML } from './media-page/utils.js';

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 * @param {Array<any>} array The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Creates an HTML string for a single media card.
 * @param {object} media - The media object from the TMDb API.
 * @param {object} [options={}] - Optional parameters for the card.
 * @param {string} [options.hrefParams=''] - Extra parameters to add to the href URL.
 * @param {boolean} [options.draggable=false] - Whether the card should be draggable.
 * @param {object} [options.cardDataAttrs={}] - Extra data attributes to add to the card div.
 * @returns {string} - The HTML string for the media card.
 */
export function createMediaCard(media, options = {}) {
    const { hrefParams = '', draggable = false, cardDataAttrs = {} } = options;
    if (!media.poster_path) return '';

    const posterUrl = `${IMAGE_BASE_URL}${media.poster_path}`;
    // Sanitize title for HTML attribute and text content
    const title = escapeHTML(media.title || media.name);
    const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
    const href = `#media?type=${mediaType}&id=${media.id}${hrefParams}`;

    const dataAttributes = Object.entries({
        id: media.id,
        type: mediaType,
        title: title,
        ...cardDataAttrs
    }).map(([key, value]) => `data-${key}="${escapeHTML(value)}"`).join(' ');

    return `
        <a href="${href}" class="media-card-link" ${draggable ? 'draggable="true"' : ''}>
            <div class="media-card" ${dataAttributes}>
                <img src="${posterUrl}" alt="${title}" loading="lazy">
                <div class="media-card-overlay">
                    <div class="status-tag-placeholder"></div>
                    <div class="media-card-overlay-content">
                        <div class="primary-metadata">
                            <!-- Year and Rating will be injected by JS -->
                        </div>
                        <ul class="details-list">
                            <!-- Details will be injected by JS -->
                        </ul>
                        <div class="media-card-actions">
                            <button class="action-button" data-status="watchlist" aria-label="Watchlist">
                                <i class="fa-regular fa-bookmark"></i>
                            </button>
                            <button class="action-button" data-status="watched" aria-label="Watched">
                                <i class="fa-regular fa-circle-check"></i>
                            </button>
                            <button class="action-button" data-action="rate" aria-label="Rate">
                                <i class="fa-regular fa-star"></i>
                            </button>
                            <button class="action-button" data-status="not_interested" aria-label="Hide">
                                <i class="fa-regular fa-eye-slash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    `;
}

/**
 * Sets up automatic scrolling for a shelf.
 * @param {HTMLElement} shelfGrid - The grid element to animate.
 */
function setupAutoplay(shelfGrid) {
    let autoplayInterval = null;

    const startAutoplay = () => {
        if (autoplayInterval) clearInterval(autoplayInterval);
        autoplayInterval = setInterval(() => {
            const { scrollLeft, scrollWidth, clientWidth } = shelfGrid;
            const scrollAmount = clientWidth * 0.8;

            if (scrollLeft + clientWidth >= scrollWidth - 10) {
                shelfGrid.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                shelfGrid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }, 10000); // 10 seconds
    };

    const stopAutoplay = () => {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
    };

    shelfGrid.addEventListener('mouseenter', stopAutoplay, { passive: true });
    shelfGrid.addEventListener('mouseleave', startAutoplay, { passive: true });

    startAutoplay();
}


/**
 * Creates and renders a single shelf of media content.
 * @param {HTMLElement} container - The parent element to append the shelf to.
 * @param {string} title - The title for the shelf.
 * @param {function(number): Promise<object>} fetcher - A function that takes a page number and returns a promise with the data.
 * @param {object} [options] - Configuration options for the shelf.
 * @param {boolean} [options.randomPage=false] - Whether to load a random initial page.
 * @param {boolean} [options.spreadRandom=false] - Fetches a random selection from multiple pages.
 * @param {boolean} [options.autoplay=false] - Whether to enable auto-scrolling.
 * @param {boolean} [options.isPersonalized=false] - Indicates a personalized shelf with a non-paginated fetcher.
 */
export async function renderShelf(container, title, fetcher, options = {}) {
    const safeTitle = escapeHTML(title);
    const shelfId = safeTitle.replace(/\s+/g, '-').toLowerCase();
    const shelfElement = document.createElement('section');
    shelfElement.className = 'shelf';
    shelfElement.setAttribute('aria-labelledby', shelfId);

    shelfElement.innerHTML = `
        <div class="shelf-header">
            <h2 class="shelf-title" id="${shelfId}">${safeTitle}</h2>
        </div>
        <div class="shelf-grid-container">
            <div class="loader-small"><i class="fas fa-spinner"></i></div>
        </div>
        <div class="shelf-nav">
            <button class="shelf-prev" aria-label="Previous" disabled><i class="fas fa-chevron-left"></i></button>
            <button class="shelf-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;
    container.appendChild(shelfElement);

    const gridContainer = shelfElement.querySelector('.shelf-grid-container');

    try {
        let dataForGrid = [];
        let initialPageForScroll = 1;
        let originalData; // To store the paginated response

        if (options.isPersonalized) {
            dataForGrid = await fetcher(); // Personalized fetcher returns flat array.
        } else if (options.spreadRandom) {
            const NUM_PAGES_TO_FETCH = 5;
            const ITEMS_PER_PAGE = 4;
            const MAX_PAGE = 10;
            
            const pagesToFetch = new Set();
            while(pagesToFetch.size < NUM_PAGES_TO_FETCH) {
                pagesToFetch.add(Math.floor(Math.random() * MAX_PAGE) + 1);
            }

            const pagePromises = Array.from(pagesToFetch).map(page => fetcher(page));
            const pageResults = await Promise.all(pagePromises);
            
            let allItems = [];
            for (const pageData of pageResults) {
                if (pageData && pageData.results && pageData.results.length > 0) {
                    shuffleArray(pageData.results);
                    allItems.push(...pageData.results.slice(0, ITEMS_PER_PAGE));
                }
            }
            shuffleArray(allItems);
            dataForGrid = allItems;
        } else {
            const initialPage = options.randomPage ? Math.floor(Math.random() * 10) + 1 : 1;
            initialPageForScroll = initialPage;
            originalData = await fetcher(initialPage);
            if (originalData && originalData.results) {
                dataForGrid = originalData.results;
            }
        }

        if (dataForGrid.length > 0) {
            const watchlist = getLocalWatchlist();
            const filteredResults = dataForGrid.filter(item => {
                const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
                const status = watchlist.get(`${mediaType}:${item.id}`);
                return !status;
            });

            if (filteredResults.length > 0) {
                const gridHtml = filteredResults.map(createMediaCard).join('');
                gridContainer.innerHTML = `<div class="shelf-grid" role="group">${gridHtml}</div>`;
                const shelfGrid = gridContainer.querySelector('.shelf-grid');
                
                if (!options.isPersonalized && !options.spreadRandom && originalData) {
                    initInfiniteScroll(shelfGrid, fetcher, createMediaCard, initialPageForScroll);
                }
                
                setupShelfNavigation(shelfElement, shelfGrid);
                if (options.autoplay) {
                    setupAutoplay(shelfGrid);
                }
                updateAllWatchlistIcons();
            } else {
                 gridContainer.innerHTML = `<p>No content to display in this section.</p>`;
            }
        } else {
            gridContainer.innerHTML = `<p>Could not load content for this section.</p>`;
        }
    } catch (error) {
        console.error(`Error rendering shelf "${title}":`, error);
        gridContainer.innerHTML = `<p>Could not load content for this section.</p>`;
    }
}

function setupShelfNavigation(shelfElement, shelfGrid) {
    const prevBtn = shelfElement.querySelector('.shelf-prev');
    const nextBtn = shelfElement.querySelector('.shelf-next');
    
    function updateNavButtons() {
        const { scrollLeft, scrollWidth, clientWidth } = shelfGrid;
        prevBtn.disabled = scrollLeft < 10;
        // Disable next when we are very close to the end
        nextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 10;
    }

    prevBtn.addEventListener('click', () => {
        const scrollAmount = shelfGrid.clientWidth * 0.8;
        shelfGrid.scrollLeft -= scrollAmount;
    });

    nextBtn.addEventListener('click', () => {
        const scrollAmount = shelfGrid.clientWidth * 0.8;
        shelfGrid.scrollLeft += scrollAmount;
    });

    // Use a timeout to ensure initial scroll position is set before checking
    shelfGrid.addEventListener('scroll', updateNavButtons, { passive: true });
    
    // Initial check
    setTimeout(updateNavButtons, 100);
}
