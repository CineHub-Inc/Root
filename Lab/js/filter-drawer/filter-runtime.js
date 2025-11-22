
let sectionEl;
let minInput, maxInput, progressEl, valueEl;
const MIN_RUNTIME = 0;
const MAX_RUNTIME = 240; // 4 hours
const GAP = 10;

function formatRuntime(minutes) {
    if (minutes === MAX_RUNTIME) return '4h+';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function updateSlider(changedInput) {
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    if (maxVal - minVal < GAP) {
        if (changedInput === minInput) {
            minInput.value = maxVal - GAP;
        } else {
            maxInput.value = minVal + GAP;
        }
    }
    
    minVal = parseInt(minInput.value);
    maxVal = parseInt(maxInput.value);

    const minPercent = ((minVal - MIN_RUNTIME) / (MAX_RUNTIME - MIN_RUNTIME)) * 100;
    const maxPercent = ((maxVal - MIN_RUNTIME) / (MAX_RUNTIME - MIN_RUNTIME)) * 100;

    progressEl.style.left = `${minPercent}%`;
    progressEl.style.right = `${100 - maxPercent}%`;
    
    valueEl.textContent = `${formatRuntime(minVal)} - ${formatRuntime(maxVal)}`;
}

export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="runtime">
            <div class="filter-section-header">
                <h3>Runtime</h3>
                <span class="selected-value">0m - 4h+</span>
            </div>
            <div class="slider-container">
                <div class="slider-track"></div>
                <div class="slider-progress"></div>
                <input type="range" class="slider-input" min="${MIN_RUNTIME}" max="${MAX_RUNTIME}" step="5" value="${MIN_RUNTIME}">
                <input type="range" class="slider-input" min="${MIN_RUNTIME}" max="${MAX_RUNTIME}" step="5" value="${MAX_RUNTIME}">
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
    const minVal = parseInt(minInput.value);
    const maxVal = parseInt(maxInput.value);

    const filters = {};
    if (minVal > MIN_RUNTIME) {
        filters['with_runtime.gte'] = minVal;
    }
    if (maxVal < MAX_RUNTIME) {
        filters['with_runtime.lte'] = maxVal;
    }

    return filters;
}

export function reset() {
    if (!minInput || !maxInput) return;
    minInput.value = MIN_RUNTIME;
    maxInput.value = MAX_RUNTIME;
    updateSlider();
}
