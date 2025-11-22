
import * as sort from './filter-sort.js';
import * as genres from './filter-genres.js';
import * as rating from './filter-rating.js';
import * as runtime from './filter-runtime.js';
import * as years from './filter-years.js';
import * as status from './filter-status.js';
import * as countries from './filter-countries.js';
import * as languages from './filter-languages.js';

// Define all available modules
const availableModules = {
    sort,
    genres,
    rating,
    runtime,
    years,
    status,
    countries,
    languages
};

let activeModules = [];
let onApplyCallback;
let drawerElement;
let overlayElement;

function createDrawerShell() {
    if (document.getElementById('filter-drawer')) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'filter-drawer-overlay';
    overlayElement.className = 'filter-drawer-overlay';
    document.body.appendChild(overlayElement);

    drawerElement = document.createElement('aside');
    drawerElement.id = 'filter-drawer';
    drawerElement.className = 'filter-drawer';
    drawerElement.setAttribute('role', 'dialog');
    drawerElement.setAttribute('aria-modal', 'true');
    drawerElement.setAttribute('aria-labelledby', 'filter-drawer-title');

    drawerElement.innerHTML = `
        <div class="filter-drawer-header">
            <h2 id="filter-drawer-title">Filters</h2>
            <button class="filter-drawer-close-btn" aria-label="Close filters">&times;</button>
        </div>
        <div class="filter-drawer-body"></div>
        <div class="filter-drawer-footer">
            <button class="filter-drawer-btn filter-clear-btn">Reset All</button>
            <button class="filter-drawer-btn filter-apply-btn">Show Results</button>
        </div>
    `;
    document.body.appendChild(drawerElement);
}

function openDrawer() {
    if (!drawerElement || !overlayElement) return;
    drawerElement.classList.add('is-visible');
    overlayElement.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    if (!drawerElement || !overlayElement) return;
    drawerElement.classList.remove('is-visible');
    overlayElement.classList.remove('is-visible');
    document.body.style.overflow = '';
}

function handleApply() {
    let combinedFilters = {};
    for (const module of activeModules) {
        if (module.getValue) {
            const moduleValue = module.getValue();
            Object.assign(combinedFilters, moduleValue);
        }
    }
    if (onApplyCallback) {
        onApplyCallback(combinedFilters);
    }
    closeDrawer();
}

function handleClear() {
    for (const module of activeModules) {
        if (module.reset) {
            module.reset();
        }
    }
}

function setupDrawerListeners() {
    const triggerBtn = document.getElementById('filter-trigger-btn');
    const closeBtn = drawerElement.querySelector('.filter-drawer-close-btn');
    const applyBtn = drawerElement.querySelector('.filter-apply-btn');
    const clearBtn = drawerElement.querySelector('.filter-clear-btn');
    
    // Remove existing listeners to avoid duplicates if re-initialized
    if (triggerBtn) {
        const newTrigger = triggerBtn.cloneNode(true);
        triggerBtn.parentNode.replaceChild(newTrigger, triggerBtn);
        newTrigger.addEventListener('click', openDrawer);
    }

    closeBtn.addEventListener('click', closeDrawer);
    overlayElement.addEventListener('click', closeDrawer);
    applyBtn.addEventListener('click', handleApply);
    clearBtn.addEventListener('click', handleClear);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerElement.classList.contains('is-visible')) {
            closeDrawer();
        }
    });
}

export function init(mediaType, onApply) {
    onApplyCallback = onApply;
    createDrawerShell();

    const drawerBody = drawerElement.querySelector('.filter-drawer-body');
    if (!drawerBody) return;

    // Configure modules based on media type
    const config = mediaType === 'tv' 
        ? ['sort', 'genres', 'status', 'rating', 'years', 'runtime', 'countries', 'languages']
        : ['sort', 'genres', 'rating', 'years', 'runtime', 'countries', 'languages'];

    activeModules = config.map(key => availableModules[key]);

    // Render modules
    const allHtml = activeModules.map(module => module.render(mediaType)).join('');
    drawerBody.innerHTML = allHtml;

    // Initialize modules
    // We need to match the rendered sections back to their modules
    const sections = drawerBody.querySelectorAll('.filter-section');
    let sectionIndex = 0;
    
    activeModules.forEach(module => {
        // Only init if the module actually rendered something
        const renderedHtml = module.render(mediaType);
        if (renderedHtml && renderedHtml.trim() !== '') {
            if (sections[sectionIndex] && module.init) {
                module.init(sections[sectionIndex], mediaType);
            }
            sectionIndex++;
        }
    });

    setupDrawerListeners();
}
