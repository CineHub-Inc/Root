export function showToast(options) {
    const { message, type = 'info', duration = 5000, onUndo = null, actions = [] } =
        typeof options === 'string' ? { message: options } : options;

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Construct actions HTML first
    let actionsHtml = '';
    if (onUndo) {
        actionsHtml += `<button class="toast-btn toast-undo-btn">Undo</button>`;
    }
    if (actions.length > 0) {
        actionsHtml += actions.map(action => 
            `<button class="toast-btn ${action.className || ''}">${action.text}</button>`
        ).join('');
    }

    // Construct final toast innerHTML
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        ${actionsHtml ? `<div class="toast-actions">${actionsHtml}</div>` : ''}
    `;

    container.appendChild(toast);

    let timeoutId;

    const removeToast = () => {
        if (!toast.parentElement) return;
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                container.removeChild(toast);
            }
        });
        clearTimeout(timeoutId);
    };
    
    // Setup listeners within the new structure
    const actionsContainer = toast.querySelector('.toast-actions');
    if (actionsContainer) {
        if (onUndo) {
            const undoButton = actionsContainer.querySelector('.toast-undo-btn');
            if (undoButton) {
                undoButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onUndo();
                    removeToast();
                });
            }
        }
        if (actions.length > 0) {
            const actionButtons = actionsContainer.querySelectorAll('.toast-btn:not(.toast-undo-btn)');
            actionButtons.forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (actions[index] && actions[index].callback) {
                        actions[index].callback();
                    }
                    removeToast();
                });
            });
        }
    }

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Set timer to remove
    timeoutId = setTimeout(removeToast, duration);
}