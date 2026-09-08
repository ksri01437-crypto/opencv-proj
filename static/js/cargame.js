// F1 Gesture Racing Engine - 100% Hand-Controlled 3-Lane Car Game
class F1RacingGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Player Car (Defined before resize)
        this.car = {
            x: 0,
            y: 0,
            width: 62,
            height: 120,
            lane: 1,
            targetX: 0,
            tilt: 0, // Tilt angle in radians
            sparks: []
        };

        // Road Animation & Dimensions
        this.roadOffset = 0;
        this.trackWidth = 500;
        this.laneWidth = this.trackWidth / 3;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Audio synthesizer
        this.audioCtx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.audioEnabled = true;

        // Game State
        this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('f1_racing_best') || '0', 10);
        this.distance = 0;
        this.carsOvertaken = 0;
        this.baseSpeedKmh = 180;
        this.currentSpeedKmh = 180;
        this.maxSpeedKmh = 360;

        // 3-Lane Setup: 0 = Left, 1 = Center, 2 = Right
        this.currentLane = 1;
        this.targetLane = 1;
        this.handZone = 'center'; // 'left', 'center', 'right'

        // Enemy Cars
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.enemyColors = ['#ffaa00', '#aa00ff', '#00ff66', '#00ffff', '#ffffff', '#ff00aa'];

        // Speed Lines & Particles
        this.speedLines = [];
        this.particles = [];
        this.screenShake = 0;

        // Timing
        this.lastFrameTime = performance.now();

        // Keyboard Fallback
        this.initKeyboard();
        this.initSpeedLines();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Adapt track width to screen size
        this.trackWidth = Math.min(560, Math.max(380, this.canvas.width * 0.48));
        this.laneWidth = this.trackWidth / 3;

        if (this.car) {
            // Position player car clearly in the foreground at the bottom of the road
            this.car.y = Math.max(120, this.canvas.height - 220);
            this.car.targetX = this.getLaneCenterX(this.car.lane);
            this.car.x = this.car.targetX;
        }
    }

    getLaneCenterX(laneIndex) {
        const roadLeft = (this.canvas.width - this.trackWidth) / 2;
        return roadLeft + (laneIndex + 0.5) * this.laneWidth;
    }

    initSpeedLines() {
        this.speedLines = [];
        for (let i = 0; i < 30; i++) {
            this.speedLines.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                length: 20 + Math.random() * 60,
                speed: 1.2 + Math.random() * 2
            });
        }
    }

    // Audio Synthesizer for Engine Roar & Crash
    initAudio() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    startEngineSound() {
        if (!this.audioEnabled) return;
        this.initAudio();
        if (!this.audioCtx) return;

        if (!this.engineOsc) {
            this.engineOsc = this.audioCtx.createOscillator();
            this.engineGain = this.audioCtx.createGain();

            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(110, this.audioCtx.currentTime);
            this.engineGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);

            // Filter for deep roaring tone
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, this.audioCtx.currentTime);

            this.engineOsc.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.audioCtx.destination);

            this.engineOsc.start();
        }
    }

    updateEngineSound() {
        if (!this.engineOsc || !this.audioCtx) return;
        const speedRatio = (this.currentSpeedKmh - 180) / (this.maxSpeedKmh - 180);
        const targetFreq = 120 + speedRatio * 180;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.1);
    }

    stopEngineSound() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
                this.engineOsc.disconnect();
            } catch (e) {}
            this.engineOsc = null;
        }
    }

    playOvertakeSound() {
        if (!this.audioEnabled || !this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
    }

    playCrashSound() {
        if (!this.audioEnabled || !this.audioCtx) return;
        this.stopEngineSound();

        const bufferSize = this.audioCtx.sampleRate * 0.6;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, this.audioCtx.currentTime);
        filter.frequency.linearRampToValueAtTime(30, this.audioCtx.currentTime + 0.6);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        noise.start();
        noise.stop(this.audioCtx.currentTime + 0.6);
    }

    // Keyboard Fallback
    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (this.state === 'PLAYING') {
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    this.setLane(Math.max(0, this.targetLane - 1));
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    this.setLane(Math.min(2, this.targetLane + 1));
                } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    this.setLane(1);
                } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
                    this.togglePause();
                }
            } else if (this.state === 'PAUSED' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
                this.resumeGame();
            }
        });
    }

    // Hand Gesture Processing from client_mediapipe.js
    handleHandGesture(data) {
        if (!data || !data.pointer) return;

        // 3-Zone Hand Mapping
        // Left: pointer.x < 0.38
        // Center: 0.38 <= pointer.x <= 0.62
        // Right: pointer.x > 0.62
        const px = data.pointer.x;

        if (px < 0.38) {
            this.setLane(0);
            this.handZone = 'left';
        } else if (px > 0.62) {
            this.setLane(2);
            this.handZone = 'right';
        } else {
            this.setLane(1);
            this.handZone = 'center';
        }

        this.updateLaneHUD();
    }

    setLane(laneIndex) {
        this.targetLane = Math.max(0, Math.min(2, laneIndex));
        this.car.targetX = this.getLaneCenterX(this.targetLane);
    }

    updateLaneHUD() {
        const leftIndicator = document.getElementById('indicator-left');
        const centerIndicator = document.getElementById('indicator-center');
        const rightIndicator = document.getElementById('indicator-right');
        const zoneElem = document.getElementById('status-zone');

        if (zoneElem) {
            zoneElem.innerText = this.handZone.toUpperCase();
        }

        if (!leftIndicator || !centerIndicator || !rightIndicator) return;

        leftIndicator.classList.toggle('active', this.handZone === 'left');
        centerIndicator.classList.toggle('active', this.handZone === 'center');
        rightIndicator.classList.toggle('active', this.handZone === 'right');
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.distance = 0;
        this.carsOvertaken = 0;
        this.currentSpeedKmh = this.baseSpeedKmh;
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.particles = [];
        this.screenShake = 0;
        this.lastFrameTime = performance.now();

        this.setLane(1);
        this.car.y = Math.max(120, this.canvas.height - 220);
        this.car.x = this.getLaneCenterX(1);
        this.car.tilt = 0;


        document.getElementById('start-modal').classList.add('hidden');
        document.getElementById('game-over-modal').classList.add('hidden');
        document.getElementById('pause-modal').classList.add('hidden');

        this.startEngineSound();
        this.updateHUD();
    }

    pauseGame() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-modal').classList.remove('hidden');
            this.stopEngineSound();
        }
    }

    resumeGame() {
        if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-modal').classList.add('hidden');
            this.lastFrameTime = performance.now();
            this.startEngineSound();
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.playCrashSound();
        this.screenShake = 25;

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('f1_racing_best', this.bestScore.toString());
        }

        // Spawn Crash Explosions
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: this.car.x,
                y: this.car.y + 40,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.5) * 16,
                radius: 3 + Math.random() * 8,
                color: Math.random() > 0.4 ? '#ff3300' : (Math.random() > 0.5 ? '#ffcc00' : '#ffffff'),
                life: 1.0,
                decay: 0.015 + Math.random() * 0.02
            });
        }

        setTimeout(() => {
            document.getElementById('go-score').innerText = this.score;
            document.getElementById('go-best').innerText = this.bestScore;
            document.getElementById('go-speed').innerText = `${Math.round(this.currentSpeedKmh)} KM/H`;
            document.getElementById('go-cars').innerText = this.carsOvertaken;
            document.getElementById('go-distance').innerText = `${(this.distance / 1000).toFixed(1)} KM`;
            document.getElementById('game-over-modal').classList.remove('hidden');
        }, 600);
    }

    updateHUD() {
        const scoreElem = document.getElementById('score-val');
        const bestElem = document.getElementById('best-val');
        const speedElem = document.getElementById('speed-val');
        const gearElem = document.getElementById('gear-val');
        const distanceElem = document.getElementById('distance-val');

        if (scoreElem) scoreElem.innerText = this.score;
        if (bestElem) bestElem.innerText = this.bestScore;
        if (speedElem) speedElem.innerText = `${Math.round(this.currentSpeedKmh)} KM/H`;

        if (gearElem) {
            // F1 8-Speed Gear Calculation
            const gear = Math.min(8, Math.max(1, Math.floor((this.currentSpeedKmh - 160) / 25) + 1));
            gearElem.innerText = `GEAR ${gear}`;
        }

        if (distanceElem) distanceElem.innerText = `${(this.distance / 1000).toFixed(1)} KM`;
    }

    spawnEnemy() {
        // Find which lanes currently have nearby cars so we NEVER create an impassable wall
        const occupiedLanes = this.enemies
            .filter(e => e.y < 350)
            .map(e => e.lane);

        const availableLanes = [0, 1, 2].filter(l => !occupiedLanes.includes(l));
        if (availableLanes.length === 0) return;

        const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const color = this.enemyColors[Math.floor(Math.random() * this.enemyColors.length)];

        // Speed is relative to road motion
        const speedDelta = 0.4 + Math.random() * 0.45; // Slower than player

        this.enemies.push({
            x: this.getLaneCenterX(lane),
            y: -140,
            width: 56,
            height: 105,
            lane: lane,
            color: color,
            speedDelta: speedDelta,
            passed: false
        });
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Smooth Car Lane Interpolation
        const dx = this.car.targetX - this.car.x;
        this.car.x += dx * Math.min(1.0, 12 * dt);

        // Calculate visual tilt based on turning speed
        this.car.tilt = Math.max(-0.25, Math.min(0.25, (dx / this.laneWidth) * 0.4));

        // Speed Progression (Gradually increase speed up to 360 km/h)
        this.currentSpeedKmh = Math.min(this.maxSpeedKmh, this.baseSpeedKmh + (this.distance / 60));
        this.updateEngineSound();

        // Speed in pixels per second
        const roadSpeedPx = (this.currentSpeedKmh / 3.6) * 16;
        this.roadOffset = (this.roadOffset + roadSpeedPx * dt) % 80;

        // Update Distance & Score
        this.distance += (this.currentSpeedKmh / 3.6) * dt;
        this.score += Math.round(dt * (this.currentSpeedKmh / 10));

        // Spawn Enemies
        this.enemySpawnTimer += dt;
        const spawnInterval = Math.max(1.1, 2.2 - (this.currentSpeedKmh - 180) / 150);
        if (this.enemySpawnTimer >= spawnInterval) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const relativeSpeed = roadSpeedPx * (1.0 - enemy.speedDelta * 0.35);
            enemy.y += relativeSpeed * dt;

            // Overtake Detection & Bonus
            if (!enemy.passed && enemy.y > this.car.y + this.car.height / 2) {
                enemy.passed = true;
                this.carsOvertaken++;
                this.score += 50; // Bonus points for clean overtake
                this.playOvertakeSound();
            }

            // Remove offscreen
            if (enemy.y > this.canvas.height + 150) {
                this.enemies.splice(i, 1);
                continue;
            }

            // Collision Detection (Tight Bounding Box)
            const padX = 12;
            const padY = 14;
            const isColliding = (
                Math.abs(this.car.x - enemy.x) < (this.car.width + enemy.width) / 2 - padX &&
                Math.abs(this.car.y - enemy.y) < (this.car.height + enemy.height) / 2 - padY
            );

            if (isColliding) {
                this.gameOver();
                return;
            }
        }

        // Exhaust flame / sparks
        if (Math.random() < 0.8) {
            this.car.sparks.push({
                x: this.car.x + (Math.random() - 0.5) * 16,
                y: this.car.y + this.car.height - 10,
                vx: (Math.random() - 0.5) * 3,
                vy: 5 + Math.random() * 8,
                radius: 2 + Math.random() * 3,
                color: Math.random() > 0.4 ? '#00e5ff' : '#ffffff',
                life: 1.0
            });
        }

        // Update Car Sparks
        for (let i = this.car.sparks.length - 1; i >= 0; i--) {
            const sp = this.car.sparks[i];
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.life -= dt * 6;
            if (sp.life <= 0) this.car.sparks.splice(i, 1);
        }

        // Screen Shake decay
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 45);
        }

        this.updateHUD();
    }

    render() {
        const ctx = this.ctx;
        ctx.save();

        // Apply Screen Shake
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(shakeX, shakeY);
        }

        // 1. Background Grass / Outer Circuit
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Road Dimensions
        const roadLeft = (this.canvas.width - this.trackWidth) / 2;
        const roadRight = roadLeft + this.trackWidth;

        // Outer Neon Guardrails
        ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
        ctx.fillRect(roadLeft - 20, 0, 20, this.canvas.height);
        ctx.fillRect(roadRight, 0, 20, this.canvas.height);

        // F1 Curbs (Red & White Alternating Stripes on road edges)
        const curbWidth = 14;
        const curbSegHeight = 40;
        const curbOffset = this.roadOffset % (curbSegHeight * 2);

        for (let y = -curbSegHeight * 2; y < this.canvas.height + curbSegHeight * 2; y += curbSegHeight) {
            const isRed = Math.floor((y + this.roadOffset) / curbSegHeight) % 2 === 0;
            ctx.fillStyle = isRed ? '#ff0033' : '#ffffff';
            // Left Curb
            ctx.fillRect(roadLeft - curbWidth, y, curbWidth, curbSegHeight);
            // Right Curb
            ctx.fillRect(roadRight, y, curbWidth, curbSegHeight);
        }

        // Asphalt Track Surface
        ctx.fillStyle = '#171922';
        ctx.fillRect(roadLeft, 0, this.trackWidth, this.canvas.height);

        // Track Edge Borders
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(roadLeft, 0);
        ctx.lineTo(roadLeft, this.canvas.height);
        ctx.moveTo(roadRight, 0);
        ctx.lineTo(roadRight, this.canvas.height);
        ctx.stroke();

        // 3. Dashed Lane Divider Lines (Between 3 Lanes)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.setLineDash([35, 35]);
        ctx.lineDashOffset = -this.roadOffset;

        ctx.beginPath();
        // Lane 0/1 divider
        ctx.moveTo(roadLeft + this.laneWidth, 0);
        ctx.lineTo(roadLeft + this.laneWidth, this.canvas.height);
        // Lane 1/2 divider
        ctx.moveTo(roadLeft + this.laneWidth * 2, 0);
        ctx.lineTo(roadLeft + this.laneWidth * 2, this.canvas.height);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // 4. Speed Lines (High Speed Wind Effect)
        if (this.currentSpeedKmh > 240) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.18)';
            ctx.lineWidth = 1.5;
            for (let sl of this.speedLines) {
                sl.y += sl.speed * (this.currentSpeedKmh / 60);
                if (sl.y > this.canvas.height) {
                    sl.y = -sl.length;
                    sl.x = Math.random() * this.canvas.width;
                }
                ctx.beginPath();
                ctx.moveTo(sl.x, sl.y);
                ctx.lineTo(sl.x, sl.y + sl.length);
                ctx.stroke();
            }
        }

        // 5. Render Enemy Cars
        for (let enemy of this.enemies) {
            this.drawF1Car(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color, 0, false);
        }

        // 6. Render Exhaust Sparks
        for (let sp of this.car.sparks) {
            ctx.fillStyle = sp.color;
            ctx.globalAlpha = Math.max(0, sp.life);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 7. Render Player Car
        if (this.state !== 'GAMEOVER') {
            this.drawF1Car(this.car.x, this.car.y, this.car.width, this.car.height, '#ff0033', this.car.tilt, true);
        }

        // 8. Explosion Particles on Crash
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
        }
        ctx.globalAlpha = 1.0;

        ctx.restore();
    }

    // Detailed F1 Race Car Drawing (Aerodynamic Nose, Wide Slick Tires, Wings, Halo, Driver Helmet)
    drawF1Car(x, y, w, h, mainColor, tiltAngle, isPlayer) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y + h / 2);
        if (tiltAngle) ctx.rotate(tiltAngle);

        const hw = w / 2;
        const hh = h / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 10, hw + 10, hh + 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player Aura Glow so car is unmistakably visible
        if (isPlayer) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.85)';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 8, hw + 12, hh + 8, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }


        // 4 Wide F1 Slick Tires
        ctx.fillStyle = '#111317';
        const tireW = 12;
        const tireH = 26;

        // Front Tires
        ctx.fillRect(-hw - 3, -hh + 12, tireW, tireH);
        ctx.fillRect(hw - tireW + 3, -hh + 12, tireW, tireH);

        // Rear Tires
        ctx.fillRect(-hw - 4, hh - 32, tireW + 2, tireH + 2);
        ctx.fillRect(hw - tireW + 2, hh - 32, tireW + 2, tireH + 2);

        // Tire Yellow Pirelli-style Rims
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-hw + 1, -hh + 22, 4, 6);
        ctx.fillRect(hw - 5, -hh + 22, 4, 6);
        ctx.fillRect(-hw + 1, hh - 22, 4, 6);
        ctx.fillRect(hw - 5, hh - 22, 4, 6);

        // Front Aerodynamic Wing
        ctx.fillStyle = '#1b1d24';
        ctx.fillRect(-hw - 4, -hh, w + 8, 10);
        ctx.fillStyle = mainColor;
        ctx.fillRect(-hw, -hh + 3, w, 4);

        // Suspension Arms (Carbon Fiber Struts)
        ctx.strokeStyle = '#333642';
        ctx.lineWidth = 2.5;
        // Front Suspension
        ctx.beginPath();
        ctx.moveTo(-hw + 6, -hh + 24);
        ctx.lineTo(-6, -hh + 28);
        ctx.moveTo(hw - 6, -hh + 24);
        ctx.lineTo(6, -hh + 28);
        // Rear Suspension
        ctx.moveTo(-hw + 6, hh - 20);
        ctx.lineTo(-8, hh - 12);
        ctx.moveTo(hw - 6, hh - 20);
        ctx.lineTo(8, hh - 12);
        ctx.stroke();

        // Aerodynamic Chassis / Body
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(0, -hh + 8);             // Nose cone tip
        ctx.lineTo(hw - 10, -hh + 35);      // Front side pod start
        ctx.lineTo(hw - 4, hh - 18);        // Rear side pod
        ctx.lineTo(hw - 12, hh);            // Rear wing mount
        ctx.lineTo(-hw + 12, hh);
        ctx.lineTo(-hw + 4, hh - 18);
        ctx.lineTo(-hw + 10, -hh + 35);
        ctx.closePath();
        ctx.fill();

        // Central Cockpit & Halo
        ctx.fillStyle = '#0b0c10';
        ctx.beginPath();
        ctx.ellipse(0, -2, 9, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Driver Helmet
        ctx.fillStyle = isPlayer ? '#ffff00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -5, 6.5, 0, Math.PI * 2);
        ctx.fill();

        // Visor
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-4, -9, 8, 3.5);

        // Halo Safety Bar
        ctx.strokeStyle = '#222530';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -3, 9, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();

        // Rear Wing
        ctx.fillStyle = '#111317';
        ctx.fillRect(-hw - 2, hh - 6, w + 4, 10);
        ctx.fillStyle = mainColor;
        ctx.fillRect(-hw + 4, hh - 4, w - 8, 4);

        // Rear Rain Light (Red Flashing LED on Player)
        ctx.fillStyle = (Date.now() % 300 < 150) ? '#ff0033' : '#440011';
        ctx.fillRect(-3, hh + 2, 6, 4);

        ctx.restore();
    }

    loop(currentTime) {
        const dt = Math.min(0.1, (currentTime - this.lastFrameTime) / 1000);
        this.lastFrameTime = currentTime;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }
}

