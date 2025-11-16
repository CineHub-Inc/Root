let sectionEl;
let minInput, maxInput, progressEl, valueEl;
const MIN_YEAR = 1920;
const MAX_YEAR = new Date().getFullYear();
const GAP = 0;

function updateSlider(changedInput) {
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    // This logic now allows thumbs to meet but not cross over.
    if (maxVal < minVal) {
        if (changedInput === minInput) {
            minInput.value = maxVal;
        } else {
            maxInput.value = minVal;
        }
    }
    
    minVal = parseInt(minInput.value);
    maxVal = parseInt(maxInput.value);

    const minPercent = ((minVal - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
    const maxPercent = ((maxVal - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;

    progressEl.style.left = `${minPercent}%`;
    progressEl.style.right = `${100 - maxPercent}%`;
    valueEl.textContent = `${minVal} - ${maxVal}`;
}


export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="years">
            <div class="filter-section-header">
                <h3>Release Year</h3>
                <span class="selected-value">${MIN_YEAR} - ${MAX_YEAR}</span>
            </div>
            <div class="slider-container">
                <div class="slider-track"></div>
                <div class="slider-progress"></div>
                <input type="range" class="slider-input" min="${MIN_YEAR}" max="${MAX_YEAR}" value="${MIN_YEAR}">
                <input type="range" class="slider-input" min="${MIN_YEAR}" max="${MAX_YEAR}" value="${MAX_YEAR}">
            </div>
        </section>
    `;
}

export function init(sectionElement, mediaType) {
    sectionEl = sectionElement;
    const inputs = sectionEl.querySelectorAll('.slider-input');
    minInput = inputs[0];
    maxInput = inputs[1];
    progressEl = sectionEl.querySelector('.slider-progress');
    valueEl = sectionEl.querySelector('.selected-value');

    minInput.addEventListener('input', () => updateSlider(minInput));
    maxInput.addEventListener('input', () => updateSlider(maxInput));

    updateSlider(); // Initial call
}

export function getValue() {
    if (!sectionEl || !minInput || !maxInput) return {};
    const minVal = parseInt(minInput.value);
    const maxVal = parseInt(maxInput.value);

    const isMovie = document.getElementById('films-grid') !== null;
    const gteKey = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
    const lteKey = isMovie ? 'primary_release_date.lte' : 'first_air_date.lte';

    const filters = {};
    if (minVal > MIN_YEAR) {
        filters[gteKey] = `${minVal}-01-01`;
    }
    if (maxVal < MAX_YEAR) {
        filters[lteKey] = `${maxVal}-12-31`;
    }

    return filters;
}

export function reset() {
    if (!minInput || !maxInput) return;
    minInput.value = MIN_YEAR;
    maxInput.value = MAX_YEAR;
    updateSlider();
}