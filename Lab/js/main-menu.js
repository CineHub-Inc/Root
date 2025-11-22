/**
 * Sets the active state on the current navigation link.
 * @param {string} hash - The current URL hash (e.g., '#home').
 */
export function setActiveLink(hash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        // Don't mark the auth link as active
        if (link.getAttribute('href') === hash && link.id !== 'auth-link') {
            link.classList.add('active');
        }
    });
}
