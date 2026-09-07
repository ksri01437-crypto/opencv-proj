// Client-Side Browser MediaPipe Vision & Gesture Engine
class ClientMediaPipeEngine {
    constructor() {
        this.video = document.getElementById('webcam-fallback-video');
        this.canvas = document.getElementById('webcam-fallback-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.feedImg = document.getElementById('webcam-feed');

        this.hands = null;
        this.faceMesh = null;
        this.camera = null;

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
    }

    async init() {
        if (typeof Hands === 'undefined' || typeof FaceMesh === 'undefined') {
            console.log("MediaPipe CDN scripts loading...");
            setTimeout(() => this.init(), 1000);
            return;
        }

        try {
            // Setup MediaPipe Hands
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

            // Setup MediaPipe Face Mesh
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

            // Start User Webcam
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' }
                });
                this.video.srcObject = stream;
                await this.video.play();

                this.canvas.width = 320;
                this.canvas.height = 240;

                this.startFrameLoop();
                console.log("Client-side MediaPipe webcam tracking started successfully.");
            }
        } catch (e) {
            console.warn("Client MediaPipe initialization error (backend fallback active):", e);
        }
    }

    async startFrameLoop() {
        const processFrame = async () => {
            if (this.video.readyState >= 2) {
                await this.hands.send({ image: this.video });
                await this.faceMesh.send({ image: this.video });
                this.drawWebcamOverlay();
            }
            requestAnimationFrame(processFrame);
        };
        requestAnimationFrame(processFrame);
    }

    onHandResults(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            this.lastHandLandmarks = null;
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        this.lastHandLandmarks = landmarks;

        const indexTip = landmarks[8];
        const wrist = landmarks[0];

        // Mirrored x coordinate
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

        // Swipe History & Velocity Detection
        this.handHistory.push({ x: rawX, y: rawY, t: now });
        this.handHistory = this.handHistory.filter(p => now - p.t <= 220);

        if (this.handHistory.length >= 3 && now > this.swipeCooldown) {
            const pOld = this.handHistory[0];
            const pNew = this.handHistory[this.handHistory.length - 1];
            const dt = (pNew.t - pOld.t) / 1000;

            if (dt > 0.04) {
                const dx = pNew.x - pOld.x;
                const dy = pNew.y - pOld.y;
                const dist = Math.hypot(dx, dy);
                const speed = dist / dt;

                if (speed > 1.1 && dist > 0.07) {
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

        // Send payload to UI Controller
        if (typeof ui !== 'undefined') {
            ui.handleGestureData({
                pointer: this.smoothedPointer,
                gesture: gesture,
                direction: direction,
                swipe_line: swipeLine
            });
        }
    }

    onFaceResults(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            this.lastFaceLandmarks = null;
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        this.lastFaceLandmarks = landmarks;

        const w = 320, h = 240;
        const leftEyeIndices = [362, 385, 387, 263, 373, 380];
        const rightEyeIndices = [33, 160, 158, 133, 153, 144];

        const leftEar = this.computeEAR(landmarks, leftEyeIndices, w, h);
        const rightEar = this.computeEAR(landmarks, rightEyeIndices, w, h);

        const isLeftClosed = leftEar < this.earThreshold;
        const isRightClosed = rightEar < this.earThreshold;
        const now = Date.now();

        let action = null;

        // Both Eyes Closed -> Pause
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

        if (typeof ui !== 'undefined') {
            ui.handleGestureData({
                left_eye: isLeftClosed ? 'closed' : 'open',
                right_eye: isRightClosed ? 'closed' : 'open',
                left_ear: leftEar.toFixed(3),
                right_ear: rightEar.toFixed(3),
                action: action
            });
        }
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

    drawWebcamOverlay() {
        if (!this.ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.save();
        // Mirror horizontally
        this.ctx.translate(w, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, 0, 0, w, h);

        // Draw Hand Skeleton
        if (this.lastHandLandmarks) {
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
            this.ctx.lineWidth = 2;

            for (let lm of this.lastHandLandmarks) {
                this.ctx.beginPath();
                this.ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Highlight index tip
            const indexTip = this.lastHandLandmarks[8];
            this.ctx.beginPath();
            this.ctx.arc(indexTip.x * w, indexTip.y * h, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fill();
        }

        // Draw Eye Indicators
        if (this.lastFaceLandmarks) {
            const leftEye = this.lastFaceLandmarks[362];
            const rightEye = this.lastFaceLandmarks[33];

            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.arc(leftEye.x * w, leftEye.y * h, 6, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(rightEye.x * w, rightEye.y * h, 6, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Update image src for floating top-right panel
        if (this.feedImg && (!ui || !ui.isConnected)) {
            this.feedImg.src = this.canvas.toDataURL('image/jpeg', 0.65);
        }
    }
}

const clientMP = new ClientMediaPipeEngine();
clientMP.init();
