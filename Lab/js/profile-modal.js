import { openModal, closeModal } from './modal.js';
import { auth, db } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getCurrentUserDoc } from './user-state.js';
import { showToast } from './toast.js';

function getProfileModalHtml() {
    const user = getCurrentUserDoc();
    const name = user?.name || '';

    return `
        <div class="profile-modal-content">
            <h2 class="profile-modal-title">Your Profile</h2>

            <form id="profile-name-form" class="auth-form" novalidate>
                <h3 class="profile-section-title">Profile Information</h3>
                <div class="form-group">
                    <label for="profile-name">Name</label>
                    <input type="text" id="profile-name" value="${name}" placeholder="Enter your name">
                </div>
                <div id="name-message" class="auth-message"></div>
                <button type="submit" class="auth-submit-btn" id="save-name-btn" disabled>Save Name</button>
            </form>

            <div class="profile-divider"></div>

            <form id="profile-password-form" class="auth-form" novalidate>
                <h3 class="profile-section-title">Change Password</h3>
                <div class="form-group">
                    <label for="current-password">Current Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="current-password" required>
                        <button type="button" class="toggle-password" aria-label="Show password"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="new-password">New Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="new-password" minlength="6" required>
                        <button type="button" class="toggle-password" aria-label="Show password"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="confirm-password">Confirm New Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="confirm-password" minlength="6" required>
                        <button type="button" class="toggle-password" aria-label="Show password"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div id="password-error" class="auth-error"></div>
                <div id="password-message" class="auth-message"></div>
                <button type="submit" class="auth-submit-btn" id="change-password-btn" disabled>Change Password</button>
            </form>
        </div>
    `;
}

async function handleNameUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const nameInput = document.getElementById('profile-name');
    const saveBtn = document.getElementById('save-name-btn');
    const messageDiv = document.getElementById('name-message');
    const newName = nameInput.value.trim();
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    messageDiv.classList.remove('show', 'success');

    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { name: newName });
        showToast({ message: "Name updated successfully!", type: 'success' });
    } catch (error) {
        console.error("Error updating name:", error);
        showToast({ message: "Could not update name.", type: 'error' });
    } finally {
        saveBtn.innerHTML = 'Save Name';
    }
}

async function handlePasswordUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorDiv = document.getElementById('password-error');
    const messageDiv = document.getElementById('password-message');
    const changeBtn = document.getElementById('change-password-btn');

    errorDiv.classList.remove('show');
    messageDiv.classList.remove('show');

    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'New passwords do not match.';
        errorDiv.classList.add('show');
        return;
    }

    changeBtn.disabled = true;
    changeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);

        messageDiv.textContent = 'Password updated successfully!';
        messageDiv.classList.add('show', 'success');
        e.target.reset(); // Clear form fields
        showToast({ message: "Password updated successfully!", type: 'success' });

    } catch (error) {
        let errorMessage = 'An error occurred. Please try again.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Incorrect current password.';
        } else {
            console.error("Password update error:", error);
        }
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        changeBtn.innerHTML = 'Change Password';
    }
}


function setupModalListeners() {
    const nameForm = document.getElementById('profile-name-form');
    const passwordForm = document.getElementById('profile-password-form');
    const nameInput = document.getElementById('profile-name');
    const saveNameBtn = document.getElementById('save-name-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const originalName = nameInput.value;

    nameInput.addEventListener('input', () => {
        saveNameBtn.disabled = nameInput.value.trim() === originalName;
    });

    nameForm.addEventListener('submit', handleNameUpdate);
    passwordForm.addEventListener('submit', handlePasswordUpdate);

    // Enable change password button only when all fields are filled
    const passwordFields = passwordForm.querySelectorAll('input[type="password"]');
    passwordFields.forEach(field => {
        field.addEventListener('input', () => {
            const allFilled = Array.from(passwordFields).every(f => f.value.length > 0);
            changePassBtn.disabled = !allFilled;
        });
    });

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const passwordInput = toggle.previousElementSibling;
            const icon = toggle.querySelector('i');
            const isPassword = passwordInput.type === 'password';

            passwordInput.type = isPassword ? 'text' : 'password';
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    });
}

export function showProfileModal() {
    openModal(getProfileModalHtml(), 'profile-modal');
    setupModalListeners();
}