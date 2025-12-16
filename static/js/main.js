// Global variables
let boyPercent = 50;
let girlPercent = 50;
let isAccessGranted = false;
window.lastBoyPercent = 50;
window.lastGirlPercent = 50;
window.countdownStarted = false;
window.dominanceShown = false;

document.addEventListener('DOMContentLoaded', () => {
    // Auto-login removed to enforce modal on every start
    // const savedKey = localStorage.getItem('accessKey');
    // if (savedKey) {
    //     validateAccessKey(savedKey);
    // }

    // Modal Logic
    const modal = document.getElementById('access-modal');
    const accessInput = document.getElementById('access-key-input');
    const accessBtn = document.getElementById('access-btn');
    const errorMsg = document.getElementById('error-msg');

    accessBtn.addEventListener('click', () => {
        const key = accessInput.value.trim();
        if (key) {
            validateAccessKey(key);
        }
    });

    // Allow Enter key to submit
    accessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const key = accessInput.value.trim();
            if (key) {
                validateAccessKey(key);
            }
        }
    });

    function validateAccessKey(key) {
        fetch('/reveal-gender-battle/api/validate_access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_key: key })
        })
            .then(response => response.json())
            .then(data => {
                if (data.valid) {
                    // Success
                    sessionStorage.setItem('accessKey', key);
                    isAccessGranted = true;
                    modal.classList.add('hidden');

                    // If admin, show admin controls
                    if (data.is_admin) {
                        console.log("Admin access granted");
                        const adminControls = document.getElementById('admin-controls');
                        if (adminControls) {
                            adminControls.classList.remove('hidden');
                        }
                    }

                    // Force update to show result if game is already over
                    updateStats();
                } else {
                    // Invalid
                    errorMsg.textContent = data.message || "Invalid Access Key";
                    errorMsg.classList.remove('hidden');
                }
            })
            .catch(err => {
                console.error(err);
                errorMsg.textContent = "Server Error";
                errorMsg.classList.remove('hidden');
            });
    }

    // Voting Logic
    const boyBtn = document.getElementById('vote-boy');
    const girlBtn = document.getElementById('vote-girl');
    const revealBtn = document.getElementById('admin-reveal-btn');

    boyBtn.addEventListener('click', () => castVote('boy'));
    girlBtn.addEventListener('click', () => castVote('girl'));

    if (revealBtn) {
        revealBtn.addEventListener('click', () => {
            const key = sessionStorage.getItem('accessKey');
            fetch('/reveal-gender-battle/api/reveal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_key: key })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'COUNTDOWN') {
                        startCountdown(data.final_result);
                    } else if (data.error) {
                        alert(data.error);
                    }
                })
                .catch(err => console.error(err));
        });
    }

    function castVote(team) {
        if (!isAccessGranted) {
            // Should not happen if modal is blocking, but safety check
            alert("Please enter a valid access key first.");
            return;
        }


        const key = sessionStorage.getItem('accessKey');
        fetch('/reveal-gender-battle/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: team, access_key: key })
        })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    // Show confetti for the voted team
                    triggerConfetti(team);

                    // If doctor vote triggered countdown immediately
                    if (data.status === 'COUNTDOWN') {
                        startCountdown(data.final_result);
                    }
                } else if (data.error) {
                    alert(data.error);
                }
            })
            .catch(error => console.error('Error voting:', error));
    }

    // Initial Poll
    // updateStats();

    // Poll every 2 seconds
    setInterval(updateStats, 2000);
});

