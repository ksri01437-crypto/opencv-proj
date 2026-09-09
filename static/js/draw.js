// Flower Magic Canvas Engine - Black Screen Gesture Flower Drawing
class FlowerCanvasEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Drawing State
        this.selectedFlower = '🌸';
        this.brushSize = 48;
        this.lastPointerPos = null;
        this.isDrawing = false;
        this.rainbowIndex = 0;
        this.rainbowPalette = ['🌸', '🌹', '🌻', '🌺', '🌷', '🌼', '🏵️', '💐'];

        // Entities
        this.strokes = [];   // Array of { x1, y1, x2, y2, color, width }
        this.flowers = [];   // Array of blooming flower objects
        this.particles = []; // Sparkle/petal floating particles
        this.dissolveParticles = []; // Clear canvas dissolve effect particles

        // Sound setup
        this.lastSoundTime = 0;

        // UI elements
        this.virtualPointer = document.getElementById('virtual-pointer');
        this.webcamFeed = document.getElementById('webcam-feed');
        this.statusHand = document.getElementById('status-hand');
        this.statusBrush = document.getElementById('status-brush');
        this.statusAction = document.getElementById('status-action');
        this.progressCircle = document.getElementById('hover-progress-circle');

        this.hoveredElement = null;
        this.hoverStartTime = null;
        this.hoverDurationNeeded = 1200;

        this.initCanvasBackground();
        this.initToolbar();
        this.initClientMediaPipe();
        this.initMouseFallback();

        // Start render animation loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    resizeCanvas() {
        // Retain current drawing when resizing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            tempCtx.drawImage(this.canvas, 0, 0);
        }

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.initCanvasBackground();
        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
            this.ctx.drawImage(tempCanvas, 0, 0);
        }
    }

    initCanvasBackground() {
        this.ctx.fillStyle = '#050508'; // Deep Obsidian Black Screen
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    initToolbar() {
        // Start Modal Button
        const startBtn = document.getElementById('btn-start-draw');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const startModal = document.getElementById('start-modal');
                if (startModal) startModal.classList.add('hidden');
                if (this.virtualPointer) this.virtualPointer.classList.remove('hidden');
                this.isDrawing = true;
            });
        }

        // Flower Type Selector Buttons
        const flowerBtns = document.querySelectorAll('.flower-btn');
        flowerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                flowerBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedFlower = btn.getAttribute('data-flower') || '🌸';
                if (this.statusBrush) {
                    this.statusBrush.innerText = `${this.selectedFlower} BRUSH`;
                }
            });
        });

        // Brush Size Selector Buttons
        const sizeBtns = document.querySelectorAll('.size-btn');
        sizeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                sizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.brushSize = parseInt(btn.getAttribute('data-size') || '48', 10);
            });
        });

        // Clear Canvas Button
        const clearBtn = document.getElementById('btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCanvasWithBurst());
        }

        // Save Artwork PNG Button
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveArtwork());
        }

        // Camera Toggle Button
        const camToggleBtn = document.getElementById('camera-toggle-btn');
        if (camToggleBtn) {
            camToggleBtn.addEventListener('click', async () => {
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
        const btn = document.getElementById('camera-toggle-btn');
        if (!btn) return;
        if (active) {
            btn.className = 'cam-toggle-btn active';
            btn.innerHTML = '<span class="pulse-dot green">●</span> CAM: ON';
        } else {
            btn.className = 'cam-toggle-btn inactive';
            btn.innerHTML = '<span class="pulse-dot red">●</span> CAM: OFF';
        }
    }

    handleGestureData(data) {
        if (!data) return;

        // 1. Update Camera Feed
        if (data.frame && this.webcamFeed) {
            this.webcamFeed.src = data.frame;
        }

        // 2. Update Virtual Hand Pointer & Draw / Erase Flowers
        if (data.pointer) {
            const px = data.pointer.x * window.innerWidth;
            const py = data.pointer.y * window.innerHeight;

            if (this.virtualPointer) {
                this.virtualPointer.style.left = `${px}px`;
                this.virtualPointer.style.top = `${py}px`;
                this.virtualPointer.classList.remove('hidden');
            }

            // IF USER CLOSES WRIST ('fist' gesture) -> ONLY THEN ERASE FLOWERS
            if (data.gesture === 'fist') {
                this.eraseFlowersAt(px, py, Math.max(40, this.brushSize * 1.2));
            } else {
                // IF NOT CLOSED WRIST -> DO NOT ERASE, DRAW BLOOMING FLOWERS
                if (this.lastPointerPos) {
                    const dist = Math.hypot(px - this.lastPointerPos.x, py - this.lastPointerPos.y);
                    if (dist >= 8) {
                        this.addFlowerSegment(this.lastPointerPos.x, this.lastPointerPos.y, px, py);
                    }
                }
            }
            this.lastPointerPos = { x: px, y: py };

            this.checkHoverInteraction(px, py);
        } else {
            this.lastPointerPos = null;
            // Full clear if closed wrist fist is detected without active pointer target
            if (data.gesture === 'fist') {
                this.clearCanvasWithBurst();
            }
        }

        // 4. Pinch Gesture -> Select / Click
        if (data.gesture === 'pinch' || data.action === 'left_click') {
            this.triggerVirtualClick();
        }

        // 5. Update Telemetry Badges
        this.updateStatusBadges(data);
    }

    addFlowerSegment(x1, y1, x2, y2) {
        // Draw organic green vine stroke
        this.strokes.push({
            x1, y1, x2, y2,
            color: '#10b981',
            glow: '#059669',
            width: Math.max(3, this.brushSize * 0.12)
        });

        // Determine flower emoji
        let currentEmoji = this.selectedFlower;
        if (currentEmoji === '🌈') {
            currentEmoji = this.rainbowPalette[this.rainbowIndex % this.rainbowPalette.length];
            this.rainbowIndex++;
        }

        // Spawn blooming flower
        const rot = (Math.random() - 0.5) * 0.6;
        const sizeVar = this.brushSize * (0.8 + Math.random() * 0.4);

        this.flowers.push({
            x: x2,
            y: y2,
            emoji: currentEmoji,
            size: sizeVar,
            rotation: rot,
            scale: 0.1, // Grows from 0.1 to 1.0 (blooming animation)
            targetScale: 1.0,
            alpha: 1.0
        });

        // Create magic sparkle particles
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 120;
            this.particles.push({
                x: x2, y: y2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color: Math.random() > 0.5 ? '#ff99dd' : '#77ffff',
                alpha: 1.0,
                decay: 1.5
            });
        }

        // Play slice/bloom chime sound
        const now = Date.now();
        if (now - this.lastSoundTime > 120) {
            this.lastSoundTime = now;
            try { if (typeof sounds !== 'undefined') sounds.playSliceSound(); } catch (e) {}
        }
    }

    eraseFlowersAt(x, y, radius = 60) {
        let erasedAny = false;

        // 1. Remove flowers within radius of closed wrist (x, y)
        for (let i = this.flowers.length - 1; i >= 0; i--) {
            const f = this.flowers[i];
            const dist = Math.hypot(f.x - x, f.y - y);
            if (dist <= radius) {
                // Spawn small dissolve burst particle for visual feedback
                for (let k = 0; k < 2; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 40 + Math.random() * 100;
                    this.dissolveParticles.push({
                        x: f.x, y: f.y,
                        emoji: f.emoji,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        size: f.size * 0.5,
                        alpha: 1.0,
                        decay: 2.0,
                        rotation: f.rotation,
                        rotSpeed: (Math.random() - 0.5) * 4
                    });
                }
                this.flowers.splice(i, 1);
                erasedAny = true;
            }
        }

        // 2. Remove vine strokes near closed wrist (x, y)
        for (let i = this.strokes.length - 1; i >= 0; i--) {
            const s = this.strokes[i];
            const d1 = Math.hypot(s.x1 - x, s.y1 - y);
            const d2 = Math.hypot(s.x2 - x, s.y2 - y);
            const midX = (s.x1 + s.x2) / 2;
            const midY = (s.y1 + s.y2) / 2;
            const dMid = Math.hypot(midX - x, midY - y);

            if (d1 <= radius || d2 <= radius || dMid <= radius) {
                this.strokes.splice(i, 1);
                erasedAny = true;
            }
        }

        if (erasedAny) {
            const now = Date.now();
            if (now - this.lastSoundTime > 150) {
                this.lastSoundTime = now;
                try { if (typeof sounds !== 'undefined') sounds.playPopSound(); } catch (e) {}
            }
        }
    }

    clearCanvasWithBurst() {
        if (this.flowers.length === 0 && this.strokes.length === 0) return;

        // Create burst dissolve particles from existing flowers
        for (let f of this.flowers) {
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 80 + Math.random() * 250;
                this.dissolveParticles.push({
                    x: f.x, y: f.y,
                    emoji: f.emoji,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: f.size * 0.6,
                    alpha: 1.0,
                    decay: 1.2,
                    rotation: f.rotation,
                    rotSpeed: (Math.random() - 0.5) * 4
                });
            }
        }

        this.strokes = [];
        this.flowers = [];

        try { if (typeof sounds !== 'undefined') sounds.playBombSound(); } catch (e) {}
    }

    saveArtwork() {
        // Create an offscreen canvas to render clean black background + drawing
        const saveCanvas = document.createElement('canvas');
        saveCanvas.width = this.canvas.width;
        saveCanvas.height = this.canvas.height;
        const sCtx = saveCanvas.getContext('2d');

        // Black background
        sCtx.fillStyle = '#050508';
        sCtx.fillRect(0, 0, saveCanvas.width, saveCanvas.height);

        // Draw vines
        for (let s of this.strokes) {
            sCtx.beginPath();
            sCtx.moveTo(s.x1, s.y1);
            sCtx.lineTo(s.x2, s.y2);
            sCtx.lineWidth = s.width;
            sCtx.strokeStyle = s.color;
            sCtx.shadowColor = s.glow;
            sCtx.shadowBlur = 10;
            sCtx.lineCap = 'round';
            sCtx.stroke();
        }
        sCtx.shadowBlur = 0;

        // Draw flowers
        for (let f of this.flowers) {
            sCtx.save();
            sCtx.translate(f.x, f.y);
            sCtx.rotate(f.rotation);
            sCtx.font = `${f.size * f.scale}px serif`;
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillText(f.emoji, 0, 0);
            sCtx.restore();
        }

        // Branding watermark in bottom corner
        sCtx.font = '800 16px Outfit, sans-serif';
        sCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        sCtx.fillText('🌸 FLOWER CANVAS ART', 30, saveCanvas.height - 30);

        // Trigger PNG Download
        const link = document.createElement('a');
        link.download = `flower_drawing_${Date.now()}.png`;
        link.href = saveCanvas.toDataURL('image/png');
        link.click();
    }

    checkHoverInteraction(px, py) {
        const elem = document.elementFromPoint(px, py);
        const btn = elem ? elem.closest('.gesture-btn, .flower-btn, .size-btn') : null;

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
        if (this.hoveredElement) {
            this.hoveredElement.click();
            this.resetHover();
        }
    }

    updateStatusBadges(data) {
        if (this.statusHand) {
            if (data.gesture === 'fist') {
                this.statusHand.className = 'status-tag tag-fist';
                this.statusHand.innerText = '✊ CLOSED WRIST (ERASING)';
            } else if (data.gesture === 'pinch') {
                this.statusHand.className = 'status-tag tag-pinch';
                this.statusHand.innerText = '👌 PINCH (CLICK)';
            } else if (data.pointer) {
                this.statusHand.className = 'status-tag tag-pointing';
                this.statusHand.innerText = '☝ DRAWING FLOWERS';
            } else {
                this.statusHand.className = 'status-tag tag-idle';
                this.statusHand.innerText = 'NO HAND';
            }
        }

        if (this.statusAction) {
            this.statusAction.innerText = data.gesture === 'fist' ? 'ERASING FLOWERS' : 'ACTIVE';
        }
    }

    initMouseFallback() {
        let isMouseDown = false;
        let isRightClick = false;

        window.addEventListener('contextmenu', (e) => {
            if (e.target === this.canvas || (e.target.closest && e.target.closest('#draw-container'))) {
                e.preventDefault();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                const px = e.clientX;
                const py = e.clientY;
                if (this.virtualPointer) {
                    this.virtualPointer.style.left = `${px}px`;
                    this.virtualPointer.style.top = `${py}px`;
                    this.virtualPointer.classList.remove('hidden');
                }

                if (isRightClick || e.shiftKey) {
                    // Closed Wrist / Right-Click / Shift simulation -> ERASE FLOWERS ONLY
                    this.eraseFlowersAt(px, py, Math.max(40, this.brushSize * 1.2));
                } else {
                    // Open hand / Normal drag -> DO NOT ERASE, DRAW FLOWERS
                    if (this.lastPointerPos) {
                        const dist = Math.hypot(px - this.lastPointerPos.x, py - this.lastPointerPos.y);
                        if (dist >= 8) {
                            this.addFlowerSegment(this.lastPointerPos.x, this.lastPointerPos.y, px, py);
                        }
                    }
                }
                this.lastPointerPos = { x: px, y: py };
            }
        });

        window.addEventListener('mousedown', (e) => {
            // Avoid drawing when clicking top toolbar buttons
            if (e.clientY < 75) return;
            isMouseDown = true;
            isRightClick = (e.button === 2);
            this.lastPointerPos = { x: e.clientX, y: e.clientY };

            if (isRightClick || e.shiftKey) {
                this.eraseFlowersAt(e.clientX, e.clientY, Math.max(40, this.brushSize * 1.2));
            }
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
            isRightClick = false;
            this.lastPointerPos = null;
        });

        // Touch support
        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                const t = e.touches[0];
                if (this.lastPointerPos) {
                    const dist = Math.hypot(t.clientX - this.lastPointerPos.x, t.clientY - this.lastPointerPos.y);
                    if (dist >= 8) {
                        this.addFlowerSegment(this.lastPointerPos.x, this.lastPointerPos.y, t.clientX, t.clientY);
                    }
                }
                this.lastPointerPos = { x: t.clientX, y: t.clientY };
            }
        }, { passive: true });

        window.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0] && e.touches[0].clientY > 75) {
                isMouseDown = true;
                this.lastPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            isMouseDown = false;
            this.lastPointerPos = null;
        });
    }

    update(dt) {
        // Animate blooming flower growth scale (scale -> 1.0)
        for (let f of this.flowers) {
            if (f.scale < f.targetScale) {
                f.scale = Math.min(f.targetScale, f.scale + dt * 4.0);
            }
        }

        // Animate Sparkle Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay * dt;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Animate Clear Dissolve Particles
        for (let i = this.dissolveParticles.length - 1; i >= 0; i--) {
            const dp = this.dissolveParticles[i];
            dp.x += dp.vx * dt;
            dp.y += dp.vy * dt;
            dp.rotation += dp.rotSpeed * dt;
            dp.alpha -= dp.decay * dt;
            if (dp.alpha <= 0) {
                this.dissolveParticles.splice(i, 1);
            }
        }
    }

    draw() {
        // Clear black canvas
        this.ctx.fillStyle = '#050508';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Vine Strokes
        for (let s of this.strokes) {
            this.ctx.beginPath();
            this.ctx.moveTo(s.x1, s.y1);
            this.ctx.lineTo(s.x2, s.y2);
            this.ctx.lineWidth = s.width;
            this.ctx.strokeStyle = s.color;
            this.ctx.shadowColor = s.glow;
            this.ctx.shadowBlur = 12;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }
        this.ctx.shadowBlur = 0;

        // 2. Draw Blooming Flowers
        for (let f of this.flowers) {
            this.ctx.save();
            this.ctx.translate(f.x, f.y);
            this.ctx.rotate(f.rotation);
            this.ctx.font = `${f.size * f.scale}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(f.emoji, 0, 0);
            this.ctx.restore();
        }

        // 3. Draw Sparkle Particles
        for (let p of this.particles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // 4. Draw Dissolve Burst Particles
        for (let dp of this.dissolveParticles) {
            this.ctx.save();
            this.ctx.translate(dp.x, dp.y);
            this.ctx.rotate(dp.rotation);
            this.ctx.font = `${dp.size}px serif`;
            this.ctx.globalAlpha = Math.max(0, dp.alpha);
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(dp.emoji, 0, 0);
            this.ctx.restore();
        }
        this.ctx.globalAlpha = 1.0;
    }

    loop(nowTime) {
        const dt = Math.min(0.1, (nowTime - this.lastFrameTime) / 1000);
        this.lastFrameTime = nowTime;

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const flowerCanvas = new FlowerCanvasEngine('flower-canvas');
