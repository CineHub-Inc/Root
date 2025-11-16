function applyDragToScroll(container) {
    if (!container || container.dataset.dragToScrollInitialized) return;
    container.dataset.dragToScrollInitialized = 'true';

    let isDown = false;
    let startX;
    let scrollLeft;
    let hasMoved = false;

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only main button
        
        isDown = true;
        hasMoved = false; // Reset move tracker
        container.classList.add('active-drag');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.classList.remove('active-drag');
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('active-drag');
        
        if (hasMoved) {
            // Prevent click event on container's children after a drag
            container.addEventListener('click', function preventClick(e) {
                e.stopPropagation();
                e.preventDefault();
                container.removeEventListener('click', preventClick, true); // Use capture phase
            }, { capture: true, once: true });
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        hasMoved = true;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // Multiplier for faster scrolling
        container.scrollLeft = scrollLeft - walk;
    });
}

export function initScrollers(rootElement) {
    if (!rootElement) return;
    // Initialize existing scrollers
    rootElement.querySelectorAll('.horizontal-scroller').forEach(applyDragToScroll);

    // Observe for future scrollers
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList.contains('horizontal-scroller')) {
                            applyDragToScroll(node);
                        }
                        node.querySelectorAll('.horizontal-scroller').forEach(applyDragToScroll);
                    }
                });
            }
        }
    });

    observer.observe(rootElement, {
        childList: true,
        subtree: true,
    });
}
