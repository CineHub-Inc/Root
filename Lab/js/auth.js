
import { auth, db } from './firebase.js';
import { 
    onAuthStateChanged,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openModal, closeModal } from './modal.js';
import { initWatchlistSync, detachWatchlistSync, getLocalWatchlist } from './watchlist.js';
import { showToast } from './toast.js';
import { showProgressBar, updateProgress, hideProgressBar } from './loading-progress-bar/loading-progress-bar.js';
import { 
    clearTasteProfile, 
    buildInitialProfileFromLibrary,
    fetchAndCacheExplicitPreferences
} from './algorithm/taste-profile.js';
import { initWatchProgressSync, detachWatchProgressSync } from './watch-progress.js';
import { syncCurrentUser, detachCurrentUserSync } from './user-state.js';


async function checkForNewEpisodes() {
    try {
        const { getLocalWatchlist, updateItemStatus } = await import('./watchlist.js');
        const { getMediaDetails } = await import('./api.js');
        const { getWatchedProgress } = await import('./watch-progress.js');
    
        const watchlist = getLocalWatchlist();
        const caughtUpSeries = Array.from(watchlist.entries())
            .filter(([, value]) => value.status === 'caught-up')
            .map(([key]) => key.split(':')[1]); // get just the IDs
    
        if (caughtUpSeries.length === 0) return;
        
        for (const seriesId of caughtUpSeries) {
            try {
                const details = await getMediaDetails(seriesId, 'tv');
                if (!details || !details.last_episode_to_air) continue;
    
                const progress = getWatchedProgress();
                const seriesProgress = progress[seriesId] || {};
                const lastEpisode = details.last_episode_to_air;
                
                const lastWatchedSeasonKey = `s${lastEpisode.season_number}`;
                const watchedEpisodesInLastSeason = new Set(seriesProgress[lastWatchedSeasonKey] || []);
                
                const highestWatchedSeason = Math.max(0, ...Object.keys(seriesProgress)
                    .filter(k => k.startsWith('s'))
                    .map(k => parseInt(k.substring(1)))
                );
    
                if (lastEpisode.season_number > highestWatchedSeason) {
                    await updateItemStatus(seriesId, 'tv', 'watchlist');
                    continue; 
                }
                
                if (!watchedEpisodesInLastSeason.has(lastEpisode.episode_number)) {
                    await updateItemStatus(seriesId, 'tv', 'watchlist');
                }
            } catch (error) {
                console.error(`Error checking for new episodes for series ${seriesId}:`, error);
            }
        }
    } catch (e) {
        console.error("Failed to dynamically import modules for new episode check:", e);
    }
}

function getAuthModalHtml() {
    return `
        <div class="auth-modal-content">
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login">Login</button>
                <button class="auth-tab" data-tab="signup">Sign Up</button>
            </div>
            <div id="login-container" class="auth-form-container active">
                <form id="login-form" class="auth-form">
                    <div class="form-group">
                        <label for="login-email">Email Address</label>
                        <input type="email" id="login-email" placeholder="Enter your email" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="login-password" required>
                            <button type="button" class="toggle-password" aria-label="Show password">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div id="login-error" class="auth-error"></div>
                    <button type="submit" class="auth-submit-btn">Login</button>
                </form>
            </div>
            <div id="signup-container" class="auth-form-container">
                 <form id="signup-form" class="auth-form">
                    <div class="form-group">
                        <label for="signup-email">Email Address</label>
                        <input type="email" id="signup-email" required>
                    </div>
                    <div class="form-group">
                        <label for="signup-password">Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="signup-password" minlength="6" required>
                             <button type="button" class="toggle-password" aria-label="Show password">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                     <div class="form-group">
                        <label for="signup-confirm-password">Confirm Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="signup-confirm-password" minlength="6" required>
                             <button type="button" class="toggle-password" aria-label="Show password">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div id="signup-error" class="auth-error"></div>
                    <button type="submit" class="auth-submit-btn">Sign Up</button>
                </form>
            </div>
        </div>
    `;
}

export function showAuthModal() {
    openModal(getAuthModalHtml(), 'auth-modal');
    setupAuthModalListeners();
}

