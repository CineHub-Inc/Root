import { updateWatchlistOrder } from './watchlist.js';
import { showToast } from './toast.js';

let draggedElement = null;
let placeholder = null;

function createPlaceholder() {
    const p = document.createElement('div');
    p.className = 'drop-placeholder';
    const card = document.querySelector('.media-card');
    if (card) {
        const style = window.getComputedStyle(card);
        p.style.width = style.width;
        p.style.height = style.height;
        p.style.margin = style.margin;
        p.style.flexShrink = '0';
    }
    return p;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.media-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleDragStart(e) {
    if (e.target.classList.contains('media-card')) {
        draggedElement = e.target;
        setTimeout(() => {
            if (draggedElement) draggedElement.classList.add('dragging');
        }, 0);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const gridContainer = e.currentTarget;
    const afterElement = getDragAfterElement(gridContainer, e.clientY);
    if (draggedElement) {
        if (afterElement == null) {
            gridContainer.appendChild(placeholder);
        } else {
            gridContainer.insertBefore(placeholder, afterElement);
        }
    }
}

function handleDrop(e, gridContainer) {
    e.preventDefault();
    if (draggedElement && gridContainer.contains(placeholder)) {
        gridContainer.insertBefore(draggedElement, placeholder);
    }
}

async function handleDragEnd(e, gridContainer) {
    if (!draggedElement) return;

    draggedElement.classList.remove('dragging');

    if (gridContainer.contains(placeholder)) {
        gridContainer.removeChild(placeholder);
    }

    const orderedCards = [...gridContainer.querySelectorAll('.media-card')];
    const orderedIds = orderedCards.map(card => `${card.dataset.type}:${card.dataset.id}`);

    showToast({ message: 'Updating order...', type: 'info', duration: 1500 });
    const success = await updateWatchlistOrder(orderedIds);

    if (success) {
        showToast({ message: 'Order saved!', type: 'success' });
    } else {
        showToast({ message: 'Failed to save order.', type: 'error' });
        const { renderLibraryPage } = await import('./watchlist-page.js');
        renderLibraryPage(document.getElementById('app-root'));
    }

    draggedElement = null;
}

export function initDragAndDrop(gridContainer) {
    if (!gridContainer || gridContainer.children.length < 2) return;

    placeholder = createPlaceholder();

    gridContainer.addEventListener('dragstart', handleDragStart);
    gridContainer.addEventListener('dragover', handleDragOver);
    gridContainer.addEventListener('drop', (e) => handleDrop(e, gridContainer));
    gridContainer.addEventListener('dragend', (e) => handleDragEnd(e, gridContainer));
}
