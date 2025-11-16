import { initSearchLogic } from '../search-bar.js';
import { init as initHistoryTrail } from '../history-trail/history-trail.js';
import { showAuthModal } from '../auth.js';
import { showPreferencesModal } from '../preferences-modal.js';
import { getCurrentUserDoc } from '../user-state.js';

function render() {
    const controlsContainer = document.getElementById('page-controls');
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
        <div class="command-bar" id="command-bar">
            <div class="search-widget" id="command-bar-search-widget">
                 <input type="search" class="search-input" id="command-bar-search-input" placeholder="Search...">
                <button class="command-bar-btn search-toggle" id="command-bar-search-toggle" aria-label="Toggle Search">
                    <i class="fas fa-search"></i>
                </button>
                <div class="search-results" id="search-results"></div>
            </div>

            <button class="command-bar-btn filter-trigger-btn" id="filter-trigger-btn" aria-label="Open filters">
                <i class="fas fa-sliders-h"></i>
            </button>
            
            <div class="history-trail-widget" id="history-trail-widget">
                <button class="command-bar-btn" id="history-trail-toggle" aria-label="View history">
                    <i class="fas fa-history"></i>
                </button>
                <div id="history-trail-dropdown" class="history-trail-dropdown"></div>
            </div>

            <div id="command-bar-login-widget">
                 <button class="command-bar-btn" id="login-btn" aria-label="Login">
                    <i class="fa-regular fa-circle-user"></i>
                </button>
            </div>

            <div class="profile-widget" id="command-bar-profile-widget">
                <button class="command-bar-btn" id="profile-toggle-btn" aria-haspopup="true" aria-expanded="false" aria-label="Profile menu">
                    <i class="fa-regular fa-circle-user"></i>
                </button>
                <div class="profile-dropdown" role="menu">
                    <a href="#taste-profile" class="profile-dropdown-item" role="menuitem">
                        <i class="fas fa-dna"></i>
                        <span>Taste Profile</span>
                    </a>
                     <button id="content-prefs-btn" class="profile-dropdown-item" role="menuitem">
                        <i class="fas fa-sliders-h"></i>
                        <span>Content Preferences</span>
                    </button>
                    <div id="admin-section" style="display: none;">
                        <div class="profile-dropdown-divider"></div>
                        <a href="#manage-keys" class="profile-dropdown-item" role="menuitem">
                            <i class="fas fa-key"></i>
                            <span>Manage Keys</span>
                        </a>
                    </div>
                    <div class="profile-dropdown-divider"></div>
                    <a href="#" id="logout-link" class="profile-dropdown-item" role="menuitem">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function closeAllWidgets(exceptId = null) {
    // Close Search
    if (exceptId !== 'command-bar-search-widget') {
        document.getElementById('command-bar')?.classList.remove('is-active');
        document.getElementById('command-bar-search-widget')?.classList.remove('is-active');
    }

    // Close History
    if (exceptId !== 'history-trail-widget') {
        document.getElementById('history-trail-widget')?.classList.remove('is-active');
    }

    // Close Profile
    if (exceptId !== 'command-bar-profile-widget') {
        const profileWidget = document.getElementById('command-bar-profile-widget');
        if (profileWidget?.classList.contains('is-active')) {
            profileWidget.classList.remove('is-active');
            profileWidget.querySelector('#profile-toggle-btn')?.setAttribute('aria-expanded', 'false');
        }
    }
}

function addEventListeners() {
    const commandBar = document.getElementById('command-bar');
    const searchWidget = document.getElementById('command-bar-search-widget');
    const searchToggle = document.getElementById('command-bar-search-toggle');
    const searchInput = document.getElementById('command-bar-search-input');

    if (!commandBar || !searchWidget || !searchToggle) return;

    searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasActive = commandBar.classList.contains('is-active');

        // Close other widgets before toggling search
        if (!wasActive) {
            document.dispatchEvent(new CustomEvent('close-command-bar-widgets', { detail: { except: 'command-bar-search-widget' } }));
        }
        
        const isActive = commandBar.classList.toggle('is-active', !wasActive);
        searchWidget.classList.toggle('is-active', !wasActive); // for mobile

        if (isActive) {
            searchInput.focus();
        }
    });

    searchInput.addEventListener('blur', () => {
        // Use a small delay to see where focus goes.
        setTimeout(() => {
            const commandBar = document.getElementById('command-bar');
            const searchResults = document.getElementById('search-results');
            const activeEl = document.activeElement;

            // If focus is still inside the command bar or its results, do nothing.
            if (commandBar.contains(activeEl) || searchResults.contains(activeEl)) {
                return;
            }

            // Otherwise, close the search bar.
            commandBar.classList.remove('is-active');
        }, 150);
    });

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAuthModal();
        });
    }

    const profileWidget = document.getElementById('command-bar-profile-widget');
    const profileToggle = document.getElementById('profile-toggle-btn');
    
    if (profileWidget && profileToggle) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasActive = profileWidget.classList.contains('is-active');
            
            if (!wasActive) {
                document.dispatchEvent(new CustomEvent('close-command-bar-widgets', { detail: { except: 'command-bar-profile-widget' } }));
            }

            const isActive = profileWidget.classList.toggle('is-active', !wasActive);
            profileToggle.setAttribute('aria-expanded', isActive);
        });

        // Close dropdown when an item is clicked
        const dropdown = profileWidget.querySelector('.profile-dropdown');
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                const prefsBtn = e.target.closest('#content-prefs-btn');
                
                if (prefsBtn) {
                    showPreferencesModal();
                }

                if (e.target.closest('.profile-dropdown-item')) {
                    profileWidget.classList.remove('is-active');
                    profileToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }
}


function init() {
    render();
    addEventListeners();
    initSearchLogic();
    initHistoryTrail();
    
    // Central listener to close widgets
    document.addEventListener('close-command-bar-widgets', (e) => {
        closeAllWidgets(e.detail?.except);
    });

    const commandBar = document.getElementById('command-bar');
    if (commandBar) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    const wasActive = mutation.oldValue?.includes('is-active');
                    const isActive = mutation.target.classList.contains('is-active');

                    if (wasActive && !isActive) {
                        const searchInput = document.getElementById('command-bar-search-input');
                        if (searchInput) {
                            searchInput.value = '';
                        }
                        document.dispatchEvent(new CustomEvent('clear-search-results'));
                    }
                }
            }
        });
        observer.observe(commandBar, { attributes: true, attributeOldValue: true });
    }

    // Listen for user data updates to show/hide admin controls
    document.addEventListener('user-data-updated', () => {
        const adminSection = document.getElementById('admin-section');
        if (!adminSection) return;

        const userData = getCurrentUserDoc();
        const isAdmin = userData && userData.userType === 'admin';
        adminSection.style.display = isAdmin ? 'block' : 'none';
    });
}

init();
