
import { initGame } from './game.js';
import { showToast } from '../toast.js';
import { getCurrentUserDoc } from '../user-state.js';

function isDevToolKey(e) {
    // F12
    if (e.key === 'F12') return true;

    // Ctrl+Shift+I/J/C (Windows/Linux) or Cmd+Option+I/J/C (Mac)
    if ((e.ctrlKey && e.shiftKey) || (e.metaKey && e.altKey)) {
        const key = e.key.toLowerCase();
        if (['i', 'j', 'c', 'u'].includes(key)) return true;
    }
    
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key.toLowerCase() === 'u') return true;

    return false;
}

export function initInterceptor() {
    // Check if user is admin
    const user = getCurrentUserDoc();
    if (user && user.userType === 'admin') {
        return; // Admins can use dev tools
    }

    window.addEventListener('keydown', (e) => {
        const currentUser = getCurrentUserDoc();
        if (currentUser && currentUser.userType === 'admin') return;

        if (isDevToolKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            
            showToast({ message: "Source code is boring. Rate these movies instead!", type: 'info' });
            initGame();
        }
    });

    window.addEventListener('contextmenu', (e) => {
        const currentUser = getCurrentUserDoc();
        if (currentUser && currentUser.userType === 'admin') return;

        // Allow context menu on text fields, otherwise block
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        
        e.preventDefault();
        showToast({ message: "Right-click disabled. Enjoy this game instead.", type: 'info' });
        initGame();
    });
}
