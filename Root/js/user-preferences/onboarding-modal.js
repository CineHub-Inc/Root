import { openModal, closeModal } from '../modal.js';
import { getMovieGenres, getTvGenres, getLanguages } from '../api.js';
import { initSwipeStack, getLikedMovies } from './swipe-stack.js';
import { buildProfileFromOnboarding } from '../algorithm/taste-profile.js';
import { showToast } from '../toast.js';

let currentUser = null;
let currentStep = 1;
const totalSteps = 4;
let onboardingData = {
    likedGenres: new Set(),
    dislikedGenres: new Set(),
    languages: new Set(),
};

let allGenres = [];
let allLanguages = [];

function updateProgressBar() {
    const progressBar = document.getElementById('onboarding-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;
    }
}

function goToStep(stepNumber) {
    const previousStep = document.querySelector('.onboarding-step.active');
    if (previousStep) {
        previousStep.classList.remove('active');
        if (stepNumber > currentStep) {
            previousStep.classList.add('previous');
        }
    }

    const nextStep = document.getElementById(`onboarding-step-${stepNumber}`);
    if (nextStep) {
        nextStep.classList.remove('previous');
        nextStep.classList.add('active');
    }
    
    currentStep = stepNumber;
    updateProgressBar();
    updateNavButtons();
}

function updateNavButtons() {
    const backBtn = document.getElementById('onboarding-back-btn');
    const nextBtn = document.getElementById('onboarding-next-btn');

    if (backBtn) {
        backBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
    }
    if (nextBtn) {
        nextBtn.textContent = currentStep === totalSteps ? 'Finish' : 'Next';
    }
}

async function finishOnboarding() {
    // Collect liked movies from swipe stack
    onboardingData.likedMovies = getLikedMovies();

    // Show processing state
    const body = document.querySelector('.onboarding-body');
    body.innerHTML = `
        <div id="finish-loader">
            <div class="loader-overlay-spinner"></div>
            <p>Building your personalized profile...</p>
        </div>
    `;
    
    try {
        await buildProfileFromOnboarding({
            likedGenres: Array.from(onboardingData.likedGenres),
            dislikedGenres: Array.from(onboardingData.dislikedGenres),
            languages: Array.from(onboardingData.languages),
            likedMovies: onboardingData.likedMovies,
        });

        // Mark as completed
        localStorage.setItem(`onboardingCompleted-${currentUser.uid}`, 'true');
        showToast({ message: "Your profile is all set!", type: 'success' });

    } catch (error) {
        console.error("Failed to build profile from onboarding:", error);
        showToast({ message: "Could not save preferences. Please try again later.", type: 'error' });
    } finally {
        closeModal();
    }
}

function handleNavClick(direction) {
    if (direction === 'next') {
        if (currentStep < totalSteps) {
            goToStep(currentStep + 1);
        } else {
            finishOnboarding();
        }
    } else if (direction === 'back') {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    }
}

function handleChipClick(e, type, key) {
    const chip = e.target.closest('.choice-chip');
    if (!chip) return;

    const id = chip.dataset.id;
    if (onboardingData[key].has(id)) {
        onboardingData[key].delete(id);
        chip.classList.remove('selected');
    } else {
        onboardingData[key].add(id);
        chip.classList.add('selected');
    }

    // Special handling for genre dislike step
    if (type === 'dislike') {
        chip.classList.toggle('disliked', onboardingData[key].has(id));
    }
}

async function fetchData() {
    const [movieGenres, tvGenres, languages] = await Promise.all([
        getMovieGenres(),
        getTvGenres(),
        getLanguages(),
    ]);

    const genreMap = new Map();
    if (movieGenres?.genres) movieGenres.genres.forEach(g => genreMap.set(g.id, g.name));
    if (tvGenres?.genres) tvGenres.genres.forEach(g => genreMap.set(g.id, g.name));
    allGenres = Array.from(genreMap.entries()).map(([id, name]) => ({ id, name }));

    const primaryLanguages = new Set(['en', 'fr', 'es', 'it', 'pt', 'pl', 'ru', 'zh', 'ko', 'ar']);
    allLanguages = languages
        .filter(lang => primaryLanguages.has(lang.iso_639_1))
        .map(lang => ({ id: lang.iso_639_1, name: lang.english_name }));
}

