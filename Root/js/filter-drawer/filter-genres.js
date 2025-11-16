import { getMovieGenres, getTvGenres } from '../api.js';

let sectionEl;

export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="genres">
            <div class="filter-section-header">
                <h3>Genres</h3>
            </div>
            <div class="genres-container">
                <div class="loader-tiny"></div>
            </div>
        </section>
    `;
}

export async function init(sectionElement, mediaType) {
    sectionEl = sectionElement;
    const container = sectionEl.querySelector('.genres-container');
    if (!container) return;

    try {
        const genreData = mediaType === 'movie' ? await getMovieGenres() : await getTvGenres();
        const genres = genreData.genres || [];

        if (genres.length > 0) {
            const pillsHtml = genres.map(genre => `
                <button class="genre-pill" data-id="${genre.id}">${genre.name}</button>
            `).join('');
            container.innerHTML = pillsHtml;

            container.addEventListener('click', e => {
                if (e.target.classList.contains('genre-pill')) {
                    const pill = e.target;
                    const currentState = pill.dataset.state || 'off';
                    let nextState;

                    if (currentState === 'off') {
                        nextState = 'include';
                    } else if (currentState === 'include') {
                        nextState = 'exclude';
                    } else { // exclude
                        nextState = 'off';
                    }

                    if (nextState === 'off') {
                        delete pill.dataset.state;
                    } else {
                        pill.dataset.state = nextState;
                    }
                }
            });
        } else {
            container.innerHTML = '<p>No genres available.</p>';
        }
    } catch (error) {
        console.error("Failed to load genres:", error);
        container.innerHTML = '<p>Could not load genres.</p>';
    }
}

export function getValue() {
    if (!sectionEl) return {};
    
    const with_genres = [];
    const without_genres = [];

    sectionEl.querySelectorAll('.genre-pill').forEach(pill => {
        const state = pill.dataset.state;
        if (state === 'include') {
            with_genres.push(pill.dataset.id);
        } else if (state === 'exclude') {
            without_genres.push(pill.dataset.id);
        }
    });

    const filters = {};
    if (with_genres.length > 0) {
        filters.with_genres = with_genres.join(',');
    }
    if (without_genres.length > 0) {
        filters.without_genres = without_genres.join(',');
    }

    return filters;
}

export function reset() {
    if (!sectionEl) return;
    sectionEl.querySelectorAll('.genre-pill').forEach(pill => delete pill.dataset.state);
}