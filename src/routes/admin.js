const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const DataManager = require('../managers/DataManager');
const AuthManager = require('../managers/AuthManager');
const SSHManager = require('../managers/SSHManager');
const AttackManager = require('../managers/AttackManager');
const EndpointHealth = require('../managers/EndpointHealth');
const WebhookManager = require('../managers/WebhookManager');

const router = express.Router();

// --- Users ---
router.get('/users', adminAuth, (req, res) => {
    const users = DataManager.read('users.json');
    const plans = DataManager.read('plans.json');
    const usersWithStats = users.map(u => {
        const userPlan = plans[u.plan] || plans['Free'];
        return {
            username: u.username, plan: u.plan, expiration: u.expiration,
            slots: u.slots !== undefined && u.slots !== null ? u.slots : (userPlan.slots || 0),
            concurrents: u.concurrents !== undefined && u.concurrents !== null ? u.concurrents : (userPlan.concurrents || 0)
        };
    });
    res.json(usersWithStats);
});

router.post('/users/add', adminAuth, (req, res) => {
    const { username, password, plan, slots, concurrents, expiration } = req.body;
    const users = DataManager.read('users.json');
    const existing = users.findIndex(u => u.username === username);
    const s = slots ? parseInt(slots) : undefined;
    const c = concurrents ? parseInt(concurrents) : undefined;
    if (existing !== -1) {
        users[existing].plan = plan;
        if (s !== undefined) users[existing].slots = s;
        if (c !== undefined) users[existing].concurrents = c;
        users[existing].expiration = expiration;
        if (password) users[existing].password = AuthManager.hashPassword(password);
    } else {
        const p = password ? AuthManager.hashPassword(password) : "";
        users.push({ username, password: p, plan, slots: s, concurrents: c, expiration, apiKey: AuthManager.generateApiKey() });
    }
    DataManager.write('users.json', users);
    res.json({ success: true });
});

router.post('/users/update', adminAuth, (req, res) => {
    const { username, updates } = req.body;
    if (!username || !updates) return res.json({ success: false, message: "Missing data" });
    const users = DataManager.read('users.json');
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.json({ success: false, message: "User not found" });
    if (updates.plan) users[idx].plan = updates.plan;
    if (updates.slots !== undefined) users[idx].slots = parseInt(updates.slots);
    if (updates.concurrents !== undefined) users[idx].concurrents = parseInt(updates.concurrents);
    if (updates.expiration) users[idx].expiration = updates.expiration;
    if (updates.password) users[idx].password = AuthManager.hashPassword(updates.password);
    DataManager.write('users.json', users);
    res.json({ success: true });
});

router.post('/users/delete', adminAuth, (req, res) => {
    const { username } = req.body;
    let users = DataManager.read('users.json');
    users = users.filter(u => u.username !== username);
    DataManager.write('users.json', users);
    res.json({ success: true });
});

// --- Servers ---
router.get('/servers', adminAuth, (req, res) => {
    const servers = DataManager.read('servers.json');
    const enriched = servers.map(s => {
        const cache = AttackManager.resourceCache[s.id] || { cpu: 0, ram: 0 };
        return { ...s, ...cache };
    });
    res.json(enriched);
});

router.get('/servers/check', adminAuth, async (req, res) => {
    const servers = DataManager.read('servers.json');
    const results = await Promise.all(servers.map(async s => {
        try {
            const out = await SSHManager.execute(s, 'echo OK', 5000, true);
            return { name: s.name, status: out.includes('OK') ? 'online' : 'offline' };
        } catch (e) { return { name: s.name, status: 'offline', error: e.message }; }
    }));
    res.json(results);
});

router.post('/servers/toggle', adminAuth, (req, res) => {
    const { id } = req.body;
    const servers = DataManager.read('servers.json');
    const idx = servers.findIndex(s => s.id === id);
    if (idx !== -1) {
        servers[idx].status = servers[idx].status === 'online' ? 'offline' : 'online';
        DataManager.write('servers.json', servers);
        WebhookManager.notify({
            title: "SERVER STATUS CHANGED",
            description: `Server **${servers[idx].name}** is now \`${servers[idx].status}\``,
            color: servers[idx].status === 'online' ? 0x00ff9d : 0xff4500,
            fields: [{ name: "Admin", value: `\`${req.user.username}\`` }]
        });
        res.json({ success: true });
    } else { res.json({ success: false }); }
});

// --- Methods ---
router.post('/methods/toggle', adminAuth, (req, res) => {
    const { name } = req.body;
    const methods = DataManager.read('methods.json');
    for (let group in methods) {
        if (methods[group][name]) {
            methods[group][name].status = methods[group][name].status === 'online' ? 'offline' : 'online';
            DataManager.write('methods.json', methods);
            return res.json({ success: true, newStatus: methods[group][name].status });
        }
    }
    res.json({ success: false });
});

// --- Methods API Endpoints Management ---
router.post('/methods/update-api', adminAuth, (req, res) => {
    const { name, mode, apiEndpoints } = req.body;
    if (!name) return res.json({ success: false, message: "Method name required" });
    const methods = DataManager.read('methods.json');
    for (let group in methods) {
        if (methods[group][name]) {
            if (mode) methods[group][name].mode = mode;
            if (apiEndpoints) methods[group][name].apiEndpoints = apiEndpoints;
            DataManager.write('methods.json', methods);
            return res.json({ success: true });
        }
    }
    res.json({ success: false, message: "Method not found" });
});

// --- Logs ---
router.get('/logs', adminAuth, (req, res) => { res.json(DataManager.read('logs.json')); });
router.post('/logs/clear', adminAuth, (req, res) => { DataManager.write('logs.json', []); res.json({ success: true }); });
router.get('/activity-logs', adminAuth, (req, res) => { res.json(DataManager.read('activity_logs.json')); });
router.post('/activity-logs/clear', adminAuth, (req, res) => { DataManager.write('activity_logs.json', []); res.json({ success: true }); });

// --- Endpoint Health ---
router.get('/endpoint-health', adminAuth, (req, res) => { res.json(EndpointHealth.getStatus()); });

// --- Proxy Upload ---
router.post('/proxy/upload', adminAuth, async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: true, message: 'No files uploaded.' });
    }
    const proxyFile = req.files.proxyFile || req.files[Object.keys(req.files)[0]];
    const path = require('path');
    const localPath = path.join(__dirname, '..', '..', 'database', 'proxy.txt');
    try {
        proxyFile.mv(localPath, async (err) => {
            if (err) return res.status(500).json({ error: true, message: err.message });
            const servers = DataManager.read('servers.json');
            const onlineServers = servers.filter(s => s.status === 'online');
            const results = await Promise.allSettled(onlineServers.map(s =>
                SSHManager.uploadFile(s, localPath, '/root/proxy.txt').then(() => ({ server: s.name, status: 'success' })).catch(e => ({ server: s.name, status: 'failed', error: e.message }))
            ));
            res.json({ success: true, message: `Proxy distributed to ${results.filter(r => r.status === 'fulfilled').length}/${onlineServers.length} servers.`, results: results.map(r => r.value || r.reason) });
        });
    } catch (err) { res.status(500).json({ error: true, message: err.message }); }
});

module.exports = router;
