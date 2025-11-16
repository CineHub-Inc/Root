import { db, auth } from './firebase.js';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './toast.js';

/**
 * Handles the logic for unlocking a feature with a code.
 * Provides user feedback for all scenarios.
 * @param {string} code The code entered by the user.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
export async function handleUnlockCode(code) {
    const user = auth.currentUser;
    if (!user) {
        showToast({ message: "You must be logged in to use a code.", type: 'error' });
        return false;
    }

    const upperCaseCode = code.toUpperCase();
    const codeRef = doc(db, "unlockCodes", upperCaseCode);
    
    try {
        const codeDoc = await getDoc(codeRef);

        if (!codeDoc.exists()) {
            showToast({ message: "Invalid code.", type: 'error' });
            return false;
        }

        if (codeDoc.data().isClaimed) {
            showToast({ message: "This code has already been used.", type: 'info' });
            return false;
        }

        // The code is valid and unclaimed.
        
        // Step 1: Claim the code.
        await updateDoc(codeRef, {
            isClaimed: true,
            claimedBy: user.uid,
            claimedAt: serverTimestamp()
        });
        
        // Step 2: Enable the feature for the user by creating or updating their watchlist doc.
        const userWatchlistRef = doc(db, "watchlists", user.uid);
        await setDoc(userWatchlistRef, { 
            watchFeatureEnabled: true 
        }, { merge: true });

        // On success, notify the user. The real-time listener will update the UI automatically.
        showToast({ message: 'Feature Unlocked! You can now watch content.', type: 'success', duration: 7000 });
        
        return true; // Signal success

    } catch (error) {
        console.error("Error processing unlock code:", error);
        showToast({ message: "A database error occurred. Please try again.", type: 'error' });
        return false; // Signal failure
    }
}