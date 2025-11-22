
import './app.js';
import './ui-components.js';
import './shelves.js';
import './films-page.js';
import './series-page.js';
import './item-details.js';
import './person-page.js';
import './responsive.js';
import './modal.js';
import './auth.js';
import './toast.js';
import './watchlist.js';
import './watchlist-page.js';
import './back-to-top.js';
import './command-bar/command-bar.js';
import './rating-system/rating-modal.js';
import './taste-profile-page.js';
import './preferences-modal.js';
import './profile-modal.js';
import './watch-progress.js';
import './watch-feature.js';
import './manage-keys-page.js';
import { initDonation } from './donation.js';
import { initInterceptor } from './source-swipe/interceptor.js';

// Initialize donation button listener
document.addEventListener('DOMContentLoaded', () => {
    initDonation();
    initInterceptor();
});

// Global delegated event listeners
document.body.addEventListener('click', e => {
    // Close any open popups when clicking outside
    const commandBar = document.getElementById('command-bar');
    if (commandBar && !commandBar.contains(e.target)) {
        const searchWidget = document.getElementById('command-bar-search-widget');
        commandBar.classList.remove('is-active');
        if (searchWidget) searchWidget.classList.remove('is-active');
    }

    const historyWidget = document.getElementById('history-trail-widget');
    if (historyWidget && !historyWidget.contains(e.target)) {
        historyWidget.classList.remove('is-active');
    }
    
    const profileWidget = document.getElementById('command-bar-profile-widget');
    if (profileWidget && !profileWidget.contains(e.target)) {
        profileWidget.classList.remove('is-active');
        const profileBtn = profileWidget.querySelector('#profile-toggle-btn');
        if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
    }
});
