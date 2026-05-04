// Thin state coordinator — data only, no side effects
const state = {
    Ongoing: 0,
    Attacks: []
};

module.exports = {
    get: () => state,
    addAttack(data) {
        state.Attacks.push(data);
        state.Ongoing++;
    },
    removeAttack(id) {
        state.Attacks = state.Attacks.filter(a => a.id !== id);
        state.Ongoing = Math.max(0, state.Ongoing - 1);
    },
    getByUser(username) {
        return state.Attacks.filter(a => a.user === username);
    },
    getByMethod(methodName) {
        return state.Attacks.filter(a => a.method === methodName);
    }
};

// Expose to global for bot.js compatibility
global.appState = state;
