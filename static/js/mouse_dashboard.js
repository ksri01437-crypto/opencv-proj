// Real Computer Mouse Control Dashboard Controller
class MouseDashboardController {
    constructor() {
        this.telPos = document.getElementById('tel-cursor-pos');
        this.telHand = document.getElementById('tel-hand-status');
        this.telLeftClick = document.getElementById('tel-left-click');
        this.telRightClick = document.getElementById('tel-right-click');
        this.telScroll = document.getElementById('tel-scroll');
        this.telAction = document.getElementById('tel-action');
        this.telStatusPill = document.getElementById('tel-status-pill');
        this.toggleBtn = document.getElementById('toggle-mouse-btn');
        this.cameraToggleBtn = document.getElementById('camera-toggle-btn');
        this.pipBtn = document.getElementById('pip-toggle-btn');

        this.mouseEnabled = true;
        this.ws = null;

        this.initControls();
        this.initWebSocket();
        this.initClientMediaPipe();
    }

    initControls() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.mouseEnabled = !this.mouseEnabled;
                this.updateToggleUI(this.mouseEnabled);
            });
        }

        if (this.cameraToggleBtn) {
            this.cameraToggleBtn.addEventListener('click', async () => {
                if (typeof clientMP !== 'undefined') {
                    const active = await clientMP.toggleCamera();
                    this.updateCameraToggleUI(active);
                }
            });
        }

        if (this.pipBtn) {
            this.pipBtn.addEventListener('click', async () => {
                if (typeof clientMP !== 'undefined') {
                    const isPip = await clientMP.togglePictureInPicture();
                    if (isPip) {
                        this.pipBtn.classList.add('active');
                        this.pipBtn.innerHTML = '🗖 FLOATING: ACTIVE';
                    } else {
                        this.pipBtn.classList.remove('active');
                        this.pipBtn.innerHTML = '🗖 FLOATING CAM (PIP)';
                    }
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

    updateToggleUI(enabled) {
        this.mouseEnabled = enabled;
        if (!this.toggleBtn) return;
        if (enabled) {
            this.toggleBtn.className = 'toggle-btn active';
            this.toggleBtn.innerHTML = '<span class="dot-indicator green">●</span> MOUSE: ACTIVE';
            if (this.telStatusPill) {
                this.telStatusPill.className = 'status-pill active';
                this.telStatusPill.innerText = 'ACTIVE';
            }
        } else {
            this.toggleBtn.className = 'toggle-btn inactive';
            this.toggleBtn.innerHTML = '<span class="dot-indicator red">●</span> MOUSE: PAUSED (FIST ✊)';
            if (this.telStatusPill) {
                this.telStatusPill.className = 'status-pill paused';
                this.telStatusPill.innerText = 'PAUSED';
            }
        }
    }

    updateCameraToggleUI(active) {
        if (!this.cameraToggleBtn) return;
        if (active) {
            this.cameraToggleBtn.className = 'toggle-btn active';
            this.cameraToggleBtn.innerHTML = '<span class="dot-indicator green">●</span> CAMERA: ON';
        } else {
            this.cameraToggleBtn.className = 'toggle-btn inactive';
            this.cameraToggleBtn.innerHTML = '<span class="dot-indicator red">●</span> CAMERA: OFF';
        }
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/mouse`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("WebSocket connected to /ws/mouse for real PyAutoGUI control.");
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (typeof data.mouse_enabled !== 'undefined') {
                    this.updateToggleUI(data.mouse_enabled);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            setTimeout(() => this.initWebSocket(), 2000);
        };
    }

    handleGestureData(data) {
        // Toggle control via Fist gesture
        if (data.action === 'toggle_control' || data.gesture === 'fist') {
            if (data.action === 'toggle_control') {
                this.mouseEnabled = !this.mouseEnabled;
                this.updateToggleUI(this.mouseEnabled);
            }
        }

        // Send hand gesture data over WebSocket to Python for PyAutoGUI execution
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            data.mode = 'mouse';
            data.mouse_enabled = this.mouseEnabled;
            this.ws.send(JSON.stringify(data));
        }

        this.updateTelemetry(data);
    }

    updateTelemetry(data) {
        // Real OS Cursor Coordinates
        if (data.pointer && this.telPos) {
            const screenX = Math.round(data.pointer.x * (window.screen.width || 1920));
            const screenY = Math.round(data.pointer.y * (window.screen.height || 1080));
            this.telPos.innerText = `X: ${screenX} | Y: ${screenY}`;
        }

        // Hand Gesture
        if (this.telHand) {
            if (!this.mouseEnabled || data.gesture === 'paused') {
                this.telHand.innerText = '✊ PAUSED (MAKE FIST TO UNPAUSE)';
                this.telHand.style.color = '#ffcc00';
            } else if (data.gesture === 'pinch') {
                this.telHand.innerText = data.is_pinch ? '👌 PINCH DRAGGING' : '👌 PINCH (CLICK)';
                this.telHand.style.color = '#ff00ff';
            } else if (data.gesture === 'peace') {
                this.telHand.innerText = '✌️ PEACE (RIGHT CLICK)';
                this.telHand.style.color = '#00ffcc';
            } else if (data.gesture === 'scroll') {
                this.telHand.innerText = '📜 SCROLLING (2 FINGERS)';
                this.telHand.style.color = '#00e5ff';
            } else if (data.gesture === 'fist') {
                this.telHand.innerText = '✊ FIST (TOGGLED)';
                this.telHand.style.color = '#ffaa00';
            } else if (data.pointer) {
                this.telHand.innerText = '☝ MOVING REAL OS CURSOR';
                this.telHand.style.color = '#00ffcc';
            } else if (data.gesture === 'open_palm') {
                this.telHand.innerText = '🖐️ OPEN PALM (HOVER)';
                this.telHand.style.color = '#00ff66';
            } else {
                this.telHand.innerText = 'WAITING FOR HAND...';
                this.telHand.style.color = '#8a93b0';
            }
        }

        // Left Click / Drag Status
        if (this.telLeftClick) {
            if (data.is_pinch || data.gesture === 'pinch' || data.action === 'left_click') {
                this.telLeftClick.innerText = data.is_pinch ? '👌 ACTIVE (DRAGGING)' : '👌 LEFT CLICK';
                this.telLeftClick.style.color = '#ff00ff';
            } else {
                this.telLeftClick.innerText = 'READY (PINCH)';
                this.telLeftClick.style.color = '#00ff66';
            }
        }

        // Right Click Status
        if (this.telRightClick) {
            if (data.gesture === 'peace' || data.action === 'right_click') {
                this.telRightClick.innerText = '✌️ ACTIVE (RIGHT CLICK)';
                this.telRightClick.style.color = '#00ffcc';
            } else {
                this.telRightClick.innerText = 'READY (PEACE SIGN)';
                this.telRightClick.style.color = '#00ff66';
            }
        }

        // Scroll Status
        if (this.telScroll) {
            if (data.gesture === 'scroll' || data.action === 'scroll_up' || data.action === 'scroll_down') {
                this.telScroll.innerText = data.action === 'scroll_up' ? '📜 SCROLLING UP ▲' : '📜 SCROLLING DOWN ▼';
                this.telScroll.style.color = '#00e5ff';
            } else {
                this.telScroll.innerText = 'READY (2 FINGERS)';
                this.telScroll.style.color = '#00ff66';
            }
        }

        // Action Status Tag
        if (this.telAction) {
            if (data.action) {
                this.telAction.innerText = data.action.replace('_', ' ').toUpperCase();
                this.telAction.style.background = 'rgba(0, 255, 204, 0.25)';
                this.telAction.style.color = '#00ffcc';
            } else if (data.is_pinch) {
                this.telAction.innerText = 'DRAG & DROP';
                this.telAction.style.background = 'rgba(255, 0, 255, 0.25)';
                this.telAction.style.color = '#ff00ff';
            } else if (data.gesture === 'scroll') {
                this.telAction.innerText = 'SCROLLING';
                this.telAction.style.background = 'rgba(0, 229, 255, 0.25)';
                this.telAction.style.color = '#00e5ff';
            } else {
                this.telAction.innerText = 'IDLE';
                this.telAction.style.background = 'rgba(255, 255, 255, 0.06)';
                this.telAction.style.color = '#8c97b8';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MouseDashboardController();
});
