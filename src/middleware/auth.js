const jwt = require('jsonwebtoken');
const { JWT_SECRET, BOT_SECRET } = require('../config');
const AuthManager = require('../managers/AuthManager');

const sendResponse = (res, status, data) => {
    res.status(status).json({ success: status < 400, ...data, timestamp: new Date().toISOString() });
};

const authenticateToken = (req, res, next) => {
    // 1. Check Internal Bot Bypass
    if (req.query.bot_auth && req.query.bot_auth === BOT_SECRET) {
        req.isInternalBot = true;
    }

    // 2. Check API Key
    const apiKey = (req.query.key || '').trim();
    if (apiKey) {
        const DataManager = require('../managers/DataManager');
        const users = DataManager.read('users.json');
        const user = users.find(u => u.apiKey === apiKey);
        if (user) {
            req.user = user;
            req.isApi = true;
            return next();
        }
        if (!req.isInternalBot) return sendResponse(res, 401, { message: 'Invalid API Key' });
    }

    // 3. JWT Auth
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const dbUser = AuthManager.getUser(decoded.username);
            if (dbUser) {
                req.user = dbUser;
                return next();
            }
        } catch (e) { }
    }

    // 4. Final Bot Fallback
    if (req.isInternalBot) {
        // If we reached here, no valid key/token was found.
        // We can't proceed without a user context.
        return sendResponse(res, 401, { message: "Internal Auth Success, but User Context Missing (provide key/token)" });
    }
    return sendResponse(res, 401, { message: "Unauthorized" });
};

module.exports = { authenticateToken, sendResponse };
