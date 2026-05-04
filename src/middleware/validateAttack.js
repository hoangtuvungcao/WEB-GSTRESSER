// Input validation middleware for attack requests
const validateAttack = (req, res, next) => {
    const { host, port, time, method } = req.query;

    if (!host || !port || !method || !time) {
        return res.json({ success: false, message: "Missing parameters!" });
    }

    const portInt = parseInt(port);
    const timeInt = parseInt(time);

    if (isNaN(portInt) || portInt < 1 || portInt > 65535) {
        return res.json({ success: false, message: "Invalid port range! Must be 1-65535." });
    }
    if (isNaN(timeInt) || timeInt < 10) {
        return res.json({ success: false, message: "Minimum attack time is 10s!" });
    }

    // Host format validation
    const hostRegex = /^[a-zA-Z0-9._-]+$/;
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

    // Store validated + parsed values
    req.validated = {
        host: host.trim(),
        port: portInt,
        time: timeInt,
        method: method.trim().toUpperCase()
    };

    next();
};

module.exports = validateAttack;
