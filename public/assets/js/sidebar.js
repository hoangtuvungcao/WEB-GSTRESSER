document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;
    if (userStr) {
        try {
            // Try to parse if it's a JSON object
            user = JSON.parse(userStr);
            // If it's just a string, wrap it into a basic object for compatibility
            if (typeof user === 'string') {
                user = { username: user, plan: 'Free' };
            }
        } catch (e) {
            // Fallback for raw strings that fail JSON.parse
            user = { username: userStr, plan: 'Free' };
        }
    }
    const path = window.location.pathname;

    // Sidebar Template
    const sidebarHTML = `
        <aside class="sidebar">
            <a href="/" class="sidebar-logo flicker-heavy">
                <img src="assets/img/logo.png" alt="Logo">
                <span class="glitch-hover">G-STRESSER</span>
            </a>
            <nav class="nav-menu">
                <div class="nav-item">
                    <a href="/dashboard" class="nav-link ${path === '/dashboard' ? 'active' : ''} glitch-hover">
                        Dashboard
                    </a>
                </div>
                <div class="nav-item">
                    <a href="/api-center" class="nav-link ${path === '/api-center' ? 'active' : ''} glitch-hover">
                        API CENTER
                    </a>
                </div>
                <div class="nav-item">
                    <a href="/profile" class="nav-link ${path === '/profile' ? 'active' : ''} glitch-hover">
                        PROFILE
                    </a>
                </div>
${user && user.plan === 'Admin' ? `
                 <div class="nav-item">
                     <a href="/admin" class="nav-link ${path === '/admin' ? 'active' : ''} glitch-hover" style="position: relative;">
                         ADMIN
                     </a>
                 </div>
                 ` : ''}
                <div class="nav-item" style="margin-top: 50px; border-top: 1px solid rgba(255,100,100,0.1); padding-top: 20px;">
                    <a href="javascript:void(0)" onclick="logout()" class="nav-link logout-link glitch-hover">
                        LOGOUT
                    </a>
                </div>
            </nav>
        </aside>
    `;

    // Inject Sidebar
    const wrapper = document.querySelector('.dashboard-wrapper');
    if (wrapper) {
        wrapper.insertAdjacentHTML('afterbegin', sidebarHTML);
    }
});

// Robust Toggle function that handles dynamic element
// Optimized toggle function with resize handling
let resizeTimer = null;
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');

        // Prevent multiple rapid toggles from causing layout thrashing
        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }
        resizeTimer = setTimeout(() => {
            // Trigger reflow to ensure proper positioning
            sidebar.offsetHeight;
        }, 50);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}
