import { getPersonDetails, IMAGE_BASE_URL } from '../api.js';

async function progressivelyLoadCastDetails(cast, releaseDate) {
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

    for (const member of cast) {
        const cardElement = document.querySelector(`#cast-content .person-card[data-person-id="${member.id}"]`);
        const placeholder = cardElement?.querySelector('.cast-member-info-placeholder');

        if (!placeholder) continue;

        try {
            const personData = await getPersonDetails(member.id);

            if (!personData) {
                placeholder.innerHTML = `
                    <div class="cast-member-info-item" title="Country not available">
                        <div class="cast-info-icon country-icon"></div>
                        <span>N/A</span>
                    </div>
                    <div class="cast-member-info-item" title="Age not available">
                        <div class="cast-info-icon age-icon"></div>
                        <span>N/A</span>
                    </div>
                `;
                continue;
            }

            // Calculate ages
            let currentAge = null;
            let ageAtFilming = null;
            if (personData.birthday) {
                const birthDate = new Date(personData.birthday);
                const birthYear = birthDate.getFullYear();
                if (!personData.deathday) {
                    currentAge = new Date().getFullYear() - birthYear;
                }
                if (releaseYear) {
                    ageAtFilming = releaseYear - birthYear;
                }
            }

            // Get country from place_of_birth
            let country = personData.place_of_birth?.split(',').pop().trim() || null;
            if (country === 'United States of America') country = 'USA';

            const ageText = currentAge ? `${currentAge}${ageAtFilming && ageAtFilming > 0 && ageAtFilming < currentAge ? ` (${ageAtFilming})` : ''}` : 'N/A';
            const infoHtml = `
                <div class="cast-member-info-item" title="${personData.place_of_birth || 'Country not available'}">
                    <div class="cast-info-icon country-icon"></div>
                    <span>${country || 'N/A'}</span>
                </div>
                <div class="cast-member-info-item" title="Current age (age at time of filming)">
                    <div class="cast-info-icon age-icon"></div>
                    <span>${ageText}</span>
                </div>
            `;
            placeholder.innerHTML = infoHtml;

        } catch (error) {
            console.warn(`Could not load details for cast member ${member.name}`, error);
            if (placeholder) {
                 placeholder.innerHTML = `
                    <div class="cast-member-info-item" title="Details could not be loaded">
                        <div class="cast-info-icon country-icon"></div>
                        <span>N/A</span>
                    </div>
                    <div class="cast-member-info-item" title="Details could not be loaded">
                        <div class="cast-info-icon age-icon"></div>
                        <span>N/A</span>
                    </div>
                `;
            }
        }
    }
}

export function renderCastTab(credits, releaseDate) {
    const castContent = document.getElementById('cast-content');
    if (!castContent) return;

    const fullCast = credits.cast;
    if (fullCast.length > 0) {
        const castHtml = fullCast.map(person => {
            const characterName = person.character || 'N/A';
            const characterTitle = person.character || 'Character not specified';
            return `
            <a href="#person?id=${person.id}" class="person-card-link">
                <div class="person-card" data-person-id="${person.id}">
                    <div class="person-image">
                        ${person.profile_path ? `<img src="${IMAGE_BASE_URL}${person.profile_path}" alt="${person.name}">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="person-info">
                        <div class="person-name">${person.name}</div>
                        <div class="person-character" title="${characterTitle}">
                            <div class="cast-info-icon character-icon"></div>
                            <span>${characterName}</span>
                        </div>
                        <div class="cast-member-info-placeholder"><div class="loader-tiny"></div></div>
                    </div>
                </div>
            </a>
        `}).join('');
        castContent.innerHTML = `<div class="person-grid">${castHtml}</div>`;
        progressivelyLoadCastDetails(fullCast, releaseDate);
    } else {
        castContent.innerHTML = '<p>No cast information available.</p>';
    }
}

export function getCastTabHtml() {
    return `<div id="cast-content" class="tab-content active"></div>`;
}