function updateStats() {
    if (!isAccessGranted) {
        return;
    }
    fetch('/reveal-gender-battle/api/stats')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ENDED') {
                if (!window.countdownStarted) {
                    startCountdown(data.final_result);
                }
                return;
            }
            const total = data.total;
            if (total > 0) {
                boyPercent = (data.boy / total) * 100;
                girlPercent = (data.girl / total) * 100;
            } else {
                boyPercent = 50;
                girlPercent = 50;
            }

            // Update Widths
            const boyLayer = document.querySelector('.background-layer-boy');
            const girlLayer = document.querySelector('.background-layer-girl');

            // Only animate widths if NOT in dominance mode
            if (!window.dominanceShown) {
                gsap.to(boyLayer, { width: `${boyPercent}%`, duration: 0.5 });
                gsap.to(girlLayer, { width: `${girlPercent}%`, duration: 0.5 });
            }

            // Update Text
            const boyText = document.getElementById('boy-percent');
            const girlText = document.getElementById('girl-percent');

            // Animate numbers
            if (boyText.innerText !== `${Math.round(boyPercent)}%`) {
                boyText.innerText = `${Math.round(boyPercent)}%`;
                gsap.fromTo(boyText, { y: -10, scale: 1.2 }, { y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" });
            }

            if (girlText.innerText !== `${Math.round(girlPercent)}%`) {
                girlText.innerText = `${Math.round(girlPercent)}%`;
                gsap.fromTo(girlText, { y: -10, scale: 1.2 }, { y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" });
            }

            // Push Animation Logic
            if (window.lastBoyPercent !== undefined && data.status === 'VOTING') {
                if (boyPercent > window.lastBoyPercent) {
                    animatePush('#boy-avatar', 40, 5);
                } else if (boyPercent < window.lastBoyPercent) {
                    animatePush('#girl-avatar', -40, -5);
                }
            }

            window.lastBoyPercent = boyPercent;
            window.lastGirlPercent = girlPercent;

            // // Handle Game State
            // if (data.status === 'COUNTDOWN' || data.status === 'ENDED') {
            //     // Hide modal immediately if game is in progress or ended
            //     const modal = document.getElementById('access-modal');
            //     if (modal && !modal.classList.contains('hidden')) {
            //         modal.classList.add('hidden');
            //         isAccessGranted = true; // Implicitly grant access to view
            //     }
            // }

            if (isAccessGranted) {
                if (data.status === 'COUNTDOWN' && !window.countdownStarted) {
                    startCountdown(data.final_result);
                } else if (data.status === 'ENDED') {
                    // Ensure dominance is shown if user joins late
                    if (!window.dominanceShown) {
                        showDominance(data.final_result, true);
                    }
                }
            }
        })
        .catch(error => console.error('Error fetching stats:', error));
}

function startCountdown(winner) {
    window.countdownStarted = true;

    // Create Countdown Elements if not exist
    let overlay = document.querySelector('.countdown-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'countdown-overlay active';
        overlay.innerHTML = '<div class="countdown-number">10</div>';
        document.body.appendChild(overlay);
    } else {
        overlay.classList.add('active');
    }

    const numberEl = overlay.querySelector('.countdown-number');
    let count = 5;

    const interval = setInterval(() => {
        count--;
        if (count >= 0) {
            numberEl.innerText = count;
            gsap.fromTo(numberEl, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" });
        } else {
            clearInterval(interval);
            overlay.classList.remove('active');
            showDominance(winner);
        }
    }, 1000);
}

function showDominance(winner, immediate = false) {
    if (window.dominanceShown) return;
    window.dominanceShown = true;

    // Stop polling
    // We don't strictly need to stop polling, but we should stop updating the UI based on votes
    // Actually, let's keep polling to ensure state consistency but ignore vote updates in UI logic above

    const boyLayer = document.querySelector('.background-layer-boy');
    const girlLayer = document.querySelector('.background-layer-girl');
    const boyAvatar = document.querySelector('#boy-avatar');
    const girlAvatar = document.querySelector('#girl-avatar');
    const vsBadge = document.querySelector('.vs-badge');
    const sides = document.querySelectorAll('.side');
    const adminControls = document.getElementById('admin-controls');

    // Hide UI elements
    const elementsToHide = [vsBadge, ...sides];
    if (adminControls) {
        elementsToHide.push(adminControls);
    }

    gsap.to(elementsToHide, { opacity: 0, duration: 0.5, pointerEvents: 'none' });

    if (winner === 'boy') {
        gsap.to(boyLayer, { width: "100%", duration: immediate ? 0 : 2, ease: "power4.inOut" });
        gsap.to(girlLayer, { width: "0%", duration: immediate ? 0 : 2, ease: "power4.inOut" });

        gsap.to(boyAvatar, {
            left: "150%",
            right: "auto",
            x: "-50%",
            scale: 1.5,
            bottom: "20%",
            duration: immediate ? 0 : 4,
            ease: "power4.inOut"
        });
        gsap.to(girlAvatar, { opacity: 0, duration: 0.5 });

        showWinnerText("¡ES UN NIÑO!");
        triggerConfetti('boy', true);
        setInterval(() => triggerConfetti('boy', true), 50); // Continuous rain

        // Show final reveal image after 3 seconds
        setTimeout(() => showFinalImage('matias.png'), 3000);

    } else if (winner === 'girl') {
        gsap.to(girlLayer, { width: "100%", duration: immediate ? 0 : 2, ease: "power4.inOut" });
        gsap.to(boyLayer, { width: "0%", duration: immediate ? 0 : 2, ease: "power4.inOut" });

        gsap.to(girlAvatar, {
            left: "-100%",
            right: "auto",
            x: "-50%",
            scale: 1.5,
            bottom: "20%",
            duration: immediate ? 0 : 4,
            ease: "power4.inOut"
        });
        gsap.to(boyAvatar, { opacity: 0, duration: 0.5 });

        showWinnerText("¡ES UNA NIÑA!");
        triggerConfetti('girl', true);
        setInterval(() => triggerConfetti('girl', true), 50); // Continuous rain

        // Show final reveal image after 3 seconds
        setTimeout(() => showFinalImage('isabella.png'), 3000);
    }
}

function showFinalImage(imageName) {
    let imgEl = document.querySelector('.final-reveal-image');
    if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.className = 'final-reveal-image';
        document.body.appendChild(imgEl);
    }

    // Always update class and src to ensure correct positioning styles (boy vs girl)
    const winnerClass = imageName.includes('matias') ? 'reveal-boy' : 'reveal-girl';
    imgEl.className = `final-reveal-image ${winnerClass}`;
    imgEl.src = `/reveal-gender-battle/static/img/${imageName}`;

    // Trigger animation after a brief delay to ensure CSS transition works
    setTimeout(() => {
        imgEl.classList.add('show');
    }, 100);

    // Change text after image finishes sliding up (2s transition + 0.5s buffer)
    setTimeout(() => {
        const winnerText = document.querySelector('.winner-text');
        if (winnerText) {
            if (imageName === 'matias.png') {
                winnerText.innerText = '¡Hola! soy Mathias';
            } else if (imageName === 'isabella.png') {
                winnerText.innerText = '¡Hola! soy Isabella';
            }
        }
    }, 2500);
}

function showWinnerText(text) {
    let winnerEl = document.querySelector('.winner-text');
    if (!winnerEl) {
        winnerEl = document.createElement('div');
        winnerEl.className = 'winner-text';
        document.body.appendChild(winnerEl);
    }
    winnerEl.innerText = text;
    winnerEl.classList.add('show');
}

function triggerConfetti(team, fromTop = false) {
    const colors = team === 'boy' ? ['#3b82f6', '#ffffff', '#60a5fa'] : ['#ec4899', '#ffffff', '#d946ef'];
    const isMobile = window.innerWidth <= 768;

    let origin, angle, startVelocity, spread, gravity, particleCount, scalar;

    if (fromTop) {
        origin = { x: Math.random(), y: isMobile ? 0 : -0.1 }; // Mobile: start from top edge
        angle = 270; // Downwards
        startVelocity = isMobile ? 10 : 30; // Mobile needs more velocity
        spread = isMobile ? 30 : 50;
        gravity = isMobile ? 0.7 : 0.5; // Mobile: slightly more gravity
        particleCount = isMobile ? 25 : 50;
        scalar = isMobile ? 0.8 : 1.2;
    } else {
        // Standard side cannon
        origin = { x: team === 'boy' ? 0 : 1, y: 0.7 };
        angle = team === 'boy' ? 60 : 120;
        startVelocity = 45;
        spread = isMobile ? 60 : 100;
        gravity = 1.2;
        particleCount = isMobile ? 80 : 150;
        scalar = isMobile ? 0.9 : 1.2;
    }

    confetti({
        particleCount: particleCount,
        spread: spread,
        startVelocity: startVelocity,
        scalar: scalar,
        gravity: gravity,
        origin: origin,
        colors: colors,
        angle: angle,
        zIndex: 9999
    });
}

function animatePush(selector, xMove, rotateDeg) {
    // Only animate if not already animating to avoid "vibrating" look
    if (!gsap.isTweening(selector)) {
        gsap.to(selector, {
            x: xMove,
            rotation: rotateDeg,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "power1.inOut"
        });
    }
}
