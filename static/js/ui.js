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
        this.cameraToggleBtn = document.getElementById('camera-toggle-btn');

        this.pointerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.lastPointerPos = null;
        this.hoveredElement = null;
        this.hoverStartTime = null;
        this.hoverDurationNeeded = 1200; // ms for auto hover-click fallback

        this.ws = null;
        this.isConnected = false;

        this.initButtons();
        this.initWebSocket();
        this.initClientMediaPipe();
        this.initMouseFallback();
    }

    initButtons() {
<<<<<<< Updated upstream
        const startBtn = document.getElementById('btn-start');
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                document.getElementById('start-modal').classList.add('hidden');
                if (this.virtualPointer) this.virtualPointer.classList.remove('hidden');
                game.startGame();
                if (typeof clientMP !== 'undefined' && !clientMP.isCameraActive) {
                    await clientMP.startCamera();
                }
            });
        }

        const resumeBtn = document.getElementById('btn-resume');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', async () => {
                game.resumeGame();
                if (typeof clientMP !== 'undefined' && !clientMP.isCameraActive) {
                    await clientMP.startCamera();
                }
            });
        }
=======
        const bindBtn = (id, handler) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        };

        bindBtn('btn-start', () => {
            const startModal = document.getElementById('start-modal');
            if (startModal) startModal.classList.add('hidden');
            if (this.virtualPointer) this.virtualPointer.classList.remove('hidden');
            if (typeof game !== 'undefined') game.startGame();
        });
