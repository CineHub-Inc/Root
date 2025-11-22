import { db, auth } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './toast.js';

export async function handleUnlockCode(code) {
    const user = auth.currentUser;
    if (!user) {
        // Fail silently if not logged in, as this is called from the search bar.
        return false;
    }

    const upperCaseCode = code.toUpperCase();
    const keyRef = doc(db, "PowerUserKeys", upperCaseCode);
    
    try {
        const keyDoc = await getDoc(keyRef);

        if (!keyDoc.exists()) {
            return false; // Not a valid key, fail silently for search bar integration.
        }

        const keyData = keyDoc.data();
        const status = keyData.Status;

        if (status !== 'active') {
            let message = 'This key is not currently active.';
            if (status === 'claimed') message = 'This key has already been used.';
            if (status === 'paused') message = 'This key is currently paused by an administrator.';
            if (status === 'inactive') message = 'This key has been deactivated.';
            showToast({ message: message, type: 'error' });
            return false;
        }


        const durationDays = keyData.Time || 0;
        if (durationDays <= 0) {
            showToast({ message: "This key has an invalid duration.", type: 'error' });
            return false;
        }

        // Key is valid. Proceed to grant access.
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        const now = new Date();
        const currentExpiry = (userDoc.exists() && userDoc.data().powerUserExpiresAt) ? userDoc.data().powerUserExpiresAt.toDate() : now;
        
        const startDate = currentExpiry > now ? currentExpiry : now;
        
        const newExpiryDate = new Date(startDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);

        // Update user document
        await setDoc(userRef, {
            powerUserExpiresAt: Timestamp.fromDate(newExpiryDate)
        }, { merge: true });


        // Claim the key
        await updateDoc(keyRef, {
            claimedBy: user.uid,
            claimedAt: serverTimestamp(),
            Status: 'claimed'
        });

        showToast({ message: `Success! Power User access granted for ${durationDays} days.`, type: 'success', duration: 7000 });
        return true;

    } catch (error) {
        console.error("Error processing unlock key:", error);
        showToast({ message: "A database error occurred. Please try again.", type: 'error' });
        return false;
    }
}