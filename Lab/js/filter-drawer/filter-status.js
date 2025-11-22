
let sectionEl;

// TMDB Status Map
const statuses = [
    { id: '0', name: 'Returning Series' },
    { id: '3', name: 'Ended' },
    { id: '4', name: 'Canceled' },
    { id: '2', name: 'In Production' },
    { id: '5', name: 'Pilot' },
    { id: '1', name: 'Planned' }
];

export function render(mediaType) {
    if (mediaType !== 'tv') return ''; // Only for TV

    return `
        <section class="filter-section" data-filter-type="status">
            <div class="filter-section-header">
                <h3>Status</h3>
            </div>
            <div class="genres-container"> <!-- Reuse genre container styles -->
                ${statuses.map(s => `<button class="genre-pill" data-id="${s.id}">${s.name}</button>`).join('')}
            </div>
        </section>
    `;
}

export function init(sectionElement, mediaType) {
    sectionEl = sectionElement;
    const container = sectionEl.querySelector('.genres-container');
    if (!container) return;

    container.addEventListener('click', e => {
        if (e.target.classList.contains('genre-pill')) {
            const pill = e.target;
            // Simple toggle for status (active/inactive), reusing 'include' state style
            const currentState = pill.dataset.state;
            if (currentState === 'include') {
                delete pill.dataset.state;
            } else {
                pill.dataset.state = 'include';
            }
        }
    });
}

export function getValue() {
    if (!sectionEl) return {};
    
    const selectedStatuses = [];
    sectionEl.querySelectorAll('.genre-pill').forEach(pill => {
        if (pill.dataset.state === 'include') {
            selectedStatuses.push(pill.dataset.id);
        }
    });

    if (selectedStatuses.length > 0) {
        return { with_status: selectedStatuses.join('|') }; // OR logic for multiple statuses
    }

    return {};
}

export function reset() {
    if (!sectionEl) return;
    sectionEl.querySelectorAll('.genre-pill').forEach(pill => delete pill.dataset.state);
}
