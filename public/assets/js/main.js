// Particles.js Initialization - Optimized
if (document.getElementById('particles-js')) {
    particlesJS('particles-js', {
        "particles": {
            "number": { "value": 60, "density": { "enable": true, "value_area": 800 } }, // Reduced from 80 to 60
            "color": { "value": "#00ff41" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.5, "random": false },
            "size": { "value": 2, "random": true }, // Reduced from 3 to 2 for better performance
            "line_linked": { "enable": true, "distance": 150, "color": "#00ff41", "opacity": 0.3, "width": 1 }, // Reduced opacity and width
            "move": { "enable": true, "speed": 1, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false } // Reduced speed from 2 to 1
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
            "modes": { "repulse": { "distance": 80, "duration": 0.3 }, "push": { "particles_nb": 3 } } // Reduced distance and particle count
        },
        "retina_detect": true
    });
}

// Terminal Typing Effect (Optimized Version)
const terminal = document.getElementById('terminal');
if (terminal) {
    const lines = [
        "> Initialize core.sys...",
        "> Injecting neural modules...",
        "> Bypass firewalls [OK]",
        "> Establishing encrypted connection...",
        "> Accessing mainframe...",
        "> Welcome, Operative."
    ];

    let lineIndex = 0;
    let charIndex = 0;
    let currentLineElement = null;
    let timer = null;

    function typeLine() {
        if (lineIndex >= lines.length) return;

        if (!currentLineElement) {
            currentLineElement = document.createElement('p');
            currentLineElement.className = 'line';
            terminal.appendChild(currentLineElement);
        }

        const text = lines[lineIndex];
        if (charIndex < text.length) {
            currentLineElement.textContent += text[charIndex];
            charIndex++;
            terminal.scrollTop = terminal.scrollHeight;
        } else {
            charIndex = 0;
            lineIndex++;
            currentLineElement = null;
            // Add delay between lines
            timer = setTimeout(typeLine, 500);
        }
    }

    // Start the typing effect
    timer = setTimeout(typeLine, 500);

    // Cleanup function to prevent memory leaks
    return () => {
        if (timer) clearTimeout(timer);
    };
}
