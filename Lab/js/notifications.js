
import { db } from './firebase.js';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openModal, closeModal } from './modal.js';

let unsubscribe = null;

function showMessageModal(messageId, data) {
    const html = `
        <div class="profile-modal-content">
            <h2 class="profile-modal-title" style="color: var(--focus-color);">
                <i class="fas fa-envelope-open-text"></i> New Message
            </h2>
            
            <div style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">${data.title}</h3>
                <p style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 1rem;">From Admin • ${new Date(data.timestamp.toDate()).toLocaleString()}</p>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; line-height: 1.6;">
                    ${data.body.replace(/\n/g, '<br>')}
                </div>
            </div>

            <div style="display:flex; justify-content: flex-end;">
                <button class="admin-btn primary-btn" onclick="window.markMessageAsRead('${messageId}')">
                    <i class="fas fa-check"></i> Mark as Read
                </button>
            </div>
        </div>
    `;
    openModal(html, 'auth-modal');
}

// Attached to window for the modal button onclick
window.markMessageAsRead = async (messageId) => {
    if (!messageId) return;
    try {
        // We can't easily get current user ID inside this global function without passing it or storing it.
        // However, the listener is active, so we know who is logged in.
        // But to keep it clean, let's pass the user ID or rely on the closure if possible.
        // Since window functions lose scope, we need to find the path.
        // The path is users/{uid}/notifications/{messageId}.
        // We can store the currentUid in a module variable.
        if (currentUserId) {
            await updateDoc(doc(db, 'users', currentUserId, 'notifications', messageId), {
                read: true
            });
            closeModal();
        }
    } catch (e) {
        console.error("Error marking message as read", e);
    }
};

let currentUserId = null;

export function initNotifications(user) {
    if (unsubscribe) {
        unsubscribe();
    }
    
    currentUserId = user.uid;

    const q = query(
        collection(db, "users", user.uid, "notifications"),
        where("read", "==", false),
        orderBy("timestamp", "desc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            // Take the latest unread message (or oldest? usually FIFO is better for reading, but LIFO for urgency).
            // Let's show the most recent one.
            const docSnap = snapshot.docs[0];
            showMessageModal(docSnap.id, docSnap.data());
        }
    });
}

export function detachNotifications() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    currentUserId = null;
}
