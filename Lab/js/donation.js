
import { openModal } from './modal.js';

export function showDonationModal() {
    const html = `
        <div class="donation-modal-content">
            <h2>Enjoying CineHub?</h2>
            <p class="donation-description">Consider buying me a coffee to keep the servers running!</p>
            <div class="qr-container">
                <img src="images/QR-Code.png" alt="Monzo QR Code" class="donation-qr" loading="lazy">
            </div>
            <p class="donation-note"><i class="fas fa-camera"></i> Scan the QR Code with your camera</p>
        </div>
    `;
    openModal(html, 'donation-modal');
}

export function initDonation() {
    const btn = document.getElementById('donate-btn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent href="#" jump if it were an anchor, though it's a button
            showDonationModal();
        });
    }
}
