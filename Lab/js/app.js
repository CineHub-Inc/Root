
import { handleRouteChange } from './router.js';
import { setActiveLink } from './main-menu.js';
import { initAuth } from './auth.js';
import { updateAllWatchlistIcons } from './watchlist.js';

function init() {
    initAuth(); // Initialize auth listener

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#home';
        setActiveLink(hash);
        handleRouteChange();
    });

    // Add a global listener for real-time data updates from Firestore
    document.addEventListener('user-data-updated', async () => {
        updateAllWatchlistIcons();
        // If the user is on the library page, re-render it to show changes
        if (window.location.hash.startsWith('#library')) {
            const appRoot = document.getElementById('app-root');
            const activeFilter = appRoot.querySelector('.chip.active')?.dataset.filter;
            const activeMediaType = appRoot.querySelector('.media-tab.active')?.dataset.mediaType;
            
            const { renderLibraryPage } = await import('./watchlist-page.js');
            renderLibraryPage(appRoot, { activeFilter, activeMediaType, isRefresh: true });
        }
    });

    // Listen for auth state changes to refresh the view (e.g. show personalized shelves)
    document.addEventListener('auth-refresh', () => {
        handleRouteChange();
    });

    // Initial load
    const initialHash = window.location.hash || '#home';
    if (!window.location.hash) {
        window.location.hash = '#home';
    } else {
        setActiveLink(initialHash);
        handleRouteChange();
    }
}

document.addEventListener('DOMContentLoaded', init);
