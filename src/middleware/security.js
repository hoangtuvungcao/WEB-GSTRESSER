const securityHeaders = (req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; " +
        "script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com 'unsafe-inline'; " +
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    next();
};

module.exports = securityHeaders;
