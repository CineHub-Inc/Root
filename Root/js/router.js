import { renderHomePageShelves } from './shelves.js';
import { renderFilmsPage } from './films-page.js';
import { renderSeriesPage } from './series-page.js';
import { renderLibraryPage } from './watchlist-page.js';
import { renderMediaPage } from './media-page/index.js';
import { renderPersonPage } from './person-page.js';
import { renderTasteProfilePage } from './taste-profile-page.js';
import { renderManageKeysPage } from './manage-keys-page.js';
import { auth } from './firebase.js';
import { showAuthModal } from './auth.js';
import { showToast } from './toast.js';

const routes = {
    '#home': renderHomePageShelves,
    '#films': renderFilmsPage,
    '#series': renderSeriesPage,
    '#library': renderLibraryPage,
    '#media': renderMediaPage,
    '#person': renderPersonPage,
    '#taste-profile': renderTasteProfilePage,
    '#manage-keys': renderManageKeysPage,
};

const protectedRoutes = new Set(['#library', '#taste-profile', '#manage-keys']);

export function handleRouteChange() {
    const fullHash = window.location.hash || '#home';
    const [hash, queryString] = fullHash.split('?');
    
    // Toggle filter button visibility based on the current page
    if (hash === '#films' || hash === '#series') {
        document.body.classList.add('filters-available');
    } else {
        document.body.classList.remove('filters-available');
    }

    // Route protection
    if (protectedRoutes.has(hash) && !auth.currentUser) {
        // Redirect to home, show login modal and a toast
        window.location.hash = '#home';
        showAuthModal();
        showToast({ message: 'Login to see this page', type: 'info' });
        return;
    }

    const routeHandler = routes[hash] || routes['#home']; // Default to home
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`; // Show loader immediately
    
    const params = new URLSearchParams(queryString);
    const paramsObject = Object.fromEntries(params.entries());

    routeHandler(appRoot, paramsObject);
}