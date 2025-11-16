import { getMovieGenres, getTvGenres, getCountries } from './api.js';

// --- STATE AND CONFIGURATION ---

let drawer = null;
let overlay = null;
let onApplyFiltersCallback = null;
let currentMediaType = 'movie';
let activeFilters = {};

// Static configuration for filters
const sortOptionsConfig = {
    common: [
        { value: 'popularity.desc', label: 'Popularity Descending' },
        { value: 'popularity.asc', label: 'Popularity Ascending' },
        { value: 'vote_average.desc', label: 'Rating Descending' },
        { value: 'vote_average.asc', label: 'Rating Ascending' },
    ],
    movie: [
        { value: 'primary_release_date.desc', label: 'Release Date Descending' },
        { value: 'primary_release_date.asc', label: 'Release Date Ascending' },
    ],
    tv: [
        { value: 'first_air_date.desc', label: 'First Air Date Descending' },
        { value: 'first_air_date.asc', label: 'First Air Date Ascending' },
    ],
};

const languageOptions = [
    { name: 'English', code: 'en' }, { name: 'French', code: 'fr' },
    { name: 'Spanish', code: 'es' }, { name: 'Italian', code: 'it' },
    { name: 'Portuguese', code: 'pt' }, { name: 'German', code: 'de' },
    { name: 'Polish', code: 'pl' }, { name: 'Russian', code: 'ru' },
    { name: 'Mandarin', code: 'zh' }, { name: 'Japanese', code: 'ja' },
    { name: 'Korean', code: 'ko' }, { name: 'Vietnamese', code: 'vi' },
    { name: 'Indonesian', code: 'id' }, { name: 'Arabic', code: 'ar' },
    { name: 'Bengali', code: 'bn' }, { name: 'Turkish', code: 'tr' },
    { name: 'Hindi', code: 'hi' },
];

// --- DRAWER LIFECYCLE ---

async function createDrawerDOM() {
    if (document.getElementById('filter-drawer')) return;

    overlay = document.createElement('div');
    overlay.id = 'filter-drawer-overlay';
    overlay.className = 'filter-drawer-overlay';
    document.body.appendChild(overlay);

    drawer = document.createElement('div');
    drawer.id = 'filter-drawer';
    drawer.className = 'filter-drawer';
    drawer.setAttribute('role', 'dialog');
    document.body.appendChild(drawer);
}

function renderDrawerSkeleton() {
    drawer.innerHTML = `
        <div class="filter-drawer-header">
            <h2 id="filter-drawer-title">Sort & Filter</h2>
            <button class="filter-drawer-close" aria-label="Close filter drawer">&times;</button>
        </div>
        <div class="filter-drawer-body">
            <!-- Sections will be populated by JS -->
        </div>
        <div class="filter-drawer-footer">
            <button id="clear-filters-btn" class="filter-action-btn clear">Clear</button>
            <button id="apply-filters-btn" class="filter-action-btn apply">Apply</button>
        </div>
    `;
}

function renderAllSections(genres, countries) {
    const body = drawer.querySelector('.filter-drawer-body');
    body.innerHTML = `
        ${renderSortSection()}
        ${renderRangeSliderSection('year', 'Release Year', 1900, new Date().getFullYear(), 1)}
        ${renderRangeSliderSection('score', 'User Score', 0, 10, 0.5)}
        ${renderPillsSection('genre-pills', 'Genres', genres, 'id', 'name', 'genre-id')}
        ${renderPillsSection('language-pills', 'Language', languageOptions, 'code', 'name', 'language-code')}
        ${renderSearchableListSection('countries', 'Country of Origin', countries, 'iso_3166_1', 'english_name')}
    `;
    updateAllInputsFromState();
}

async function populateAndRender() {
    renderDrawerSkeleton();
    addEventListeners();

    const [genreData, countryData] = await Promise.all([
        currentMediaType === 'movie' ? getMovieGenres() : getTvGenres(),
        getCountries()
    ]);

    renderAllSections(genreData?.genres || [], countryData || []);
}


// --- SECTION RENDERERS ---

function renderSortSection() {
    const options = [...sortOptionsConfig.common, ...sortOptionsConfig[currentMediaType]];
    const optionsHtml = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
    return `
        <section class="filter-section">
            <h3>Sort By</h3>
            <select id="sort-select" class="sort-select">${optionsHtml}</select>
        </section>
    `;
}

