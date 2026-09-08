// 100% Hand-Controlled MediaPipe Vision & Camera Overlay Engine (No Eye/Face Tracking)
class ClientMediaPipeEngine {
    constructor() {
        this.video = document.getElementById('webcam-video');
        this.overlayCanvas = document.getElementById('camera-overlay-canvas');
        this.ctx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

        this.hands = null;
        this.stream = null;

        // Coordinate Smoothing
        this.smoothedPointer = null;
        this.smoothingFactor = 0.35;

        // Swipe Tracking History
        this.handHistory = [];
        this.swipeCooldown = 0;

        // Gesture State Management
        this.lastHandLandmarks = null;
        this.currentGesture = 'none';
        this.isPinching = false;
        this.pinchStartTime = 0;

        // Cooldowns for discrete actions
        this.actionCooldownUntil = 0;
        this.fistTriggered = false;
        this.peaceTriggered = false;
        this.pinchTriggered = false;

        this.isCameraActive = false;
        this.isLoopRunning = false;
        this.cameraError = null;

        // Callback hooks for UI and Dashboards
        this.onGestureData = null;
        this.onCameraStateChange = null;
    }

    async init() {
        this.video = document.getElementById('webcam-video');
        this.overlayCanvas = document.getElementById('camera-overlay-canvas');
        this.ctx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

        if (!this.video) return;

        // Ensure video element properties for mobile/desktop autoplay
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('muted', '');

        if (typeof Hands === 'undefined') {
            console.log("Waiting for MediaPipe Hands CDN script to load...");
            setTimeout(() => this.init(), 400);
            return;
        }

        try {
            // Initialize MediaPipe Hands
            if (!this.hands) {
                this.hands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.65,
                    minTrackingConfidence: 0.65
                });
                this.hands.onResults((results) => this.onHandResults(results));
            }

            // Start webcam camera stream
            await this.startCamera();

