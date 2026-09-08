// Client-Side Browser MediaPipe Vision & Camera Overlay Engine
class ClientMediaPipeEngine {
    constructor() {
        this.video = document.getElementById('webcam-video');
        this.overlayCanvas = document.getElementById('camera-overlay-canvas');
        this.ctx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

        this.hands = null;
        this.faceMesh = null;
        this.stream = null;

        // Coordinate Smoothing
        this.smoothedPointer = null;
        this.smoothingFactor = 0.35;

        // Swipe Tracking History
        this.handHistory = [];
        this.swipeCooldown = 0;

        // Eye Tracking State
        this.earThreshold = 0.20;
        this.leftEyeCloseStart = null;
        this.rightEyeCloseStart = null;
        this.bothEyesCloseStart = null;

        this.leftEyeTriggered = false;
        this.rightEyeTriggered = false;
        this.bothEyesTriggered = false;
        this.actionCooldownUntil = 0;

        this.lastHandLandmarks = null;
        this.lastFaceLandmarks = null;

        this.isCameraActive = false;
        this.isLoopRunning = false;

        // Callback hooks for UI and Dashboards
        this.onGestureData = null;
        this.onCameraStateChange = null;
    }

    async init() {
        if (!this.video) return;

        if (typeof Hands === 'undefined' || typeof FaceMesh === 'undefined') {
            console.log("Waiting for MediaPipe CDN scripts to load...");
            setTimeout(() => this.init(), 600);
            return;
        }

        try {
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            this.hands.onResults((results) => this.onHandResults(results));

            // Initialize MediaPipe Face Mesh
            this.faceMesh = new FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            this.faceMesh.onResults((results) => this.onFaceResults(results));

            // Start webcam camera stream
            await this.startCamera();

            if (!this.isLoopRunning) {
                this.isLoopRunning = true;
                this.startFrameLoop();
            }
        } catch (e) {
            console.warn("Webcam camera initialization error:", e);
        }
    }

