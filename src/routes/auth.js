const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { authLimiter } = require('../middleware/rateLimiter');
const { sendResponse } = require('../middleware/auth');
const AuthManager = require('../managers/AuthManager');

const router = express.Router();

router.post('/register', authLimiter, (req, res) => {
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

router.post('/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    const result = AuthManager.login(username, password);
    if (!result.error) {
        const token = jwt.sign({ username: result.user.username }, JWT_SECRET, { expiresIn: '24h' });
        sendResponse(res, 200, { token, isAdmin: result.user.plan === 'Admin', plan: result.user.plan });
    } else {
        sendResponse(res, 401, { message: result.message });
    }
});

module.exports = router;
