export function createSkeletonLoader() {
    return `
        <div class="media-page-wrapper">
            <header class="media-hero skeleton-hero">
                <div class="media-hero-content">
                    <div class="skeleton skeleton-poster"></div>
                    <div class="media-hero-details">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-tagline"></div>
                        <div class="skeleton skeleton-meta"></div>
                        <div class="media-hero-overview">
                            <div class="skeleton skeleton-overview-p"></div>
                            <div class="skeleton skeleton-overview-p"></div>
                        </div>
                        <div class="media-hero-actions">
                            <div class="skeleton skeleton-button"></div>
                            <div class="skeleton skeleton-button"></div>
                        </div>
                    </div>
                </div>
            </header>
        </div>
    `;
}