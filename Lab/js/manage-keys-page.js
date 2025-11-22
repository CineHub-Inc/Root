
import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp, 
    query, 
    orderBy,
    Timestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';
import { getCurrentUserDoc } from './user-state.js';

let usersCache = new Map();

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    // Format to dd Mmm YYYY, e.g., 01 Jan 2025
    return timestamp.toDate().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

async function getUserEmail(uid) {
    if (!uid) return 'N/A';
    if (usersCache.has(uid)) {
        return usersCache.get(uid);
    }
    try {
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const email = userDoc.data().email;
            usersCache.set(uid, email);
            return email;
        }
        usersCache.set(uid, 'Unknown User');
        return 'Unknown User';
    } catch (error) {
        console.error("Error fetching user email:", error);
        usersCache.set(uid, 'Error');
        return 'Error';
    }
}

async function findUserByEmail(email) {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0];
    } catch (error) {
        console.error("Error finding user by email:", error);
        return null;
    }
}

function generateKeyCode() {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    const segments = [4, 4, 4];
    let code = [];

    for (const segmentLength of segments) {
        let segment = '';
        for (let i = 0; i < segmentLength; i++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code.push(segment);
    }
    return code.join('-');
}


function renderKeyCard(keyId, keyData) {
    const status = keyData.Status || 'inactive';
    
    let expiryDateHtml = '';
    if (keyData.claimedAt && keyData.Time) {
        const claimedDate = keyData.claimedAt.toDate();
        const expiryDate = new Date(claimedDate);
        expiryDate.setDate(expiryDate.getDate() + keyData.Time);
        const formattedExpiry = formatTimestamp({ toDate: () => expiryDate });
        expiryDateHtml = `<div><strong>Expiry Date:</strong> <span>${formattedExpiry}</span></div>`;
    }

    let actionsHtml = `<button class="key-action-btn" data-action="edit">Edit</button>`;
    if (status === 'active') {
        actionsHtml += `<button class="key-action-btn" data-action="deactivate">Deactivate</button>`;
    }
    if (status === 'inactive') {
        actionsHtml += `<button class="key-action-btn" data-action="activate">Activate</button>`;
    }
    if (status === 'claimed') {
        actionsHtml += `<button class="key-action-btn" data-action="pause">Pause</button>`;
    }
    if (status === 'paused') {
        actionsHtml += `<button class="key-action-btn" data-action="unpause">Unpause</button>`;
    }
    actionsHtml += `<button class="key-action-btn delete-btn" data-action="delete">Delete</button>`;


    return `
        <div class="key-card" data-status="${status.toLowerCase()}" data-key-id="${keyId}">
            <div class="key-string">
                <span>${keyId}</span>
                <button class="copy-btn" data-action="copy" title="Copy Key">
                    <i class="far fa-copy"></i>
                </button>
            </div>
            <div class="key-details">
                <div><strong>Status:</strong> <span class="status-badge">${status.charAt(0).toUpperCase() + status.slice(1)}</span></div>
                <div><strong>Duration:</strong> ${keyData.Time || 'N/A'} days</div>
                <div><strong>Created:</strong> ${formatTimestamp(keyData.createdAt)}</div>
                <div class="claimed-by-field"><strong>Claimed By:</strong> <span class="claimed-by-value">${keyData.claimedBy ? 'Loading...' : 'N/A'}</span></div>
                <div><strong>Claimed At:</strong> ${formatTimestamp(keyData.claimedAt)}</div>
                ${expiryDateHtml}
            </div>
            <div class="key-notes">
                <strong>Notes:</strong> <span>${keyData.Notes || 'N/A'}</span>
            </div>
            <div class="key-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

function applyKeyFiltersAndSearch() {
    const container = document.getElementById('keys-list-container');
    if (!container) return;

    const activeFilter = document.querySelector('.key-filter-chip.active')?.dataset.filter || 'all';
    const searchTerm = document.getElementById('key-search-input')?.value.toLowerCase() || '';
    const keyCards = container.querySelectorAll('.key-card');
    const noKeysMessage = document.getElementById('no-keys-message');

    let visibleCount = 0;

    keyCards.forEach(card => {
        const status = card.dataset.status;
        const keyId = card.querySelector('.key-string span')?.textContent.toLowerCase() || '';
        const notes = card.querySelector('.key-notes span')?.textContent.toLowerCase() || '';
        const claimedBy = card.querySelector('.claimed-by-value')?.textContent.toLowerCase() || '';

        const statusMatch = activeFilter === 'all' || status === activeFilter;
        const searchMatch = searchTerm === '' || 
                            keyId.includes(searchTerm) || 
                            notes.includes(searchTerm) ||
                            (claimedBy !== 'n/a' && claimedBy.includes(searchTerm));

        if (statusMatch && searchMatch) {
            card.style.display = 'grid';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (noKeysMessage) {
        noKeysMessage.textContent = 'No keys match the current filter.';
        noKeysMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}


async function loadAndRenderKeys() {
    const container = document.getElementById('keys-list-container');
    const noKeysMessage = document.getElementById('no-keys-message');
    if (!container) return;
    container.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`;
    if(noKeysMessage) noKeysMessage.style.display = 'none';

    try {
        const keysQuery = query(collection(db, "PowerUserKeys"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(keysQuery);
        
        if (querySnapshot.empty) {
            container.innerHTML = '';
            if(noKeysMessage) {
                noKeysMessage.textContent = 'No keys found. Create one to get started!';
                noKeysMessage.style.display = 'block';
            }
            return;
        }

        const keysHtml = querySnapshot.docs.map(doc => renderKeyCard(doc.id, doc.data())).join('');
        container.innerHTML = keysHtml;

        // Progressively load user emails
        for (const doc of querySnapshot.docs) {
            const keyData = doc.data();
            if (keyData.claimedBy) {
                const email = await getUserEmail(keyData.claimedBy);
                const emailEl = container.querySelector(`[data-key-id="${doc.id}"] .claimed-by-value`);
                if (emailEl) {
                    emailEl.textContent = email;
                }
            }
        }
        applyKeyFiltersAndSearch(); // Apply initial filters
    } catch (error) {
        console.error("Error loading keys:", error);
        container.innerHTML = '';
        if(noKeysMessage) {
            noKeysMessage.textContent = 'Could not load keys. Please check console for errors.';
            noKeysMessage.style.display = 'block';
        }
    }
}

function getEditModalHtml(keyId, keyData) {
    return `
        <div class="edit-key-modal-content">
            <h2 class="edit-key-title">Edit Key</h2>
            <p class="edit-key-subtitle">${keyId}</p>
            <form id="edit-key-form" class="auth-form">
                 <div class="form-group">
                    <label for="edit-key-duration">Duration (days)</label>
                    <input type="number" id="edit-key-duration" value="${keyData.Time || 30}" min="1" required>
                </div>
                 <div class="form-group">
                    <label for="edit-key-notes">Notes (for admin reference)</label>
                    <textarea id="edit-key-notes" rows="3" placeholder="e.g., For giveaway winner John D.">${keyData.Notes || ''}</textarea>
                </div>
                <div class="edit-key-actions">
                    <button type="button" class="preferences-btn pref-cancel-btn">Cancel</button>
                    <button type="submit" class="preferences-btn pref-save-btn">Save Changes</button>
                </div>
            </form>
        </div>
    `;
}

async function openEditModal(keyId, keyData) {
    openModal(getEditModalHtml(keyId, keyData), 'auth-modal');

    const form = document.getElementById('edit-key-form');
    const cancelBtn = form.querySelector('.pref-cancel-btn');

    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = form.querySelector('.pref-save-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const newDuration = parseInt(document.getElementById('edit-key-duration').value, 10);
        const newNotes = document.getElementById('edit-key-notes').value;
        
        try {
            const keyRef = doc(db, "PowerUserKeys", keyId);
            await updateDoc(keyRef, {
                Time: newDuration,
                Notes: newNotes
            });
            showToast({ message: 'Key updated successfully!', type: 'success' });
            closeModal();
            loadAndRenderKeys();
        } catch (error) {
            console.error("Error updating key:", error);
            showToast({ message: 'Failed to update key.', type: 'error' });
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
}

async function handleCreateKey(e) {
    e.preventDefault();
    const durationInput = document.getElementById('key-duration');
    const keyCodeInput = document.getElementById('key-code');
    const assignEmailInput = document.getElementById('assign-user-email');
    const button = e.target.querySelector('button[type="submit"]');
    
    const duration = parseInt(durationInput.value, 10);
    const keyCode = keyCodeInput.value.trim().toUpperCase();
    const assignEmail = assignEmailInput ? assignEmailInput.value.trim() : '';

    if (!keyCode) {
        showToast({ message: 'Please enter or generate a key code.', type: 'error' });
        return;
    }
    if (isNaN(duration) || duration <= 0) {
        showToast({ message: 'Please enter a valid duration in days.', type: 'error' });
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const keyRef = doc(db, "PowerUserKeys", keyCode);
        const keyDoc = await getDoc(keyRef);
        
        if (keyDoc.exists()) {
            showToast({ message: `Key "${keyCode}" already exists.`, type: 'error' });
            button.disabled = false;
            button.textContent = 'Create Key';
            return;
        }

        let keyData = {
            Status: 'active',
            Time: duration,
            createdAt: serverTimestamp(),
            Notes: null,
            claimedBy: null,
            claimedAt: null
        };

        // Optional User Assignment
        if (assignEmail) {
            const userDoc = await findUserByEmail(assignEmail);
            if (!userDoc) {
                showToast({ message: `User not found: ${assignEmail}`, type: 'error' });
                button.disabled = false;
                button.textContent = 'Create Key';
                return;
            }

            // Grant access to user immediately
            const userData = userDoc.data();
            const now = new Date();
            let currentExpiry = now;
            
            // Handle Firestore Timestamp conversion safely
            if (userData.powerUserExpiresAt) {
                if (typeof userData.powerUserExpiresAt.toDate === 'function') {
                    currentExpiry = userData.powerUserExpiresAt.toDate();
                } else {
                    currentExpiry = new Date(userData.powerUserExpiresAt);
                }
            }

            // If user is already active, extend from current expiry. If expired, start from now.
            const startDate = currentExpiry > now ? currentExpiry : now;
            const newExpiryDate = new Date(startDate);
            newExpiryDate.setDate(newExpiryDate.getDate() + duration);

            // Update User Doc
            await setDoc(doc(db, "users", userDoc.id), {
                powerUserExpiresAt: Timestamp.fromDate(newExpiryDate)
            }, { merge: true });

            // Update Key Data as Claimed
            keyData.Status = 'claimed';
            keyData.claimedBy = userDoc.id;
            keyData.claimedAt = serverTimestamp();
            keyData.Notes = `Assigned to ${assignEmail}`;
        }

        await setDoc(keyRef, keyData);

        showToast({ message: assignEmail ? `Key created and assigned to ${assignEmail}!` : `Key ${keyCode} created!`, type: 'success' });
        keyCodeInput.value = '';
        if (assignEmailInput) assignEmailInput.value = '';
        
        await loadAndRenderKeys();
    } catch (error) {
        console.error("Error creating key:", error);
        showToast({ message: 'Failed to create key.', type: 'error' });
    } finally {
        button.disabled = false;
        button.textContent = 'Create Key';
    }
}

async function handleKeyAction(e) {
    const button = e.target.closest('.key-action-btn, .copy-btn');
    if (!button) return;

    const action = button.dataset.action;
    const card = button.closest('.key-card');
    const keyId = card.dataset.keyId;
    const keyRef = doc(db, "PowerUserKeys", keyId);

    try {
        if (action === 'copy') {
             navigator.clipboard.writeText(keyId).then(() => {
                showToast({ message: `Copied: ${keyId}`, type: 'success' });
            }).catch(err => {
                showToast({ message: 'Failed to copy key.', type: 'error' });
                console.error('Copy failed', err);
            });
        } else if (action === 'edit') {
            const keyDoc = await getDoc(keyRef);
            if (keyDoc.exists()) {
                openEditModal(keyId, keyDoc.data());
            } else {
                showToast({ message: 'Key not found.', type: 'error' });
            }
        } else if (action === 'delete') {
            showToast({
                message: `Permanently delete the key "${keyId}"? This will revoke access if claimed.`,
                type: 'error',
                duration: 10000,
                actions: [
                    {
                        text: 'Confirm',
                        className: 'toast-confirm-btn',
                        callback: async () => {
                            try {
                                const keyDoc = await getDoc(keyRef);
                                if (keyDoc.exists() && keyDoc.data().claimedBy) {
                                    const userRef = doc(db, "users", keyDoc.data().claimedBy);
                                    await setDoc(userRef, { powerUserExpiresAt: Timestamp.now() }, { merge: true });
                                }
                                await deleteDoc(keyRef);
                                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, height 0.3s ease, padding 0.3s ease, margin 0.3s ease';
                                card.style.opacity = '0';
                                card.style.transform = 'scale(0.95)';
                                card.style.height = '0';
                                card.style.padding = '0';
                                card.style.margin = '0';
                                setTimeout(() => card.remove(), 300);
                                showToast({ message: `Key ${keyId} deleted.`, type: 'info' });
                            } catch (deleteError) {
                                console.error('Deletion failed after confirmation:', deleteError);
                                showToast({ message: 'Failed to delete key.', type: 'error' });
                            }
                        }
                    },
                    {
                        text: 'Cancel',
                        callback: () => {}
                    }
                ]
            });
        } else if (action === 'deactivate' || action === 'pause') {
            const newStatus = action === 'deactivate' ? 'inactive' : 'paused';
            const keyDoc = await getDoc(keyRef);
            if (keyDoc.exists() && keyDoc.data().claimedBy) {
                const userRef = doc(db, "users", keyDoc.data().claimedBy);
                await setDoc(userRef, { powerUserExpiresAt: Timestamp.now() }, { merge: true });
            }
            await updateDoc(keyRef, { Status: newStatus });
            showToast({ message: `Key ${keyId} is now ${newStatus}. Access revoked if claimed.`, type: 'success' });
            await loadAndRenderKeys();
        } else if (action === 'activate') {
            await updateDoc(keyRef, { Status: 'active' });
            showToast({ message: `Key ${keyId} is now active.`, type: 'success' });
            await loadAndRenderKeys();
        } else if (action === 'unpause') {
            const keyDoc = await getDoc(keyRef);
            if (keyDoc.exists()) {
                const keyData = keyDoc.data();
                if (keyData.claimedBy && keyData.claimedAt && keyData.Time) {
                    const claimedDate = keyData.claimedAt.toDate();
                    const originalExpiryDate = new Date(claimedDate);
                    originalExpiryDate.setDate(originalExpiryDate.getDate() + keyData.Time);

                    if (originalExpiryDate > new Date()) {
                        const userRef = doc(db, "users", keyData.claimedBy);
                        await setDoc(userRef, { powerUserExpiresAt: Timestamp.fromDate(originalExpiryDate) }, { merge: true });
                         showToast({ message: `Key unpaused. User access restored until ${originalExpiryDate.toLocaleDateString()}.`, type: 'success' });
                    } else {
                         showToast({ message: `Key unpaused, but original duration has expired.`, type: 'info' });
                    }
                }
            }
            await updateDoc(keyRef, { Status: 'claimed' });
            await loadAndRenderKeys();
        }
    } catch (error) {
        console.error(`Error performing action "${action}" on key:`, error);
        showToast({ message: `Failed to ${action} key.`, type: 'error' });
    }
}


function setupEventListeners() {
    const createForm = document.getElementById('create-key-form');
    const keysContainer = document.getElementById('keys-list-container');
    const generateBtn = document.getElementById('generate-random-key-btn');
    const filterChipsContainer = document.querySelector('.key-filter-chips');
    const searchInput = document.getElementById('key-search-input');

    if (createForm) {
        createForm.addEventListener('submit', handleCreateKey);
    }
    if (keysContainer) {
        keysContainer.addEventListener('click', handleKeyAction);
    }
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const keyCodeInput = document.getElementById('key-code');
            keyCodeInput.value = generateKeyCode();
        });
    }
    if (filterChipsContainer) {
        filterChipsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('key-filter-chip')) {
                filterChipsContainer.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                applyKeyFiltersAndSearch();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', applyKeyFiltersAndSearch);
    }
}

export function renderManageKeysPage(appRoot) {
    const user = getCurrentUserDoc();
    // Client-side gate: prevent rendering UI if not admin. 
    if (!user || user.userType !== 'admin') {
        appRoot.innerHTML = `
            <div class="manage-keys-page" style="text-align: center; padding: 4rem;">
                <h1>Access Denied</h1>
                <p>You do not have permission to view this page.</p>
                <button onclick="window.history.back()" class="preferences-btn pref-cancel-btn" style="margin-top: 1rem;">Go Back</button>
            </div>
        `;
        return;
    }

    appRoot.innerHTML = `
        <div class="manage-keys-page">
            <header class="manage-keys-header">
                <h1>Manage Power User Keys</h1>
                <p>Create, view, and manage access keys for the watch feature.</p>
            </header>

            <section class="create-key-section">
                <h2>Create New Key</h2>
                <form id="create-key-form">
                    <div class="form-group key-code-group">
                        <label for="key-code">Key Code</label>
                        <div class="key-input-wrapper">
                            <button type="button" id="generate-random-key-btn" class="generate-random-btn" title="Generate Random Key"><i class="fas fa-dice"></i></button>
                            <input type="text" id="key-code" placeholder="e.g., ABCD-EFGH-IJKL" required pattern="[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="key-duration">Duration (days)</label>
                        <input type="number" id="key-duration" value="30" min="1" required>
                    </div>
                    <div class="form-group full-width-mobile">
                        <label for="assign-user-email">Assign to User (Email)</label>
                        <input type="email" id="assign-user-email" placeholder="Optional: user@example.com">
                    </div>
                    <button type="submit" class="generate-key-btn">Create Key</button>
                </form>
            </section>

            <section class="keys-list-section">
                <h2>Existing Keys</h2>
                <div class="keys-list-controls">
                    <div class="key-filter-chips">
                        <button class="key-filter-chip active" data-filter="all">All</button>
                        <button class="key-filter-chip" data-filter="active">Active</button>
                        <button class="key-filter-chip" data-filter="claimed">Claimed</button>
                        <button class="key-filter-chip" data-filter="paused">Paused</button>
                        <button class="key-filter-chip" data-filter="inactive">Inactive</button>
                    </div>
                    <input type="search" id="key-search-input" placeholder="Search keys, notes, email...">
                </div>
                <div class="keys-list-container" id="keys-list-container">
                    <!-- Keys will be loaded here -->
                </div>
                <p class="no-keys-message" id="no-keys-message" style="display: none;"></p>
            </section>
        </div>
    `;

    setupEventListeners();
    loadAndRenderKeys();
}
