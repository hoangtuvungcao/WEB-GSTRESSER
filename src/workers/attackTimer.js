const state = require('../state');
const DataManager = require('../managers/DataManager');
const AttackManager = require('../managers/AttackManager');

let intervalId = null;

function start() {
    console.log('[Worker] Attack timer started');
    intervalId = setInterval(() => {
        const s = state.get();
        const expiredAttacks = s.Attacks.filter(a => a.timeLeft <= 0);

        if (expiredAttacks.length > 0) {
            const logs = DataManager.read('logs.json') || [];
            expiredAttacks.forEach(a => {
                // Only kill SSH sessions for attacks that have servers
                if (a.servers && a.servers.length > 0) {
                    AttackManager.stopAttack(a.id, a.servers);
                }
                state.removeAttack(a.id);
                const lIdx = logs.findIndex(l => l.id === a.id);
                if (lIdx !== -1) logs[lIdx].status = 'expired';
            });
            DataManager.write('logs.json', logs);
        }

        s.Attacks.forEach(a => { a.timeLeft--; });
    }, 1000);
}

function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    console.log('[Worker] Attack timer stopped');
}

module.exports = { start, stop };
