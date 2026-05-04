const crypto = require('crypto');
const path = require('path');
const DataManager = require('./managers/DataManager');

const settings = DataManager.read('settings.json') || {};

// Generate persistent secrets if not configured
if (!settings.jwtSecret) {
    settings.jwtSecret = crypto.randomBytes(64).toString('hex');
    DataManager.write('settings.json', settings);
}
if (!settings.botSecret) {
    settings.botSecret = crypto.randomBytes(32).toString('hex');
    DataManager.write('settings.json', settings);
}

process.env.INTERNAL_BOT_SECRET = settings.botSecret;

module.exports = {
    PORT: process.env.PORT || 8880,
    JWT_SECRET: settings.jwtSecret,
    BOT_SECRET: settings.botSecret,
    DB_DIR: path.join(__dirname, '..', 'database'),
    LOGS_DIR: path.join(__dirname, '..', 'logs'),
    PUBLIC_DIR: path.join(__dirname, '..', 'public'),
    settings
};
