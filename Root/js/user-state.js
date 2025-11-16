import { db } from './firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUserData = null;
let unsubscribeUser = null;

export function syncCurrentUser(user) {
    if (unsubscribeUser) {
        unsubscribeUser();
    }
    const userDocRef = doc(db, "users", user.uid);
    unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
        } else {
            currentUserData = {}; // User doc might not exist yet
        }
        // Dispatch a global event so UI can react to user data changes
        document.dispatchEvent(new CustomEvent('user-data-updated'));
    }, (error) => {
        console.error("User document sync error:", error);
        currentUserData = null;
    });
}

export function detachCurrentUserSync() {
    if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
    }
    currentUserData = null;
}

export function getCurrentUserDoc() {
    return currentUserData;
}
