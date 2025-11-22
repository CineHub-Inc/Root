
import { db, auth } from './firebase.js';
import { 
    collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    serverTimestamp, query, orderBy, Timestamp, where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';
import { getCurrentUserDoc } from './user-state.js';

// --- State Management ---
let state = {
    users: [],
    keys: [],
    activeTab: 'dashboard',
    filters: {
        userSearch: '',
        keySearch: ''
    }
};

// --- Helper Functions ---

function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    // Firestore Timestamp or JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = date - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
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

// --- Data Fetching ---

async function fetchAllUsers() {
    try {
        // Note: In a real large-scale app, pagination would be required.
        // For this admin panel, we fetch all to sort/filter client-side.
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        state.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error fetching users:", e);
        showToast({ message: "Failed to load users", type: 'error' });
    }
}

async function fetchAllKeys() {
    try {
        const q = query(collection(db, "PowerUserKeys"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        state.keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error fetching keys:", e);
        showToast({ message: "Failed to load keys", type: 'error' });
    }
}

async function loadData() {
    const container = document.getElementById('admin-content');
    if (container) container.innerHTML = `<div class="loader"><i class="fas fa-spinner"></i></div>`;
    
    await Promise.all([fetchAllUsers(), fetchAllKeys()]);
    renderTabs();
}

// --- Rendering ---

function renderDashboardTab() {
    const totalUsers = state.users.length;
    const totalKeys = state.keys.length;
    const activeKeys = state.keys.filter(k => k.Status === 'active').length;
    
    const now = new Date();
    const powerUsers = state.users.filter(u => {
        if (!u.powerUserExpiresAt) return false;
        return u.powerUserExpiresAt.toDate() > now;
    }).length;

    // Get 5 recent claims
    const recentActivity = state.keys
        .filter(k => k.claimedAt)
        .sort((a, b) => b.claimedAt.toDate() - a.claimedAt.toDate())
        .slice(0, 5);

    const activityHtml = recentActivity.map(item => {
        const user = state.users.find(u => u.id === item.claimedBy);
        const userName = user ? (user.name || user.email) : 'Unknown User';
        return `
            <li class="activity-item">
                <div class="activity-main">
                    <div class="activity-icon"><i class="fas fa-check"></i></div>
                    <div class="activity-details">
                        <strong>${userName}</strong> claimed key <span class="code-display">${item.id}</span>
                    </div>
                </div>
                <span class="activity-time">${formatDate(item.claimedAt)}</span>
            </li>
        `;
    }).join('');

    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon stat-blue"><i class="fas fa-users"></i></div>
                <div class="stat-info">
                    <h3>Total Users</h3>
                    <div class="stat-value">${totalUsers}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-purple"><i class="fas fa-bolt"></i></div>
                <div class="stat-info">
                    <h3>Active Power Users</h3>
                    <div class="stat-value">${powerUsers}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-green"><i class="fas fa-key"></i></div>
                <div class="stat-info">
                    <h3>Available Keys</h3>
                    <div class="stat-value">${activeKeys}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-orange"><i class="fas fa-ticket"></i></div>
                <div class="stat-info">
                    <h3>Total Keys Generated</h3>
                    <div class="stat-value">${totalKeys}</div>
                </div>
            </div>
        </div>

        <div class="admin-panel">
            <div class="panel-header">
                <h2>Recent Activity</h2>
            </div>
            <ul class="activity-list">
                ${activityHtml || '<li class="activity-item">No recent activity found.</li>'}
            </ul>
        </div>
    `;
}

function renderUsersTab() {
    const term = state.filters.userSearch.toLowerCase();
    const filteredUsers = state.users.filter(u => 
        (u.email && u.email.toLowerCase().includes(term)) || 
        (u.name && u.name.toLowerCase().includes(term))
    );

    const rows = filteredUsers.map(user => {
        const isPower = user.powerUserExpiresAt && user.powerUserExpiresAt.toDate() > new Date();
        const isAdmin = user.userType === 'admin';
        const initials = (user.name || user.email || 'U').substring(0, 2).toUpperCase();
        
        let statusBadge = '<span class="status-badge badge-user"><i class="far fa-user"></i> Free</span>';
        if (isAdmin) statusBadge = '<span class="status-badge badge-admin"><i class="fas fa-shield-alt"></i> Admin</span>';
        else if (isPower) statusBadge = '<span class="status-badge badge-power"><i class="fas fa-bolt"></i> Power</span>';

        const expiry = isPower ? formatDate(user.powerUserExpiresAt) : '-';

        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-details">
                            <span class="user-name">${user.name || 'No Name'}</span>
                            <span class="user-email">${user.email}</span>
                        </div>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${expiry}</td>
                <td class="action-cell">
                    <button class="icon-btn edit" onclick="window.openUserModal('${user.id}')" title="Edit Access"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="admin-panel">
            <div class="panel-header">
                <h2>User Management</h2>
                <div class="panel-controls">
                    <input type="text" class="admin-search" id="user-search" placeholder="Search users..." value="${state.filters.userSearch}">
                </div>
            </div>
            <div class="data-table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Access Expiry</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderKeysTab() {
    const term = state.filters.keySearch.toLowerCase();
    const filteredKeys = state.keys.filter(k => 
        k.id.toLowerCase().includes(term) || 
        (k.Notes && k.Notes.toLowerCase().includes(term))
    );

    const rows = filteredKeys.map(key => {
        let statusClass = 'badge-inactive';
        if (key.Status === 'active') statusClass = 'badge-active';
        if (key.Status === 'claimed') statusClass = 'badge-claimed';
        if (key.Status === 'paused') statusClass = 'badge-expired';

        // Find user email if claimed
        let claimedByEmail = '-';
        if (key.claimedBy) {
            const u = state.users.find(user => user.id === key.claimedBy);
            if (u) claimedByEmail = u.email;
        }

        return `
            <tr>
                <td><span class="code-display" onclick="window.copyKey('${key.id}')">${key.id}</span></td>
                <td><span class="status-badge ${statusClass}">${key.Status}</span></td>
                <td>${key.Time} Days</td>
                <td>${claimedByEmail}</td>
                <td>${key.Notes || '-'}</td>
                <td class="action-cell">
                    <button class="icon-btn edit" onclick="window.openKeyModal('${key.id}')"><i class="fas fa-cog"></i></button>
                    <button class="icon-btn delete" onclick="window.deleteKey('${key.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="admin-panel">
            <div class="create-key-grid">
                <div class="form-group">
                    <label>New Key Code</label>
                    <div style="position:relative">
                        <input type="text" id="new-key-code" class="admin-search" style="width:100%" placeholder="XXXX-XXXX-XXXX">
                        <button onclick="document.getElementById('new-key-code').value = window.generateKey()" style="position:absolute; right:5px; top:5px; background:none; border:none; color:var(--text-color); cursor:pointer"><i class="fas fa-dice"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Duration (Days)</label>
                    <input type="number" id="new-key-duration" class="admin-search" style="width:100%" value="30">
                </div>
                <button class="admin-btn" onclick="window.createKey()">Create Key</button>
            </div>
            
            <div class="panel-header">
                <h2>All Keys</h2>
                <div class="panel-controls">
                    <input type="text" class="admin-search" id="key-search" placeholder="Search keys..." value="${state.filters.keySearch}">
                </div>
            </div>
            <div class="data-table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>Claimed By</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderTabs() {
    const container = document.getElementById('admin-content');
    let content = '';
    
    if (state.activeTab === 'dashboard') content = renderDashboardTab();
    else if (state.activeTab === 'users') content = renderUsersTab();
    else if (state.activeTab === 'keys') content = renderKeysTab();

    container.innerHTML = content;

    // Re-attach listeners for search inputs
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            state.filters.userSearch = e.target.value;
            renderTabs(); // Rerender immediate (could debounce in production)
            // Keep focus
            const input = document.getElementById('user-search');
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
    }
    
    const keySearch = document.getElementById('key-search');
    if (keySearch) {
        keySearch.addEventListener('input', (e) => {
            state.filters.keySearch = e.target.value;
            renderTabs();
            const input = document.getElementById('key-search');
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
    }
}

// --- User Actions ---

window.openUserModal = (userId) => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    const isPower = user.powerUserExpiresAt && user.powerUserExpiresAt.toDate() > new Date();
    
    const html = `
        <div class="profile-modal-content">
            <h2 class="profile-modal-title">Manage User</h2>
            <div class="user-cell" style="margin-bottom: 1.5rem; justify-content: center;">
                <div class="user-avatar" style="width:60px; height:60px; font-size: 1.5rem;">
                    ${(user.name || user.email || 'U').substring(0, 2).toUpperCase()}
                </div>
            </div>
            <p style="text-align:center; opacity: 0.8; margin-bottom: 2rem;">${user.email}</p>

            <h3 class="profile-section-title">Manual Access Control</h3>
            <div class="form-group">
                <label>Set Access Until</label>
                <input type="date" id="access-date-picker" class="admin-search" style="width: 100%">
            </div>
            
            <div style="display:flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="admin-btn" style="flex:1" onclick="window.saveUserAccess('${userId}')">Update Access</button>
                ${isPower ? `<button class="admin-btn btn-outline" style="color: #f85149; border-color: #f85149;" onclick="window.revokeUserAccess('${userId}')">Revoke</button>` : ''}
            </div>
        </div>
    `;
    openModal(html, 'profile-modal');
};

window.saveUserAccess = async (userId) => {
    const dateVal = document.getElementById('access-date-picker').value;
    if (!dateVal) {
        showToast({ message: "Please select a date", type: 'error' });
        return;
    }
    
    try {
        const newDate = new Date(dateVal);
        // Set time to end of day
        newDate.setHours(23, 59, 59);
        
        await setDoc(doc(db, "users", userId), {
            powerUserExpiresAt: Timestamp.fromDate(newDate)
        }, { merge: true });
        
        showToast({ message: "User access updated", type: 'success' });
        closeModal();
        await fetchAllUsers();
        renderTabs();
    } catch (e) {
        console.error(e);
        showToast({ message: "Update failed", type: 'error' });
    }
};

window.revokeUserAccess = async (userId) => {
    try {
        await setDoc(doc(db, "users", userId), {
            powerUserExpiresAt: Timestamp.now() // Expire now
        }, { merge: true });
        
        showToast({ message: "Access revoked", type: 'success' });
        closeModal();
        await fetchAllUsers();
        renderTabs();
    } catch (e) {
        console.error(e);
        showToast({ message: "Action failed", type: 'error' });
    }
};

// --- Key Actions ---

window.generateKey = () => {
    return generateKeyCode();
};

window.createKey = async () => {
    const code = document.getElementById('new-key-code').value.trim();
    const duration = parseInt(document.getElementById('new-key-duration').value);

    if (!code || !duration) {
        showToast({ message: "Invalid input", type: 'error' });
        return;
    }

    try {
        await setDoc(doc(db, "PowerUserKeys", code), {
            Status: 'active',
            Time: duration,
            createdAt: serverTimestamp(),
            Notes: 'Created via Admin Panel'
        });
        showToast({ message: "Key created!", type: 'success' });
        await fetchAllKeys();
        renderTabs();
    } catch (e) {
        console.error(e);
        showToast({ message: "Creation failed", type: 'error' });
    }
};

window.copyKey = (text) => {
    navigator.clipboard.writeText(text);
    showToast({ message: "Copied to clipboard", type: 'success' });
};

window.openKeyModal = (keyId) => {
    const key = state.keys.find(k => k.id === keyId);
    if (!key) return;

    const html = `
        <div class="profile-modal-content">
            <h2 class="profile-modal-title">Edit Key</h2>
            <p class="edit-key-subtitle">${keyId}</p>
            
            <div class="form-group">
                <label>Status</label>
                <select id="key-status-select" class="admin-search" style="width:100%">
                    <option value="active" ${key.Status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${key.Status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="paused" ${key.Status === 'paused' ? 'selected' : ''}>Paused</option>
                    <option value="claimed" ${key.Status === 'claimed' ? 'selected' : ''}>Claimed (Do not force unless fixing)</option>
                </select>
            </div>
            <div class="form-group" style="margin-top:1rem">
                <label>Duration</label>
                <input type="number" id="key-duration-edit" class="admin-search" style="width:100%" value="${key.Time}">
            </div>
            <div class="form-group" style="margin-top:1rem">
                <label>Notes</label>
                <textarea id="key-notes-edit" class="admin-search" style="width:100%">${key.Notes || ''}</textarea>
            </div>

            <div style="display:flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="admin-btn" style="flex:1" onclick="window.saveKeyChanges('${keyId}')">Save Changes</button>
            </div>
        </div>
    `;
    openModal(html, 'auth-modal');
};

window.saveKeyChanges = async (keyId) => {
    const status = document.getElementById('key-status-select').value;
    const time = parseInt(document.getElementById('key-duration-edit').value);
    const notes = document.getElementById('key-notes-edit').value;

    try {
        const ref = doc(db, "PowerUserKeys", keyId);
        
        // If pausing/deactivating a claimed key, we should technically revoke user access,
        // but that logic is complex (finding user doc). For this basic admin panel, 
        // we update the key. The existing `manage-keys-page` logic handled this, 
        // so let's keep it simple for the prototype or mirror that logic if critical.
        // Mirroring logic:
        const key = state.keys.find(k => k.id === keyId);
        if ((status === 'inactive' || status === 'paused') && key.claimedBy) {
             await setDoc(doc(db, "users", key.claimedBy), { powerUserExpiresAt: Timestamp.now() }, { merge: true });
        }

        await updateDoc(ref, {
            Status: status,
            Time: time,
            Notes: notes
        });

        showToast({ message: "Key updated", type: 'success' });
        closeModal();
        await fetchAllKeys();
        renderTabs();
    } catch (e) {
        console.error(e);
        showToast({ message: "Update failed", type: 'error' });
    }
};

window.deleteKey = async (keyId) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    try {
        await deleteDoc(doc(db, "PowerUserKeys", keyId));
        showToast({ message: "Key deleted", type: 'success' });
        await fetchAllKeys();
        renderTabs();
    } catch (e) {
        console.error(e);
        showToast({ message: "Delete failed", type: 'error' });
    }
};

// --- Initialization ---

export function renderAdminDashboard(appRoot) {
    const user = getCurrentUserDoc();
    if (!user || user.userType !== 'admin') {
        appRoot.innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <h1>Access Denied</h1>
                <p>Restricted Area.</p>
                <button onclick="window.history.back()" class="admin-btn" style="margin: 1rem auto;">Go Back</button>
            </div>
        `;
        return;
    }

    appRoot.innerHTML = `
        <div class="admin-dashboard">
            <div class="admin-header">
                <div class="admin-title">
                    <h1><i class="fas fa-rocket"></i> Control Panel</h1>
                    <p>Manage users, access keys, and system health.</p>
                </div>
            </div>

            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="dashboard"><i class="fas fa-chart-pie"></i> Dashboard</button>
                <button class="admin-tab" data-tab="users"><i class="fas fa-users"></i> Users</button>
                <button class="admin-tab" data-tab="keys"><i class="fas fa-key"></i> Keys</button>
            </div>

            <div id="admin-content"></div>
        </div>
    `;

    // Tab Switching Logic
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeTab = tab.dataset.tab;
            renderTabs();
        });
    });

    loadData();
}