function setupAuthModalListeners() {
    const modal = document.querySelector('.modal-container');

    // Tab switching
    modal.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelector('.auth-tab.active').classList.remove('active');
            tab.classList.add('active');

            modal.querySelector('.auth-form-container.active').classList.remove('active');
            modal.querySelector(`#${tab.dataset.tab}-container`).classList.add('active');
        });
    });

    // Form submissions
    modal.querySelector('#login-form').addEventListener('submit', handleLogin);
    modal.querySelector('#signup-form').addEventListener('submit', handleSignUp);

    // Password visibility toggles
    modal.querySelectorAll('.toggle-password').forEach(togglePassword => {
        togglePassword.addEventListener('click', () => {
            const passwordInput = togglePassword.previousElementSibling;
            const icon = togglePassword.querySelector('i');
            const isPassword = passwordInput.type === 'password';

            passwordInput.type = isPassword ? 'text' : 'password';
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
            togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('.auth-submit-btn');
    const modalContent = e.target.closest('.auth-modal-content');

    submitBtn.disabled = true;
    errorDiv.classList.remove('show');

    if (modalContent) modalContent.style.visibility = 'hidden';
    showProgressBar();

    try {
        updateProgress(10, 'Authenticating...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await signInWithEmailAndPassword(auth, email.trim(), password);
        
        updateProgress(40, 'Syncing your library...');
        // onAuthStateChanged will trigger the sync
        
        // Taste profile generation happens after sync in onAuthStateChanged
        
        updateProgress(95, 'Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        updateProgress(100, 'Welcome!');
        await new Promise(resolve => setTimeout(resolve, 500));

        hideProgressBar();
        closeModal();
        showToast({ message: 'Successfully logged in!', type: 'success' });

    } catch (error) {
        hideProgressBar();
        if (modalContent) modalContent.style.visibility = 'visible';
        
        let errorMessage = 'An unexpected error occurred. Please try again later.';
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid email or password. Please try again.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/Password sign-in is not enabled in this Firebase project.';
                break;
            default:
                console.error('Login error:', error);
        }
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const errorDiv = document.getElementById('signup-error');
    const submitBtn = e.target.querySelector('.auth-submit-btn');

    submitBtn.disabled = true;
    errorDiv.classList.remove('show');

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match.';
        errorDiv.classList.add('show');
        submitBtn.disabled = false;
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        // On success, onAuthStateChanged will fire, creating the user doc and fetching the (empty) watchlist.
        closeModal();
        showToast({ message: 'Account created successfully! Welcome.', type: 'success' });
    } catch (error) {
        let errorMessage = 'An unexpected error occurred. Please try again.';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email address is already in use.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters long.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/Password sign-up is not enabled. Please check your Firebase console.';
                break;
            default:
                console.error('Sign up error:', error);
        }
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
    }
}


async function handleLogout() {
    try {
        await signOut(auth);
        clearTasteProfile();
        // The onAuthStateChanged listener will handle detaching syncs.
        if (window.location.hash === '#library' || window.location.hash === '#taste-profile') {
            window.location.hash = '#home';
        }
        showToast({ message: 'Logged out.', type: 'info' });
    } catch (error) {
        console.error("Logout error:", error);
    }
}

export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        document.body.classList.toggle('logged-in', !!user);
        
        if (user) {
            // Ensure a user document exists in Firestore for every logged-in user.
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    email: user.email,
                    createdAt: serverTimestamp(),
                    name: null
                });
            }

            // Sync user document from 'users' collection
            syncCurrentUser(user);

            // Initiate real-time sync and wait for the first data load
            await Promise.all([initWatchlistSync(), initWatchProgressSync()]);

            // Fetch explicit preferences from DB and cache them.
            const explicitPrefs = await fetchAndCacheExplicitPreferences();
            const watchlist = getLocalWatchlist();

            // Always rebuild profile on login to ensure consistency across devices.
            const MIGRATION_FLAG_KEY = `cinehub-profileMigrated-${user.uid}`;
            const needsUIVisual = !localStorage.getItem(MIGRATION_FLAG_KEY);
            
            if (needsUIVisual) showProgressBar();
            await buildInitialProfileFromLibrary(watchlist, needsUIVisual ? updateProgress : () => {}, explicitPrefs);
            if (needsUIVisual) hideProgressBar();

            // After all setup is done, check for new episodes.
            checkForNewEpisodes();

            // Signal that auth data is ready and view should refresh (e.g. to show personalized shelves)
            document.dispatchEvent(new CustomEvent('auth-refresh'));

        } else {
            // Detach listeners and clear local data when logged out
            detachWatchlistSync();
            detachWatchProgressSync();
            detachCurrentUserSync();
            clearTasteProfile();

            // Signal that auth data is cleared and view should refresh
            document.dispatchEvent(new CustomEvent('auth-refresh'));
        }
    });
    
    // Use delegation for auth and logout links since they are dynamic
    document.body.addEventListener('click', e => {
        const logoutLink = e.target.closest('#logout-link');
        if (logoutLink) {
            e.preventDefault();
            handleLogout();
        }
    });
}
