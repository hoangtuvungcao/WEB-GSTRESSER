const AttackManager = require('./AttackManager');
const ApiAttackManager = require('./ApiAttackManager');

/**
 * AttackDispatcher — Strategy Pattern entry point.
 * Routes attacks to SSH, API, or Hybrid based on method config.
 */
class AttackDispatcher {
    /**
     * @param {Object} user - User object from DB
     * @param {Object} attackData - { id, host, port, method, time, command, ... }
     * @param {Object} methodConf - Method config from methods.json
     * @param {number} concurrents - Number of concurrent nodes/endpoints
     * @returns {Object} { servers: [], apiResults: [], partial: boolean }
     */
    static async dispatch(user, attackData, methodConf, concurrents) {
        const mode = methodConf.mode || 'ssh'; // backward compatible

        switch (mode) {
            case 'ssh':
                return this.dispatchSSH(user, attackData, methodConf, concurrents);

            case 'api':
                return this.dispatchAPI(attackData, methodConf, concurrents);

            case 'hybrid':
                return this.dispatchHybrid(user, attackData, methodConf, concurrents);

            default:
                throw new Error(`Unknown attack mode: ${mode}`);
        }
    }

    static async dispatchSSH(user, attackData, methodConf, concurrents) {
        const servers = await AttackManager.startAttack(user, attackData, methodConf, concurrents);
        return { servers, apiResults: [], partial: false };
    }

    static async dispatchAPI(attackData, methodConf, concurrents) {
        const apiResult = await ApiAttackManager.dispatch(attackData, methodConf, concurrents);
        if (!apiResult.success) throw new Error('All API endpoints failed');
        return { servers: [], apiResults: apiResult.results, partial: false };
    }

    static async dispatchHybrid(user, attackData, methodConf, concurrents) {
        const [sshResult, apiResult] = await Promise.allSettled([
            AttackManager.startAttack(user, attackData, methodConf, concurrents),
            ApiAttackManager.dispatch(attackData, methodConf, concurrents)
        ]);

        const sshOk = sshResult.status === 'fulfilled';
        const apiOk = apiResult.status === 'fulfilled' && apiResult.value.success;

        if (!sshOk && !apiOk) {
            const sshErr = sshResult.reason?.message || 'SSH failed';
            const apiErr = apiResult.reason?.message || 'API failed';
            throw new Error(`All attack channels failed. SSH: ${sshErr}, API: ${apiErr}`);
        }

        return {
            servers: sshOk ? sshResult.value : [],
            apiResults: apiOk ? apiResult.value.results : [],
            partial: !(sshOk && apiOk)
        };
    }
}

module.exports = AttackDispatcher;
