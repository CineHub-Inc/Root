import { IMAGE_BASE_URL } from '../api.js';

const HISTORY_KEY = 'cinehub-navigationHistory';
const MAX_HISTORY_ITEMS = 25;

let historyWidget;
let toggleBtn;
let dropdown;

function getHistory() {
    try {
        const historyJson = sessionStorage.getItem(HISTORY_KEY);
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
        console.error("Could not parse navigation history.", error);
        return [];
    }
}

function saveHistory(history) {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function renderHistoryDropdown() {
    if (!dropdown) return;

    const history = getHistory();

    if (history.length === 0) {
        dropdown.innerHTML = `<div class="history-empty">Your browsing history is empty.</div>`;
        return;
    }

    const itemsHtml = history.reverse().map(item => {
        const imageUrl = item.posterPath ? `${IMAGE_BASE_URL}${item.posterPath}` : '';
        const placeholderIcon = item.type === 'person' ? 'fa-user' : 'fa-film';
        const typeText = item.type === 'tv' ? 'TV Series' : item.type;
        
        let href;
        if (item.type === 'movie' || item.type === 'tv') {
            href = `#media?type=${item.type}&id=${item.id}`;
        } else {
            href = `#${item.type}?id=${item.id}`; // For 'person', etc.
        }

        return `
            <a href="${href}" class="history-item">
                <div class="history-item-image">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${item.name}" loading="lazy">` : `<i class="fas ${placeholderIcon}"></i>`}
                </div>
                <div class="history-item-info">
                    <div class="history-item-name">${item.name}</div>
                    <div class="history-item-type">${typeText}</div>
                </div>
            </a>
        `;
    }).join('');

    dropdown.innerHTML = `
        <div class="history-trail-header">
            <h3>Recently Viewed</h3>
        </div>
        <div class="history-trail-list">${itemsHtml}</div>
    `;
}

function toggleDropdown() {
    if (!historyWidget) return;
    
    // Dispatch event to handle closing other widgets
    const wasActive = historyWidget.classList.contains('is-active');
    if (!wasActive) {
         document.dispatchEvent(new CustomEvent('close-command-bar-widgets', { detail: { except: 'history-trail-widget' } }));
    }

    const isVisible = historyWidget.classList.toggle('is-active');
    if (isVisible) {
        renderHistoryDropdown();
    }
}

function closeDropdown() {
    historyWidget?.classList.remove('is-active');
}

export function addPageToHistory(pageData) {
    if (!pageData || !pageData.id || !pageData.type || !pageData.name) {
        console.warn("Attempted to add invalid page data to history:", pageData);
        return;
    }

    const history = getHistory();

    // Avoid adding duplicates if the last page is the same
    const lastItem = history[history.length - 1];
    if (lastItem && lastItem.type === pageData.type && lastItem.id === pageData.id) {
        return;
    }

    // Remove any existing instance of this page to move it to the end
    const filteredHistory = history.filter(item => !(item.type === pageData.type && item.id === pageData.id));

    filteredHistory.push(pageData);

    // Cap the history size
    while (filteredHistory.length > MAX_HISTORY_ITEMS) {
        filteredHistory.shift();
    }

    saveHistory(filteredHistory);
}

export function init() {
    historyWidget = document.getElementById('history-trail-widget');
    toggleBtn = document.getElementById('history-trail-toggle');
    dropdown = document.getElementById('history-trail-dropdown');
    
    if (!toggleBtn || !dropdown || !historyWidget) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    dropdown.addEventListener('click', (e) => {
        if (e.target.closest('.history-item')) {
            closeDropdown();
        }
    });
}