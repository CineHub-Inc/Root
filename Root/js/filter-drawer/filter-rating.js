let sectionEl;
let minInput, maxInput, progressEl, valueEl;
const MIN_RATING = 0;
const MAX_RATING = 10;
const GAP = 1;

function updateSlider(changedInput) {
    let minVal = parseFloat(minInput.value);
    let maxVal = parseFloat(maxInput.value);

    if (maxVal - minVal < GAP) {
        if (changedInput === minInput) {
            minInput.value = maxVal - GAP;
        } else {
            maxInput.value = minVal + GAP;
        }
    }
    
    minVal = parseFloat(minInput.value);
    maxVal = parseFloat(maxInput.value);

    const minPercent = ((minVal - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100;
    const maxPercent = ((maxVal - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100;

    progressEl.style.left = `${minPercent}%`;
    progressEl.style.right = `${100 - maxPercent}%`;
    valueEl.textContent = `${minVal} - ${maxVal}`;
}

export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="rating">
            <div class="filter-section-header">
                <h3>User Score</h3>
                <span class="selected-value">${MIN_RATING} - ${MAX_RATING}</span>
            </div>
            <div class="slider-container">
                <div class="slider-track"></div>
                <div class="slider-progress"></div>
                <input type="range" class="slider-input" min="${MIN_RATING}" max="${MAX_RATING}" step="0.5" value="${MIN_RATING}">
                <input type="range" class="slider-input" min="${MIN_RATING}" max="${MAX_RATING}" step="0.5" value="${MAX_RATING}">
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

    updateSlider();
}

export function getValue() {
    if (!sectionEl || !minInput || !maxInput) return {};
    const minVal = parseFloat(minInput.value);
    const maxVal = parseFloat(maxInput.value);

    const filters = {};
    if (minVal > MIN_RATING) {
        filters['vote_average.gte'] = minVal;
    }
    if (maxVal < MAX_RATING) {
        filters['vote_average.lte'] = maxVal;
    }

    return filters;
}

export function reset() {
    if (!minInput || !maxInput) return;
    minInput.value = MIN_RATING;
    maxInput.value = MAX_RATING;
    updateSlider();
}