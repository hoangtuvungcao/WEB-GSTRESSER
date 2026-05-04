const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '..', 'database');

class DataManager {
    static read(filename) {
        try {
            const data = fs.readFileSync(path.join(DB_DIR, filename), 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }

    static write(filename, data) {
        try {
            fs.writeFileSync(path.join(DB_DIR, filename), JSON.stringify(data || [], null, 4));
        } catch (e) {
            console.error(`Failed to write database/${filename}:`, e.message);
        }
    }
}

module.exports = DataManager;
