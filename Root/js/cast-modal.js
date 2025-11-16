import { getMediaCredits, getMediaDetails, getPersonDetails, IMAGE_BASE_URL } from './api.js';
import { openModal } from './modal.js';

async function progressivelyLoadCastDetails(cast, releaseDate) {
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

    for (const member of cast) {
        const cardElement = document.getElementById(`cast-member-${member.id}`);
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

            const ageText = currentAge ? `${currentAge}${ageAtFilming && ageAtFilming > 0 ? ` (${ageAtFilming})` : ''}` : 'N/A';
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

export async function showCast(mediaId, mediaType) {
    openModal('<div class="loader"><i class="fas fa-spinner"></i></div>');

    try {
        const [creditsData, mediaData] = await Promise.all([
            getMediaCredits(mediaId, mediaType),
            getMediaDetails(mediaId, mediaType)
        ]);
        
        const cast = creditsData?.cast;

        if (cast && cast.length > 0) {
            const topCast = cast.slice(0, 20); // Limit to top 20 cast members

            const castGridHtml = topCast.map(member => {
                const imageUrl = member.profile_path
                    ? `${IMAGE_BASE_URL}${member.profile_path}`
                    : '';
                const characterName = member.character || 'N/A';
                const characterTitle = member.character || 'Character not specified';
                return `
                    <div class="cast-member-card" id="cast-member-${member.id}">
                        <div class="cast-member-image-container">
                            ${imageUrl 
                                ? `<img src="${imageUrl}" alt="${member.name}" loading="lazy">` 
                                : '<i class="fas fa-user-alt"></i>'
                            }
                        </div>
                        <div class="cast-member-details">
                             <div class="cast-member-name">${member.name}</div>
                             <div class="cast-member-character" title="${characterTitle}">
                                <div class="cast-info-icon character-icon"></div>
                                <span>${characterName}</span>
                            </div>
                            <div class="cast-member-info-placeholder"><div class="loader-tiny"></div></div>
                        </div>
                    </div>
                `;
            }).join('');

            const contentHtml = `
                <div class="cast-modal-header">
                     <h2 class="cast-modal-title">Cast</h2>
                </div>
                <div class="cast-grid">${castGridHtml}</div>
            `;
            openModal(contentHtml);

            // Asynchronously load the extra details without blocking the modal display
            progressivelyLoadCastDetails(topCast, mediaData.release_date || mediaData.first_air_date);

        } else {
            openModal('<p class="no-content-message">Could not load cast information.</p>');
        }
    } catch (error) {
        console.error('Error fetching cast:', error);
        openModal('<p class="no-content-message">Could not load cast information.</p>');
    }
}