let f1Game = null;

document.addEventListener('DOMContentLoaded', () => {
    f1Game = new F1RacingGame('racing-canvas');

    // Re-use clientMP from client_mediapipe.js (Zero duplicate camera code!)
    if (typeof clientMP !== 'undefined') {
        clientMP.onGestureData = (data) => {
            if (f1Game) f1Game.handleHandGesture(data);
        };
    }

    // UI Buttons
    const startBtn = document.getElementById('btn-start-race');
    if (startBtn) {
        startBtn.addEventListener('click', () => f1Game.startGame());
    }

    const restartBtn = document.getElementById('btn-restart-race');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => f1Game.startGame());
    }

    const resumeBtn = document.getElementById('btn-resume-race');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => f1Game.resumeGame());
    }

    const pauseHudBtn = document.getElementById('btn-pause-hud');
    if (pauseHudBtn) {
        pauseHudBtn.addEventListener('click', () => {
            if (f1Game) {
                if (f1Game.state === 'PLAYING') f1Game.pauseGame();
                else if (f1Game.state === 'PAUSED') f1Game.resumeGame();
            }
        });
    }

    const cameraToggleBtn = document.getElementById('camera-toggle-btn');
    if (cameraToggleBtn && typeof clientMP !== 'undefined') {
        cameraToggleBtn.addEventListener('click', async () => {
            const active = await clientMP.toggleCamera();
            cameraToggleBtn.className = active ? 'cam-toggle-btn active' : 'cam-toggle-btn inactive';
            cameraToggleBtn.innerHTML = active ? '<span class="pulse-dot green">●</span> CAM: ON' : '<span class="pulse-dot red">●</span> CAM: OFF';
        });
    }

    // Start Game Render Loop
    requestAnimationFrame((t) => f1Game.loop(t));
});
