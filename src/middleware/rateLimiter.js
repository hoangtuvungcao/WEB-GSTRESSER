const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: true, message: "Too many requests, please try again later." },
    standardHeaders: true, legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: true, message: "Too many authentication attempts, please try again later." },
    standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: true, message: "Too many API requests, please try again later." },
    standardHeaders: true, legacyHeaders: false,
});

module.exports = { limiter, authLimiter, apiLimiter };
