import * as genres from './filter-genres.js';
import * as years from './filter-years.js';
import * as rating from './filter-rating.js';
import * as countries from './filter-countries.js';
import * as languages from './filter-languages.js';

const allModules = [genres, years, rating, countries, languages];
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
            <button class="filter-drawer-btn filter-clear-btn">Clear</button>
            <button class="filter-drawer-btn filter-apply-btn">Apply</button>
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
    for (const module of allModules) {
        const moduleValue = module.getValue();
        Object.assign(combinedFilters, moduleValue);
    }
    onApplyCallback(combinedFilters);
    closeDrawer();
}

function handleClear() {
    for (const module of allModules) {
        module.reset();
    }
    // Does not close the drawer, allows user to make new selections
}

function setupDrawerListeners() {
    const triggerBtn = document.getElementById('filter-trigger-btn');
    const closeBtn = drawerElement.querySelector('.filter-drawer-close-btn');
    const applyBtn = drawerElement.querySelector('.filter-apply-btn');
    const clearBtn = drawerElement.querySelector('.filter-clear-btn');
    
    triggerBtn.addEventListener('click', openDrawer);
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

    const allHtml = allModules.map(module => module.render(mediaType)).join('');
    drawerBody.innerHTML = allHtml;

    const sections = drawerBody.querySelectorAll('.filter-section');
    sections.forEach((section, index) => {
        if (allModules[index].init) {
            allModules[index].init(section, mediaType);
        }
    });

    setupDrawerListeners();
}