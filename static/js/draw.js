// Flower Magic Canvas Engine - Black Screen Gesture Flower Drawing
class FlowerCanvasEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Drawing State & Modes
        this.selectedFlower = '🌸';
        this.brushSize = 44;
        this.drawMode = 'pinch'; // 'pinch' (hover to aim, pinch to write) or 'freehand' (continuous)
        this.isEraserActive = false;
        this.lastPointerPos = null;
        this.isDrawing = false;
        this.rainbowIndex = 0;
        this.rainbowPalette = ['🌸', '🌹', '🌻', '🌺', '🌷', '🌼', '🏵️', '💐'];

        // Spacing tracker for clean, elegant flower blooming
        this.distSinceLastFlower = 0;

        // Undo History Stack
        this.history = [];
        this.currentStroke = null;

        // Entities
        this.strokes = [];   // Array of { x1, y1, x2, y2, color, glow, width }
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

        // Draw Mode Selector Buttons (Pinch vs Freehand)
        const pinchModeBtn = document.getElementById('mode-pinch');
        const freehandModeBtn = document.getElementById('mode-freehand');

        if (pinchModeBtn && freehandModeBtn) {
            pinchModeBtn.addEventListener('click', () => {
                this.drawMode = 'pinch';
                this.isEraserActive = false;
                pinchModeBtn.classList.add('active');
                freehandModeBtn.classList.remove('active');
                const eraserBtn = document.getElementById('btn-eraser');
                if (eraserBtn) eraserBtn.classList.remove('active');
                if (this.statusAction) this.statusAction.innerText = 'PINCH TO DRAW';
            });

            freehandModeBtn.addEventListener('click', () => {
                this.drawMode = 'freehand';
                this.isEraserActive = false;
                freehandModeBtn.classList.add('active');
                pinchModeBtn.classList.remove('active');
                const eraserBtn = document.getElementById('btn-eraser');
                if (eraserBtn) eraserBtn.classList.remove('active');
                if (this.statusAction) this.statusAction.innerText = 'FLOW DRAWING';
            });
        }

        // Undo Button
        const undoBtn = document.getElementById('btn-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }

        // Eraser Toggle Button
        const eraserBtn = document.getElementById('btn-eraser');
        if (eraserBtn) {
            eraserBtn.addEventListener('click', () => {
                this.isEraserActive = !this.isEraserActive;
                eraserBtn.classList.toggle('active', this.isEraserActive);
                if (this.statusAction) {
                    this.statusAction.innerText = this.isEraserActive ? 'ERASER ACTIVE' : (this.drawMode === 'pinch' ? 'PINCH TO DRAW' : 'DRAWING');
                }
                if (this.virtualPointer) {
                    const ring = this.virtualPointer.querySelector('.pointer-ring');
                    if (ring) ring.classList.toggle('eraser-ring', this.isEraserActive);
                }
            });
        }

        // Keyboard Shortcut: Z or Ctrl+Z for Undo
        window.addEventListener('keydown', (e) => {
            if (e.key === 'z' || e.key === 'Z') {
                this.undo();
            }
        });

        // Flower Type Selector Buttons
        const flowerBtns = document.querySelectorAll('.flower-btn');
        flowerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                flowerBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedFlower = btn.getAttribute('data-flower') || '🌸';
                if (this.isEraserActive && eraserBtn) {
                    this.isEraserActive = false;
                    eraserBtn.classList.remove('active');
                }
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
                this.brushSize = parseInt(btn.getAttribute('data-size') || '44', 10);
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

                const ring = this.virtualPointer.querySelector('.pointer-ring');
                if (ring) {
                    ring.classList.toggle('eraser-ring', data.gesture === 'fist' || this.isEraserActive);
                }
            }

            const shouldErase = data.gesture === 'fist' || this.isEraserActive;
            const isPinching = data.gesture === 'pinch' || data.is_pinch || data.action === 'left_click';
            const shouldDraw = !shouldErase && (this.drawMode === 'freehand' || isPinching);

            if (shouldErase) {
                this.endStroke();
                this.eraseFlowersAt(px, py, Math.max(45, this.brushSize * 1.3));
                this.lastPointerPos = { x: px, y: py };
            } else if (shouldDraw) {
                if (this.lastPointerPos) {
                    this.continueStroke(this.lastPointerPos.x, this.lastPointerPos.y, px, py);
                } else {
                    this.startStroke(px, py);
                }
                this.lastPointerPos = { x: px, y: py };
            } else {
                // Free Pointer Hover / Aim Mode (not drawing)
                this.endStroke();
                this.lastPointerPos = { x: px, y: py };
            }

            this.checkHoverInteraction(px, py);
        } else {
            this.endStroke();
            this.lastPointerPos = null;
        }

        // 3. Peace sign gesture ✌️ -> Quick Undo!
        if (data.gesture === 'peace') {
            const now = Date.now();
            if (now - this.lastSoundTime > 400) {
                this.undo();
                this.lastSoundTime = now;
            }
        }

        // 4. Update Telemetry Badges
        this.updateStatusBadges(data);
    }

    startStroke(x, y) {
        this.currentStroke = { vines: [], flowers: [] };
        this.distSinceLastFlower = 0;
        this.lastPointerPos = { x, y };
        // Plant initial flower at stroke start
        this.spawnFlowerAt(x, y);
    }

    continueStroke(x1, y1, x2, y2) {
        if (!this.currentStroke) {
            this.startStroke(x1, y1);
        }

        const dist = Math.hypot(x2 - x1, y2 - y1);
        if (dist < 3) return;

        // 1. Draw smooth bioluminescent vine segment
        const vine = {
            x1, y1, x2, y2,
            color: '#10b981',
            glow: '#059669',
            width: Math.max(2.5, this.brushSize * 0.12)
        };
        this.strokes.push(vine);
        if (this.currentStroke) {
            this.currentStroke.vines.push(vine);
        }

        // 2. Add leaves / flower with SMART DISTANCE SPACING
        // Prevents ugly dense pileups of 60 flowers in 100px!
        this.distSinceLastFlower += dist;
        const targetSpacing = Math.max(42, this.brushSize * 1.15);

        if (this.distSinceLastFlower >= targetSpacing) {
            this.distSinceLastFlower = 0;
            this.spawnFlowerAt(x2, y2);
        } else if (this.distSinceLastFlower >= targetSpacing * 0.5 && Math.random() < 0.25) {
            // Sprout a natural green leaf along the vine
            this.spawnLeafAt(x2, y2);
        }

        // Magic sparkle particles
        if (Math.random() < 0.35) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 25 + Math.random() * 80;
            this.particles.push({
                x: x2, y: y2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 3,
                color: Math.random() > 0.5 ? '#ff99dd' : '#77ffff',
                alpha: 1.0,
                decay: 1.5
            });
        }
    }

    endStroke() {
        if (this.currentStroke && (this.currentStroke.vines.length > 0 || this.currentStroke.flowers.length > 0)) {
            this.history.push(this.currentStroke);
            if (this.history.length > 60) this.history.shift();
            this.currentStroke = null;
        }
        this.distSinceLastFlower = 0;
    }

    spawnFlowerAt(x, y) {
        let currentEmoji = this.selectedFlower;
        if (currentEmoji === '🌈') {
            currentEmoji = this.rainbowPalette[this.rainbowIndex % this.rainbowPalette.length];
            this.rainbowIndex++;
        }

        const rot = (Math.random() - 0.5) * 0.5;
        const sizeVar = this.brushSize * (0.85 + Math.random() * 0.3);

        const flower = {
            x, y,
            emoji: currentEmoji,
            size: sizeVar,
            rotation: rot,
            scale: 0.1,
            targetScale: 1.0,
            alpha: 1.0
        };

        this.flowers.push(flower);
        if (this.currentStroke) {
            this.currentStroke.flowers.push(flower);
        }

        const now = Date.now();
        if (now - this.lastSoundTime > 120) {
            this.lastSoundTime = now;
            try { if (typeof sounds !== 'undefined') sounds.playSliceSound(); } catch (e) {}
        }
    }

    spawnLeafAt(x, y) {
        const leafEmoji = Math.random() > 0.5 ? '🌿' : '🍃';
        const flower = {
            x, y,
            emoji: leafEmoji,
            size: this.brushSize * 0.65,
            rotation: (Math.random() - 0.5) * 1.2,
            scale: 0.2,
            targetScale: 0.85,
            alpha: 0.95
        };

        this.flowers.push(flower);
        if (this.currentStroke) {
            this.currentStroke.flowers.push(flower);
        }
    }

    undo() {
        if (this.history.length === 0) return;
        const lastStroke = this.history.pop();
        if (!lastStroke) return;

        // Remove vines
        if (lastStroke.vines && lastStroke.vines.length > 0) {
            const vineSet = new Set(lastStroke.vines);
            this.strokes = this.strokes.filter(v => !vineSet.has(v));
        }

        // Remove flowers with dissolve effect
        if (lastStroke.flowers && lastStroke.flowers.length > 0) {
            const flowerSet = new Set(lastStroke.flowers);
            for (let f of lastStroke.flowers) {
                for (let k = 0; k < 2; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 40 + Math.random() * 90;
                    this.dissolveParticles.push({
                        x: f.x, y: f.y,
                        emoji: f.emoji,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        size: f.size * 0.55,
                        alpha: 1.0,
                        decay: 1.8,
                        rotation: f.rotation,
                        rotSpeed: (Math.random() - 0.5) * 3
                    });
                }
            }
            this.flowers = this.flowers.filter(f => !flowerSet.has(f));
        }

        try { if (typeof sounds !== 'undefined') sounds.playPopSound(); } catch (e) {}
    }

    eraseFlowersAt(x, y, radius = 60) {
        let erasedAny = false;

        // 1. Remove flowers within radius
        for (let i = this.flowers.length - 1; i >= 0; i--) {
            const f = this.flowers[i];
            const dist = Math.hypot(f.x - x, f.y - y);
            if (dist <= radius) {
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

        // 2. Remove vine strokes near eraser
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
        this.history = [];
        this.currentStroke = null;

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
            const px = e.clientX;
            const py = e.clientY;

            if (this.virtualPointer) {
                this.virtualPointer.style.left = `${px}px`;
                this.virtualPointer.style.top = `${py}px`;
                this.virtualPointer.classList.remove('hidden');

                const ring = this.virtualPointer.querySelector('.pointer-ring');
                if (ring) {
                    ring.classList.toggle('eraser-ring', isRightClick || this.isEraserActive);
                }
            }

            if (isMouseDown) {
                if (isRightClick || e.shiftKey || this.isEraserActive) {
                    this.eraseFlowersAt(px, py, Math.max(45, this.brushSize * 1.3));
                } else {
                    if (this.lastPointerPos) {
                        this.continueStroke(this.lastPointerPos.x, this.lastPointerPos.y, px, py);
                    } else {
                        this.startStroke(px, py);
                    }
                }
                this.lastPointerPos = { x: px, y: py };
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (e.clientY < 75) return;
            isMouseDown = true;
            isRightClick = (e.button === 2);
            this.lastPointerPos = { x: e.clientX, y: e.clientY };

            if (isRightClick || e.shiftKey || this.isEraserActive) {
                this.eraseFlowersAt(e.clientX, e.clientY, Math.max(45, this.brushSize * 1.3));
            } else {
                this.startStroke(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isMouseDown) {
                this.endStroke();
            }
            isMouseDown = false;
            isRightClick = false;
            this.lastPointerPos = null;
        });

        // Touch support
        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                const t = e.touches[0];
                if (this.isEraserActive) {
                    this.eraseFlowersAt(t.clientX, t.clientY, Math.max(45, this.brushSize * 1.3));
                } else {
                    if (this.lastPointerPos) {
                        this.continueStroke(this.lastPointerPos.x, this.lastPointerPos.y, t.clientX, t.clientY);
                    } else {
                        this.startStroke(t.clientX, t.clientY);
                    }
                }
                this.lastPointerPos = { x: t.clientX, y: t.clientY };
            }
        }, { passive: true });

        window.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0] && e.touches[0].clientY > 75) {
                isMouseDown = true;
                const t = e.touches[0];
                this.lastPointerPos = { x: t.clientX, y: t.clientY };
                if (this.isEraserActive) {
                    this.eraseFlowersAt(t.clientX, t.clientY, Math.max(45, this.brushSize * 1.3));
                } else {
                    this.startStroke(t.clientX, t.clientY);
                }
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (isMouseDown) {
                this.endStroke();
            }
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
