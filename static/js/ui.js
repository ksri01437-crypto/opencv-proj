// UI & Gesture Controller
class UIController {
    constructor() {
        this.virtualPointer = document.getElementById('virtual-pointer');
        this.webcamFeed = document.getElementById('webcam-feed');
        this.statusHand = document.getElementById('status-hand');
        this.statusLeftEye = document.getElementById('status-left-eye');
        this.statusRightEye = document.getElementById('status-right-eye');
        this.statusAction = document.getElementById('status-action');
        this.progressCircle = document.getElementById('hover-progress-circle');

        this.pointerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.hoveredElement = null;
        this.hoverStartTime = null;
        this.hoverDurationNeeded = 1200; // ms for auto hover-click fallback

        this.ws = null;
        this.isConnected = false;

        this.initButtons();
        this.initWebSocket();
        this.initMouseFallback();
    }

    initButtons() {
        document.getElementById('btn-start').addEventListener('click', () => {
            document.getElementById('start-modal').classList.add('hidden');
            this.virtualPointer.classList.remove('hidden');
            game.startGame();
        });

        document.getElementById('btn-resume').addEventListener('click', () => {
            game.resumeGame();
        });

        document.getElementById('btn-restart-pause').addEventListener('click', () => {
            document.getElementById('pause-modal').classList.add('hidden');
            game.startGame();
        });

        document.getElementById('btn-play-again').addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.add('hidden');
            game.startGame();
        });

        document.getElementById('btn-home').addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.add('hidden');
            document.getElementById('start-modal').classList.remove('hidden');
            game.state = 'START';
        });
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("WebSocket connected to backend GestureEngine.");
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleGestureData(data);
            } catch (err) {
                console.error("Error parsing WS gesture data:", err);
            }
        };

        this.ws.onclose = () => {
            console.warn("WebSocket disconnected. Retrying in 2 seconds...");
            this.isConnected = false;
            setTimeout(() => this.initWebSocket(), 2000);
        };

        this.ws.onerror = (err) => {
            console.error("WebSocket error:", err);
        };
    }

    handleGestureData(data) {
        // 1. Update Camera Video Feed
        if (data.frame) {
            this.webcamFeed.src = data.frame;
        }

        // 2. Update Virtual Hand Pointer Position
        if (data.pointer) {
            const px = data.pointer.x * window.innerWidth;
            const py = data.pointer.y * window.innerHeight;
            this.pointerPos = { x: px, y: py };

            this.virtualPointer.style.left = `${px}px`;
            this.virtualPointer.style.top = `${py}px`;
            this.virtualPointer.classList.remove('hidden');

            this.checkHoverInteraction(px, py);
        }

        // 3. Process Hand Swipe Line
        if (data.gesture === 'swipe' && data.swipe_line) {
            const x1 = data.swipe_line.x1 * window.innerWidth;
            const y1 = data.swipe_line.y1 * window.innerHeight;
            const x2 = data.swipe_line.x2 * window.innerWidth;
            const y2 = data.swipe_line.y2 * window.innerHeight;
            game.processSwipeLine(x1, y1, x2, y2);
        }

        // 4. Fist Gesture -> Pause
        if (data.gesture === 'fist') {
            if (game.state === 'PLAYING') {
                game.pauseGame();
            }
        }

        // 5. Eye Action Triggering
        if (data.action === 'left_click') {
            this.triggerVirtualClick();
        } else if (data.action === 'right_click') {
            this.triggerVirtualRightClick();
        } else if (data.action === 'both_eyes_closed') {
            if (game.state === 'PLAYING') {
                game.pauseGame();
            } else if (game.state === 'PAUSED') {
                game.resumeGame();
            }
        }

        // 6. Update Gesture Status Badges in Top-Right Panel
        this.updateStatusBadges(data);
    }

    checkHoverInteraction(px, py) {
        const elem = document.elementFromPoint(px, py);
        const btn = elem ? elem.closest('.gesture-btn') : null;

        if (btn) {
            if (this.hoveredElement !== btn) {
                if (this.hoveredElement) this.hoveredElement.classList.remove('hover-active');
                this.hoveredElement = btn;
                this.hoverStartTime = Date.now();
                btn.classList.add('hover-active');
            }

            // Calculate progress radial fill
            const elapsed = Date.now() - this.hoverStartTime;
            const progress = Math.min(1.0, elapsed / this.hoverDurationNeeded);
            const dashoffset = 276 * (1.0 - progress);
            if (this.progressCircle) {
                this.progressCircle.style.strokeDashoffset = dashoffset;
            }

            if (progress >= 1.0) {
                // Auto trigger hover click
                btn.click();
                this.resetHover();
            }
        } else {
            this.resetHover();
        }
    }

    resetHover() {
        if (this.hoveredElement) {
            this.hoveredElement.classList.remove('hover-active');
            this.hoveredElement = null;
        }
        this.hoverStartTime = null;
        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = '276';
        }
    }

    triggerVirtualClick() {
        sounds.playClickSound();
        if (this.hoveredElement) {
            this.hoveredElement.click();
            this.resetHover();
            return;
        }

        // If in game, left click slices any fruit currently under virtual pointer
        if (game.state === 'PLAYING') {
            const { x, y } = this.pointerPos;
            game.processSwipeLine(x - 20, y - 20, x + 20, y + 20);
        } else if (game.state === 'PAUSED') {
            game.resumeGame();
        }
    }

    triggerVirtualRightClick() {
        sounds.playClickSound();
        if (game.state === 'PLAYING') {
            const { x, y } = this.pointerPos;
            game.processSwipeLine(x - 30, y, x + 30, y);
        }
    }

    updateStatusBadges(data) {
        // Hand Badge
        if (data.gesture === 'swipe') {
            this.statusHand.className = 'status-tag tag-swipe';
            this.statusHand.innerText = `⚡ SWIPING (${data.direction || 'SWIPE'})`;
        } else if (data.gesture === 'fist') {
            this.statusHand.className = 'status-tag tag-fist';
            this.statusHand.innerText = '✊ FIST';
        } else if (data.pointer) {
            this.statusHand.className = 'status-tag tag-pointing';
            this.statusHand.innerText = '☝ POINTING';
        } else {
            this.statusHand.className = 'status-tag tag-idle';
            this.statusHand.innerText = 'NO HAND';
        }

        // Left Eye Badge
        if (data.left_eye === 'closed') {
            this.statusLeftEye.className = 'status-tag tag-closed';
            this.statusLeftEye.innerText = '👁️ CLOSED';
        } else {
            this.statusLeftEye.className = 'status-tag tag-open';
            this.statusLeftEye.innerText = '👁️ OPEN';
        }

        // Right Eye Badge
        if (data.right_eye === 'closed') {
            this.statusRightEye.className = 'status-tag tag-closed';
            this.statusRightEye.innerText = '👁️ CLOSED';
        } else {
            this.statusRightEye.className = 'status-tag tag-open';
            this.statusRightEye.innerText = '👁️ OPEN';
        }

        // Action Badge
        if (data.action) {
            this.statusAction.className = 'status-tag tag-action';
            this.statusAction.innerText = data.action.toUpperCase();
        } else {
            this.statusAction.className = 'status-tag tag-idle';
            this.statusAction.innerText = 'MOVING';
        }
    }

    initMouseFallback() {
        let isMouseDown = false;
        let lastMousePos = null;

        window.addEventListener('mousemove', (e) => {
            if (!this.isConnected || !this.virtualPointer.offsetParent) {
                this.pointerPos = { x: e.clientX, y: e.clientY };
                this.virtualPointer.style.left = `${e.clientX}px`;
                this.virtualPointer.style.top = `${e.clientY}px`;
                this.virtualPointer.classList.remove('hidden');

                if (isMouseDown && lastMousePos) {
                    game.processSwipeLine(lastMousePos.x, lastMousePos.y, e.clientX, e.clientY);
                }
                lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
    }
}

const ui = new UIController();
