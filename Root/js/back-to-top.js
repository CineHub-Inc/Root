const backToTopButton = document.getElementById('back-to-top-btn');

if (backToTopButton) {
    // Show or hide the button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    }, { passive: true }); // Use passive listener for better scroll performance

    // Scroll to top on click
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
