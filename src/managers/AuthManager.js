const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const DataManager = require('./DataManager');

class AuthManager {
    static hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }

    static generateApiKey() {
        return 'gst-' + uuidv4().replace(/-/g, '').substring(0, 32);
    }

    static migrateKeys() {
        const users = DataManager.read('users.json');
        let changed = false;
        users.forEach(u => {
            if (!u.apiKey) {
                u.apiKey = this.generateApiKey();
                changed = true;
            }
        });
        if (changed) DataManager.write('users.json', users);
    }

    static login(username, password) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        const passSafe = password || "";
        const userPassSafe = user ? (user.password || "") : "";

        let isMatch = false;
        try {
            isMatch = (passSafe === userPassSafe) || (passSafe && userPassSafe && bcrypt.compareSync(passSafe, userPassSafe));
        } catch (e) { }

        if (user && isMatch) {
            const isLifetime = user.expiration === 'Lifetime' || user.expiration === 'Never';
            if (!isLifetime && user.expiration && new Date(user.expiration) < new Date()) {
                return { error: true, message: "Account expired!" };
            }
            return { error: false, user };
        }
        return { error: true, message: "Invalid credentials!" };
    }

    static validate(username, password) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        if (!user || !password) return null;

        const userPassSafe = user.password || "";
        let isMatch = false;
        try {
            isMatch = (password === userPassSafe || bcrypt.compareSync(password, userPassSafe));
        } catch (e) { }

        if (isMatch) {
            const { password: _, ...userSafe } = user;
            return userSafe;
        }
        return null;
    }

    static getUser(username) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        if (!user) return null;
        const { password: _, ...userSafe } = user;
        return userSafe;
    }

    static getUserByTelegramId(telegramId) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.telegramId === telegramId.toString());
        if (!user) return null;
        const { password: _, ...userSafe } = user;
        return userSafe;
    }

    static updateProfile(username, updates) {
        const users = DataManager.read('users.json');
        const userIdx = users.findIndex(u => u.username === username);
        if (userIdx === -1) return { error: true, message: "User not found!" };

        const user = users[userIdx];

        if (updates.newPassword) {
            const curPass = updates.currentPassword || "";
            const userPass = user.password || "";
            let isMatch = false;
            try {
                isMatch = (curPass === userPass) || (curPass && userPass && bcrypt.compareSync(curPass, userPass));
            } catch (e) { }
            if (!isMatch) return { error: true, message: "Current password incorrect!" };
            users[userIdx].password = this.hashPassword(updates.newPassword);
        }

        if (updates.telegramId !== undefined) {
            users[userIdx].telegramId = updates.telegramId.toString();
        }

        DataManager.write('users.json', users);
        return { error: false, message: "Profile updated successfully!" };
    }

    static regenApiKey(username) {
        const users = DataManager.read('users.json');
        const userIdx = users.findIndex(u => u.username === username);
        if (userIdx === -1) return { error: true, message: "User not found!" };

        const newKey = this.generateApiKey();
        users[userIdx].apiKey = newKey;
        DataManager.write('users.json', users);
        return { error: false, apiKey: newKey };
    }

    static register(username, password, telegramId) {
        const users = DataManager.read('users.json');
        if (users.some(u => u.username === username)) {
            return { error: true, message: "Username already exists!" };
        }

        users.push({
            username,
            password: this.hashPassword(password),
            plan: "Free",
            expiration: "Lifetime",
            apiKey: this.generateApiKey(),
            telegramId: telegramId ? telegramId.toString() : ""
        });

        DataManager.write('users.json', users);
        return { error: false, message: "Registration successful!" };
    }
}

module.exports = AuthManager;
