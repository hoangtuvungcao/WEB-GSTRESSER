// Optimized Floating Effects System
// Handles: Stars, Shapes, Lines, Particles with mobile/desktop optimization

const FloatingEffects = {
    isMobile: () => window.innerWidth <= 768,
    isTablet: () => window.innerWidth > 768 && window.innerWidth <= 1024,

    config: {
        desktop: { stars: 15, shapes: 2, lines: 2, particles: 10 },
        tablet: { stars: 12, shapes: 2, lines: 1, particles: 8 },
        mobile: { stars: 10, shapes: 1, lines: 1, particles: 6 }
    },

    getConfig() {
        if (this.isMobile()) return this.config.mobile;
        if (this.isTablet()) return this.config.tablet;
        return this.config.desktop;
    },

    ensureEffectsExist() {
        const starsContainer = document.getElementById('starsContainer');
        const shapesContainer = document.getElementById('shapesContainer');
        const linesContainer = document.getElementById('linesContainer');
        
        if (!starsContainer || starsContainer.children.length === 0) this.createStars();
        if (!shapesContainer || shapesContainer.children.length === 0) this.createShapes();
        if (!linesContainer || linesContainer.children.length === 0) this.createNeonLines();
    },

    createStars() {
        const container = document.getElementById('starsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const config = this.getConfig();
        const starTypes = ['star-small', 'star-medium', 'star-large'];
        
        for (let i = 0; i < config.stars; i++) {
            const star = document.createElement('div');
            star.className = `floating-star ${starTypes[Math.floor(Math.random() * starTypes.length)]}`;
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 8 + 's';
            star.style.willChange = 'opacity';
            container.appendChild(star);
        }
    },

    createShapes() {
        const container = document.getElementById('shapesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const config = this.getConfig();
        const shapes = ['shape-diamond', 'shape-triangle', 'shape-square'];
        
        for (let i = 0; i < config.shapes; i++) {
            const shape = document.createElement('div');
            shape.className = `floating-shape ${shapes[Math.floor(Math.random() * shapes.length)]}`;
            shape.style.left = Math.random() * 90 + '%';
            shape.style.top = Math.random() * 90 + '%';
            shape.style.animationDelay = Math.random() * 10 + 's';
            shape.style.willChange = 'transform';
            container.appendChild(shape);
        }
    },

    createNeonLines() {
        const container = document.getElementById('linesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const config = this.getConfig();
        
        for (let i = 0; i < config.lines; i++) {
            const line = document.createElement('div');
            line.className = `neon-line ${i % 2 === 0 ? 'line-horizontal' : 'line-vertical'}`;
            line.style.left = Math.random() * 100 + '%';
            line.style.top = Math.random() * 100 + '%';
            line.style.animationDelay = Math.random() * 8 + 's';
            line.style.willChange = 'transform';
            container.appendChild(line);
        }
    },

    createParticles() {
        const container = document.getElementById('particleContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const config = this.getConfig();
        const colors = ['particle-green', 'particle-blue', 'particle-purple'];
        
        for (let i = 0; i < config.particles; i++) {
            const particle = document.createElement('div');
            particle.className = `floating-particle ${colors[i % 3]}`;
            particle.style.left = Math.random() * 100 + '%';
            particle.style.bottom = '-10px';
            particle.style.animationDelay = Math.random() * 5 + 's';
            particle.style.willChange = 'transform, opacity';
            container.appendChild(particle);
        }
    },

    init() {
        this.createStars();
        this.createShapes();
        this.createNeonLines();
        this.createParticles();

        // Periodically check if effects exist
        setInterval(() => this.ensureEffectsExist(), 8000);
    },

    handleResize() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.createStars();
                this.createShapes();
                this.createNeonLines();
            }, 300);
        });
    }
};

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        FloatingEffects.init();
        FloatingEffects.handleResize();
    });
} else {
    FloatingEffects.init();
    FloatingEffects.handleResize();
}

window.addEventListener('load', () => {
    FloatingEffects.ensureEffectsExist();
});