>>>>>>> Stashed changes

        bindBtn('btn-resume', () => {
            if (typeof game !== 'undefined') game.resumeGame();
        });

        bindBtn('btn-restart-pause', () => {
            const pauseModal = document.getElementById('pause-modal');
            if (pauseModal) pauseModal.classList.add('hidden');
            if (typeof game !== 'undefined') game.startGame();
        });

        bindBtn('btn-play-again', () => {
            const goModal = document.getElementById('game-over-modal');
            if (goModal) goModal.classList.add('hidden');
            if (typeof game !== 'undefined') game.startGame();
        });

        bindBtn('btn-home', () => {
            const goModal = document.getElementById('game-over-modal');
            if (goModal) goModal.classList.add('hidden');
            const startModal = document.getElementById('start-modal');
            if (startModal) startModal.classList.remove('hidden');
            if (typeof game !== 'undefined') game.state = 'START';
        });

        if (this.cameraToggleBtn) {
            this.cameraToggleBtn.addEventListener('click', async () => {
                if (typeof clientMP !== 'undefined' && clientMP.toggleCamera) {
                    const active = await clientMP.toggleCamera();
                    this.updateCameraToggleUI(active);
                }
            });
        }
    }

    initClientMediaPipe() {
        if (typeof clientMP !== 'undefined') {
            clientMP.onGestureData = (data) => this.handleGestureData(data);
            clientMP.onCameraStateChange = (active) => this.updateCameraToggleUI(active);
        }
    }

    updateCameraToggleUI(active) {
        if (!this.cameraToggleBtn) return;
        if (active) {
            this.cameraToggleBtn.className = 'cam-toggle-btn active';
            this.cameraToggleBtn.innerHTML = '<span class="pulse-dot green">●</span> CAM: ON';
        } else {
            this.cameraToggleBtn.className = 'cam-toggle-btn inactive';
            this.cameraToggleBtn.innerHTML = '<span class="pulse-dot red">●</span> CAM: OFF';
        }
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/game`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log("WebSocket connected to backend GestureEngine (/ws/game).");
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
                this.isConnected = false;
                setTimeout(() => this.initWebSocket(), 3000);
            };

            this.ws.onerror = (err) => {
                console.warn("WebSocket status note:", err);
            };
        } catch (e) {
            console.warn("WebSocket connection init error:", e);
        }
    }

    handleGestureData(data) {
        if (!data) return;

        // 1. Update Camera Video Feed if available
        if (data.frame && this.webcamFeed) {
            this.webcamFeed.src = data.frame;
        }

        // 2. Update Virtual Hand Pointer Position & Continuous Slicing
        if (data.pointer) {
            const px = data.pointer.x * window.innerWidth;
            const py = data.pointer.y * window.innerHeight;
            this.pointerPos = { x: px, y: py };

            if (this.virtualPointer) {
                this.virtualPointer.style.left = `${px}px`;
                this.virtualPointer.style.top = `${py}px`;
                this.virtualPointer.classList.remove('hidden');
            }

            // Continuous hand movement blade slicing
            if (this.lastPointerPos && typeof game !== 'undefined' && game.state === 'PLAYING') {
                const dist = Math.hypot(px - this.lastPointerPos.x, py - this.lastPointerPos.y);
                if (dist >= 4 && data.gesture !== 'fist') {
                    game.processSwipeLine(this.lastPointerPos.x, this.lastPointerPos.y, px, py);
                }
            }
            this.lastPointerPos = { x: px, y: py };

            this.checkHoverInteraction(px, py);
        } else {
            this.lastPointerPos = null;
        }

        // 3. Process Fast Hand Swipe Gesture Line
        if (data.gesture === 'swipe' && data.swipe_line && typeof game !== 'undefined') {
            const x1 = data.swipe_line.x1 * window.innerWidth;
            const y1 = data.swipe_line.y1 * window.innerHeight;
            const x2 = data.swipe_line.x2 * window.innerWidth;
            const y2 = data.swipe_line.y2 * window.innerHeight;
            game.processSwipeLine(x1, y1, x2, y2);
        }

        // 4. Hand Action Triggering (Pinch / Left Click / Peace / Fist)
        if (data.action === 'left_click' || data.gesture === 'pinch') {
            this.triggerVirtualClick();
        } else if (data.action === 'right_click' || data.gesture === 'peace') {
            this.triggerVirtualRightClick();
        } else if (data.action === 'toggle_control' || data.gesture === 'fist') {
            if (typeof game !== 'undefined') {
                if (game.state === 'PLAYING') {
                    game.pauseGame();
                } else if (game.state === 'PAUSED') {
                    game.resumeGame();
                }
            }
        }

        // 5. Update Gesture Status Badges
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

            const elapsed = Date.now() - this.hoverStartTime;
            const progress = Math.min(1.0, elapsed / this.hoverDurationNeeded);
            const dashoffset = 276 * (1.0 - progress);
            if (this.progressCircle) {
                this.progressCircle.style.strokeDashoffset = dashoffset;
            }

            if (progress >= 1.0) {
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
        if (typeof sounds !== 'undefined') sounds.playClickSound();
        if (this.hoveredElement) {
            this.hoveredElement.click();
            this.resetHover();
            return;
        }

        if (typeof game !== 'undefined') {
            if (game.state === 'PLAYING') {
                const { x, y } = this.pointerPos;
                game.processSwipeLine(x - 25, y - 25, x + 25, y + 25);
            } else if (game.state === 'PAUSED') {
                game.resumeGame();
            }
        }
    }

    triggerVirtualRightClick() {
        if (typeof sounds !== 'undefined') sounds.playClickSound();
        if (typeof game !== 'undefined' && game.state === 'PLAYING') {
            const { x, y } = this.pointerPos;
            game.processSwipeLine(x - 35, y, x + 35, y);
        }
    }

    updateStatusBadges(data) {
        if (!data) return;

        // Hand Gesture Badge
        if (this.statusHand) {
            if (data.gesture === 'swipe') {
                this.statusHand.className = 'status-tag tag-swipe';
                this.statusHand.innerText = `⚡ SWIPING (${data.direction || 'SWIPE'})`;
            } else if (data.gesture === 'pinch') {
                this.statusHand.className = 'status-tag tag-pinch';
                this.statusHand.innerText = '👌 PINCH (CLICK)';
            } else if (data.gesture === 'peace') {
                this.statusHand.className = 'status-tag tag-peace';
                this.statusHand.innerText = '✌️ PEACE (RIGHT)';
            } else if (data.gesture === 'fist') {
                this.statusHand.className = 'status-tag tag-fist';
                this.statusHand.innerText = '✊ FIST (PAUSE)';
            } else if (data.gesture === 'open_palm') {
                this.statusHand.className = 'status-tag tag-open';
                this.statusHand.innerText = '🖐️ OPEN PALM';
            } else if (data.pointer) {
                this.statusHand.className = 'status-tag tag-pointing';
                this.statusHand.innerText = '☝ POINTING';
            } else {
                this.statusHand.className = 'status-tag tag-idle';
                this.statusHand.innerText = 'NO HAND';
            }
        }

        // Action Badge
        if (this.statusAction) {
            if (data.action) {
                this.statusAction.className = 'status-tag tag-action';
                this.statusAction.innerText = data.action.replace('_', ' ').toUpperCase();
            } else if (data.is_pinch) {
                this.statusAction.className = 'status-tag tag-pinch';
                this.statusAction.innerText = 'DRAGGING';
            } else {
                this.statusAction.className = 'status-tag tag-idle';
                this.statusAction.innerText = 'MOVING';
            }
        }
    }

    initMouseFallback() {
        let isMouseDown = false;
        let lastMousePos = null;

        const handleMove = (clientX, clientY) => {
            this.pointerPos = { x: clientX, y: clientY };
            if (this.virtualPointer) {
                this.virtualPointer.style.left = `${clientX}px`;
                this.virtualPointer.style.top = `${clientY}px`;
                this.virtualPointer.classList.remove('hidden');
            }

            if (isMouseDown && lastMousePos && typeof game !== 'undefined') {
                game.processSwipeLine(lastMousePos.x, lastMousePos.y, clientX, clientY);
            }
            lastMousePos = { x: clientX, y: clientY };
        };

        window.addEventListener('mousemove', (e) => {
            handleMove(e.clientX, e.clientY);
        });

        window.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        // Touch support for mobile / laptops with touch
        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                const t = e.touches[0];
                handleMove(t.clientX, t.clientY);
            }
        }, { passive: true });

        window.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) {
                isMouseDown = true;
                const t = e.touches[0];
                lastMousePos = { x: t.clientX, y: t.clientY };
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            isMouseDown = false;
        });
    }
}

const ui = new UIController();
