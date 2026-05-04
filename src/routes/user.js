const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const DataManager = require('../managers/DataManager');
const AuthManager = require('../managers/AuthManager');
const state = require('../state');

const router = express.Router();

router.post('/profile/update', authenticateToken, (req, res) => {
    const { currentPassword, newPassword, telegramId } = req.body;
    const result = AuthManager.updateProfile(req.user.username, { currentPassword, newPassword, telegramId });
    res.json(result);
});

router.post('/link-telegram', authenticateToken, (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false, message: "Missing Telegram ID" });
    const users = DataManager.read('users.json');
    const idx = users.findIndex(u => u.username === req.user.username);
    if (idx === -1) return res.json({ success: false, message: "User not found" });
    users[idx].telegramId = telegramId.toString();
    DataManager.write('users.json', users);
    res.json({ success: true, message: "Telegram linked!" });
});

router.post('/regen-key', authenticateToken, (req, res) => {
    const result = AuthManager.regenApiKey(req.user.username);
    res.json(result);
});

router.get('/info', authenticateToken, (req, res) => {
    const user = req.user;
    const plans = DataManager.read('plans.json');
    const userPlan = plans[user.plan] || plans['Free'];
    const currentSessions = state.getByUser(user.username).length;
    const maxSlots = user.slots !== undefined && user.slots !== null ? parseInt(user.slots) : userPlan.slots;
    res.json({
        username: user.username,
        plan: user.plan,
        slots: maxSlots,
        slotsUsed: currentSessions,
        maxTime: userPlan.maxTime,
        concurrents: user.concurrents !== undefined && user.concurrents !== null ? parseInt(user.concurrents) : userPlan.concurrents,
        expiration: user.expiration,
        apiKey: user.apiKey,
        telegramId: user.telegramId || ""
    });
});

module.exports = router;
