// HTML5 Canvas Fruit Ninja Game Engine with Delta-Time Physics & Progressive Difficulty
class FruitGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Game State
        this.state = 'START';
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('gesture_fruit_best') || '0', 10);
        this.lives = 3;
        this.slices = 0;
        this.maxCombo = 1;
        this.comboCount = 0;
        this.comboTimer = null;
        this.gameTime = 0;
        this.startTime = 0;
        this.lastFrameTime = performance.now();
        this.level = 1;

        // Entities
        this.fruits = [];
        this.halves = [];
        this.particles = [];
        this.popups = [];
        this.swipeTrail = [];

        // Spawning
        this.spawnTimer = 0;

        // Screen Shake
        this.shakeAmount = 0;

        // Fruit Definitions
        this.fruitTypes = [
            { name: 'apple', emoji: '🍎', score: 10, radius: 45, color: '#ff3333', juice: '#ff1a1a', weight: 20 },
            { name: 'orange', emoji: '🍊', score: 15, radius: 42, color: '#ff9900', juice: '#ff6600', weight: 18 },
            { name: 'banana', emoji: '🍌', score: 15, radius: 40, color: '#ffe600', juice: '#ffd700', weight: 18 },
            { name: 'watermelon', emoji: '🍉', score: 25, radius: 58, color: '#22cc44', juice: '#cc0033', weight: 12 },
            { name: 'strawberry', emoji: '🍓', score: 20, radius: 36, color: '#ff1a40', juice: '#ff0033', weight: 15 },
            { name: 'kiwi', emoji: '🥝', score: 20, radius: 34, color: '#77b300', juice: '#4d8000', weight: 15 },
            { name: 'pineapple', emoji: '🍍', score: 30, radius: 50, color: '#ffcc00', juice: '#ffaa00', weight: 10 },
            { name: 'mango', emoji: '🥭', score: 25, radius: 46, color: '#ff8000', juice: '#ff5500', weight: 12 },
            { name: 'golden', emoji: '⭐', score: 100, radius: 44, color: '#ffd700', juice: '#ffffff', weight: 4, isGolden: true },
            { name: 'bomb', emoji: '💣', score: 0, radius: 42, color: '#222222', juice: '#ff5500', weight: 6, isBomb: true }
        ];

        this.updateHUD();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    updateHUD() {
        const levelElem = document.getElementById('level-val');
        if (levelElem) levelElem.innerText = this.level;
        document.getElementById('score-val').innerText = this.score;
        document.getElementById('best-score-val').innerText = this.bestScore;
        document.getElementById('combo-val').innerText = `🔥 x${Math.max(1, this.comboCount)}`;
        
        let hearts = '';
        for (let i = 0; i < 3; i++) {
            hearts += i < this.lives ? '❤️' : '🖤';
        }
        document.getElementById('lives-val').innerText = hearts;
        document.getElementById('timer-val').innerText = `${Math.floor(this.gameTime)}s`;
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.lives = 3;
        this.slices = 0;
        this.maxCombo = 1;
        this.comboCount = 0;
        this.gameTime = 0;
        this.level = 1;
        this.startTime = Date.now();
        this.lastFrameTime = performance.now();
        this.fruits = [];
        this.halves = [];
        this.particles = [];
        this.popups = [];
        this.spawnTimer = 0;

        this.updateHUD();
        try { if (typeof sounds !== 'undefined') sounds.playClickSound(); } catch (e) {}
        this.spawnFruitBatch();
    }

    pauseGame() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-modal').classList.remove('hidden');
            sounds.playClickSound();
        }
    }

    resumeGame() {
        if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-modal').classList.add('hidden');
            this.lastFrameTime = performance.now();
            sounds.playClickSound();
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('gesture_fruit_best', this.bestScore.toString());
        }

        document.getElementById('go-score').innerText = this.score;
        document.getElementById('go-best-score').innerText = this.bestScore;
        document.getElementById('go-slices').innerText = this.slices;
        document.getElementById('go-max-combo').innerText = `x${this.maxCombo}`;

        document.getElementById('game-over-modal').classList.remove('hidden');
        sounds.playBombSound();
    }

    getRandomFruitType() {
        // Exclude bombs in Level 1
        let availableTypes = this.fruitTypes;
        if (this.level === 1) {
            availableTypes = this.fruitTypes.filter(f => !f.isBomb);
        }

        const totalWeight = availableTypes.reduce((acc, f) => acc + f.weight, 0);
        let rand = Math.random() * totalWeight;
        for (let f of availableTypes) {
            if (rand < f.weight) return f;
            rand -= f.weight;
        }
        return availableTypes[0];
    }

    spawnFruitBatch() {
        // Level 1: 1 fruit, Level 2: 1-2 fruits, Level 3+: 1-3 fruits
        const maxBatch = this.level === 1 ? 1 : (this.level === 2 ? 2 : 3);
        const count = Math.min(maxBatch, 1 + Math.floor(Math.random() * maxBatch));

        for (let i = 0; i < count; i++) {
            const fType = this.getRandomFruitType();
            const margin = 140;
            const x = margin + Math.random() * (this.canvas.width - margin * 2);
            const y = this.canvas.height + 50;

            // Target central upper region of screen
            const targetX = this.canvas.width * 0.3 + Math.random() * (this.canvas.width * 0.4);
            const floatDurationSec = 2.4 + Math.random() * 0.8; // Takes ~2.4 to 3.2 seconds!

            // Initial Launch Velocities (pixels per second)
            const vx = (targetX - x) / floatDurationSec;
            
            // Speed scaling based on level
            const levelSpeedMult = this.level === 1 ? 0.55 : (this.level === 2 ? 0.78 : 1.05);
            const vy = - (this.canvas.height * 0.72 + Math.random() * 120) * (levelSpeedMult / floatDurationSec);
            const gravity = (this.canvas.height * 0.55) * (levelSpeedMult / (floatDurationSec * floatDurationSec));

            const rotSpeed = (Math.random() - 0.5) * 1.5; // radians per second

            this.fruits.push({
                ...fType,
                id: Math.random().toString(),
                x, y, vx, vy,
                gravity,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed
            });
        }
    }

    processSwipeLine(x1, y1, x2, y2) {
        if (this.state !== 'PLAYING') return;

        this.swipeTrail.push({ x1, y1, x2, y2, time: Date.now(), alpha: 1.0 });
        let slicedInThisSwipe = 0;

        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            const dist = this.distToSegment(fruit.x, fruit.y, x1, y1, x2, y2);

            // Generous collision tolerance (fruit.radius + 20px)
            if (dist <= fruit.radius + 20) {
                this.sliceFruit(i, x1, y1, x2, y2);
                slicedInThisSwipe++;
            }
        }

        if (slicedInThisSwipe > 0) {
            this.handleCombo(slicedInThisSwipe);
        }
    }

    distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    sliceFruit(index, x1, y1, x2, y2) {
        const fruit = this.fruits[index];
        this.fruits.splice(index, 1);

        if (fruit.isBomb) {
            this.lives--;
            this.comboCount = 0;
            this.shakeAmount = 25;
            this.createExplosionParticles(fruit.x, fruit.y);
            sounds.playBombSound();
            this.updateHUD();

            if (this.lives <= 0) {
                this.gameOver();
            }
            return;
        }

        this.slices++;
        const pts = fruit.score * Math.max(1, this.comboCount);
        this.score += pts;
        this.updateHUD();

        if (fruit.isGolden) {
            sounds.playGoldenSound();
        } else {
            sounds.playSliceSound();
            sounds.playSplashSound();
        }

        // Halves
        const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        const perpX = Math.cos(angle) * 120;
        const perpY = Math.sin(angle) * 120;

        this.halves.push({
            emoji: fruit.emoji,
            color: fruit.color,
            radius: fruit.radius,
            half: 1,
            x: fruit.x - perpX * 0.1,
            y: fruit.y - perpY * 0.1,
            vx: fruit.vx - perpX,
            vy: fruit.vy - 100,
            gravity: fruit.gravity * 1.2,
            rotation: fruit.rotation,
            rotSpeed: -2.5
        });

        this.halves.push({
            emoji: fruit.emoji,
            color: fruit.color,
            radius: fruit.radius,
            half: 2,
            x: fruit.x + perpX * 0.1,
            y: fruit.y + perpY * 0.1,
            vx: fruit.vx + perpX,
            vy: fruit.vy - 100,
            gravity: fruit.gravity * 1.2,
            rotation: fruit.rotation,
            rotSpeed: 2.5
        });

        this.createJuiceParticles(fruit.x, fruit.y, fruit.juice);

        this.popups.push({
            text: fruit.isGolden ? `⭐ +${pts}` : `+${pts}`,
            x: fruit.x,
            y: fruit.y,
            vy: -80,
            alpha: 1.0,
            color: fruit.isGolden ? '#ffd700' : '#ffffff'
        });
    }

    handleCombo(count) {
        this.comboCount += count;
        if (this.comboCount > this.maxCombo) {
            this.maxCombo = this.comboCount;
        }

        if (this.comboCount >= 2) {
            sounds.playComboSound(this.comboCount);
            this.popups.push({
                text: `🔥 COMBO x${this.comboCount}!`,
                x: this.canvas.width / 2,
                y: this.canvas.height * 0.35,
                vy: -50,
                alpha: 1.2,
                color: '#ffcc00',
                isCombo: true
            });
        }

        clearTimeout(this.comboTimer);
        this.comboTimer = setTimeout(() => {
            this.comboCount = 0;
            this.updateHUD();
        }, 1200);

        this.updateHUD();
    }

    createJuiceParticles(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 350;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 4 + Math.random() * 6,
                color,
                alpha: 1.0,
                gravity: 250,
                decay: 0.8
            });
        }
    }

    createExplosionParticles(x, y) {
        for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 150 + Math.random() * 500;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 5 + Math.random() * 9,
                color: Math.random() > 0.5 ? '#ff3300' : '#ffcc00',
                alpha: 1.0,
                gravity: 100,
                decay: 1.0
            });
        }
    }

    // Delta-Time Physics Update Loop
    update(dt) {
        if (this.state === 'PLAYING') {
            this.gameTime = (Date.now() - this.startTime) / 1000;
            
            // Progressive Difficulty Levels
            if (this.score >= 300) {
                this.level = 3;
            } else if (this.score >= 100) {
                this.level = 2;
            } else {
                this.level = 1;
            }

            // Spawn Interval: Level 1 = 3.5s, Level 2 = 2.5s, Level 3 = 1.8s
            const spawnIntervalSec = this.level === 1 ? 3.5 : (this.level === 2 ? 2.5 : 1.8);
            this.spawnTimer += dt;
            if (this.spawnTimer >= spawnIntervalSec) {
                this.spawnTimer = 0;
                this.spawnFruitBatch();
            }

            this.updateHUD();
        }

        if (this.shakeAmount > 0) {
            this.shakeAmount *= 0.88;
            if (this.shakeAmount < 0.5) this.shakeAmount = 0;
        }

        // Update Fruits with Delta Time
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const f = this.fruits[i];
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vy += f.gravity * dt;
            f.rotation += f.rotSpeed * dt;

            if (f.y > this.canvas.height + 80) {
                this.fruits.splice(i, 1);
                if (this.state === 'PLAYING' && !f.isBomb && !f.isGolden) {
                    this.lives--;
                    this.comboCount = 0;
                    this.updateHUD();
                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                }
            }
        }

        // Update Halves with Delta Time
        for (let i = this.halves.length - 1; i >= 0; i--) {
            const h = this.halves[i];
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            h.vy += h.gravity * dt;
            h.rotation += h.rotSpeed * dt;
            if (h.y > this.canvas.height + 100) {
                this.halves.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.alpha -= p.decay * dt;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const pop = this.popups[i];
            pop.y += pop.vy * dt;
            pop.alpha -= 0.6 * dt;
            if (pop.alpha <= 0) {
                this.popups.splice(i, 1);
            }
        }

        const now = Date.now();
        this.swipeTrail = this.swipeTrail.filter(t => now - t.time <= 180);
    }

    draw() {
        this.ctx.save();

        if (this.shakeAmount > 0) {
            const rx = (Math.random() - 0.5) * this.shakeAmount;
            const ry = (Math.random() - 0.5) * this.shakeAmount;
            this.ctx.translate(rx, ry);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Swipe Trails
        for (let t of this.swipeTrail) {
            this.ctx.beginPath();
            this.ctx.moveTo(t.x1, t.y1);
            this.ctx.lineTo(t.x2, t.y2);
            this.ctx.lineWidth = 10;
            this.ctx.strokeStyle = `rgba(0, 255, 204, ${t.alpha})`;
            this.ctx.shadowColor = '#00ffcc';
            this.ctx.shadowBlur = 15;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }
        this.ctx.shadowBlur = 0;

        // Draw Juice Particles
        for (let p of this.particles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Draw Fruits
        for (let f of this.fruits) {
            this.ctx.save();
            this.ctx.translate(f.x, f.y);
            this.ctx.rotate(f.rotation);

            if (f.isGolden) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, f.radius + 10, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
                this.ctx.shadowColor = '#ffd700';
                this.ctx.shadowBlur = 25;
                this.ctx.fill();
            }

            this.ctx.font = `${f.radius * 1.8}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(f.emoji, 0, 0);

            this.ctx.restore();
        }

        // Draw Halves
        for (let h of this.halves) {
            this.ctx.save();
            this.ctx.translate(h.x, h.y);
            this.ctx.rotate(h.rotation);

            this.ctx.beginPath();
            if (h.half === 1) {
                this.ctx.arc(0, 0, h.radius, Math.PI * 0.5, Math.PI * 1.5);
            } else {
                this.ctx.arc(0, 0, h.radius, Math.PI * 1.5, Math.PI * 0.5);
            }
            this.ctx.closePath();
            this.ctx.clip();

            this.ctx.font = `${h.radius * 1.8}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(h.emoji, 0, 0);

            this.ctx.restore();
        }

        // Draw Popups
        for (let pop of this.popups) {
            this.ctx.save();
            this.ctx.font = pop.isCombo ? '900 2.4rem Outfit, sans-serif' : '800 1.6rem Outfit, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = pop.color;
            this.ctx.globalAlpha = Math.max(0, Math.min(1.0, pop.alpha));
            this.ctx.shadowColor = pop.color;
            this.ctx.shadowBlur = 12;
            this.ctx.fillText(pop.text, pop.x, pop.y);
            this.ctx.restore();
        }

        this.ctx.restore();
    }

    loop(nowTime) {
        const dt = Math.min(0.1, (nowTime - this.lastFrameTime) / 1000);
        this.lastFrameTime = nowTime;

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new FruitGame('game-canvas');
requestAnimationFrame((t) => game.loop(t));
