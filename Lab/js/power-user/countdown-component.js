
import { getCurrentUserDoc } from '../user-state.js';
import { showDonationModal } from '../donation.js';

function calculateRemainingTime(expiryTimestamp) {
    if (!expiryTimestamp) return null;
    
    let expiryDate;
    // Handle Firestore Timestamp or Date string/object
    if (typeof expiryTimestamp.toDate === 'function') {
        expiryDate = expiryTimestamp.toDate();
    } else {
        expiryDate = new Date(expiryTimestamp);
    }

    const now = new Date();
    const diffMs = expiryDate - now;
    
    if (diffMs <= 0) return 0;
    
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days;
}

function render(container) {
    const user = getCurrentUserDoc();
    
    // Only show if the user has previously entered a key (field exists)
    if (!user || !user.powerUserExpiresAt) {
        container.innerHTML = '';
        return;
    }
    
    // Default state logic
    let daysLeft = calculateRemainingTime(user.powerUserExpiresAt);
    let statusClass = 'status-expired';
    let title = 'Power User';
    let percent = 0;

    if (daysLeft > 0) {
        // Assuming a standard key is 30 days for the visual scale, 
        // but cap it at 100% if they have more.
        percent = Math.min((daysLeft / 30) * 100, 100);

        if (daysLeft > 7) {
            statusClass = 'status-good';
            title = 'Active';
        } else if (daysLeft > 3) {
            statusClass = 'status-warning';
            title = 'Expiring Soon';
        } else {
            statusClass = 'status-critical';
            title = 'Critical';
        }
    } else {
        // Expired
        statusClass = 'status-expired';
        title = 'Expired';
        percent = 0;
    }

    const daysText = daysLeft > 0 ? `${daysLeft} Days Left` : 'Inactive';

    container.innerHTML = `
        <div class="power-user-status ${statusClass}" id="pu-status-trigger" title="Click to extend access">
            <div class="pu-header">
                <span class="pu-title"><i class="fas fa-bolt"></i> ${title}</span>
                <span class="pu-days">${daysText}</span>
            </div>
            <div class="pu-progress-track">
                <div class="pu-progress-fill" style="width: ${percent}%"></div>
            </div>
        </div>
    `;

    document.getElementById('pu-status-trigger').addEventListener('click', (e) => {
        e.stopPropagation(); 
        showDonationModal();
        document.dispatchEvent(new CustomEvent('close-command-bar-widgets'));
    });
}

export function initPowerUserCountdown(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render initial state
    render(container);

    // Listen for real-time updates (handled by user-state.js)
    document.addEventListener('user-data-updated', () => {
        render(container);
    });
}