function renderRangeSliderSection(type, title, min, max, step) {
    return `
        <section class="filter-section">
            <h3>
                <span>${title}</span>
                <span id="${type}-range-label" class="filter-values"></span>
            </h3>
            <div class="range-slider-container">
                <div class="range-slider">
                    <div class="slider-track"></div>
                    <input type="range" id="${type}-slider-min" min="${min}" max="${max}" step="${step}">
                    <input type="range" id="${type}-slider-max" min="${min}" max="${max}" step="${step}">
                </div>
            </div>
        </section>
    `;
}

function renderPillsSection(id, title, items, valueKey, nameKey, dataAttr) {
    const pillsHtml = items.map(item =>
        `<button class="genre-pill" data-${dataAttr}="${item[valueKey]}">${item[nameKey]}</button>`
    ).join('');
    return `
        <section class="filter-section">
            <h3>${title}</h3>
            <div id="${id}-container" class="genre-pills">${pillsHtml}</div>
        </section>
    `;
}

function renderSearchableListSection(id, title, items, valueKey, labelKey) {
    const listHtml = items.map(item => `
        <div class="checkbox-item">
            <input type="checkbox" id="${id}-${item[valueKey]}" value="${item[valueKey]}">
            <span class="custom-checkbox"><i class="fas fa-check"></i></span>
            <label for="${id}-${item[valueKey]}">${item[labelKey]}</label>
        </div>
    `).join('');

    return `
        <section class="filter-section">
            <h3>${title}</h3>
            <div id="${id}-container" class="searchable-list-container">
                <input type="search" class="list-search-input" placeholder="Search...">
                <div class="checkbox-list">${listHtml}</div>
            </div>
        </section>
    `;
}


// --- UI STATE AND EVENT HANDLING ---

function updateAllInputsFromState() {
    // Sort
    const sortSelect = drawer.querySelector('#sort-select');
    if (sortSelect) sortSelect.value = activeFilters.sort_by || 'popularity.desc';

    // Year Slider
    const dateKeys = currentMediaType === 'movie' ? { gte: 'primary_release_date.gte', lte: 'primary_release_date.lte' } : { gte: 'first_air_date.gte', lte: 'first_air_date.lte' };
    const minYear = activeFilters[dateKeys.gte] ? activeFilters[dateKeys.gte].substring(0, 4) : 1900;
    const maxYear = activeFilters[dateKeys.lte] ? activeFilters[dateKeys.lte].substring(0, 4) : new Date().getFullYear();
    updateRangeSlider('year', minYear, maxYear);
    
    // Score Slider
    const minScore = activeFilters['vote_average.gte'] || 0;
    const maxScore = activeFilters['vote_average.lte'] || 10;
    updateRangeSlider('score', minScore, maxScore);

    // Pills (Genres, Languages)
    updatePillsFromState('#genre-pills-container', 'genre-id', activeFilters.with_genres, ',');
    updatePillsFromState('#language-pills-container', 'language-code', activeFilters.with_original_language, '|');

    // Checkboxes (Countries)
    const selectedCountries = new Set((activeFilters.with_origin_country || '').split(','));
    drawer.querySelectorAll('#countries-container input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedCountries.has(cb.value);
    });
}

function updateRangeSlider(type, minVal, maxVal) {
    const minSlider = drawer.querySelector(`#${type}-slider-min`);
    const maxSlider = drawer.querySelector(`#${type}-slider-max`);
    const label = drawer.querySelector(`#${type}-range-label`);
    const track = minSlider.parentElement.querySelector('.slider-track');
    
    minSlider.value = minVal;
    maxSlider.value = maxVal;

    const minRange = parseFloat(minSlider.min);
    const maxRange = parseFloat(minSlider.max);
    
    label.textContent = `${minVal} - ${maxVal}`;
    const minPercent = ((minVal - minRange) / (maxRange - minRange)) * 100;
    const maxPercent = ((maxVal - minRange) / (maxRange - minRange)) * 100;
    track.style.left = `${minPercent}%`;
    track.style.width = `${maxPercent - minPercent}%`;
}

