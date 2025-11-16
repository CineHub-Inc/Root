export function renderMediaTypeFilter(container, currentType) {
    container.innerHTML = `
        <div class="filter-section">
            <h3 class="filter-section-title">Content Type</h3>
            <div class="media-type-pills">
                <button class="media-type-pill ${currentType === 'movie' ? 'active' : ''}" data-type="movie">Films</button>
                <button class="media-type-pill ${currentType === 'tv' ? 'active' : ''}" data-type="tv">TV Series</button>
            </div>
        </div>
    `;

    const pills = container.querySelectorAll('.media-type-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Update UI
            container.querySelector('.media-type-pill.active').classList.remove('active');
            pill.classList.add('active');

            // Dispatch event
            const event = new CustomEvent('filterChanged', {
                bubbles: true,
                composed: true,
                detail: { mediaType: pill.dataset.type }
            });
            container.dispatchEvent(event);
        });
    });
}