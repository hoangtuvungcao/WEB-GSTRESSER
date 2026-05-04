const state = require('../state');
const DataManager = require('../managers/DataManager');

let intervalId = null;

function start() {
    console.log('[Worker] Server reconciler started');
    intervalId = setInterval(() => {
        try {
            const servers = DataManager.read('servers.json');
            if (!servers) return;
            const s = state.get();
            const counts = {};
            s.Attacks.forEach(a => {
                if (a.servers) {
                    a.servers.forEach(sid => { counts[sid] = (counts[sid] || 0) + 1; });
                }
            });
            let changed = false;
            servers.forEach(srv => {
                const actual = counts[srv.id] || 0;
                if (srv.ongoing !== actual) { srv.ongoing = actual; changed = true; }
            });
            if (changed) DataManager.write('servers.json', servers);
        } catch (e) { }
    }, 30000);
}

function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    console.log('[Worker] Server reconciler stopped');
}

module.exports = { start, stop };