    async startCamera() {
        if (this.isCameraActive) return true;

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
                });
                if (this.video) {
                    this.video.srcObject = this.stream;
                    await this.video.play();
                }
                this.isCameraActive = true;
                console.log("Webcam camera started successfully.");
                if (this.onCameraStateChange) this.onCameraStateChange(true);
                return true;
            }
        } catch (e) {
            console.warn("Error starting webcam stream:", e);
            this.isCameraActive = false;
            if (this.onCameraStateChange) this.onCameraStateChange(false);
            return false;
        }
    }

    stopCamera() {
        if (!this.isCameraActive) return;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        this.isCameraActive = false;
        this.lastHandLandmarks = null;
        this.lastFaceLandmarks = null;
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
            if (this.video && this.video.readyState >= 2 && this.isCameraActive && this.hands && this.faceMesh) {
                try {
                    await this.hands.send({ image: this.video });
                    await this.faceMesh.send({ image: this.video });
                } catch (err) {
                    // Ignore frame drop errors when stopping camera
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
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        this.lastHandLandmarks = landmarks;

        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        const wrist = landmarks[0];

        // Mirrored x coordinate so moving right in real life moves cursor right
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
        let direction = null;
        let swipeLine = null;

        // Check Fist Gesture
        const tips = [8, 12, 16, 20];
        const mcps = [5, 9, 13, 17];
        let isFist = true;
        for (let i = 0; i < tips.length; i++) {
            const tip = landmarks[tips[i]];
            const mcp = landmarks[mcps[i]];
            const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const mcpDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
            if (tipDist > mcpDist * 1.3) {
                isFist = false;
                break;
            }
        }

        if (isFist) {
            gesture = 'fist';
        }

        // Check Pinch Dragging Gesture (Thumb Tip #4 to Index Tip #8)
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        if (pinchDist < 0.055 && !isFist) {
            gesture = 'pinch';
        }

        // Swipe History & Velocity Detection
        this.handHistory.push({ x: rawX, y: rawY, t: now });
        this.handHistory = this.handHistory.filter(p => now - p.t <= 220);

        if (this.handHistory.length >= 3 && now > this.swipeCooldown && gesture !== 'pinch') {
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

        this.emitGestureData({
            pointer: this.smoothedPointer,
            gesture: gesture,
            direction: direction,
            swipe_line: swipeLine
        });
    }

    onFaceResults(results) {
        if (!this.isCameraActive) return;

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            this.lastFaceLandmarks = null;
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        this.lastFaceLandmarks = landmarks;

        const w = (this.video && this.video.videoWidth) ? this.video.videoWidth : 320;
        const h = (this.video && this.video.videoHeight) ? this.video.videoHeight : 240;
        const leftEyeIndices = [362, 385, 387, 263, 373, 380];
        const rightEyeIndices = [33, 160, 158, 133, 153, 144];

        const leftEar = this.computeEAR(landmarks, leftEyeIndices, w, h);
        const rightEar = this.computeEAR(landmarks, rightEyeIndices, w, h);

        const isLeftClosed = leftEar < this.earThreshold;
        const isRightClosed = rightEar < this.earThreshold;
        const now = Date.now();

        let action = null;

        // Both Eyes Closed -> Pause / Toggle
        if (isLeftClosed && isRightClosed) {
            if (!this.bothEyeCloseStart) this.bothEyeCloseStart = now;
            const duration = now - this.bothEyeCloseStart;
            if (duration >= 450 && !this.bothEyesTriggered && now > this.actionCooldownUntil) {
                action = 'both_eyes_closed';
                this.bothEyesTriggered = true;
                this.actionCooldownUntil = now + 600;
            }
        } else {
            this.bothEyeCloseStart = null;
            if (!isLeftClosed && !isRightClosed) this.bothEyesTriggered = false;
        }

        // Left Eye Closed (Wink -> Left Click)
        if (isLeftClosed && !isRightClosed) {
            if (!this.leftEyeCloseStart) this.leftEyeCloseStart = now;
            const duration = now - this.leftEyeCloseStart;
            if (duration >= 280 && !this.leftEyeTriggered && now > this.actionCooldownUntil) {
                action = 'left_click';
                this.leftEyeTriggered = true;
                this.actionCooldownUntil = now + 450;
            }
        } else {
            if (!isLeftClosed) {
                this.leftEyeCloseStart = null;
                this.leftEyeTriggered = false;
            }
        }

        // Right Eye Closed (Wink -> Right Click)
        if (isRightClosed && !isLeftClosed) {
            if (!this.rightEyeCloseStart) this.rightEyeCloseStart = now;
            const duration = now - this.rightEyeCloseStart;
            if (duration >= 280 && !this.rightEyeTriggered && now > this.actionCooldownUntil) {
                action = 'right_click';
                this.rightEyeTriggered = true;
                this.actionCooldownUntil = now + 450;
            }
        } else {
            if (!isRightClosed) {
                this.rightEyeCloseStart = null;
                this.rightEyeTriggered = false;
            }
        }

        this.emitGestureData({
            left_eye: isLeftClosed ? 'closed' : 'open',
            right_eye: isRightClosed ? 'closed' : 'open',
            left_ear: leftEar.toFixed(3),
            right_ear: rightEar.toFixed(3),
            action: action
        });
    }

    computeEAR(landmarks, indices, w, h) {
        try {
            const p1 = { x: landmarks[indices[0]].x * w, y: landmarks[indices[0]].y * h };
            const p2 = { x: landmarks[indices[1]].x * w, y: landmarks[indices[1]].y * h };
            const p3 = { x: landmarks[indices[2]].x * w, y: landmarks[indices[2]].y * h };
            const p4 = { x: landmarks[indices[3]].x * w, y: landmarks[indices[3]].y * h };
            const p5 = { x: landmarks[indices[4]].x * w, y: landmarks[indices[4]].y * h };
            const p6 = { x: landmarks[indices[5]].x * w, y: landmarks[indices[5]].y * h };

            const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
            const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
            const hDist = Math.hypot(p1.x - p4.x, p1.y - p4.y);

            if (hDist === 0) return 0.30;
            return (v1 + v2) / (2.0 * hDist);
        } catch (e) {
            return 0.30;
        }
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
            this.ctx.fillStyle = 'rgba(10, 12, 20, 0.95)';
            this.ctx.fillRect(0, 0, w, h);
            this.ctx.fillStyle = '#ff3366';
            this.ctx.font = 'bold 14px Outfit, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('📷 CAMERA OFF', w / 2, h / 2);
            return;
        }

        // Draw Hand Skeleton Connections
        if (this.lastHandLandmarks) {
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.85)';
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.lineWidth = 3;

            for (let lm of this.lastHandLandmarks) {
                this.ctx.beginPath();
                this.ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Highlight Index Fingertip (#8)
            const indexTip = this.lastHandLandmarks[8];
            this.ctx.beginPath();
            this.ctx.arc(indexTip.x * w, indexTip.y * h, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }

        // Draw Eye Indicators
        if (this.lastFaceLandmarks) {
            const leftEye = this.lastFaceLandmarks[362];
            const rightEye = this.lastFaceLandmarks[33];

            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.arc(leftEye.x * w, leftEye.y * h, 8, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(rightEye.x * w, rightEye.y * h, 8, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
}

const clientMP = new ClientMediaPipeEngine();
clientMP.init();
