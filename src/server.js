const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Initialize config (generates JWT secret if needed)
const { PORT, PUBLIC_DIR, LOGS_DIR } = require('./config');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// Initialize managers
const AuthManager = require('./managers/AuthManager');
const AttackManager = require('./managers/AttackManager');
AuthManager.migrateKeys();

// Initialize state
const state = require('./state');
const DataManager = require('./managers/DataManager');

// Restore running attacks from logs
try {
    const logs = DataManager.read('logs.json') || [];
    const now = Date.now();
    logs.forEach(l => {
        if (l.status === 'running') {
            const startTime = new Date(l.timestamp).getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const remaining = (l.time || 0) - elapsed;
            if (remaining > 0) {
                state.addAttack({ ...l, timeLeft: remaining });
            } else {
                l.status = 'expired';
            }
        }
    });
    DataManager.write('logs.json', logs);
} catch (e) { console.error("Failed to initialize state:", e); }

// Create Express app
const app = express();
app.disable('x-powered-by');

// Middleware
const securityHeaders = require('./middleware/security');
const { limiter } = require('./middleware/rateLimiter');
const { sendResponse } = require('./middleware/auth');

app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static(PUBLIC_DIR));
app.use(securityHeaders);
app.use('/api/', limiter);

// Routes
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const attackRoutes = require('./routes/attack');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

app.use('/', publicRoutes);
app.use('/api', authRoutes);
app.use('/api/attack', attackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Direct route for dashboard — must be /api/attacks/active (not under /api/user)
const { authenticateToken: authToken } = require('./middleware/auth');
const appState = require('./state');
app.get('/api/attacks/active', authToken, (req, res) => {
    const userAttacks = appState.get().Attacks.filter(a => a.user === req.user.username);
    res.json(userAttacks);
});

// Bot user lookup — used by Telegram bot
app.get('/api/bot/user/:telegramId', (req, res) => {
    const DataManager = require('./managers/DataManager');
    const users = DataManager.read('users.json') || [];
    const plans = DataManager.read('plans.json') || {};
    const user = users.find(u => String(u.telegramId) === String(req.params.telegramId));
    if (!user) return res.json({ success: false, message: 'User not found' });
    const userPlan = plans[user.plan] || plans['Free'] || {};
    const currentSessions = appState.getByUser(user.username).length;
    res.json({
        success: true,
        user: {
            username: user.username,
            plan: user.plan,
            slots: user.slots !== undefined && user.slots !== null ? parseInt(user.slots) : (userPlan.slots || 0),
            slotsUsed: currentSessions,
            maxTime: userPlan.maxTime || 60,
            concurrents: user.concurrents !== undefined && user.concurrents !== null ? parseInt(user.concurrents) : (userPlan.concurrents || 1),
            expiration: user.expiration,
            apiKey: user.apiKey,
            telegramId: user.telegramId || ""
        }
    });
});

// 404 Handler
app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
    }
    sendResponse(res, 404, { message: "Endpoint not found" });
});

// Start workers
const attackTimer = require('./workers/attackTimer');
attackTimer.start();
const serverReconciler = require('./workers/serverReconciler');
serverReconciler.start();

// Launch Telegram Bot
try {
    const telegramBot = require('./bot');
    telegramBot.start().catch(err => console.error('[Bot] Startup error:', err.message));
} catch (err) {
    console.error('[Bot] Failed to load bot module:', err.message);
}

// Graceful Shutdown
let isShuttingDown = false;

// Start server monitor
AttackManager.monitorServers();

// --- GLOBAL STABILITY GUARDS ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
    fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack}\n`);
});
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
    fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

// Graceful shutdown
function shutdown() {
    console.log('[Shutdown] Graceful stop...');
    attackTimer.stop();
    serverReconciler.stop();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start listening
app.listen(PORT, () => {
    console.log(`[G-STRESSER] Server running on port ${PORT}`);
});

