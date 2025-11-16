import { getLanguages } from '../api.js';

let sectionEl, containerEl, btnEl, btnTextEl, dropdownEl, searchInputEl, optionsEl;
let optionsData = [];

function selectOption(isoCode, name) {
    btnTextEl.textContent = name;
    btnTextEl.classList.add('selected');
    containerEl.dataset.selectedValue = isoCode;
    
    optionsEl.querySelector('.selected')?.classList.remove('selected');
    optionsEl.querySelector('.highlighted')?.classList.remove('highlighted');
    const newSelected = optionsEl.querySelector(`[data-value="${isoCode}"]`);
    if(newSelected) newSelected.classList.add('selected');

    containerEl.classList.remove('open');
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    optionsEl.querySelectorAll('li').forEach(li => {
        const name = li.textContent.toLowerCase();
        li.classList.toggle('hidden', !name.includes(searchTerm));
    });
}

function handleKeyDown(e) {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
    e.preventDefault();

    const visibleItems = Array.from(optionsEl.querySelectorAll('li:not(.hidden)'));
    if (visibleItems.length === 0) return;

    let highlightedIndex = visibleItems.findIndex(item => item.classList.contains('highlighted'));

    if (e.key === 'ArrowDown') {
        highlightedIndex = (highlightedIndex + 1) % visibleItems.length;
    } else if (e.key === 'ArrowUp') {
        highlightedIndex = (highlightedIndex - 1 + visibleItems.length) % visibleItems.length;
    } else if (e.key === 'Enter') {
        if (highlightedIndex > -1) {
            visibleItems[highlightedIndex].click();
        } else if (visibleItems.length > 0) {
            visibleItems[0].click();
        }
        return;
    }

    visibleItems.forEach((item, index) => {
        item.classList.toggle('highlighted', index === highlightedIndex);
    });

    if (highlightedIndex > -1) {
        visibleItems[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
}

export function render(mediaType) {
    return `
        <section class="filter-section" data-filter-type="languages">
            <div class="filter-section-header">
                <h3>Language</h3>
            </div>
            <div class="select-container">
                <button class="select-btn" aria-haspopup="listbox">
                    <span class="select-btn-text">Any Language</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <input type="text" class="select-search-input" placeholder="Search languages...">
                <div class="select-dropdown">
                    <ul class="select-options" role="listbox">
                        <div class="loader-tiny"></div>
                    </ul>
                </div>
            </div>
        </section>
    `;
}

export async function init(sectionElement, mediaType) {
    sectionEl = sectionElement;
    containerEl = sectionEl.querySelector('.select-container');
    btnEl = sectionEl.querySelector('.select-btn');
    btnTextEl = sectionEl.querySelector('.select-btn-text');
    dropdownEl = sectionEl.querySelector('.select-dropdown');
    searchInputEl = sectionEl.querySelector('.select-search-input');
    optionsEl = sectionEl.querySelector('.select-options');
    
    btnEl.addEventListener('click', () => {
        containerEl.classList.add('open');
        searchInputEl.value = '';
        handleSearch({ target: { value: '' } });
        searchInputEl.focus();
    });

    document.addEventListener('click', (e) => {
        if (!containerEl.contains(e.target)) {
            containerEl.classList.remove('open');
            optionsEl.querySelector('.highlighted')?.classList.remove('highlighted');
        }
    });

    searchInputEl.addEventListener('input', handleSearch);
    searchInputEl.addEventListener('keydown', handleKeyDown);

    optionsEl.addEventListener('click', e => {
        if (e.target.tagName === 'LI') {
            selectOption(e.target.dataset.value, e.target.textContent);
        }
    });

    try {
        optionsData = await getLanguages();
        if (optionsData && optionsData.length > 0) {
            optionsData.sort((a, b) => a.english_name.localeCompare(b.english_name));
            const optionsHtml = optionsData.map(l => 
                `<li role="option" data-value="${l.iso_639_1}">${l.english_name}</li>`
            ).join('');
            optionsEl.innerHTML = optionsHtml;
        } else {
            optionsEl.innerHTML = '<li>No languages available</li>';
        }
    } catch (error) {
        console.error("Failed to load languages:", error);
        optionsEl.innerHTML = '<li>Could not load languages</li>';
    }
}

export function getValue() {
    if (!containerEl || !containerEl.dataset.selectedValue) return {};
    return { with_original_language: containerEl.dataset.selectedValue };
}

export function reset() {
    if (!containerEl) return;
    delete containerEl.dataset.selectedValue;
    btnTextEl.textContent = 'Any Language';
    btnTextEl.classList.remove('selected');
    searchInputEl.value = '';
    optionsEl.querySelectorAll('li').forEach(li => li.classList.remove('hidden', 'selected', 'highlighted'));
    containerEl.classList.remove('open');
}