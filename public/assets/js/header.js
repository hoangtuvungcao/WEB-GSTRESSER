document.addEventListener('DOMContentLoaded', async () => {
    const headerContainer = document.getElementById('global-header');
    if (!headerContainer) return;

    // Fetch Site Settings - Global Synchronization
    let settings = { siteName: 'G-STRESSER' }; // Fallback
    try {
        const sRes = await fetch('/api/public/settings');
        settings = await sRes.json();
    } catch (e) {
        console.warn("Header: Failed to fetch settings, using fallback branding.");
    }

    // Update Page Elements (Fallback for pages that don't load data)
    if (document.getElementById('siteNameFooter')) document.getElementById('siteNameFooter').innerText = settings.siteName;
    if (document.title.includes('G-STRESS')) document.title = document.title.replace(/G-STRESS[ER]*/g, settings.siteName);

    // Inject Ultra-Premium Responsive Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .header-main-wrapper {
            width: 100%; 
            position: sticky; 
            top: 0; 
            z-index: 1000;
            background: rgba(2, 2, 5, 0.9);
            backdrop-filter: blur(25px);
            border-bottom: 1px solid rgba(0, 255, 157, 0.1);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.8);
        }
        .header-nav-container {
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 12px 5%;
            width: 100%;
        }
        .nav-actions {
            display: flex; 
            gap: 15px; 
            align-items: center;
        }
        .hamburger-menu {
            display: none;
            flex-direction: column;
            gap: 6px;
            cursor: pointer;
            z-index: 2000;
            padding: 10px;
            border-radius: 8px;
            transition: 0.3s;
        }
        .hamburger-menu:hover { background: rgba(0, 255, 157, 0.05); }
        .hamburger-menu span {
            width: 28px;
            height: 2px;
            background: var(--neon-green);
            transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 0 10px var(--neon-green);
        }
        
        .mobile-nav-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background: radial-gradient(circle at center, rgba(15, 15, 25, 0.98), var(--bg-color));
            backdrop-filter: blur(30px);
            z-index: 1500;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 15px;
            opacity: 0;
            visibility: hidden;
            transition: 0.6s ease;
            pointer-events: none;
        }
        .mobile-nav-overlay.active {
            opacity: 1;
            visibility: visible;
            pointer-events: all;
        }
        
        .mobile-nav-item {
            position: relative;
            width: 80%;
            max-width: 300px;
            opacity: 0;
            transform: translateY(30px);
            transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-nav-overlay.active .mobile-nav-item {
            opacity: 1;
            transform: translateY(0);
        }
        
        .mobile-nav-link {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            text-decoration: none;
            transition: 0.4s;
            overflow: hidden;
        }
        .mobile-nav-link::before {
            content: "";
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 157, 0.1), transparent);
            transition: 0.5s;
        }
        .mobile-nav-link:hover::before { left: 100%; }
        
        .mobile-nav-link span.icon {
            font-size: 1.5rem;
            filter: drop-shadow(0 0 5px var(--neon-green));
        }
        .mobile-nav-link span.text {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.1rem;
            color: var(--text-primary);
            letter-spacing: 3px;
        }
        .mobile-nav-link:hover {
            border-color: var(--neon-green);
            background: rgba(0, 255, 157, 0.05);
            transform: scale(1.05);
            box-shadow: 0 0 30px rgba(0, 255, 157, 0.1);
        }
        
        .hud-bracket {
            position: absolute;
            width: 20px;
            height: 20px;
            border: 2px solid var(--neon-green);
            opacity: 0.3;
        }
        .br-tl { top: 40px; left: 40px; border-right: 0; border-bottom: 0; }
        .br-tr { top: 40px; right: 40px; border-left: 0; border-bottom: 0; }
        .br-bl { bottom: 40px; left: 40px; border-right: 0; border-top: 0; }
        .br-br { bottom: 40px; right: 40px; border-left: 0; border-top: 0; }

        .hamburger-menu.active span:nth-child(1) { transform: rotate(45deg) translate(8px, 8px); }
        .hamburger-menu.active span:nth-child(2) { opacity: 0; transform: scale(0); }
        .hamburger-menu.active span:nth-child(3) { transform: rotate(-45deg) translate(8px, -8px); }

        @media (max-width: 900px) {
            .nav-actions { display: none; }
            .hamburger-menu { display: flex; }
        }

        /* FORCE GLITCH - Hardware Accelerated for Mobile */
        .glitch {
            position: relative;
            display: inline-block;
            color: var(--neon-green);
        }
        .glitch::before, .glitch::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            opacity: 0.8;
            visibility: visible !important;
            z-index: -1;
        }
        .glitch::before {
            color: var(--neon-pink);
            animation: force-glitch-1 0.4s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .glitch::after {
            color: var(--neon-blue);
            animation: force-glitch-2 0.4s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
        }
        @keyframes force-glitch-1 {
            0% { transform: translate(0); }
            20% { transform: translate(-3px, 3px); }
            40% { transform: translate(-3px, -3px); }
            60% { transform: translate(3px, 3px); }
            80% { transform: translate(3px, -3px); }
            100% { transform: translate(0); }
        }
        @keyframes force-glitch-2 {
            0% { transform: translate(0); }
            20% { transform: translate(3px, -3px); }
            40% { transform: translate(3px, 3px); }
            60% { transform: translate(-3px, -3px); }
            80% { transform: translate(-3px, 3px); }
            100% { transform: translate(0); }
        }
    `;
    document.head.appendChild(style);

    const token = localStorage.getItem('token');
    const isDashboard = window.location.pathname.includes('dashboard.html') || window.location.pathname === '/dashboard';

    // Header Element
    const header = document.createElement('header');
    header.className = 'header-main-wrapper';

    // Inner Container
    const container = document.createElement('div');
    container.className = 'header-nav-container';

    // Logo Section
    const logoLink = document.createElement('a');
    logoLink.href = '/';
    logoLink.style.cssText = 'text-decoration: none; display: flex; align-items: center; gap: 15px;';
    logoLink.innerHTML = `
        <img src="assets/img/logo.png" style="height: 35px; filter: drop-shadow(0 0 8px rgba(0, 255, 157, 0.3));">
        <span class="logo-text" style="font-family: 'Orbitron', sans-serif; font-size: 1.3rem; color: var(--neon-green); letter-spacing: 2px; text-shadow: 0 0 10px rgba(0, 255, 157, 0.3);">${settings.siteName}</span>
    `;

    // Mobile Overlay
    const mobileOverlay = document.createElement('div');
    mobileOverlay.className = 'mobile-nav-overlay';
    mobileOverlay.innerHTML = `
        <div class="hud-bracket br-tl"></div>
        <div class="hud-bracket br-tr"></div>
        <div class="hud-bracket br-bl"></div>
        <div class="hud-bracket br-br"></div>
        <p style="position: absolute; top: 100px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--neon-green); opacity: 0.5; letter-spacing: 5px;">${settings.siteName}_HUD_V2.5</p>
    `;

    // Hamburger
    const hamburger = document.createElement('div');
    hamburger.className = 'hamburger-menu';
    hamburger.innerHTML = '<span></span><span></span><span></span>';

    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        document.body.style.overflow = mobileOverlay.classList.contains('active') ? 'hidden' : '';
    };

    hamburger.onclick = toggleMenu;

    // Links Config
    const links = [
        { text: 'HOME', action: () => location.href = '/' },
        { text: 'MOBILE APP', action: () => location.href = '/download' },
        { text: 'METHODS', action: () => location.href = '/methods' }
    ];

    if (token) {
        links.push({ text: 'DASHBOARD', action: () => location.href = '/dashboard' });
        if (isDashboard) {
            links.push({
                text: 'LOGOUT', action: () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    location.href = '/login';
                }
            });
        }
    } else {
        links.push({ text: 'LOGIN', action: () => location.href = '/login' });
        links.push({ text: 'REGISTER', action: () => location.href = '/register' });
    }

    // Populate Desktop
    const navActions = document.createElement('div');
    navActions.className = 'nav-actions';
    links.forEach(l => {
        const btn = document.createElement('button');
        btn.className = (l.text === 'DASHBOARD' || l.text === 'LOGIN') ? 'btn-nav-top primary' : 'btn-nav-top';
        btn.innerText = l.text;
        btn.onclick = l.action;
        navActions.appendChild(btn);
    });

    // Populate Mobile
    links.forEach((l, index) => {
        const item = document.createElement('div');
        item.className = 'mobile-nav-item';
        item.style.transitionDelay = `${index * 0.1}s`;

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'mobile-nav-link';
        link.innerHTML = `
            <span class="text">${l.text}</span>
        `;
        link.onclick = (e) => {
            e.preventDefault();
            l.action();
            toggleMenu();
        };

        item.appendChild(link);
        mobileOverlay.appendChild(item);
    });

    container.appendChild(logoLink);
    container.appendChild(navActions);
    container.appendChild(hamburger);
    header.appendChild(container);

    headerContainer.innerHTML = '';
    headerContainer.appendChild(header);
    document.body.appendChild(mobileOverlay);

    // AUTO-GLITCH SYSTEM: Make all titles "magical" automatically
    const applyGlitch = () => {
        const headers = document.querySelectorAll('h1, h2, .card h3, .logo-text, .pricing-header h2');
        headers.forEach(h => {
            if (!h.classList.contains('no-glitch')) {
                h.classList.add('glitch');
                // Force data-text synchronization
                const text = h.innerText.trim();
                if (text && h.getAttribute('data-text') !== text) {
                    h.setAttribute('data-text', text);
                }
            }
        });
    };

    // Multi-pass execution to catch dynamic content
    applyGlitch();
    setTimeout(applyGlitch, 500);
    setTimeout(applyGlitch, 2000);

    // Global HUD Notification System
    window.showStatus = function (msg, type = 'info') {
        let container = document.getElementById('notify-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notify-container';
            document.body.appendChild(container);
        }
        const div = document.createElement('div');
        div.className = `notif ${type}`;
        div.innerHTML = `<span>${msg}</span><span style="cursor:pointer;margin-left:15px;opacity:0.5;font-weight:bold" onclick="this.parentElement.remove()">×</span>`;
        container.appendChild(div);

        // Auto-remove
        setTimeout(() => {
            if (div.parentElement) {
                div.style.opacity = '0';
                div.style.transform = 'translateX(50px)';
                div.style.transition = '0.4s';
                setTimeout(() => div.remove(), 400);
            }
        }, 5000);
    };
});
