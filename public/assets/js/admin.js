let globalPlans = {};

async function loadData() {
    const token = localStorage.getItem('token');
    const authHeaders = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

    try {
        // Load Users
        const userRes = await fetch('/api/admin/users', { headers: authHeaders });
        const users = await userRes.json();
        if (userRes.status === 401 || userRes.status === 403 || users.error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return location.href = '/login';
        }
        if (!Array.isArray(users)) {
            console.warn("API returned non-array (possibly rate limited)", users);
            return;
        }
        const userBody = document.querySelector('#userTable tbody');
        userBody.innerHTML = '';
        users.forEach(u => {
            const planClass = 'plan-' + u.plan.toLowerCase().replace(' ', '-');
            userBody.innerHTML += `
                <tr>
                    <td data-label="User">${u.username}</td>
                    <td data-label="Plan"><span class="${planClass}">${u.plan}</span></td>
                    <td data-label="Slots"><span class="${u.slotsUsed >= u.slots ? 'offline' : 'online'}">${u.slotsUsed || 0}/${u.slots}</span></td>
                    <td data-label="ConC">${u.concurrents}</td>
                    <td data-label="Exp">${u.expiration}</td>
                    <td data-label="Action">
                        <button onclick="openUserModal('edit', '${u.username}', '${u.plan}', '${u.expiration}', ${u.slots}, ${u.concurrents})" class="btn-small">Edit</button>
                        <button onclick="deleteUser('${u.username}')" class="btn-small" style="color:#ff5f56; border-color:#ff5f56">Del</button>
                    </td>
                </tr>
            `;
        });

        // Load Servers
        const serverRes = await fetch('/api/admin/servers', { headers: authHeaders });
        const servers = await serverRes.json();
        const serverBody = document.querySelector('#serverTable tbody');
        serverBody.innerHTML = '';
        servers.forEach(s => {
            const cpu = Number(s.cpu) || 0;
            const ram = Number(s.ram) || 0;

            const getColor = (val) => {
                if (val >= 80) return 'var(--neon-red)';
                if (val >= 40) return 'var(--neon-purple)';
                return 'var(--neon-green)';
            };

            const cpuColor = getColor(cpu);
            const ramColor = getColor(ram);

            serverBody.innerHTML += `
                <tr>
                    <td data-label="Server" style="font-weight:bold">${s.name}</td>
                    <td data-label="Host" style="opacity:0.7; font-size:0.8rem">${s.host}</td>
                    <td data-label="Slots"><span style="color:var(--neon-purple)">${s.ongoing || 0}</span> / ${s.slots || 5}</td>
                    <td data-label="CPU">
                        <div style="width:100%; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; margin-bottom:5px;">
                            <div style="width:${cpu}%; height:100%; background:${cpuColor}; box-shadow: 0 0 5px ${cpuColor};"></div>
                        </div>
                        <span style="font-size:0.7rem; color:${cpuColor}">${cpu}%</span>
                    </td>
                    <td data-label="RAM">
                        <div style="width:100%; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; margin-bottom:5px;">
                            <div style="width:${ram}%; height:100%; background:${ramColor}; box-shadow: 0 0 5px ${ramColor};"></div>
                        </div>
                        <span style="font-size:0.7rem; color:${ramColor}">${ram}%</span>
                    </td>
                    <td data-label="Status">
                        <span class="status-badge ${s.status === 'online' ? 'status-online' : 'status-offline'}">
                            ${s.status.toUpperCase()}
                        </span>
                    </td>
                    <td data-label="Action">
                        <button onclick="toggleServer('${s.id}')" class="btn-small">${s.status === 'online' ? 'OFF' : 'ON'}</button>
                    </td>
                </tr>
            `;
        });

        // Load Methods
        const methodRes = await fetch('/api/methods', { headers: authHeaders });
        const methods = await methodRes.json();
        const methodBody = document.querySelector('#methodTable tbody');
        methodBody.innerHTML = '';
        for (let group in methods) {
            for (let m in methods[group]) {
                const conf = methods[group][m];
                methodBody.innerHTML += `
                    <tr>
                        <td data-label="Method">${m}</td>
                        <td data-label="Type" style="font-size:0.7rem; color:#888">${group.toUpperCase()}</td>
                        <td data-label="Status"><span class="${conf.status || 'online'}">${(conf.status || 'online').toUpperCase()}</span></td>
                        <td data-label="Action">
                            <button onclick="toggleMethod('${m}')" class="btn-small">${(conf.status || 'online') === 'online' ? 'OFF' : 'ON'}</button>
                        </td>
                    </tr>
                `;
            }
        }

        // Load Logs
        const logRes = await fetch('/api/admin/logs', { headers: authHeaders });
        const logs = (await logRes.json()).reverse().slice(0, 50);
        const logBody = document.querySelector('#logTable tbody');
        logBody.innerHTML = '';
        logs.forEach(l => {
            logBody.innerHTML += `
                <tr>
                    <td data-label="User">${l.user}</td>
                    <td data-label="Target" style="font-size:0.75rem">${l.host}</td>
                    <td data-label="Method">${l.method}</td>
                    <td data-label="Time">${l.time}s</td>
                    <td data-label="Status"><span class="online">Success</span></td>
                    <td data-label="Timestamp" style="font-size:0.7rem; color:#666">${new Date(l.timestamp).toLocaleString()}</td>
                </tr>
            `;
        });

        // Load Plans for auto-fill logic
        const planRes = await fetch('/api/public/plans');
        globalPlans = await planRes.json();

        // Dynamically populate the Plan dropdown (only if empty to avoid reset during edit)
        const planSelect = document.getElementById('inPlan');
        if (planSelect && planSelect.options.length === 0) {
            planSelect.innerHTML = '';
            for (let planName in globalPlans) {
                const opt = document.createElement('option');
                opt.value = planName;
                opt.innerText = `Plan: ${planName}`;
                planSelect.appendChild(opt);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

// Add event listener for plan change (if needed for other real-time logic)
document.getElementById('inPlan').addEventListener('change', function () {
    const selectedPlan = this.value;
    const modalAction = document.getElementById('modalAction').value;

    // Auto-fill slots and concurrents based on plan defaults
    if (globalPlans[selectedPlan]) {
        document.getElementById('inSlots').value = globalPlans[selectedPlan].slots || 1;
        document.getElementById('inConc').value = globalPlans[selectedPlan].concurrents || 1;
    }
});

function openUserModal(action, username = '', plan = 'Free', exp = '', slots = null, concurrents = null) {
    document.getElementById('modalAction').value = action;
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('userFields').style.display = 'block';

    if (action === 'edit') {
        document.getElementById('modalTitle').innerText = 'Edit User: ' + username;
        document.getElementById('editUsername').value = username;
        document.getElementById('inUser').value = username;
        document.getElementById('inUser').disabled = true;
        document.getElementById('inPass').placeholder = '(Leave blank to keep current)';
        document.getElementById('inPlan').value = plan;
        document.getElementById('inExp').value = exp;

        // Show current values (already resolved from plan in loadData if not overridden)
        document.getElementById('inSlots').value = slots;
        document.getElementById('inConc').value = concurrents;
    } else if (action === 'add') {
        document.getElementById('modalTitle').innerText = 'Add New User';
        document.getElementById('inUser').value = '';
        document.getElementById('inUser').disabled = false;
        document.getElementById('inPass').value = '';
        document.getElementById('inPass').placeholder = 'Password';

        // Default to first available plan or Free
        const defaultPlan = plan || 'Free';
        document.getElementById('inPlan').value = defaultPlan;

        // Load default plan limits
        const limits = globalPlans[defaultPlan] || { slots: 1, concurrents: 1 };
        document.getElementById('inSlots').value = limits.slots || 1;
        document.getElementById('inConc').value = limits.concurrents || 1;

        // Auto-set expiration to +1 month from now
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const yyyy = nextMonth.getFullYear();
        const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
        const dd = String(nextMonth.getDate()).padStart(2, '0');
        document.getElementById('inExp').value = `${yyyy}-${mm}-${dd}`;
    }
}

function closeModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function submitModal() {
    try {
        const action = document.getElementById('modalAction').value;
        const token = localStorage.getItem('token');
        const authHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

        if (action === 'add' || action === 'edit') {
            const username = action === 'add' ? document.getElementById('inUser').value : document.getElementById('editUsername').value;
            const password = document.getElementById('inPass').value;
            const plan = document.getElementById('inPlan').value;
            const slots = parseInt(document.getElementById('inSlots').value) || 0;
            const concurrents = parseInt(document.getElementById('inConc').value) || 0;
            const expiration = document.getElementById('inExp').value;

            if (!username) throw new Error("Username is required");

            const endpoint = action === 'add' ? '/api/admin/users/add' : '/api/admin/users/update';
            const body = action === 'add'
                ? { username, password, plan, slots, concurrents, expiration }
                : { username, updates: { plan, slots, concurrents, expiration } };

            if (action === 'edit' && password) body.updates.password = password;

            console.log(`Submitting ${action} for ${username}:`, body);

            const res = await fetch(endpoint, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
            const data = await res.json();

            if (data.success) {
                if (typeof showStatus === 'function') {
                    showStatus("Operation successful!", "success");
                } else {
                    alert("Operation successful!");
                }
                closeModal();
                loadData();
            } else {
                throw new Error(data.message || "Unknown error occurred");
            }
        }
    } catch (e) {
        console.error("submitModal Error:", e);
        if (typeof showStatus === 'function') {
            showStatus("Error: " + e.message, "error");
        } else {
            alert("Error: " + e.message);
        }
    }
}

// Global showStatus from header.js is used

async function toggleServer(id) {
    const token = localStorage.getItem('token');
    await fetch('/api/admin/servers/toggle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ id })
    });
    loadData();
}

let pendingDeleteUser = null;

async function deleteUser(username) {
    pendingDeleteUser = username;
    document.getElementById('confirmMsg').innerText = `Bạn có chắc chắn muốn xóa vĩnh viễn user: ${username}?`;
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

async function submitDelete() {
    if (!pendingDeleteUser) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/admin/users/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ username: pendingDeleteUser })
        });
        const data = await res.json();
        if (data.success) {
            showStatus(`User ${pendingDeleteUser} deleted`, 'success');
            loadData();
        } else {
            showStatus('Delete failed: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (e) {
        showStatus('Connection error', 'error');
    }
    closeConfirmModal();
}

function addUser() { openUserModal('add'); }

async function toggleMethod(name) {
    const token = localStorage.getItem('token');
    const button = event.target;
    const row = button.closest('tr');
    const statusSpan = row.querySelector('td[data-label="Status"] span');

    // Optimistic UI Update
    const isOnline = statusSpan.innerText.trim() === 'ONLINE';
    const nextStatus = isOnline ? 'OFFLINE' : 'ONLINE';

    statusSpan.innerText = nextStatus;
    statusSpan.className = isOnline ? 'offline' : 'online';
    button.innerText = isOnline ? 'ON' : 'OFF';

    try {
        const res = await fetch('/api/admin/methods/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
    } catch (e) {
        showStatus('Error: ' + e.message, 'error');
        // Revert UI on failure
        statusSpan.innerText = isOnline ? 'ONLINE' : 'OFFLINE';
        statusSpan.className = isOnline ? 'online' : 'offline';
        button.innerText = isOnline ? 'OFF' : 'ON';
    }
}

async function toggleServer(id) {
    const token = localStorage.getItem('token');
    const button = event.target;
    const row = button.closest('tr');
    const statusBadge = row.querySelector('.status-badge');

    // Optimistic UI Update
    const isOnline = statusBadge.innerText.trim() === 'ONLINE';
    const nextStatus = isOnline ? 'OFFLINE' : 'ONLINE';

    statusBadge.innerText = nextStatus;
    statusBadge.className = `status-badge ${isOnline ? 'status-offline' : 'status-online'}`;
    button.innerText = isOnline ? 'ON' : 'OFF';

    try {
        const res = await fetch('/api/admin/servers/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (!data.success) throw new Error();
    } catch (e) {
        showStatus('Failed to toggle server status', 'error');
        // Revert UI on failure
        statusBadge.innerText = isOnline ? 'ONLINE' : 'OFFLINE';
        statusBadge.className = `status-badge ${isOnline ? 'status-online' : 'status-offline'}`;
        button.innerText = isOnline ? 'OFF' : 'ON';
    }
}

// Load initial data and set up efficient refresh mechanism
loadData();
// Refresh data every 5 seconds instead of every second to reduce API load
// Use requestAnimationFrame for smoother UI updates when visible
let refreshInterval = setInterval(loadData, 5000);

// Pause refresh when tab is hidden to save resources
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(refreshInterval);
    } else {
        refreshInterval = setInterval(loadData, 5000);
        // Immediately refresh when returning to tab
        loadData();
    }
});

// Redundant definition removed

async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs? (This cannot be undone)')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/admin/logs/clear', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
            showStatus(data.message, 'success');
            loadData();
        } else {
            showStatus(data.message, 'error');
        }
    } catch (e) {
        showStatus('Server connection error', 'error');
    }
}

document.getElementById('proxyFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('proxyFile', file);

    const token = localStorage.getItem('token');
    const statusDiv = document.getElementById('proxyUploadStatus');
    const progressText = document.getElementById('proxyProgressText');
    const progressBar = document.getElementById('proxyProgressBar');
    const resultList = document.getElementById('proxyServerResults');

    statusDiv.style.display = 'block';
    resultList.innerHTML = '';
    progressBar.style.width = '20%';
    progressText.innerText = 'Uploading and processing...';

    try {
        const res = await fetch('/api/admin/proxy/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            progressBar.style.width = '100%';
            progressText.innerText = data.message;
            data.results.forEach(r => {
                const li = document.createElement('li');
                li.style.color = r.status === 'success' ? 'var(--neon-green)' : '#ff5f56';
                li.innerText = `${r.server}: ${r.status.toUpperCase()}${r.error ? ' (' + r.error + ')' : ''}`;
                resultList.appendChild(li);
            });
            showStatus('Proxy synchronization complete!', 'success');
        } else {
            showStatus('Error: ' + data.message, 'error');
            progressText.innerText = 'Failed.';
        }
    } catch (err) {
        showStatus('Connection error', 'error');
        progressText.innerText = 'System error.';
    }
});
