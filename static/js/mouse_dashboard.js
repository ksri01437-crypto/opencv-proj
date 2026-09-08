// Real Computer Mouse Control Dashboard Controller (100% Hand-Controlled)
class MouseDashboardController {
    constructor() {
        this.feedImg = document.getElementById('webcam-feed');
        this.telPos = document.getElementById('tel-cursor-pos');
        this.telHand = document.getElementById('tel-hand-status');
        this.telLeftClick = document.getElementById('tel-left-click');
        this.telRightClick = document.getElementById('tel-right-click');
        this.telAction = document.getElementById('tel-action');
        this.toggleBtn = document.getElementById('toggle-mouse-btn');
        this.cameraToggleBtn = document.getElementById('camera-toggle-btn');

        this.mouseEnabled = true;
        this.ws = null;

        this.initToggleBtn();
        this.initWebSocket();
        this.initClientMediaPipe();
    }

    initToggleBtn() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.mouseEnabled = !this.mouseEnabled;
                this.updateToggleUI();
            });
        }

        if (this.cameraToggleBtn) {
            this.cameraToggleBtn.addEventListener('click', async () => {
                if (typeof clientMP !== 'undefined') {
                    const isActive = await clientMP.toggleCamera();
                    this.updateCameraToggleUI(isActive);
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

    updateToggleUI() {
        if (this.mouseEnabled) {
            this.toggleBtn.className = 'toggle-btn active';
            this.toggleBtn.innerHTML = '<span class="dot-indicator green">●</span> MOUSE CONTROL: ACTIVE';
        } else {
            this.toggleBtn.className = 'toggle-btn inactive';
            this.toggleBtn.innerHTML = '<span class="dot-indicator red">●</span> MOUSE CONTROL: DISABLED';
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
            console.log("WebSocket connected to /ws/mouse for PyAutoGUI control.");
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMouseData(data);
            } catch (e) {
                console.error("Error parsing mouse socket data:", e);
            }
        };

        this.ws.onclose = () => {
            setTimeout(() => this.initWebSocket(), 2000);
        };
    }

    handleGestureData(data) {
        // Handle Fist toggle
        if (data.action === 'toggle_control' || data.gesture === 'fist') {
            if (data.action === 'toggle_control') {
                this.mouseEnabled = !this.mouseEnabled;
                this.updateToggleUI();
            }
        }

        // Forward client MediaPipe data over WebSocket for PyAutoGUI execution
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            data.mode = 'mouse';
            data.mouse_enabled = this.mouseEnabled;
            this.ws.send(JSON.stringify(data));
        }

        this.updateTelemetry(data);
    }

    handleMouseData(data) {
        if (data.frame && this.feedImg) {
            this.feedImg.src = data.frame;
        }

        this.updateTelemetry(data);
    }

    updateTelemetry(data) {
        if (data.pointer && this.telPos) {
            const screenX = Math.round(data.pointer.x * window.screen.width);
            const screenY = Math.round(data.pointer.y * window.screen.height);
            this.telPos.innerText = `X: ${screenX} | Y: ${screenY}`;
        }

        if (this.telHand) {
            if (data.gesture === 'pinch') {
                this.telHand.innerText = '👌 PINCH DRAGGING';
                this.telHand.style.color = '#ff00ff';
            } else if (data.gesture === 'peace') {
                this.telHand.innerText = '✌️ PEACE (RIGHT CLICK)';
                this.telHand.style.color = '#00ffcc';
            } else if (data.gesture === 'fist') {
                this.telHand.innerText = '✊ FIST (TOGGLE MOUSE)';
                this.telHand.style.color = '#ffcc00';
            } else if (data.gesture === 'open_palm') {
                this.telHand.innerText = '🖐️ OPEN PALM';
                this.telHand.style.color = '#00ff66';
            } else if (data.pointer) {
                this.telHand.innerText = '☝ MOVING OS CURSOR';
                this.telHand.style.color = '#00ffcc';
            } else {
                this.telHand.innerText = 'NO HAND DETECTED';
                this.telHand.style.color = '#8a93b0';
            }
        }

        // Pinch Left Click Status
        if (this.telLeftClick) {
            if (data.gesture === 'pinch' || data.action === 'left_click') {
                this.telLeftClick.innerText = '👌 ACTIVE (PINCH)';
                this.telLeftClick.style.color = '#ff00ff';
            } else {
                this.telLeftClick.innerText = 'READY (PINCH)';
                this.telLeftClick.style.color = '#00ff66';
            }
        }

        // Peace Right Click Status
        if (this.telRightClick) {
            if (data.gesture === 'peace' || data.action === 'right_click') {
                this.telRightClick.innerText = '✌️ ACTIVE (PEACE)';
                this.telRightClick.style.color = '#00ffcc';
            } else {
                this.telRightClick.innerText = 'READY (PEACE SIGN)';
                this.telRightClick.style.color = '#00ff66';
            }
        }

        // Action Status
        if (this.telAction) {
            if (data.action) {
                this.telAction.innerText = data.action.replace('_', ' ').toUpperCase();
                this.telAction.style.background = 'rgba(0, 255, 204, 0.2)';
                this.telAction.style.color = '#00ffcc';
            } else if (data.is_pinch) {
                this.telAction.innerText = 'DRAG & DROP';
                this.telAction.style.background = 'rgba(255, 0, 255, 0.2)';
                this.telAction.style.color = '#ff00ff';
            } else {
                this.telAction.innerText = 'IDLE';
                this.telAction.style.background = 'rgba(255, 255, 255, 0.08)';
                this.telAction.style.color = '#a0aabf';
            }
        }
    }
}

const mouseDash = new MouseDashboardController();
