const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { exec } = require('child_process');

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

class SSHManager {
    static async execute(server, command, timeout = 30000, silent = false) {
        if (process.env.MOCK_SSH === 'true') {
            if (!silent) {
                const logMsg = `[${new Date().toISOString()}] [MOCK-SSH] ${server.name} (${server.host}): ${command}\n`;
                fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), logMsg);
            }
            return "Mock Output OK";
        }

        if (server.isLocal) {
            return new Promise((resolve, reject) => {
                if (!silent) {
                    const logMsg = `[${new Date().toISOString()}] [LOCAL] Executing on ${server.name}: ${command}\n`;
                    fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), logMsg);
                }
                exec(command, { timeout }, (error, stdout, stderr) => {
                    if (error && !silent) {
                        const failMsg = `[${new Date().toISOString()}] [LOCAL-FAIL] ${server.name}: ${error.message}\n`;
                        fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), failMsg);
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
                        fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), logMsg);
                    }
                    const conn = new Client();
                    const tm = setTimeout(() => { conn.destroy(); reject(new Error("SSH Execution Timeout")); }, timeout + 5000);
                    conn.on('ready', () => {
                        conn.exec(command, (err, stream) => {
                            if (err) { clearTimeout(tm); conn.end(); return reject(err); }
                            let out = '';
                            stream.on('close', () => { clearTimeout(tm); conn.end(); resolve(out); })
                                .on('data', (data) => { out += data; })
                                .on('error', (err) => { clearTimeout(tm); conn.end(); reject(err); });
                        });
                    }).on('error', (err) => { clearTimeout(tm); reject(err); })
                        .connect({
                            host: server.host, port: server.port || 22, username: server.user, password: server.pass,
                            readyTimeout: 10000, keepaliveInterval: 5000, ident: 'OpenSSH_8.2p1 Ubuntu-4ubuntu0.5'
                        });
                });
            } catch (err) {
                lastError = err;
                const failMsg = `[${new Date().toISOString()}] [SSH-RETRY] ${server.name} attempt ${i + 1} failed: ${err.message}\n`;
                fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), failMsg);
                if (i < 2) await new Promise(r => setTimeout(r, 1000));
            }
        }
        throw lastError;
    }

    static async uploadFile(server, localPath, remotePath) {
        if (process.env.MOCK_SSH === 'true') {
            fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), `[MOCK-SFTP] Uploading to ${server.name}: ${localPath} -> ${remotePath}\n`);
            return;
        }
        if (server.isLocal) {
            try { fs.copyFileSync(localPath, remotePath); return; } catch (err) { console.error("Local upload bypass failed:", err.message); }
        }
        return new Promise((resolve, reject) => {
            const conn = new Client();
            const tm = setTimeout(() => { conn.destroy(); reject(new Error("SFTP Connection Timeout (15s)")); }, 15000);
            conn.on('ready', () => {
                conn.sftp((err, sftp) => {
                    if (err) { clearTimeout(tm); conn.end(); return reject(err); }
                    sftp.fastPut(localPath, remotePath, (err) => { clearTimeout(tm); conn.end(); if (err) return reject(err); resolve(); });
                });
            }).on('error', (err) => { clearTimeout(tm); reject(err); })
                .connect({ host: server.host, port: server.port || 22, username: server.user, password: server.pass, readyTimeout: 10000, keepaliveInterval: 5000 });
        });
    }

    static async checkResources(server) {
        if (server.isLocal || process.env.MOCK_SSH === 'true') {
            return { cpu: Math.floor(Math.random() * 30), ram: Math.floor(Math.random() * 40) };
        }
        try {
            const cpuCmd = "read cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat; prev_idle=$idle; prev_total=$(($user+$nice+$system+$idle+$iowait+$irq+$softirq+$steal)); sleep 0.5; read cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat; idle=$idle; total=$(($user+$nice+$system+$idle+$iowait+$irq+$softirq+$steal)); diff_idle=$(($idle-$prev_idle)); diff_total=$(($total-$prev_total)); echo $(($diff_total==0 ? 0 : 100 * ($diff_total - $diff_idle) / $diff_total))";
            const ramCmd = "cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'";
            const [cpuStat, memInfo] = await Promise.all([
                this.execute(server, cpuCmd, 5000, true).catch(() => "0"),
                this.execute(server, ramCmd, 5000, true).catch(() => "")
            ]);
            let cpu = parseInt(cpuStat) || 0;
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
            return { cpu: Math.max(0, Math.min(100, cpu)), ram: Math.max(0, Math.min(100, ram)) };
        } catch (e) {
            fs.appendFileSync(path.join(LOGS_DIR, 'ssh_manager.log'), `[${new Date().toISOString()}] Failed to check resources for ${server.name}: ${e.message}\n`);
            return { cpu: 100, ram: 100 };
        }
    }
}

module.exports = SSHManager;
