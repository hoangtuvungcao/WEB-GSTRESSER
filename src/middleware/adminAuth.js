const { authenticateToken, sendResponse } = require('./auth');

const adminAuth = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user && req.user.plan === 'Admin') {
            next();
        } else {
            res.status(403).json({ error: true, message: "Admin access required" });
        }
    });
};

module.exports = adminAuth;
