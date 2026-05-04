const express = require('express');
const path = require('path');
const DataManager = require('../managers/DataManager');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Page routes
const pages = {
    '/': 'index.html', '/login': 'login.html', '/register': 'register.html',
    '/profile': 'profile.html', '/admin': 'admin.html', '/dashboard': 'dashboard.html',
    '/download': 'download.html', '/api-center': 'api-center.html', '/methods': 'methods.html'
};
Object.entries(pages).forEach(([route, file]) => {
    router.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
});

// Public API
router.get('/api/public/plans', (req, res) => res.json(DataManager.read('plans.json')));
router.get('/api/public/settings', (req, res) => res.json(DataManager.read('settings.json')));
router.get('/api/methods', (req, res) => res.json(DataManager.read('methods.json')));

module.exports = router;