function updatePillsFromState(containerSelector, dataAttr, filterValue, separator) {
    const selectedValues = new Set((filterValue || '').split(separator));
    drawer.querySelectorAll(`${containerSelector} button`).forEach(pill => {
        const pillValues = pill.dataset[dataAttr.replace(/-/g, '')].split(',');
        if (pillValues.some(v => selectedValues.has(v))) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

function addEventListeners() {
    drawer.addEventListener('click', e => {
        if (e.target.matches('.filter-drawer-close')) closeFilterDrawer();
        if (e.target.matches('#clear-filters-btn')) handleClear();
        if (e.target.matches('#apply-filters-btn')) handleApply();
        if (e.target.closest('.genre-pill, .language-pill')) {
            e.target.closest('button').classList.toggle('active');
        }
    });

    const body = drawer.querySelector('.filter-drawer-body');
    body.addEventListener('input', e => {
        if (e.target.matches('input[type="range"]')) {
            const type = e.target.id.split('-')[0];
            let min = parseFloat(drawer.querySelector(`#${type}-slider-min`).value);
            let max = parseFloat(drawer.querySelector(`#${type}-slider-max`).value);

            // Prevent sliders from crossing
            if (max < min) {
                 if (e.target.id.includes('-min')) {
                    min = max;
                } else {
                    max = min;
                }
            }
            updateRangeSlider(type, min, max);
        }

        if (e.target.matches('.list-search-input')) {
            const searchTerm = e.target.value.toLowerCase();
            const listContainer = e.target.nextElementSibling;
            if (listContainer) {
                listContainer.querySelectorAll('.checkbox-item').forEach(item => {
                    const label = item.querySelector('label').textContent.toLowerCase();
                    item.style.display = label.includes(searchTerm) ? 'flex' : 'none';
                });
            }
        }
    });
}

// --- FILTER LOGIC ---

function collectFiltersFromUI() {
    const filters = {};
    
    // Sort
    filters.sort_by = drawer.querySelector('#sort-select').value;

    // Year
    const dateKeys = currentMediaType === 'movie' ? { gte: 'primary_release_date.gte', lte: 'primary_release_date.lte' } : { gte: 'first_air_date.gte', lte: 'first_air_date.lte' };
    const yearMin = drawer.querySelector('#year-slider-min').value;
    const yearMax = drawer.querySelector('#year-slider-max').value;
    if (yearMin > 1900) filters[dateKeys.gte] = `${yearMin}-01-01`;
    if (yearMax < new Date().getFullYear()) filters[dateKeys.lte] = `${yearMax}-12-31`;
    
    // Score
    const scoreMin = drawer.querySelector('#score-slider-min').value;
    const scoreMax = drawer.querySelector('#score-slider-max').value;
    if (scoreMin > 0) filters['vote_average.gte'] = scoreMin;
    if (scoreMax < 10) filters['vote_average.lte'] = scoreMax;
    
    // Pills
    const getActivePillData = (selector, dataAttr) => Array.from(drawer.querySelectorAll(`${selector}.active`)).map(p => p.dataset[dataAttr]);
    filters.with_genres = getActivePillData('.genre-pill', 'genreId').join(',');
    filters.with_original_language = getActivePillData('.language-pill', 'languageCode').join('|');
    
    // Checkboxes
    filters.with_origin_country = Array.from(drawer.querySelectorAll('#countries-container input:checked')).map(cb => cb.value).join(',');

    // Clean empty keys
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    return filters;
}

function handleApply() {
    const newFilters = collectFiltersFromUI();
    if (newFilters !== null) { // Only apply if validation passes
        activeFilters = newFilters;
        onApplyFiltersCallback(activeFilters);
        closeFilterDrawer();
    }
}

function handleClear() {
    activeFilters = {};
    onApplyFiltersCallback({});
    // Re-render to show default states
    populateAndRender();
}


// --- PUBLIC API ---

export function openFilterDrawer() {
    if (!drawer || !overlay) return;
    populateAndRender();
    overlay.classList.add('is-visible');
    drawer.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
}

export function closeFilterDrawer() {
    if (!drawer || !overlay) return;
    overlay.classList.remove('is-visible');
    drawer.classList.remove('is-visible');
    document.body.style.overflow = '';
}

export function toggleFilterDrawer() {
    if (drawer && drawer.classList.contains('is-visible')) {
        closeFilterDrawer();
    } else {
        openFilterDrawer();
    }
}

export async function initFilterDrawer(container, mediaType, initialFilters, onApply) {
    currentMediaType = mediaType;
    activeFilters = initialFilters;
    onApplyFiltersCallback = onApply;
    
    await createDrawerDOM();
    overlay.addEventListener('click', closeFilterDrawer);
}
