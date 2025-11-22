import { getLocalWatchlist, updateAllWatchlistIcons } from './watchlist.js';

/**
 * Initializes infinite scrolling on a given shelf grid.
 * @param {HTMLElement} shelfGrid - The element containing the scrollable media cards.
 * @param {function(number): Promise<object>} fetcher - A function that takes a page number and returns a promise with the data.
 * @param {function(object): string} cardCreator - A function that takes a media object and returns an HTML string for its card.
 * @param {number} [startPage=1] - The page number that is currently displayed. Infinite scroll will start fetching from startPage + 1.
 */
export function initInfiniteScroll(shelfGrid, fetcher, cardCreator, startPage = 1) {
    let currentPage = startPage + 1;
    let isFetching = false; // Tracks network request status
    let isProcessingScroll = false; // Tracks scroll event handler status to prevent overlap
    let hasMore = true;
    let itemPool = [];

    async function replenishPool() {
        if (isFetching || !hasMore) return false;
        isFetching = true;

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
                isFetching = false;
                return true;
            } else {
                hasMore = false;
                isFetching = false;
                return false;
            }
        } catch (error) {
            console.error('Failed to replenish item pool for shelf:', error);
            hasMore = false;
            isFetching = false;
            return false;
        }
    }

    async function getNextValidItem() {
        while (true) {
            if (itemPool.length > 0) {
                const nextItem = itemPool.shift();
                const watchlist = getLocalWatchlist();
                const mediaType = nextItem.media_type || (nextItem.title ? 'movie' : 'tv');
                
                // Double check watchlist status (in case it changed since pooling)
                if (watchlist.has(`${mediaType}:${nextItem.id}`)) {
                    continue;
                }

                // Check if item is already displayed in the grid to avoid duplicates
                const alreadyInGrid = shelfGrid.querySelector(`.media-card[data-id="${nextItem.id}"][data-type="${mediaType}"]`);
                if (!alreadyInGrid) {
                    return nextItem;
                }
            } else if (hasMore) {
                // If pool is empty but more pages exist, fetch next page
                const success = await replenishPool();
                if (!success) return null; // Fetch failed or no more items
            } else {
                return null; // No pool and no more pages
            }
        }
    }

    // Exposed method for external replacement triggers (e.g. hiding an item)
    shelfGrid.fetchReplacement = async () => {
        const newItem = await getNextValidItem();
        if (newItem) {
            const cardHtml = cardCreator(newItem);
            if (shelfGrid) {
                 shelfGrid.insertAdjacentHTML('beforeend', cardHtml);
                 return true;
            }
        }
        return false;
    };

    shelfGrid.addEventListener('scroll', async () => {
        if (isProcessingScroll || !hasMore) return;

        const { scrollLeft, scrollWidth, clientWidth } = shelfGrid;
        
        // Trigger load when user is near the end (600px buffer)
        if (scrollLeft + clientWidth >= scrollWidth - 600) {
            isProcessingScroll = true;
            
            const loader = document.createElement('div');
            loader.className = 'loader-small-infinite';
            loader.innerHTML = '<i class="fas fa-spinner"></i>';
            shelfGrid.appendChild(loader);

            let addedCount = 0;
            // Try to append 5 items at a time
            for (let i = 0; i < 5; i++) {
                const added = await shelfGrid.fetchReplacement();
                if (added) addedCount++;
                // Stop if we run out of data entirely
                if (!hasMore && itemPool.length === 0) break;
            }

            if (shelfGrid.contains(loader)) {
                shelfGrid.removeChild(loader);
            }
            
            // Batch icon updates if we added anything
            if (addedCount > 0) {
                updateAllWatchlistIcons();
            }

            isProcessingScroll = false;
        }
    });

    // Start buffering the next page immediately in background
    replenishPool();
}
