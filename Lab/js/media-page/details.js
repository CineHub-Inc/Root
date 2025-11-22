import { formatCurrency } from './utils.js';

export function renderDetailsTab(data, mediaType) {
    const status = data.status || 'N/A';
    const originalLanguage = new Intl.DisplayNames(['en'], { type: 'language' }).of(data.original_language) || 'N/A';
    
    const productionCountries = data.production_countries?.map(c => 
        c.name === 'United States of America' ? 'USA' : c.name
    ).join(', ') || 'N/A';

    const productionCompanies = data.production_companies?.map(c => c.name).join(', ') || 'N/A';

    // Find the director for movies, or creator for TV shows
    let directorHtml = '';
    if (mediaType === 'tv' && data.created_by?.length > 0) {
        const creators = data.created_by;
        const creatorLinks = creators.map(c => `<a href="#person?id=${c.id}">${c.name}</a>`).join(', ');
        directorHtml = `
            <div class="detail-item">
                <span class="detail-label">${creators.length > 1 ? 'Creators' : 'Creator'}</span>
                <span class="detail-value">${creatorLinks}</span>
            </div>
        `;
    } else {
        const director = data.credits?.crew?.find(person => person.job === 'Director');
        if (director) {
            directorHtml = `
                <div class="detail-item">
                   <span class="detail-label">Director</span>
                   <span class="detail-value"><a href="#person?id=${director.id}">${director.name}</a></span>
               </div>`;
        }
    }


    let mediaSpecificDetails = '';
    if (mediaType === 'movie') {
        mediaSpecificDetails = `
            <div class="detail-item"><span class="detail-label">Budget</span><span class="detail-value">${formatCurrency(data.budget)}</span></div>
            <div class="detail-item"><span class="detail-label">Revenue</span><span class="detail-value">${formatCurrency(data.revenue)}</span></div>
        `;
    } else {
        mediaSpecificDetails = `
            <div class="detail-item"><span class="detail-label">Seasons</span><span class="detail-value">${data.number_of_seasons || 'N/A'}</span></div>
            <div class="detail-item"><span class="detail-label">Episodes</span><span class="detail-value">${data.number_of_episodes || 'N/A'}</span></div>
        `;
    }

    return `
        <div id="details-content" class="tab-content">
            <div class="details-grid">
                <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${status}</span></div>
                ${directorHtml}
                <div class="detail-item"><span class="detail-label">Country</span><span class="detail-value">${productionCountries}</span></div>
                <div class="detail-item"><span class="detail-label">Language</span><span class="detail-value">${originalLanguage}</span></div>
                ${mediaSpecificDetails}
                <div class="detail-item"><span class="detail-label">Production</span><span class="detail-value">${productionCompanies}</span></div>
            </div>
        </div>
    `;
}