
import { getPersonDetails, getPersonCombinedCredits, IMAGE_BASE_URL } from './api.js';
import { createMediaCard } from './ui-components.js';
import { updateAllWatchlistIcons } from './watchlist.js';
import { addPageToHistory } from './history-trail/history-trail.js';
import { updatePersonAffinity } from './algorithm/taste-profile.js';
import { escapeHTML } from './media-page/utils.js';

function calculateAge(birthday, deathday) {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const endDate = deathday ? new Date(deathday) : new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const m = endDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && endDate.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function renderExternalLinks(personData) {
    const imdbId = personData.external_ids?.imdb_id;
    const personName = personData.name;

    let linksHtml = '';

    // 1. Google
    if (personName) {
        linksHtml += `
            <a href="https://www.google.com/search?q=${encodeURIComponent(personName)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" aria-label="Search on Google">
                <i class="fa-brands fa-google"></i>
            </a>
        `;
    }

    // 2. IMDb
    if (imdbId) {
        linksHtml += `
            <a href="https://www.imdb.com/name/${imdbId}" target="_blank" rel="noopener noreferrer" class="external-link-btn imdb-link" aria-label="View on IMDb">
                <div class="imdb-icon"></div>
            </a>
        `;
    }

    // 3. Wikipedia
    if (personName) {
         linksHtml += `
            <a href="https://en.wikipedia.org/wiki/${personName.replace(/ /g, '_')}" target="_blank" rel="noopener noreferrer" class="external-link-btn" aria-label="View on Wikipedia">
                <i class="fa-brands fa-wikipedia-w"></i>
            </a>
        `;
    }

    if (linksHtml) {
        return `<div class="person-external-links">${linksHtml}</div>`;
    }

    return '';
}

function renderFilmographyGrid(grid, credits, personData) {
    if (!grid) return;

    if (credits.length === 0) {
        grid.innerHTML = '<p class="no-content-message">No credits found in this category.</p>';
        return;
    }

    const fromParams = `&from=person&fromId=${personData.id}&fromName=${encodeURIComponent(personData.name)}`;
    const filmographyHtml = credits.map(credit => createMediaCard(credit, { hrefParams: fromParams })).join('');

    grid.innerHTML = filmographyHtml;
    updateAllWatchlistIcons();
}

function setupFilmography(personData, creditsData) {
    const tabsContainer = document.querySelector('.filmography-tabs');
    if (!tabsContainer) return;

    tabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.filmography-tab');
        if (tab && !tab.classList.contains('active')) {
            document.querySelector('.filmography-tab.active').classList.remove('active');
            tab.classList.add('active');

            document.querySelector('.filmography-tab-content.active').classList.remove('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        }
    });

    const allCastCredits = creditsData.cast || [];
    const allCrewCredits = creditsData.crew || [];
    const excludedGenreIds = new Set([10767, 10763, 10764, 10766]); // TV genres: Talk, News, Reality, Soap

    const processCredits = (credits) => {
        const uniqueCredits = credits.reduce((acc, current) => {
            const hasExcludedGenre = current.genre_ids?.some(id => excludedGenreIds.has(id));
            if (current.poster_path && !acc.find(item => item.id === current.id) && !hasExcludedGenre) {
                acc.push(current);
            }
            return acc;
        }, []);

        // Sort by release date descending (most recent first)
        const getDate = (item) => item.release_date || item.first_air_date;
        uniqueCredits.sort((a, b) => {
            const dateA = getDate(a);
            const dateB = getDate(b);
            if (!dateA) return 1; // Put items without a date at the end
            if (!dateB) return -1;
            return new Date(dateB) - new Date(dateA);
        });
        return uniqueCredits;
    };

    // Acting Credits
    const uniqueActingCredits = processCredits(allCastCredits.filter(c => c.character !== 'Self'));
    const actingFilms = uniqueActingCredits.filter(c => c.media_type === 'movie');
    const actingSeries = uniqueActingCredits.filter(c => c.media_type === 'tv');

    // Directing / Creating Credits
    const directingCrew = allCrewCredits.filter(c => c.job === 'Director' || c.job === 'Creator');
    const uniqueDirectorCredits = processCredits(directingCrew);

    renderFilmographyGrid(document.getElementById('filmography-films-grid'), actingFilms, personData);
    renderFilmographyGrid(document.getElementById('filmography-series-grid'), actingSeries, personData);

    // Conditionally handle the director tab and grid
    const directorTab = tabsContainer.querySelector('[data-tab="filmography-director"]');
    if (directorTab) {
        if (uniqueDirectorCredits.length > 0) {
            directorTab.style.display = ''; // Use default display style
            renderFilmographyGrid(document.getElementById('filmography-director-grid'), uniqueDirectorCredits, personData);
        } else {
            directorTab.style.display = 'none';
        }
    }
}


function setupPageEventListeners(personData) {
    const bioText = document.querySelector('.person-bio p');
    const readMoreBtn = document.querySelector('.read-more-btn');
    if (readMoreBtn) {
        readMoreBtn.addEventListener('click', () => {
            bioText.classList.toggle('expanded');
            readMoreBtn.textContent = bioText.classList.contains('expanded') ? 'Read Less' : 'Read More';
        });
    }

    const filmographySection = document.querySelector('.filmography');
    if (filmographySection) {
        filmographySection.addEventListener('click', (e) => {
            if (e.target.closest('a.media-card-link')) {
                const filmsGrid = document.getElementById('filmography-films-grid');
                const seriesGrid = document.getElementById('filmography-series-grid');
                if (filmsGrid && seriesGrid) {
                     const scrollPositions = {
                        films: filmsGrid.scrollLeft,
                        series: seriesGrid.scrollLeft,
                    };
                    sessionStorage.setItem(`personPageScrollPos-${personData.id}`, JSON.stringify(scrollPositions));
                }
            }
        });
    }
}

export async function renderPersonPage(appRoot, params) {
    const { id } = params;
    if (!id) {
        appRoot.innerHTML = '<p>No person specified.</p>';
        return;
    }

    appRoot.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`;

    try {
        const [personData, creditsData] = await Promise.all([
            getPersonDetails(id),
            getPersonCombinedCredits(id)
        ]);

        if (!personData) {
            throw new Error('Person not found');
        }

        addPageToHistory({
            type: 'person',
            id: id,
            name: personData.name,
            posterPath: personData.profile_path
        });
        
        // Track interest in this person for the recommendation algorithm
        updatePersonAffinity(id, personData.known_for_department);

        const profileUrl = personData.profile_path ? `${IMAGE_BASE_URL}${personData.profile_path}` : '';
        const age = calculateAge(personData.birthday, personData.deathday);
        const externalLinksHtml = renderExternalLinks(personData);
        
        const name = escapeHTML(personData.name);
        const bio = escapeHTML(personData.biography);
        const placeOfBirth = escapeHTML(personData.place_of_birth);

        const pageHtml = `
            <div class="person-page-container">
                <section class="person-hero">
                    <img src="${profileUrl}" alt="${name}" class="person-hero-image">
                    <div class="person-hero-details">
                        <h1 class="person-name">${name}</h1>
                        <div class="person-bio">
                            <h3>Biography</h3>
                            <p>${bio || 'No biography available.'}</p>
                            ${(personData.biography?.length || 0) > 400 ? '<button class="read-more-btn">Read More</button>' : ''}
                        </div>
                        <div class="person-meta">
                            <div class="person-meta-item">
                                <span class="person-meta-label">Known For</span>
                                <span>${escapeHTML(personData.known_for_department)}</span>
                            </div>
                            <div class="person-meta-item">
                                <span class="person-meta-label">Born</span>
                                <span>${personData.birthday ? new Date(personData.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                            </div>
                             ${personData.deathday ? `
                                <div class="person-meta-item">
                                    <span class="person-meta-label">Died</span>
                                    <span>${new Date(personData.deathday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (aged ${age})</span>
                                </div>
                             ` : (age ? `
                                <div class="person-meta-item">
                                    <span class="person-meta-label">Age</span>
                                    <span>${age}</span>
                                </div>
                             ` : '')}
                            <div class="person-meta-item">
                                <span class="person-meta-label">Place of Birth</span>
                                <span>${placeOfBirth || 'N/A'}</span>
                            </div>
                        </div>
                        ${externalLinksHtml}
                    </div>
                </section>
                <section class="filmography">
                    <h2 class="shelf-title">Filmography</h2>
                    <div class="filmography-tabs">
                        <button class="filmography-tab active" data-tab="filmography-films">Films</button>
                        <button class="filmography-tab" data-tab="filmography-series">TV Series</button>
                        <button class="filmography-tab" data-tab="filmography-director">Director</button>
                    </div>
                    <div id="filmography-films" class="filmography-tab-content active">
                        <div class="filmography-grid" id="filmography-films-grid">
                            <div class="loader-small"><i class="fas fa-spinner"></i></div>
                        </div>
                    </div>
                    <div id="filmography-series" class="filmography-tab-content">
                         <div class="filmography-grid" id="filmography-series-grid">
                            <div class="loader-small"><i class="fas fa-spinner"></i></div>
                        </div>
                    </div>
                    <div id="filmography-director" class="filmography-tab-content">
                         <div class="filmography-grid" id="filmography-director-grid">
                            <div class="loader-small"><i class="fas fa-spinner"></i></div>
                        </div>
                    </div>
                </section>
            </div>
        `;
        appRoot.innerHTML = pageHtml;
        
        setupPageEventListeners(personData);
        setupFilmography(personData, creditsData);
        
        const storedScroll = sessionStorage.getItem(`personPageScrollPos-${id}`);
        if (storedScroll) {
            try {
                const { films, series } = JSON.parse(storedScroll);
                const filmsGrid = document.getElementById('filmography-films-grid');
                const seriesGrid = document.getElementById('filmography-series-grid');
                
                setTimeout(() => {
                    if (filmsGrid) filmsGrid.scrollLeft = films;
                    if (seriesGrid) seriesGrid.scrollLeft = series;
                }, 0);

            } catch (e) {
                console.error("Could not parse scroll positions", e);
                sessionStorage.removeItem(`personPageScrollPos-${id}`);
            }
        }

        setTimeout(() => {
            appRoot.querySelector('.person-page-container')?.classList.add('loaded');
        }, 100);

    } catch (error) {
        console.error("Failed to render person page:", error);
        appRoot.innerHTML = '<p>Could not load person details.</p>';
    }
}
