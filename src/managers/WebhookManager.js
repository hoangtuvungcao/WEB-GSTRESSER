const axios = require('axios');
const DataManager = require('./DataManager');

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
                        color: data.color || 0x00ff9d,
                        fields: data.fields || [],
                        footer: {
                            text: data.footer || `G-STRESSER HUB • ${new Date().toLocaleString()}`,
                            icon_url: "https://stress.vpsgen.com/assets/img/favicon.png"
                        },
                        thumbnail: { url: "https://stress.vpsgen.com/assets/img/logo.png" },
                        author: { name: "NETWORK COMMAND CENTER", icon_url: "https://stress.vpsgen.com/assets/img/favicon.png" }
                    }]
                };
            } else {
                let text = `<b>${data.title || "G-STRESSER"}</b>\n\n${data.description || ""}\n`;
                if (data.fields) {
                    data.fields.forEach(f => { text += `\n<b>${f.name}:</b> ${f.value}`; });
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

module.exports = WebhookManager;
