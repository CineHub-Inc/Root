
let sectionEl, containerEl, btnEl, btnTextEl, dropdownEl, optionsEl;

const sortOptions = {
    movie: [
        { label: 'Popularity Descending', value: 'popularity.desc' },
        { label: 'Popularity Ascending', value: 'popularity.asc' },
        { label: 'Rating Descending', value: 'vote_average.desc' },
        { label: 'Rating Ascending', value: 'vote_average.asc' },
        { label: 'Release Date Descending', value: 'primary_release_date.desc' },
        { label: 'Release Date Ascending', value: 'primary_release_date.asc' },
        { label: 'Title (A-Z)', value: 'title.asc' },
        { label: 'Title (Z-A)', value: 'title.desc' }
    ],
    tv: [
        { label: 'Popularity Descending', value: 'popularity.desc' },
        { label: 'Popularity Ascending', value: 'popularity.asc' },
        { label: 'Rating Descending', value: 'vote_average.desc' },
        { label: 'Rating Ascending', value: 'vote_average.asc' },
        { label: 'Air Date Descending', value: 'first_air_date.desc' },
        { label: 'Air Date Ascending', value: 'first_air_date.asc' },
        { label: 'Name (A-Z)', value: 'name.asc' },
        { label: 'Name (Z-A)', value: 'name.desc' }
    ]
};

function selectOption(value, label) {
    btnTextEl.textContent = label;
    btnTextEl.classList.add('selected');
    containerEl.dataset.selectedValue = value;
    
    optionsEl.querySelectorAll('li').forEach(li => {
        li.classList.toggle('selected', li.dataset.value === value);
    });
    
    containerEl.classList.remove('open');
}

export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="sort">
            <div class="filter-section-header">
                <h3>Sort By</h3>
            </div>
            <div class="select-container">
                <button class="select-btn" aria-haspopup="listbox">
                    <span class="select-btn-text">Popularity Descending</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="select-dropdown">
                    <ul class="select-options" role="listbox">
                        <!-- Options injected in init -->
                    </ul>
                </div>
            </div>
        </section>
    `;
}

export function init(sectionElement, mediaType) {
    sectionEl = sectionElement;
    containerEl = sectionEl.querySelector('.select-container');
    btnEl = sectionEl.querySelector('.select-btn');
    btnTextEl = sectionEl.querySelector('.select-btn-text');
    dropdownEl = sectionEl.querySelector('.select-dropdown');
    optionsEl = sectionEl.querySelector('.select-options');

    const currentOptions = sortOptions[mediaType] || sortOptions.movie;
    
    optionsEl.innerHTML = currentOptions.map(opt => 
        `<li role="option" data-value="${opt.value}" class="${opt.value === 'popularity.desc' ? 'selected' : ''}">${opt.label}</li>`
    ).join('');

    // Set default
    containerEl.dataset.selectedValue = 'popularity.desc';

    btnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        containerEl.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!containerEl.contains(e.target)) {
            containerEl.classList.remove('open');
        }
    });

    optionsEl.addEventListener('click', e => {
        if (e.target.tagName === 'LI') {
            selectOption(e.target.dataset.value, e.target.textContent);
        }
    });
}

export function getValue() {
    if (!containerEl || !containerEl.dataset.selectedValue) return {};
    return { sort_by: containerEl.dataset.selectedValue };
}

export function reset() {
    if (!containerEl) return;
    selectOption('popularity.desc', 'Popularity Descending');
    btnTextEl.classList.remove('selected'); // visually reset generic state if needed
}
