// Real Computer Mouse Control Dashboard Controller
class MouseDashboardController {
    constructor() {
        this.feedImg = document.getElementById('webcam-feed');
        this.telPos = document.getElementById('tel-cursor-pos');
        this.telHand = document.getElementById('tel-hand-status');
        this.telLeftEye = document.getElementById('tel-left-eye');
        this.telRightEye = document.getElementById('tel-right-eye');
        this.telAction = document.getElementById('tel-action');
        this.toggleBtn = document.getElementById('toggle-mouse-btn');

        this.mouseEnabled = true;
        this.ws = null;

        this.initToggleBtn();
        this.initWebSocket();
    }

    initToggleBtn() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.mouseEnabled = !this.mouseEnabled;
                this.updateToggleUI();
            });
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
        // Intercept data from client_mediapipe.js and forward to backend for PyAutoGUI execution
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
        if (data.pointer) {
            const screenX = Math.round(data.pointer.x * window.screen.width);
            const screenY = Math.round(data.pointer.y * window.screen.height);
            this.telPos.innerText = `X: ${screenX} | Y: ${screenY}`;
        }

        if (data.gesture === 'pinch') {
            this.telHand.innerText = '👌 PINCH DRAGGING';
        } else if (data.pointer) {
            this.telHand.innerText = '☝ MOVING OS CURSOR';
        } else {
            this.telHand.innerText = 'NO HAND';
        }

        if (data.left_eye === 'closed') {
            this.telLeftEye.innerText = '👁️ CLOSED (WINK)';
            this.telLeftEye.style.color = '#ff0066';
        } else {
            this.telLeftEye.innerText = '👁️ OPEN';
            this.telLeftEye.style.color = '#00ff66';
        }

        if (data.right_eye === 'closed') {
            this.telRightEye.innerText = '👁️ CLOSED (WINK)';
            this.telRightEye.style.color = '#ff0066';
        } else {
            this.telRightEye.innerText = '👁️ OPEN';
            this.telRightEye.style.color = '#00ff66';
        }

        if (data.action) {
            this.telAction.innerText = data.action.toUpperCase();
            this.telAction.style.background = 'rgba(0, 255, 204, 0.2)';
            this.telAction.style.color = '#00ffcc';
        } else {
            this.telAction.innerText = 'IDLE';
            this.telAction.style.background = 'rgba(255, 255, 255, 0.08)';
            this.telAction.style.color = '#a0aabf';
        }
    }
}

const mouseDash = new MouseDashboardController();

// Override client_mediapipe handler when on mouse dashboard
if (typeof ui !== 'undefined') {
    ui.handleGestureData = (data) => mouseDash.handleGestureData(data);
}
