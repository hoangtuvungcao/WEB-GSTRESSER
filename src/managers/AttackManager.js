const fs = require('fs');
const path = require('path');
const DataManager = require('./DataManager');
const SSHManager = require('./SSHManager');
const WebhookManager = require('./WebhookManager');

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

class AttackManager {
    static resourceCache = {};

    /**
     * @param {Object} user - User from DB
     * @param {Object} attack - Attack data { id, host, port, method, time, command }
     * @param {Object} methodConf - Method config from methods.json (passed from route)
     * @param {number} vpsCount - Requested server count
     */
    static async startAttack(user, attack, methodConf, vpsCount) {
        const plans = DataManager.read('plans.json');
        const userPlan = plans[user.plan] || plans['Free'];
        const serverCount = vpsCount || userPlan.concurrents || 1;

        const servers = DataManager.read('servers.json');
        const availableServers = servers.filter(s => s.status === 'online' && (s.ongoing || 0) < (s.slots || 10));

        if (availableServers.length < serverCount) {
            try {
                await WebhookManager.notify({
                    title: 'SERVER CAPACITY ALERT',
                    description: `Not enough servers! Need ${serverCount} but only ${availableServers.length} available.`,
                    fields: [
                        { name: 'Required', value: String(serverCount) },
                        { name: 'Available', value: String(availableServers.length) }
                    ],
                    color: 0xFF4500
                });
            } catch (e) { console.error('Failed to send capacity alert:', e.message); }
            throw new Error(`Not enough servers! Need ${serverCount} but only ${availableServers.length} available.`);
        }

        const serverStats = availableServers.map(s => {
            const cache = this.resourceCache[s.id] || { cpu: 10, ram: 10 };
            const ongoingFactor = (s.ongoing || 0) * 10;
            return { ...s, score: (cache.cpu + cache.ram) / 2 + ongoingFactor };
        });
        serverStats.sort((a, b) => a.score - b.score);
        const selectedServers = serverStats.slice(0, serverCount);
        const usedServersInfo = [];

        for (const selectedServer of selectedServers) {
            // FIRE AND LOG: We still run in background for concurrency, 
            // but we ensure the initial connection attempt is noted.
            SSHManager.execute(selectedServer, attack.command, 10000).then(output => {
                const logMsg = `[${new Date().toISOString()}] [Success] Attack ${attack.id} started on ${selectedServer.name}\n`;
                fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), logMsg);
            }).catch(err => {
                const logMsg = `[${new Date().toISOString()}] [CRITICAL] Attack ${attack.id} failed on ${selectedServer.name}: ${err.message}\n`;
                fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), logMsg);

                // Optional: Notify via Webhook if a node fails
                WebhookManager.notify({
                    title: 'NODE EXECUTION FAILURE',
                    description: `Attack ${attack.id} failed to launch on node \`${selectedServer.name}\`.`,
                    fields: [{ name: 'Error', value: err.message }],
                    color: 0xFF0000
                }).catch(() => { });
            });

            const sIndex = servers.findIndex(s => s.id === selectedServer.id);
            if (sIndex !== -1) {
                servers[sIndex].ongoing = (servers[sIndex].ongoing || 0) + 1;
                usedServersInfo.push({ id: selectedServer.id, name: selectedServer.name });
            }
        }

        DataManager.write('servers.json', servers);
        return usedServersInfo;
    }

    static async stopAttack(attackID, serverIds) {
        if (!serverIds) return;
        if (!Array.isArray(serverIds)) serverIds = [serverIds];
        let servers = DataManager.read('servers.json');
        for (const sid of serverIds) {
            const index = servers.findIndex(s => s.id === sid);
            if (index === -1) continue;
            const command = `screen -S ${attackID} -X quit`;
            SSHManager.execute(servers[index], command, 5000).catch(() => { });
            servers[index].ongoing = Math.max(0, (servers[index].ongoing || 0) - 1);
        }
        DataManager.write('servers.json', servers);
    }

    static monitorServers() {
        console.log("[Monitor] Starting server resource monitoring loop...");
        setInterval(async () => {
            const servers = DataManager.read('servers.json');
            if (!servers) return;
            for (const s of servers) {
                if (s.status === 'online') {
                    SSHManager.checkResources(s).then(stats => {
                        this.resourceCache[s.id] = { ...stats, timestamp: Date.now() };
                    }).catch(err => {
                        console.error(`[Monitor] Error checking ${s.name}:`, err.message);
                    });
                }
            }
        }, 500);
    }
}

module.exports = AttackManager;