function renderStepContent() {
    // Step 1: Liked Genres
    document.getElementById('step-1-content').innerHTML = allGenres.map(g => 
        `<button class="choice-chip" data-id="${g.id}">${g.name}</button>`
    ).join('');
    // Step 2: Disliked Genres
    document.getElementById('step-2-content').innerHTML = allGenres.map(g => 
        `<button class="choice-chip" data-id="${g.id}">${g.name}</button>`
    ).join('');
    // Step 3: Languages
    const languagesContainer = document.getElementById('step-3-content');
    languagesContainer.innerHTML = `
        <input type="search" id="language-search-input" class="onboarding-search-input" placeholder="Search languages...">
        <div class="choice-chips-container" id="language-chips-container">
             ${allLanguages.map(l => `<button class="choice-chip" data-id="${l.id}">${l.name}</button>`).join('')}
        </div>
    `;
    
    // Step 4: Poster Swipe
    initSwipeStack(document.getElementById('step-4-content'));
}

export async function showOnboardingModal(user) {
    currentUser = user;
    const modalHtml = `
        <div class="onboarding-container">
            <header class="onboarding-header">
                <div id="onboarding-progress-bar" class="onboarding-progress-bar"></div>
                <h2 class="onboarding-title">Welcome! Let's Personalize Your Experience</h2>
            </header>
            <main class="onboarding-body">
                <div class="onboarding-step active" id="onboarding-step-1">
                    <div class="step-header">
                        <h3 class="step-title">What do you love to watch?</h3>
                        <p class="step-description">Select a few genres you enjoy. This will help us find your first great recommendation.</p>
                    </div>
                    <div class="step-content">
                        <div id="step-1-content" class="choice-chips-container"><div class="loader-small"><i class="fas fa-spinner"></i></div></div>
                    </div>
                </div>
                <div class="onboarding-step" id="onboarding-step-2">
                    <div class="step-header">
                        <h3 class="step-title">Anything you'd rather skip?</h3>
                        <p class="step-description">Let us know if there are any genres you'd prefer not to see.</p>
                    </div>
                    <div class="step-content">
                        <div id="step-2-content" class="choice-chips-container"></div>
                    </div>
                </div>
                <div class="onboarding-step" id="onboarding-step-3">
                    <div class="step-header">
                        <h3 class="step-title">Preferred Languages</h3>
                        <p class="step-description">Choose the languages you're most interested in watching content in.</p>
                    </div>
                    <div id="step-3-content" class="step-content"></div>
                </div>
                <div class="onboarding-step" id="onboarding-step-4">
                     <div class="step-header">
                        <h3 class="step-title">Pick a few favorites</h3>
                        <p class="step-description">Swipe right on titles you've enjoyed, or left to skip. This gives us the best starting point.</p>
                    </div>
                    <div class="step-content">
                        <div id="step-4-content" class="swipe-container-wrapper">
                            <div class="swipe-stack-container"></div>
                            <div class="swipe-actions">
                                <button class="swipe-btn skip-btn" aria-label="Skip"><i class="fas fa-times"></i></button>
                                <button class="swipe-btn like-btn" aria-label="Like"><i class="fas fa-heart"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <footer class="onboarding-footer">
                <button id="onboarding-skip-btn" class="onboarding-nav-btn skip-btn">Skip for now</button>
                <div>
                    <button id="onboarding-back-btn" class="onboarding-nav-btn secondary">Back</button>
                    <button id="onboarding-next-btn" class="onboarding-nav-btn">Next</button>
                </div>
            </footer>
        </div>
    `;

    openModal(modalHtml, 'onboarding-modal');
    updateNavButtons();

    await fetchData();
    renderStepContent();
    
    // Add event listeners
    document.getElementById('step-1-content').addEventListener('click', e => handleChipClick(e, 'like', 'likedGenres'));
    document.getElementById('step-2-content').addEventListener('click', e => handleChipClick(e, 'dislike', 'dislikedGenres'));
    document.getElementById('step-3-content').addEventListener('click', e => handleChipClick(e, 'like', 'languages'));

    document.getElementById('language-search-input').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        const chipsContainer = document.getElementById('language-chips-container');
        const filteredLanguages = allLanguages.filter(l => l.name.toLowerCase().includes(searchTerm));
        chipsContainer.innerHTML = filteredLanguages.map(l => {
            const isSelected = onboardingData.languages.has(l.id);
            return `<button class="choice-chip ${isSelected ? 'selected' : ''}" data-id="${l.id}">${l.name}</button>`
        }).join('');
    });

    document.getElementById('onboarding-next-btn').addEventListener('click', () => handleNavClick('next'));
    document.getElementById('onboarding-back-btn').addEventListener('click', () => handleNavClick('back'));
    document.getElementById('onboarding-skip-btn').addEventListener('click', () => {
        localStorage.setItem(`onboardingCompleted-${currentUser.uid}`, 'true');
        closeModal();
    });
}