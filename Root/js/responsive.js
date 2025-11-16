const menuToggle = document.querySelector('.menu-toggle');
const sideNav = document.querySelector('.side-nav');
const appRoot = document.getElementById('app-root');
const navLinks = document.querySelectorAll('.nav-link');
const logoLink = document.querySelector('.logo-link');

function openMenu() {
    sideNav.classList.add('is-open');
    document.body.classList.add('nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.innerHTML = '<i class="fas fa-times"></i>';
}

function closeMenu() {
    sideNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
}

function handleMenuToggle() {
    const isMenuOpen = sideNav.classList.contains('is-open');
    if (isMenuOpen) {
        closeMenu();
    } else {
        openMenu();
    }
}

// Setup menu toggle listener only if the button exists
if (menuToggle && sideNav) {
    menuToggle.addEventListener('click', handleMenuToggle);

    // Close menu when clicking outside on the main content
    appRoot.addEventListener('click', () => {
        if (sideNav.classList.contains('is-open')) {
            closeMenu();
        }
    });

    // Close menu when a nav link or the logo is clicked
    const closeMenuOnClickLinks = [...navLinks, logoLink];
    closeMenuOnClickLinks.forEach(link => {
        if (link) {
            link.addEventListener('click', () => {
                if (sideNav.classList.contains('is-open')) {
                    closeMenu();
                }
            });
        }
    });
}