import React, { useEffect, useRef, useState } from 'react';
import { soundSynth } from '../utils/audioSynth';
import confetti from 'canvas-confetti';

export default function GameCanvas({
  aimPos,
  shootTriggered,
  gameState,
  onGameComplete,
  onGameOverBomb,
  onScoreUpdate
}) {
  const canvasRef = useRef(null);
  const [banner, setBanner] = useState(null);

  const itemsRef = useRef([]); // Active fruits and bombs flying in arc physics
  const slicedHalvesRef = useRef([]);
  const juiceParticlesRef = useRef([]);
  const sliceTrailsRef = useRef([]);
  const scorePopupsRef = useRef([]);
  const screenShakeRef = useRef(0);
  const prevAimPosRef = useRef({ x: 0.5, y: 0.5 });
  const mouseAimRef = useRef({ x: 0.5, y: 0.5, isMouseActive: false });
  const lastSpawnTimeRef = useRef(0);

  const statsRef = useRef({
    score: 0,
    enemiesShot: 0, // Fruits cut count out of 10
    totalEnemies: 10,
    shotsFired: 0,
    accuracy: 0,
    startTime: 0
  });

  const lastShootStateRef = useRef(false);

  // Available Fruits Definitions
  const fruitDefs = [
    { type: 'fruit', name: 'Watermelon', emoji: '🍉', color: '#EF4444', juiceColor: '#DC2626', radius: 46, points: 100 },
    { type: 'fruit', name: 'Red Apple', emoji: '🍎', color: '#F87171', juiceColor: '#B91C1C', radius: 38, points: 120 },
    { type: 'fruit', name: 'Banana', emoji: '🍌', color: '#FACC15', juiceColor: '#EAB308', radius: 40, points: 140 },
    { type: 'fruit', name: 'Sweet Orange', emoji: '🍊', color: '#FB923C', juiceColor: '#EA580C', radius: 38, points: 130 },
    { type: 'fruit', name: 'Pineapple', emoji: '🍍', color: '#FBBF24', juiceColor: '#D97706', radius: 44, points: 180 },
    { type: 'fruit', name: 'Strawberry', emoji: '🍓', color: '#F43F5E', juiceColor: '#E11D48', radius: 34, points: 150 },
    { type: 'fruit', name: 'Fresh Kiwi', emoji: '🥝', color: '#84CC16', juiceColor: '#65A30D', radius: 36, points: 160 },
    { type: 'fruit', name: 'Coconut', emoji: '🥥', color: '#A16207', juiceColor: '#FEF08A', radius: 42, points: 200 },
    { type: 'fruit', name: 'Juicy Grapes', emoji: '🍇', color: '#A855F7', juiceColor: '#7E22CE', radius: 38, points: 170 },
    { type: 'fruit', name: 'Peach', emoji: '🍑', color: '#F472B6', juiceColor: '#DB2777', radius: 37, points: 190 }
  ];

  // Spawn Fruit / Bomb Wave launching upward from bottom
  const spawnWave = (width, height) => {
    const waveCount = 2 + Math.floor(Math.random() * 2); // Launch 2-3 items
    for (let i = 0; i < waveCount; i++) {
      // 20% chance to spawn a Bomb 💣
      const isBomb = Math.random() < 0.22;
      let itemData;

      if (isBomb) {
        itemData = {
          type: 'bomb',
          name: 'DANGEROUS BOMB',
          emoji: '💣',
          color: '#EF4444',
          radius: 42,
          points: 0
        };
      } else {
        const randFruit = fruitDefs[Math.floor(Math.random() * fruitDefs.length)];
        itemData = { ...randFruit };
      }

      const spawnX = 120 + Math.random() * (width - 240);
      const spawnY = height + 30; // Below canvas
      const vx = (Math.random() - 0.5) * 5.5;
      const vy = -(13.5 + Math.random() * 4.5); // Arc velocity upwards

      itemsRef.current.push({
        id: Date.now() + Math.random(),
        ...itemData,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.12,
        alive: true
      });
    }
  };

  // Reset Game State for New Match
  const resetGame = (width, height) => {
    itemsRef.current = [];
    slicedHalvesRef.current = [];
    juiceParticlesRef.current = [];
    sliceTrailsRef.current = [];
    scorePopupsRef.current = [];
    screenShakeRef.current = 0;

    statsRef.current = {
      score: 0,
      enemiesShot: 0,
      totalEnemies: 10,
      shotsFired: 0,
      accuracy: 0,
      startTime: Date.now()
    };

    onScoreUpdate(statsRef.current);
    spawnWave(width, height);
  };

  // Check Line Segment Collision to Item Center
  const checkLineSlice = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) <= r;

    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(cx - projX, cy - projY) <= r;
  };

  // Process Hand Slicing / Laser Blast
  const processSliceAction = (x1, y1, x2, y2, isBlast = false) => {
    if (gameState !== 'PLAYING') return;

    sliceTrailsRef.current.push({
      x: x2,
      y: y2,
      alpha: 1.0
    });

    itemsRef.current.forEach((item) => {
      if (item.alive) {
        const isHit = checkLineSlice(x1, y1, x2, y2, item.x, item.y, item.radius + 15);
        if (isHit) {
          item.alive = false;

          // IF BOMB HIT -> GAME OVER OUT! 💣💥
          if (item.type === 'bomb') {
            soundSynth.playExplosion();
            screenShakeRef.current = 30; // Huge explosion shake

            // Massive Bomb Blast Particles
            for (let p = 0; p < 60; p++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 12 + 3;
              juiceParticlesRef.current.push({
                x: item.x,
                y: item.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? '#EF4444' : '#F59E0B',
                radius: Math.random() * 8 + 4,
                alpha: 1.0,
                decay: 0.02
              });
            }

            setBanner('💣 BOMB DETONATED! GAME OVER!');
            onGameOverBomb({
              ...statsRef.current,
              durationSeconds: Math.round((Date.now() - statsRef.current.startTime) / 1000)
            });
            return;
          }

          // IF FRUIT SLICED 🍉
          soundSynth.playLaser();
          statsRef.current.enemiesShot += 1;
          statsRef.current.score += item.points;

          setBanner(` 🍉 ${item.name.toUpperCase()} SLICED! +${item.points} PTS`);
          setTimeout(() => setBanner(null), 1200);

          // Spawn 2 Sliced Halves flying apart
          slicedHalvesRef.current.push(
            {
              emoji: item.emoji,
              x: item.x - 12,
              y: item.y,
              vx: -5 + (Math.random() - 0.5) * 2,
              vy: -6,
              rotation: item.rotation,
              vRot: -0.2,
              alpha: 1.0
            },
            {
              emoji: item.emoji,
              x: item.x + 12,
              y: item.y,
              vx: 5 + (Math.random() - 0.5) * 2,
              vy: -6,
              rotation: item.rotation,
              vRot: 0.2,
              alpha: 1.0
            }
          );

          // Juice Splash Particles
          for (let p = 0; p < 25; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 2;
            juiceParticlesRef.current.push({
              x: item.x,
              y: item.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: item.juiceColor,
              radius: Math.random() * 6 + 3,
              alpha: 1.0,
              decay: 0.025
            });
          }

          // Score Floating Text
          scorePopupsRef.current.push({
            text: `+${item.points}`,
            x: item.x,
            y: item.y,
            alpha: 1.0,
            color: item.color
          });

          // Update Stats
          const acc = Math.round((statsRef.current.enemiesShot / Math.max(1, statsRef.current.shotsFired + 1)) * 100);
          statsRef.current.accuracy = Math.min(100, acc);
          onScoreUpdate({ ...statsRef.current });

          // Check Win Condition (10 Fruits Sliced)
          if (statsRef.current.enemiesShot >= 10) {
            soundSynth.playVictory();
            confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
            const durationSeconds = Math.round((Date.now() - statsRef.current.startTime) / 1000);
            onGameComplete({
              ...statsRef.current,
              durationSeconds
            });
          }
        }
      }
    });
  };

  // Init Match when gameState changes to PLAYING
  useEffect(() => {
    if (gameState === 'PLAYING') {
      const canvas = canvasRef.current;
      if (canvas) {
        resetGame(canvas.width, canvas.height);
      }
    }
  }, [gameState]);

  // Handle Eye Shoot Trigger
  useEffect(() => {
    if (gameState === 'PLAYING' && shootTriggered && !lastShootStateRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const activePos = mouseAimRef.current.isMouseActive ? mouseAimRef.current : aimPos;
        const cx = activePos.x * canvas.width;
        const cy = activePos.y * canvas.height;
        statsRef.current.shotsFired += 1;
        processSliceAction(cx - 30, cy - 30, cx + 30, cy + 30, true);
      }
    }
    lastShootStateRef.current = shootTriggered;
  }, [shootTriggered, aimPos, gameState]);

  // Keyboard Spacebar / Enter slice listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === 'PLAYING') {
          e.preventDefault();
          const canvas = canvasRef.current;
          if (canvas) {
            const activePos = mouseAimRef.current.isMouseActive ? mouseAimRef.current : aimPos;
            const cx = activePos.x * canvas.width;
            const cy = activePos.y * canvas.height;
            processSliceAction(cx - 30, cy - 30, cx + 30, cy + 30, true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, aimPos]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      ctx.save();

      // Screen Shake Shift
      let shakeX = 0;
      let shakeY = 0;
      if (screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        screenShakeRef.current *= 0.85;
        if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
      }

      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

      // Arena Background
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dojo Grid Lines
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.lineWidth = 1;
      const step = 50;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Continuous Wave Spawner
      const now = Date.now();
      if (gameState === 'PLAYING' && now - lastSpawnTimeRef.current > 2200) {
        lastSpawnTimeRef.current = now;
        spawnWave(canvas.width, canvas.height);
      }

      // Determine active Hand Pointer coordinates
      const activePos = mouseAimRef.current.isMouseActive ? mouseAimRef.current : aimPos;
      const cx = activePos.x * canvas.width;
      const cy = activePos.y * canvas.height;

      const prevCx = prevAimPosRef.current.x * canvas.width;
      const prevCy = prevAimPosRef.current.y * canvas.height;

      // 1. Process Hand Movement Slicing Line Collision
      if (gameState === 'PLAYING') {
        const swipeDist = Math.hypot(cx - prevCx, cy - prevCy);
        if (swipeDist > 4) {
          processSliceAction(prevCx, prevCy, cx, cy, false);
        }
      }
      prevAimPosRef.current = { x: activePos.x, y: activePos.y };

      // 2. Render & Physics Update for Flying Fruits / Bombs
      itemsRef.current.forEach((item, idx) => {
        if (item.alive) {
          // Arc Physics Movement (vy + gravity)
          item.x += item.vx;
          item.y += item.vy;
          item.vy += 0.32; // Gravity pulling item back down
          item.rotation += item.vRot;

          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.rotate(item.rotation);

          if (item.type === 'bomb') {
            // Render Bomb 💣 with red glowing aura & fuse flame
            ctx.shadowBlur = 22;
            ctx.shadowColor = '#EF4444';
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = `${item.radius * 1.3}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.emoji, 0, 0);

            // Warning Label
            ctx.fillStyle = '#EF4444';
            ctx.font = '900 11px Orbitron, sans-serif';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#EF4444';
            ctx.fillText('💣 DANGER BOMB', 0, -item.radius - 12);
          } else {
            // Render Fruit 🍉
            ctx.shadowBlur = 20;
            ctx.shadowColor = item.color;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = `${item.radius * 1.3}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.emoji, 0, 0);

            // Fruit Name Label
            ctx.fillStyle = item.color;
            ctx.font = '900 10px Orbitron, sans-serif';
            ctx.shadowBlur = 8;
            ctx.shadowColor = item.color;
            ctx.fillText(item.name, 0, -item.radius - 10);
          }

          ctx.restore();

          // Remove item if fallen way past bottom
          if (item.y > canvas.height + 80) {
            itemsRef.current.splice(idx, 1);
          }
        }
      });

      // 3. Render Sliced Halves Gravity Physics
      slicedHalvesRef.current.forEach((half, idx) => {
        half.x += half.vx;
        half.y += half.vy;
        half.vy += 0.38; // Gravity
        half.rotation += half.vRot;
        half.alpha -= 0.015;

        ctx.save();
        ctx.translate(half.x, half.y);
        ctx.rotate(half.rotation);
        ctx.globalAlpha = Math.max(0, half.alpha);
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(half.emoji, 0, 0);
        ctx.restore();

        if (half.alpha <= 0 || half.y > canvas.height + 60) {
          slicedHalvesRef.current.splice(idx, 1);
        }
      });

      // 4. Render Juice Particles
      juiceParticlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= p.decay;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.alpha <= 0) juiceParticlesRef.current.splice(idx, 1);
      });

      // 5. Render Glowing Blade Slash Trails
      sliceTrailsRef.current.forEach((trail, idx) => {
        ctx.save();
        ctx.strokeStyle = `rgba(6, 182, 212, ${trail.alpha})`;
        ctx.lineWidth = 10 * trail.alpha;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#06B6D4';
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, 25 * (1 - trail.alpha + 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        trail.alpha -= 0.12;
        if (trail.alpha <= 0) sliceTrailsRef.current.splice(idx, 1);
      });

      // 6. Render Floating Score Popups
      scorePopupsRef.current.forEach((popup, idx) => {
        popup.y -= 1.8;
        popup.alpha -= 0.02;

        ctx.save();
        ctx.fillStyle = popup.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = popup.color;
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.font = '900 20px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();

        if (popup.alpha <= 0) scorePopupsRef.current.splice(idx, 1);
      });

      // 7. Draw Player Hand Blade Pointer
      ctx.save();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00F0FF';

      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Blade Reticle Cross
      ctx.beginPath();
      ctx.moveTo(cx - 32, cy); ctx.lineTo(cx - 14, cy);
      ctx.moveTo(cx + 14, cy); ctx.lineTo(cx + 32, cy);
      ctx.moveTo(cx, cy - 32); ctx.lineTo(cx, cy - 14);
      ctx.moveTo(cx, cy + 14); ctx.lineTo(cx, cy + 32);
      ctx.stroke();

      ctx.fillStyle = '#00F0FF';
      ctx.font = '900 10px Orbitron, sans-serif';
      ctx.fillText('HAND KATANA BLADE', cx + 28, cy + 4);

      ctx.restore();
      ctx.restore(); // Restore shake

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [aimPos, gameState]);

  // Mouse move updates hand blade pointer
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width;
      const normY = (e.clientY - rect.top) / rect.height;
      mouseAimRef.current = { x: normX, y: normY, isMouseActive: true };
    }
  };

  // Canvas Click fallback slice
  const handleCanvasClick = (e) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;
      processSliceAction(clickX - 25, clickY - 25, clickX + 25, clickY + 25, true);
    }
  };

  return (
    <div className="game-canvas-wrapper relative w-full h-full">
      {banner && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-400 text-slate-950 font-orbitron font-extrabold px-6 py-2 rounded-full shadow-2xl z-30 text-xs border-2 border-amber-900 animate-pulse">
          {banner}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={1024}
        height={640}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        className="w-full h-full bg-stone-900 rounded-xl cursor-crosshair shadow-2xl border-2 border-amber-500/40"
      />
    </div>
  );
}
