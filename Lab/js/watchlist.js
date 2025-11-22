import { db, auth } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateTasteProfile } from './algorithm/taste-profile.js';
import { markSeasonAsWatched, clearSeriesWatchProgress } from './watch-progress.js';
import { getMediaDetails } from './api.js';


let localWatchlist = new Map();
let unsubscribeWatchlist = null;

export function getLocalWatchlist() {
    return localWatchlist;
}

export function initWatchlistSync() {
    if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
    }
    const user = auth.currentUser;
    if (!user) {
        localWatchlist.clear();
        updateAllWatchlistIcons(); // Ensure UI is cleared on logout
        return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
        const docRef = doc(db, "watchlists", user.uid);
        let isFirstLoad = true;
        
        unsubscribeWatchlist = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const items = data.items || {};
                let itemList = Object.entries(items).map(([key, value]) => {
                    if (typeof value === 'string') return [key, { status: value, order: Infinity }];
                    return [key, value];
                });
                itemList.sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity));
                localWatchlist = new Map(itemList);
            } else {
                localWatchlist.clear();
            }
            
            // Dispatch a global event so the UI can react
            document.dispatchEvent(new CustomEvent('user-data-updated'));
            
            if (isFirstLoad) {
                isFirstLoad = false;
                resolve();
            }
        }, (error) => {
            console.error("Watchlist sync error:", error);
            if (isFirstLoad) {
                isFirstLoad = false;
                reject(error); // Reject on error during initial load
            }
        });
    });
}

export function detachWatchlistSync() {
    if (unsubscribeWatchlist) {
        unsubscribeWatchlist();
        unsubscribeWatchlist = null;
    }
    localWatchlist.clear();
    updateAllWatchlistIcons(); // Ensure UI is cleared
}

export function getItemStatus(mediaId, mediaType) {
    if (!mediaId || !mediaType) return null;
    const item = localWatchlist.get(`${mediaType}:${mediaId}`);
    return item ? item.status : null;
}

export async function updateItemStatus(mediaId, mediaType, status) {
    const user = auth.currentUser;
    if (!user) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const itemIdentifier = `${mediaType}:${mediaId}`;
    const previousStatus = getItemStatus(mediaId, mediaType) || 'remove';

    try {
        if (status === 'remove') {
            await updateDoc(docRef, { [`items.${itemIdentifier}`]: deleteField() });
        } else {
            const currentItem = localWatchlist.get(itemIdentifier);
            const order = currentItem?.order ?? (localWatchlist.size > 0 ? Math.max(...Array.from(localWatchlist.values()).map(item => item.order || 0)) + 1 : 0);
            
            const userRating = currentItem?.userRating || null;
            const updatedItem = { status, order };
            if (userRating) {
                updatedItem.userRating = userRating;
            }

            await updateDoc(docRef, { [`items.${itemIdentifier}`]: updatedItem });
        }
        
        if (mediaType === 'tv') {
            if (status === 'watched') {
                const details = await getMediaDetails(mediaId, mediaType);
                if (details && details.seasons) {
                    const promises = details.seasons
                        .filter(season => season.season_number > 0 && season.episode_count > 0)
                        .map(season => markSeasonAsWatched(mediaId, season.season_number, season.episode_count));
                    await Promise.all(promises);
                }
            } else if (previousStatus === 'watched' && status !== 'watched') {
                await clearSeriesWatchProgress(mediaId);
            }
        }

        updateTasteProfile(mediaId, mediaType, status, previousStatus);
        return true;
    } catch (e) {
        console.error("Error updating watchlist status: ", e);
        if (e.code === 'not-found' && status !== 'remove') {
             try {
                const order = localWatchlist.size > 0 ? Math.max(...Array.from(localWatchlist.values()).map(item => item.order || 0)) + 1 : 0;
                const newItem = { status, order };
                await setDoc(docRef, { items: { [itemIdentifier]: newItem } }, { merge: true });
                updateTasteProfile(mediaId, mediaType, status, previousStatus);
                return true;
             } catch (setErr) {
                 console.error("Error creating watchlist doc:", setErr);
                 return false;
             }
        }
        return false;
    }
}

export async function updateItemRating(mediaId, mediaType, rating) {
    const user = auth.currentUser;
    if (!user) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const itemIdentifier = `${mediaType}:${mediaId}`;
    
    if (!localWatchlist.has(itemIdentifier)) {
        console.error("Attempted to rate an item that is not on any list.");
        return false;
    }

    try {
        await updateDoc(docRef, {
            [`items.${itemIdentifier}.userRating`]: rating
        });
        return true;
    } catch (e) {
        console.error("Error updating item rating: ", e);
        return false;
    }
}

