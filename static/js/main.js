let currentTeam = null;

// Access Modal Logic
let isAccessGranted = false;
const ACCESS_KEY = "BEBE2025";

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('access-modal');
    const accessInput = document.getElementById('access-key-input');
    const accessBtn = document.getElementById('access-btn');
    const errorMessage = document.getElementById('error-message');

    function checkAccess() {
        const enteredKey = accessInput.value.trim();
        if (enteredKey === ACCESS_KEY) {
            isAccessGranted = true;
            modal.classList.add('hidden');
            // Optional: Add blur removal or other reveal animations here
        } else {
            errorMessage.classList.remove('hidden');
            // Shake animation for error
            gsap.fromTo(accessInput, { x: -10 }, { x: 10, duration: 0.1, repeat: 5, yoyo: true });
        }
    }

    accessBtn.addEventListener('click', checkAccess);

    accessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkAccess();
        }
    });
});

// Modified vote function to check for access
function vote(team) {
    if (!isAccessGranted) return;

    fetch('/api/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote: team }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                updateStats();
                triggerConfetti(team);
                animatePush(team);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function updateStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            const total = data.total;
            let boyPercent = 50;
            let girlPercent = 50;

            if (total > 0) {
                boyPercent = (data.boy / total) * 100;
                girlPercent = (data.girl / total) * 100;
            }

            // Calculate Visual Percentages (Clamping)
            const visualBoyPercent = 15 + (boyPercent * 0.7);
            const visualGirlPercent = 15 + (girlPercent * 0.7);

            // Confetti Logic
            if (window.lastBoyPercent !== undefined) {
                if (boyPercent > window.lastBoyPercent) {
                    triggerConfetti('boy');
                } else if (girlPercent > window.lastGirlPercent) {
                    triggerConfetti('girl');
                }
            }

            // Animate Widths
            gsap.to(".background-layer-boy", {
                width: `${visualBoyPercent}%`,
                height: "100%",
                duration: 1.5,
                ease: "elastic.out(1, 0.5)"
            });

            gsap.to(".background-layer-girl", {
                width: `${visualGirlPercent}%`,
                height: "100%",
                duration: 1.5,
                ease: "elastic.out(1, 0.5)"
            });

            // Update Text with Jump Animation
            const boyText = document.getElementById('boy-percent');
            const girlText = document.getElementById('girl-percent');

            if (boyText.innerText !== `${Math.round(boyPercent)}%`) {
                boyText.innerText = `${Math.round(boyPercent)}%`;
                gsap.fromTo(boyText, { y: -10, scale: 1.2 }, { y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" });
            }

            if (girlText.innerText !== `${Math.round(girlPercent)}%`) {
                girlText.innerText = `${Math.round(girlPercent)}%`;
                gsap.fromTo(girlText, { y: -10, scale: 1.2 }, { y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" });
            }

            // Push Animation Logic
            if (window.lastBoyPercent !== undefined) {
                if (boyPercent > window.lastBoyPercent) {
                    animatePush('#boy-avatar', 40, 5);
                } else if (boyPercent < window.lastBoyPercent) {
                    animatePush('#girl-avatar', -40, -5);
                }
            }

            window.lastBoyPercent = boyPercent;
            window.lastGirlPercent = girlPercent;
        })
        .catch(error => console.error('Error fetching stats:', error));
}

function triggerConfetti(team) {
    const colors = team === 'boy' ? ['#3b82f6', '#ffffff', '#60a5fa'] : ['#ec4899', '#ffffff', '#d946ef'];
    const originX = team === 'boy' ? 0 : 1;
    const angle = team === 'boy' ? 60 : 120;

    confetti({
        particleCount: 150,
        spread: 100,
        startVelocity: 45,
        scalar: 1.2,
        gravity: 1.2,
        origin: { x: originX, y: 0.7 },
        colors: colors,
        angle: angle,
        zIndex: 9999
    });
}

function animatePush(selector, xDist, rotAngle) {
    const el = document.querySelector(selector);
    if (!el) return;

    if (gsap.isTweening(el)) return;

    const tl = gsap.timeline();

    tl.to(el, {
        x: xDist,
        rotation: rotAngle,
        scaleY: 0.95,
        duration: 0.15,
        ease: "power2.out"
    })
        .to(el, {
            x: 0,
            rotation: 0,
            scaleY: 1,
            duration: 0.8,
            ease: "elastic.out(1, 0.5)"
        });
}

// Poll every 2 seconds
setInterval(updateStats, 2000);

// Initial call
updateStats();

// Resize Listener
window.addEventListener('resize', () => {
    gsap.set(".background-layer-boy, .background-layer-girl", { height: "100%" });
    updateStats();
});
