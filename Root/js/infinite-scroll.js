import { getLocalWatchlist, updateAllWatchlistIcons } from './watchlist.js';

/**
 * Initializes infinite scrolling on a given shelf grid.
 * @param {HTMLElement} shelfGrid - The element containing the scrollable media cards.
 * @param {function(number): Promise<object>} fetcher - A function that takes a page number and returns a promise with the data.
 * @param {function(object): string} cardCreator - A function that takes a media object and returns an HTML string for its card.
 * @param {number} [startPage=1] - The page number to start from.
 */
export function initInfiniteScroll(shelfGrid, fetcher, cardCreator, startPage = 1) {
    let currentPage = startPage;
    let isLoading = false;
    let hasMore = true;
    let itemPool = [];

    async function replenishPool() {
        if (isLoading || !hasMore) return false;
        isLoading = true;

        try {
            const data = await fetcher(currentPage);
            if (data && data.results && data.results.length > 0) {
                const watchlist = getLocalWatchlist();
                const newItems = data.results.filter(item => {
                    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
                    return !watchlist.has(`${mediaType}:${item.id}`);
                });
                itemPool.push(...newItems);
                
                hasMore = data.page < data.total_pages;
                currentPage++;
                return true;
            } else {
                hasMore = false;
                return false;
            }
        } catch (error) {
            console.error('Failed to replenish item pool for shelf:', error);
            hasMore = false;
            return false;
        } finally {
            isLoading = false;
        }
    }

    async function getNextValidItem() {
        while (true) {
            if (itemPool.length > 0) {
                const nextItem = itemPool.shift();
                const watchlist = getLocalWatchlist();
                const mediaType = nextItem.media_type || (nextItem.title ? 'movie' : 'tv');
                if (!watchlist.has(`${mediaType}:${nextItem.id}`)) {
                    return nextItem;
                }
            } else if (hasMore) {
                const success = await replenishPool();
                if (!success) return null;
            } else {
                return null;
            }
        }
    }

    shelfGrid.fetchReplacement = async () => {
        const newItem = await getNextValidItem();
        if (newItem) {
            const cardHtml = cardCreator(newItem);
            if (shelfGrid) {
                 shelfGrid.insertAdjacentHTML('beforeend', cardHtml);
                 updateAllWatchlistIcons();
            }
        }
    };

    shelfGrid.addEventListener('scroll', async () => {
        if (isLoading || !hasMore) return;

        const { scrollLeft, scrollWidth, clientWidth } = shelfGrid;
        
        if (scrollLeft + clientWidth >= scrollWidth - 400) {
            isLoading = true;
            
            const loader = document.createElement('div');
            loader.className = 'loader-small-infinite';
            loader.innerHTML = '<i class="fas fa-spinner"></i>';
            shelfGrid.appendChild(loader);

            for (let i = 0; i < 5; i++) {
                await shelfGrid.fetchReplacement();
                if (!hasMore && itemPool.length === 0) break;
            }

            if (shelfGrid.contains(loader)) {
                shelfGrid.removeChild(loader);
            }
            isLoading = false;
        }
    });

    // Pre-fill the pool on initialization
    replenishPool();
}