export async function updateWatchlistOrder(orderedIds) {
    const user = auth.currentUser;
    if (!user || orderedIds.length === 0) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const newItemsMap = {};
    const currentList = getLocalWatchlist();

    orderedIds.forEach((itemId, index) => {
        const currentItem = currentList.get(itemId);
        if (currentItem) {
            newItemsMap[itemId] = {
                status: currentItem.status,
                order: index,
                ...(currentItem.userRating && { userRating: currentItem.userRating })
            };
        }
    });

    try {
        await updateDoc(docRef, { items: newItemsMap });
        return true;
    } catch (e) {
        console.error("Error updating watchlist order:", e);
        return false;
    }
}

export function updateWatchlistIcon(mediaId, mediaType) {
    document.querySelectorAll(`[data-id="${mediaId}"][data-type="${mediaType}"]`).forEach(container => {
        const itemData = localWatchlist.get(`${mediaType}:${mediaId}`);
        const status = itemData ? itemData.status : null;
        const userRating = itemData ? itemData.userRating : null;
        
        // Handle 4-button system on media cards
        const watchlistBtn = container.querySelector('.action-button[data-status="watchlist"]');
        if (watchlistBtn) { 
            const watchedBtn = container.querySelector('.action-button[data-status="watched"]');
            const hiddenBtn = container.querySelector('.action-button[data-status="not_interested"]');
            
            const buttons = [
                { el: watchlistBtn, status: 'watchlist', icon: 'bookmark' },
                { el: watchedBtn, status: 'watched', icon: 'circle-check' },
                { el: hiddenBtn, status: 'not_interested', icon: 'eye-slash' }
            ];

            buttons.forEach(btnInfo => {
                if (btnInfo.el) {
                    const iconEl = btnInfo.el.querySelector('i');
                    if (status === btnInfo.status) {
                        btnInfo.el.classList.add('active');
                        iconEl.className = `fa-solid fa-${btnInfo.icon}`;
                    } else {
                        btnInfo.el.classList.remove('active');
                        iconEl.className = `fa-regular fa-${btnInfo.icon}`;
                    }
                }
            });

            // Handle rating button
            const rateBtn = container.querySelector('.action-button[data-action="rate"]');
            if (rateBtn) {
                const iconEl = rateBtn.querySelector('i');
                if (userRating) {
                    rateBtn.setAttribute('aria-label', `Your rating: ${userRating}/10`);
                    iconEl.className = 'fa-solid fa-star';
                } else {
                    rateBtn.setAttribute('aria-label', 'Rate');
                    iconEl.className = 'fa-regular fa-star';
                }
            }
            return; 
        }

        // Handle single-button system on hero pages
        const singleButton = container.querySelector('.watchlist-toggle');
        if (singleButton) {
            const icon = singleButton.querySelector('i');
            const text = singleButton.querySelector('.watchlist-btn-text');
            
            singleButton.classList.remove('saved', 'watched', 'not-interested');
            icon.className = 'fa-regular fa-bookmark';
            if (text) text.textContent = 'Add to List';

            switch (status) {
                case 'watchlist':
                    singleButton.classList.add('saved');
                    icon.className = 'fa-solid fa-bookmark';
                    if (text) text.textContent = 'On Watchlist';
                    break;
                case 'watched':
                    singleButton.classList.add('watched');
                    icon.className = 'fa-solid fa-circle-check';
                    if (text) text.textContent = 'Watched';
                    break;
                case 'not_interested':
                    singleButton.classList.add('not-interested');
                    icon.className = 'fa-solid fa-eye-slash';
                    if (text) text.textContent = 'Hidden';
                    break;
            }
        }
    });
}


export function updateAllWatchlistIcons() {
    const isLibraryPage = window.location.hash.startsWith('#library');

    // Update all media cards
    document.querySelectorAll('.media-card').forEach(card => {
        const { id, type } = card.dataset;
        if (id && type) {
            // 1. Update icons
            updateWatchlistIcon(id, type);

            // 2. Update visibility in discovery modules
            if (!isLibraryPage) {
                const cardLink = card.closest('a.media-card-link');
                if (cardLink) {
                    const status = getItemStatus(id, type);
                    if (status) {
                        // Item is in library, hide from discovery
                        cardLink.classList.add('hidden-in-discovery');
                    } else {
                        // Item is NOT in library (e.g. removed), show in discovery
                        cardLink.classList.remove('hidden-in-discovery');
                        // Ensure display style (from previous inline hiding) is reset
                        if (cardLink.style.display === 'none') {
                            cardLink.style.display = '';
                            cardLink.style.opacity = '1';
                            cardLink.style.transform = 'scale(1)';
                        }
                    }
                }
            }
        }
    });
    
    // Update hero watchlist button if it exists
    const heroBtn = document.getElementById('hero-watchlist-btn');
    if (heroBtn) {
        const { id, type } = heroBtn.dataset;
        if (id && type) {
            updateWatchlistIcon(id, type);
        }
    }
}