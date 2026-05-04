// Endpoint health tracking with dead-endpoint cooldown
class EndpointHealth {
    static cache = {}; // { url: { fails: 0, deadUntil: timestamp } }
    static DEAD_DURATION = 30000; // 30s cooldown after 3 fails
    static MAX_FAILS = 3;

    static isDead(url) {
        const entry = this.cache[url];
        if (!entry) return false;
        if (entry.deadUntil > Date.now()) return true;
        // Cooldown expired — reset
        delete this.cache[url];
        return false;
    }

    static markFail(url) {
        if (!this.cache[url]) this.cache[url] = { fails: 0, deadUntil: 0 };
        this.cache[url].fails++;
        if (this.cache[url].fails >= this.MAX_FAILS) {
            this.cache[url].deadUntil = Date.now() + this.DEAD_DURATION;
        }
    }

    static markAlive(url) {
        delete this.cache[url];
    }

    static getStatus() {
        const result = {};
        for (const [url, entry] of Object.entries(this.cache)) {
            result[url] = {
                fails: entry.fails,
                dead: entry.deadUntil > Date.now(),
                recoversIn: Math.max(0, Math.ceil((entry.deadUntil - Date.now()) / 1000))
            };
        }
        return result;
    }
}

module.exports = EndpointHealth;