            if (!this.isLoopRunning) {
                this.isLoopRunning = true;
                this.startFrameLoop();
            }
        } catch (e) {
            console.warn("MediaPipe Hands initialization error:", e);
            this.cameraError = e.message || "Init Error";
            this.drawOverlay();
        }
    }

    async startCamera() {
        if (this.isCameraActive && this.stream) return true;

        this.cameraError = null;
        let stream = null;

        const constraintsList = [
            { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } },
            { video: { facingMode: 'user' } },
            { video: true }
        ];

        for (const constraints of constraintsList) {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (stream) break;
                }
            } catch (err) {
                console.warn("Constraint attempt failed:", constraints, err);
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    this.cameraError = "Permission Denied: Click lock icon in browser URL bar to allow camera";
                    break;
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    this.cameraError = "Camera in use: Close other apps/Python OpenCV using webcam";
                } else if (err.name === 'NotFoundError') {
                    this.cameraError = "No camera device detected on this system";
                    break;
                } else {
                    this.cameraError = err.message || "Camera access failed";
                }
            }
        }

        if (stream) {
            this.stream = stream;
            if (this.video) {
                this.video.srcObject = this.stream;
                try {
                    await this.video.play();
                } catch (playErr) {
                    console.log("Autoplay play() promise caught:", playErr);
                }
            }
            this.isCameraActive = true;
            this.cameraError = null;
            console.log("Webcam camera started successfully.");
            if (this.onCameraStateChange) this.onCameraStateChange(true);
            return true;
        } else {
            console.warn("Could not start webcam stream. Error:", this.cameraError);
            this.isCameraActive = false;
            if (this.onCameraStateChange) this.onCameraStateChange(false);
            this.drawOverlay();
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        this.isCameraActive = false;
        this.lastHandLandmarks = null;
        this.drawOverlay();
        console.log("Webcam camera stopped.");
        if (this.onCameraStateChange) this.onCameraStateChange(false);
    }

    async toggleCamera() {
        if (this.isCameraActive) {
            this.stopCamera();
            return false;
        } else {
            const success = await this.startCamera();
            return success;
        }
    }

    async startFrameLoop() {
        const processFrame = async () => {
            if (this.video && this.video.readyState >= 2 && this.isCameraActive && this.hands) {
                try {
                    await this.hands.send({ image: this.video });
                } catch (err) {
                    // Ignore frame drop errors
                }
                this.drawOverlay();
            } else if (!this.isCameraActive) {
                this.drawOverlay();
            }
            requestAnimationFrame(processFrame);
        };
        requestAnimationFrame(processFrame);
    }

    emitGestureData(data) {
        if (this.onGestureData) {
            this.onGestureData(data);
        }
        if (typeof ui !== 'undefined' && ui.handleGestureData) {
            ui.handleGestureData(data);
        }
    }

    onHandResults(results) {
        if (!this.isCameraActive) return;

        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            this.lastHandLandmarks = null;
            this.currentGesture = 'none';
            if (this.isPinching) {
                this.isPinching = false;
            }
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        this.lastHandLandmarks = landmarks;

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        const indexPip = landmarks[6];
        const middlePip = landmarks[10];
        const ringPip = landmarks[14];
        const pinkyPip = landmarks[18];

        const indexMcp = landmarks[5];
        const middleMcp = landmarks[9];
        const ringMcp = landmarks[13];
        const pinkyMcp = landmarks[17];

        // Mirrored X coordinate so moving right in real life moves cursor right
        const rawX = 1.0 - indexTip.x;
        const rawY = indexTip.y;

        // Exponential Coordinate Smoothing
        if (!this.smoothedPointer) {
            this.smoothedPointer = { x: rawX, y: rawY };
        } else {
            this.smoothedPointer.x = (1 - this.smoothingFactor) * this.smoothedPointer.x + this.smoothingFactor * rawX;
            this.smoothedPointer.y = (1 - this.smoothingFactor) * this.smoothedPointer.y + this.smoothingFactor * rawY;
        }

        const now = Date.now();
        let gesture = 'pointing';
        let action = null;
        let direction = null;
        let swipeLine = null;

        // --- 1. Finger Extension Analysis ---
        const isIndexExtended = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) * 1.15;
        const isMiddleExtended = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) * 1.15;
        const isRingExtended = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > Math.hypot(ringPip.x - wrist.x, ringPip.y - wrist.y) * 1.15;
        const isPinkyExtended = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > Math.hypot(pinkyPip.x - wrist.x, pinkyPip.y - wrist.y) * 1.15;

        // --- 2. Distances for Pinch Gestures ---
        const pinchIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const pinchMiddleDist = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);

        // --- 3. Check Fist Gesture ✊ (All 4 fingers curled) ---
        const tips = [8, 12, 16, 20];
        const mcps = [5, 9, 13, 17];
        let isFist = true;
        for (let i = 0; i < tips.length; i++) {
            const tip = landmarks[tips[i]];
            const mcp = landmarks[mcps[i]];
            const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const mcpDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
            if (tipDist > mcpDist * 1.25) {
                isFist = false;
                break;
            }
        }

        // --- 4. Gesture Priority Evaluation ---
        if (isFist) {
            gesture = 'fist';
            if (!this.fistTriggered && now > this.actionCooldownUntil) {
                action = 'toggle_control';
                this.fistTriggered = true;
                this.actionCooldownUntil = now + 650;
            }
        } else {
            this.fistTriggered = false;

            // Pinch (Index + Thumb) 👌 -> Left Click / Drag & Drop
            if (pinchIndexDist < 0.055) {
                gesture = 'pinch';
                this.isPinching = true;

                if (!this.pinchTriggered && now > this.actionCooldownUntil) {
                    action = 'left_click';
                    this.pinchTriggered = true;
                    this.actionCooldownUntil = now + 350;
                }
            } else {
                this.isPinching = false;
                this.pinchTriggered = false;

                // Peace Sign ✌️ (Index & Middle extended, Ring & Pinky curled) OR Middle-Thumb Pinch -> Right Click
                const isPeaceSign = isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended;
                const isMiddlePinch = pinchMiddleDist < 0.055;

                if (isPeaceSign || isMiddlePinch) {
                    gesture = 'peace';
                    if (!this.peaceTriggered && now > this.actionCooldownUntil) {
                        action = 'right_click';
                        this.peaceTriggered = true;
                        this.actionCooldownUntil = now + 500;
                    }
                } else {
                    this.peaceTriggered = false;

                    // Open Palm 🖐️ (All fingers extended)
                    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
                        gesture = 'open_palm';
                    } else if (isIndexExtended) {
                        // Pointing ☝
                        gesture = 'pointing';
                    }
                }
            }
        }

        this.currentGesture = gesture;

        // --- 5. Swipe History & Velocity Detection ✋ ---
        this.handHistory.push({ x: rawX, y: rawY, t: now });
        this.handHistory = this.handHistory.filter(p => now - p.t <= 220);

        if (this.handHistory.length >= 3 && now > this.swipeCooldown && gesture !== 'pinch' && !isFist) {
            const pOld = this.handHistory[0];
            const pNew = this.handHistory[this.handHistory.length - 1];
            const dt = (pNew.t - pOld.t) / 1000;

            if (dt > 0.04) {
                const dx = pNew.x - pOld.x;
                const dy = pNew.y - pOld.y;
                const dist = Math.hypot(dx, dy);
                const speed = dist / dt;

                if (speed > 0.95 && dist > 0.07) {
                    gesture = 'swipe';
                    this.swipeCooldown = now + 120;

                    if (Math.abs(dx) > 1.8 * Math.abs(dy)) {
                        direction = dx > 0 ? 'right' : 'left';
                    } else if (Math.abs(dy) > 1.8 * Math.abs(dx)) {
                        direction = dy > 0 ? 'down' : 'up';
                    } else {
                        direction = 'diagonal';
                    }

                    swipeLine = {
                        x1: pOld.x, y1: pOld.y,
                        x2: pNew.x, y2: pNew.y,
                        speed: speed.toFixed(2)
                    };
                }
            }
        }

        // Emit Unified Gesture & Pointer Telemetry
        this.emitGestureData({
            pointer: this.smoothedPointer,
            gesture: gesture,
            action: action,
            is_pinch: this.isPinching,
            direction: direction,
            swipe_line: swipeLine
        });
    }

    drawOverlay() {
        if (!this.overlayCanvas || !this.ctx) return;
        const w = (this.video && this.video.videoWidth) ? this.video.videoWidth : (this.overlayCanvas.width || 320);
        const h = (this.video && this.video.videoHeight) ? this.video.videoHeight : (this.overlayCanvas.height || 240);

        if (this.overlayCanvas.width !== w || this.overlayCanvas.height !== h) {
            this.overlayCanvas.width = w;
            this.overlayCanvas.height = h;
        }

        this.ctx.clearRect(0, 0, w, h);

        if (!this.isCameraActive) {
            this.ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
            this.ctx.fillRect(0, 0, w, h);
            
            // Invert scaleX so text is not rendered backwards on a mirrored canvas
            this.ctx.save();
            this.ctx.scale(-1, 1);

            this.ctx.fillStyle = '#ff3366';
            this.ctx.font = 'bold 13px Outfit, sans-serif';
            this.ctx.textAlign = 'center';
            
            if (this.cameraError) {
                this.ctx.fillText('⚠️ CAMERA NOTICE', -w / 2, h / 2 - 12);
                this.ctx.fillStyle = '#cbd5e1';
                this.ctx.font = '10px Outfit, sans-serif';
                if (this.cameraError.length > 32) {
                    this.ctx.fillText(this.cameraError.substring(0, 32), -w / 2, h / 2 + 6);
                    this.ctx.fillText(this.cameraError.substring(32, 64), -w / 2, h / 2 + 20);
                } else {
                    this.ctx.fillText(this.cameraError, -w / 2, h / 2 + 10);
                }
            } else {
                this.ctx.fillText('📷 CAMERA OFF', -w / 2, h / 2 - 6);
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.font = '11px Outfit, sans-serif';
                this.ctx.fillText('Click CAM button to enable', -w / 2, h / 2 + 14);
            }
            this.ctx.restore();
            return;
        }

        // Draw Hand Skeleton Connections & Bones
        if (this.lastHandLandmarks) {
            const connections = [
                // Thumb
                [0, 1], [1, 2], [2, 3], [3, 4],
                // Index
                [0, 5], [5, 6], [6, 7], [7, 8],
                // Middle
                [0, 9], [9, 10], [10, 11], [11, 12],
                // Ring
                [0, 13], [13, 14], [14, 15], [15, 16],
                // Pinky
                [0, 17], [17, 18], [18, 19], [19, 20],
                // Palm Base
                [5, 9], [9, 13], [13, 17]
            ];

            // Draw Skeleton Bones
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.65)';
            this.ctx.lineWidth = 3;
            for (let [i, j] of connections) {
                const p1 = this.lastHandLandmarks[i];
                const p2 = this.lastHandLandmarks[j];
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x * w, p1.y * h);
                this.ctx.lineTo(p2.x * w, p2.y * h);
                this.ctx.stroke();
            }

            // Draw Landmark Joints
            for (let i = 0; i < this.lastHandLandmarks.length; i++) {
                const lm = this.lastHandLandmarks[i];
                this.ctx.beginPath();
                this.ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.fill();
            }

            // Highlight Index Fingertip (#8) - Glowing Cursor Aim Tip
            const indexTip = this.lastHandLandmarks[8];
            this.ctx.beginPath();
            this.ctx.arc(indexTip.x * w, indexTip.y * h, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 12;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Highlight Thumb Tip (#4)
            const thumbTip = this.lastHandLandmarks[4];
            this.ctx.beginPath();
            this.ctx.arc(thumbTip.x * w, thumbTip.y * h, 7, 0, Math.PI * 2);
            this.ctx.fillStyle = this.isPinching ? '#ff00ff' : '#00ffcc';
            this.ctx.fill();

            // If pinching, draw connection line between thumb and index
            if (this.isPinching) {
                this.ctx.strokeStyle = '#ff00ff';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(thumbTip.x * w, thumbTip.y * h);
                this.ctx.lineTo(indexTip.x * w, indexTip.y * h);
                this.ctx.stroke();
            }
        }
    }
}

const clientMP = new ClientMediaPipeEngine();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => clientMP.init());
} else {
    clientMP.init();
}
